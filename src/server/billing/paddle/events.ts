import { z } from 'zod';
import { type DbClient, withTransaction } from '@/server/db';
import { grantCredits } from '../credits';
import { offers } from './catalog';
import { getPaddle, paddleEnvironment, paddleCustomerColumn } from './api';
import { env } from '@/server/env';

const period=z.object({starts_at:z.string().datetime({offset:true}),ends_at:z.string().datetime({offset:true})});
const item=z.object({price:z.object({id:z.string()}),quantity:z.number().int(),proration:z.unknown().optional()});
const dataSchema=z.object({id:z.string(),status:z.string(),customer_id:z.string().nullable().optional(),subscription_id:z.string().nullable().optional(),origin:z.string().optional(),billing_period:period.nullable().optional(),current_billing_period:period.nullable().optional(),scheduled_change:z.object({action:z.string()}).nullable().optional(),transaction_id:z.string().optional(),action:z.string().optional(),type:z.string().optional()}).passthrough();
export const eventSchema=z.object({event_id:z.string().min(1),event_type:z.string(),occurred_at:z.string().datetime({offset:true}),data:dataSchema});
type Event=z.infer<typeof eventSchema>;

export async function receivePaddleEvent(client:DbClient,raw:string,signature:string){
 const secret=env().PADDLE_WEBHOOK_SECRET;
 if(!secret || !signature)throw new Error('Webhook not configured or unsigned');
 await getPaddle().webhooks.unmarshal(raw,secret,signature);
 const event=eventSchema.parse(JSON.parse(raw));
 await client.query('insert into app.paddle_event_inbox(id,type,occurred_at,payload,environment) values($1,$2,$3,$4::jsonb,$5) on conflict(id) do nothing',[event.event_id,event.event_type,event.occurred_at,JSON.stringify(event),paddleEnvironment()]);
}

