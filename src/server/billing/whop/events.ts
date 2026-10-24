import { plannedReturning, isPlanned } from '@/server/db/d1/plan';
import { isD1 } from '@/server/db/d1/client';
import { z } from 'zod';
import { unwrapWebhook } from '@whop/sdk/helpers';
import type { Whop } from '@whop/sdk';
import { type DbClient,withTransaction } from '@/server/db';
import { grantCredits } from '../credits';
import { getWhop,whopSettings } from './client';
import { whopEnvironment } from './settings';
import { whopOffers } from './catalog';

export const whopEvents=['payment.succeeded','payment.failed','payment.requires_action','payment.canceled','membership.activated','membership.deactivated','membership.updated','membership.cancel_at_period_end_changed','refund.created','refund.updated','dispute.created','dispute.updated'] as const;
const envelope=z.object({id:z.string().min(1),type:z.string(),account_id:z.string(),data:z.object({id:z.string().min(1)})});
export function verifyWhopEvent(raw:string,headers:Record<string,string>) {
 const event=envelope.parse(unwrapWebhook(raw,{headers,key:process.env.WHOP_WEBHOOK_SECRET}));
 if(event.account_id!==process.env.WHOP_ACCOUNT_ID || event.id!==headers['webhook-id'])throw new Error('Wrong webhook account or ID');
 return event;
}
export async function receiveWhopEvent(db:DbClient,raw:string,headers:Record<string,string>) {
 const event=verifyWhopEvent(raw,headers);
 if(!whopEvents.some(t=>t===event.type))return;
 await db.query('insert into app.whop_event_inbox(id,environment,type,resource_id) values($1,$2,$3,$4) on conflict(id) do nothing',[event.id,whopEnvironment(),event.type,event.data.id]);
}
type Intent={id:string;user_id:string;plan_id:string;kind:string;code:string;configuration_id:string|null};
export async function syncMembership(tx:DbClient,m:Whop.Membership) {
 const {accountId,environment}=whopSettings();
 if(m.account.id!==accountId)throw new Error('Wrong membership account');
 const offer=whopOffers.find(o=>process.env[o.env]===m.plan_id && o.kind==='subscription');
 if(!offer)return;
 const existing=(await tx.query<{user_id:string}>('select user_id from app.whop_memberships where id=$1 and environment=$2',[m.id,environment])).rows[0];
 const checkoutId=typeof m.metadata.checkout_id==='string'?m.metadata.checkout_id:null;
 const intent=checkoutId?(await tx.query<Intent>('select * from app.whop_checkouts where id::text=$1 and environment=$2',[checkoutId,environment])).rows[0]:undefined;
 if(!existing && (!intent || intent.plan_id!==m.plan_id))throw new Error('Unbound membership');
 if(existing && intent && existing.user_id!==intent.user_id)throw new Error('Membership ownership mismatch');
 const userId=existing?.user_id??intent!.user_id;
 await tx.query(`insert into app.whop_memberships(id,user_id,environment,plan_id,code,status,period_start,period_end,cancel_at_period_end,updated_at)
 values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict(id) do update set plan_id=excluded.plan_id,code=excluded.code,status=excluded.status,period_start=excluded.period_start,period_end=excluded.period_end,cancel_at_period_end=excluded.cancel_at_period_end,updated_at=excluded.updated_at
 where app.whop_memberships.updated_at<=excluded.updated_at`,[m.id,userId,environment,m.plan_id,offer.code,m.status,m.current_period_start,m.current_period_end,m.cancel_at_period_end,m.updated_at]);
 return userId;
}
function cents(m:Whop.Money|null) {
 if(!m || m.currency!=='usd' || !/^\d+(\.\d{1,2})?$/.test(m.amount))throw new Error('Unexpected payment money');
 return Math.round(Number(m.amount)*100);
}
/** Call with freshly retrieved provider objects inside a transaction. Redirects never grant credits. */
export async function settlePayment(tx:DbClient,p:Whop.Payment,m:Whop.Membership|null) {
 const {accountId,environment}=whopSettings();
 if(p.account_id!==accountId)throw new Error('Wrong payment account');
 await tx.query("select pg_advisory_xact_lock(hashtext('whop-settlement'))");
 const offer=whopOffers.find(o=>process.env[o.env]===p.plan_id);
 if(!offer || p.product_id!==process.env.WHOP_PRODUCT_ID)throw new Error('Payment catalog mismatch');
 const previous=(await tx.query<{id:string;user_id:string;checkout_id:string|null;grant_id:string|null;revoked_credits:number;updated_at:Date}>('select * from app.whop_payments where id=$1 and environment=$2 for update',[p.id,environment])).rows[0];
 if(previous && new Date(previous.updated_at)>new Date(p.updated_at))return;
 if(p.status!=='paid'){if(m)await syncMembership(tx,m);return;}
 if(p.currency!=='usd' || cents(p.subtotal)!==offer.amount || cents(p.total)<offer.amount || p.promo_code_id || p.line_items.length!==1 || p.line_items[0].plan_id!==p.plan_id || p.line_items[0].quantity!==1)throw new Error('Payment amount or quantity mismatch');
 let intent:Intent|undefined;
 if(p.checkout_configuration_id)intent=(await tx.query<Intent>('select * from app.whop_checkouts where configuration_id=$1 and environment=$2',[p.checkout_configuration_id,environment])).rows[0];
 // Closing a fulfilled hosted link removes checkout_configuration_id from provider payments.
 // Subsequent notifications must use the binding established by the first verified payment.
 if(previous?.checkout_id){
  const saved=(await tx.query<Intent>('select * from app.whop_checkouts where id=$1 and environment=$2',[previous.checkout_id,environment])).rows[0];
  if(!saved || saved.user_id!==previous.user_id || (intent && intent.id!==saved.id))throw new Error('Payment checkout binding mismatch');
  intent=saved;
 }
 let userId=intent?.user_id;
 let start:string|null=null,end:string|null=null;
 if(offer.kind==='subscription') {
  if(!m || m.id!==p.membership_id || m.plan_id!==p.plan_id)throw new Error('Missing matching membership');
  const memberUser=await syncMembership(tx,m);
  if(userId && userId!==memberUser)throw new Error('Payment ownership mismatch');
  userId=memberUser;
  if(!previous){
   start=m.current_period_start;end=m.current_period_end;
   // Never apply a delayed historic payment to a new allowance period.
   if(!start||!end||!p.paid_at||new Date(p.paid_at)<new Date(start)||new Date(p.paid_at)>=new Date(end))throw new Error('Payment period requires review');
   if(!['subscription_create','subscription_cycle','subscription'].includes(p.billing_reason??''))throw new Error('Unsupported subscription charge');
  }
 }else if(!intent || intent.kind!=='pack' || intent.plan_id!==p.plan_id || p.billing_reason!=='one_time')throw new Error('Unbound pack payment');
 if(!userId)throw new Error('Unbound payment');
 if(intent && intent.plan_id!==p.plan_id)throw new Error('Checkout plan mismatch');
 if(!previous){
  if(isPlanned(tx) && (await tx.query('select id from app.whop_payments where environment=$1 and membership_id=$2 and period_start=$3 and period_end=$4',[environment,offer.kind==='subscription'?p.membership_id:null,start,end])).rows.length)return;
  const inserted=await plannedReturning(tx,`insert into app.whop_payments(id,user_id,environment,checkout_id,membership_id,period_start,period_end,updated_at)
   values($1,$2,$3,$4,$5,$6,$7,$8) on conflict do nothing returning id`,[p.id,userId,environment,intent?.id??null,offer.kind==='subscription'?p.membership_id:null,start,end,p.updated_at],async()=>[{id:p.id}]);
  if(!inserted.rows.length)return;
  const source=`whop_${environment}_${offer.kind}`;
  await grantCredits(tx,{userId,amount:offer.credits,source,sourceRef:p.id,expiresAt:end?new Date(end):null});
  await tx.query('update app.whop_payments set grant_id=(select id from app.credit_grants where source=$2 and source_ref=$1) where id=$1',[p.id,source]);
 }
 const refunded=p.refunded_amount?cents(p.refunded_amount):0;
 const revoke=Math.min(offer.credits,Math.ceil(offer.credits*refunded/cents(p.total)));
 if(revoke>0){
  await tx.query(`update app.credit_grants set remaining_amount=greatest(0,remaining_amount-$2),expires_at=case when $3 then now() else expires_at end
   where id=(select grant_id from app.whop_payments where id=$1)`,[p.id,Math.max(0,revoke-(previous?.revoked_credits??0)),revoke===offer.credits]);
 }
 await tx.query('update app.whop_payments set revoked_credits=greatest(revoked_credits,$2),updated_at=$3 where id=$1',[p.id,revoke,p.updated_at]);
 await tx.query("update app.whop_payments set disputed=$2 where id=$1",[p.id,['dispute_needs_response','dispute_under_review','dispute_lost','open_dispute','resolution_lost'].includes(p.substatus)]);
 if(intent)await tx.query("update app.whop_checkouts set state='completed' where id=$1",[intent.id]);
}