export async function applyPaddleEvent(tx:DbClient,event:Event){
 await tx.query("select pg_advisory_xact_lock(hashtext('app.paddle.settlement'))");
 const d=event.data;
 if(event.event_type.startsWith('adjustment.')){
  if(!d.transaction_id || !d.action)throw new Error('Invalid adjustment');
  await tx.query(`insert into app.paddle_adjustments(id,transaction_id,action,status,type,occurred_at,payload,needs_review)
   values($1,$2,$3,$4,$5,$6,$7::jsonb,$8) on conflict(id) do update set status=excluded.status,occurred_at=excluded.occurred_at,payload=excluded.payload,needs_review=excluded.needs_review where app.paddle_adjustments.occurred_at < excluded.occurred_at`,[d.id,d.transaction_id,d.action,d.status,d.type??null,event.occurred_at,JSON.stringify(d),d.type!=='full'||d.action.includes('reverse')]);
  // Only confirmed full refunds/chargebacks revoke automatically. Partial/reversed adjustments need review.
  await tx.query(`update app.credit_grants set remaining_amount=0,expires_at=now() where id in
   (select t.grant_id from app.paddle_transactions t join app.paddle_adjustments a on a.transaction_id=t.id
    where a.id=$1 and a.status='approved' and a.type='full' and a.action in ('refund','chargeback'))`,[d.id]);
  return;
 }
 const items = event.event_type.startsWith('subscription.') || event.event_type==='transaction.completed' ? z.array(item).parse(d.items) : [];
 if(event.event_type.startsWith('subscription.')){
  if(!d.customer_id)throw new Error('Subscription customer missing');
  const user=(await tx.query<{id:string}>(`select id from app.users where ${paddleCustomerColumn()}=$1`,[d.customer_id])).rows[0];
  if(!user)return;
  const offer=offers.find(o=>o.kind==='subscription' && process.env[o.priceEnv]===items[0]?.price.id);
  if(!offer || items.length!==1 || items[0].quantity!==1)throw new Error('Subscription catalog mismatch');
  if(!['active','trialing','past_due','canceled','paused'].includes(d.status))throw new Error('Unknown subscription status');
  await tx.query(`insert into app.subscriptions(paddle_environment,user_id,paddle_subscription_id,paddle_customer_id,paddle_price_id,plan_code,status,current_period_start,current_period_end,cancel_at_period_end,latest_paddle_event_at,raw)
   values($12,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
   on conflict(paddle_subscription_id) do update set status=excluded.status,paddle_price_id=excluded.paddle_price_id,plan_code=excluded.plan_code,current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,cancel_at_period_end=excluded.cancel_at_period_end,latest_paddle_event_at=excluded.latest_paddle_event_at,raw=excluded.raw,updated_at=now()
   where app.subscriptions.latest_paddle_event_at is null or app.subscriptions.latest_paddle_event_at < excluded.latest_paddle_event_at`,[user.id,d.id,d.customer_id,items[0].price.id,offer.code,d.status,d.current_billing_period?.starts_at??null,d.current_billing_period?.ends_at??null,d.scheduled_change?.action==='cancel',event.occurred_at,JSON.stringify(d),paddleEnvironment()]);
  return;
 }
 if(event.event_type!=='transaction.completed')return;
 if(d.status!=='completed' || !d.customer_id)throw new Error('Payment incomplete');
 const prior=await tx.query('select id from app.paddle_transactions where id=$1',[d.id]);
 if(prior.rows.length)return;
 const checkout=(await tx.query<{user_id:string;price_id:string;credits:number;kind:string;code:string}>('select * from app.paddle_checkouts where transaction_id=$1 and environment=$2',[d.id,paddleEnvironment()])).rows[0];
 const subscription=d.subscription_id?(await tx.query<{user_id:string;paddle_price_id:string;current_period_start:Date|string|null;current_period_end:Date|string|null}>('select user_id,paddle_price_id,current_period_start,current_period_end from app.subscriptions where paddle_subscription_id=$1 and paddle_environment=$2',[d.subscription_id,paddleEnvironment()])).rows[0]:undefined;
 if(!checkout && d.origin!=='subscription_recurring')throw new Error('Unbound transaction requires review');
 const userId=checkout?.user_id??subscription?.user_id;
 if(!userId)throw new Error('Waiting for subscription or checkout binding');
 const owner=(await tx.query<{paddle_customer_id:string}>(`select ${paddleCustomerColumn()} as paddle_customer_id from app.users where id=$1`,[userId])).rows[0];
 if(owner?.paddle_customer_id!==d.customer_id)throw new Error('Customer mismatch');
 const offer=offers.find(o=>process.env[o.priceEnv]===items[0]?.price.id);
 if(!offer || items.length!==1 || items[0].quantity!==1 || items[0].proration)throw new Error('Transaction catalog mismatch');
 if(checkout && (checkout.price_id!==items[0].price.id || checkout.code!==offer.code || checkout.kind!==offer.kind))throw new Error('Checkout mismatch');
 if(!checkout && (offer.kind!=='subscription' || subscription?.paddle_price_id!==items[0].price.id))throw new Error('Renewal mismatch');
 let paidPeriod=d.billing_period;
 // Initial transactions may omit billing_period. Use the mirrored period only
 // when it contains this payment's occurrence, never a newer renewal period.
 if(!paidPeriod && checkout && offer.kind==='subscription' && subscription?.current_period_start && subscription.current_period_end){
  const starts=new Date(subscription.current_period_start),ends=new Date(subscription.current_period_end),occurred=Date.parse(event.occurred_at);
  if(starts.getTime()<=occurred && occurred<ends.getTime())paidPeriod={starts_at:starts.toISOString(),ends_at:ends.toISOString()};
 }
 if(offer.kind==='subscription' && (!d.subscription_id || !paidPeriod || Date.parse(paidPeriod.ends_at)<=Date.parse(paidPeriod.starts_at)))throw new Error('Paid billing period missing');
 const inserted=await tx.query(`insert into app.paddle_transactions(id,user_id,subscription_id,period_start,period_end,environment) values($1,$2,$3,$4,$5,$6) on conflict do nothing returning id`,[d.id,userId,d.subscription_id??null,paidPeriod?.starts_at??null,paidPeriod?.ends_at??null,paddleEnvironment()]);
 if(!inserted.rows.length)return;
 const revoked=(await tx.query("select id from app.paddle_adjustments where transaction_id=$1 and status='approved' and type='full' and action in ('refund','chargeback')",[d.id])).rows.length>0;
 if(!revoked){
  const prefix=paddleEnvironment()==='sandbox'?'paddle_sandbox':'paddle';
  const source=offer.kind==='pack'?`${prefix}_pack`:`${prefix}_subscription`;
  await grantCredits(tx,{userId,amount:checkout?.credits??offer.credits,source,sourceRef:d.id,expiresAt:offer.kind==='subscription'?new Date(paidPeriod!.ends_at):null});
  await tx.query('update app.paddle_transactions set grant_id=(select id from app.credit_grants where source=$2 and source_ref=$1) where id=$1',[d.id,source]);
 }
 if(offer.kind==='subscription'){
  // Do not infer active status from a delayed payment event. Subscription webhooks control access.
  if(!subscription)throw new Error('Waiting for subscription state');
  await tx.query(`update app.subscriptions set paid_current_period_start=$2,paid_current_period_end=$3,latest_paid_transaction_id=$4 where paddle_subscription_id=$1 and (paid_current_period_end is null or paid_current_period_end < $3::timestamptz)`,[d.subscription_id,paidPeriod!.starts_at,paidPeriod!.ends_at,d.id]);
 }
 await tx.query("update app.paddle_checkouts set state='completed' where transaction_id=$1",[d.id]);
}

export async function processPaddleEvents(client:DbClient,limit=25){
 for(let i=0;i<limit;i++){
  const processed=await withTransaction(client,async tx=>{
   const row=(await tx.query<{id:string;payload:unknown}>("select id,payload from app.paddle_event_inbox where environment=$1 and state in ('pending','failed') and attempts<20 and next_attempt_at<=now() order by received_at for update skip locked limit 1",[paddleEnvironment()])).rows[0];
   if(!row)return false;
   await tx.query('savepoint paddle_event');
   try{
    await applyPaddleEvent(tx,eventSchema.parse(row.payload));
    await tx.query("update app.paddle_event_inbox set state='processed',processed_at=now(),last_error=null where id=$1",[row.id]);
   }catch{
    await tx.query('rollback to savepoint paddle_event');
    await tx.query("update app.paddle_event_inbox set state='failed',attempts=attempts+1,next_attempt_at=now()+least(3600,power(2,attempts+1)::integer)*interval '1 second',last_error='Processing failed; inspect binding, catalog, or event schema.' where id=$1",[row.id]);
   }
   return true;
  });
  if(!processed)break;
 }
}