export async function processWhopEvents(db:DbClient) {
 if(!process.env.WHOP_API_KEY || !process.env.WHOP_ACCOUNT_ID)return;
 const environment=whopEnvironment();
 const rows=(await db.query<{id:string;type:string;resource_id:string}>(`update app.whop_event_inbox set state='processing',attempts=attempts+1,next_attempt_at=now()+interval '2 minutes'
 where id in(select id from app.whop_event_inbox where environment=$1 and state in ('pending','failed','processing') and next_attempt_at<=now() and attempts<30 order by created_at limit 10 ${isD1(db)?'':'for update skip locked'}) returning id,type,resource_id`,[environment])).rows;
 const client=getWhop();
 // Stop completed hosted links from being reused. Retry cleanup independently of fulfillment.
 const completed=(await db.query<{id:string;configuration_id:string}>("select id,configuration_id from app.whop_checkouts where environment=$1 and state='completed' and not configuration_closed and configuration_id is not null limit 10",[environment])).rows;
 for(const checkout of completed){
  try{await client.checkoutConfigurations.delete({id:checkout.configuration_id});}
  catch(error){if(!(error && typeof error==='object' && 'statusCode' in error && error.statusCode===404))continue;}
  await db.query('update app.whop_checkouts set configuration_closed=true where id=$1',[checkout.id]);
 }
 for(const row of rows){
  try{
   if(row.type.startsWith('membership.')){
    const m=await client.memberships.retrieve({id:row.resource_id});
    await withTransaction(db,tx=>syncMembership(tx,m));
   }else{
    let paymentId=row.resource_id;let dispute:Whop.Dispute|undefined;
    if(row.type.startsWith('refund.'))paymentId=(await client.refunds.retrieve({id:row.resource_id})).payment_id;
    if(row.type.startsWith('dispute.')){dispute=await client.disputes.retrieve({id:row.resource_id});paymentId=dispute.payment.id;}
    const payment=await client.payments.retrieve({id:paymentId});
    const member=payment.membership_id?await client.memberships.retrieve({id:payment.membership_id}):null;
    await withTransaction(db,async tx=>{
     await settlePayment(tx,payment,member);
     if(dispute){
      if(dispute.account_id!==process.env.WHOP_ACCOUNT_ID)throw new Error('Wrong dispute account');
      await tx.query('update app.whop_payments set disputed=$2 where id=$1',[payment.id,!['won','closed'].includes(dispute.status)]);
     }
    });
   }
   await db.query("update app.whop_event_inbox set state='done' where id=$1",[row.id]);
  }catch{
   // Keep provider/customer details out of logs; durable event ID supports dashboard investigation.
   console.error('Whop event requires retry or review',{eventId:row.id,type:row.type});
   await db.query("update app.whop_event_inbox set state='failed',next_attempt_at=now()+interval '30 seconds' where id=$1",[row.id]);
  }
 }
}
