import { z } from 'zod';
import { getPool, withTransaction } from '@/server/db';
import { HttpError } from '@/server/http';
import { getPaddle, requirePaddle, paddleCustomerColumn } from './api';
import { offers } from './catalog';

const inputSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('cancel')}),
 z.object({action:z.literal('preview'),planCode:z.literal('monthly')}),
 z.object({action:z.literal('upgrade'),planCode:z.literal('monthly'),updatedAt:z.string(),maxDueNow:z.string().regex(/^\d+$/).max(14),currency:z.string().length(3)})
]);
export async function managePaddleSubscription(userId:string,body:unknown){
 const parsed=inputSchema.safeParse(body);
 if(!parsed.success)throw new HttpError(400,'Choose a valid subscription action.');
 const input=parsed.data;const settings=requirePaddle();const paddle=getPaddle();
 return withTransaction(getPool(),async tx=>{
  // Serialize this user's actions, including repeated confirmation clicks.
  await tx.query('select id from app.users where id=$1 for update',[userId]);
  const row=(await tx.query<{paddle_subscription_id:string;customer_id:string}>(`select s.paddle_subscription_id,u.${paddleCustomerColumn()} as customer_id from app.subscriptions s join app.users u on u.id=s.user_id where s.user_id=$1 and s.paddle_environment=$2 and s.status in ('active','trialing','past_due','paused') order by s.updated_at desc limit 1`,[userId,settings.PADDLE_ENVIRONMENT])).rows[0];
  if(!row?.paddle_subscription_id||!row.customer_id)throw new HttpError(404,'No manageable subscription found.');
  const subscription=await paddle.subscriptions.get(row.paddle_subscription_id);
  if(subscription.customerId!==row.customer_id)throw new HttpError(403,'Subscription ownership could not be verified.');
  if(input.action==='cancel'){
   if(subscription.scheduledChange?.action==='cancel')return {endsAt:subscription.scheduledChange.effectiveAt};
   const canceled=await paddle.subscriptions.cancel(subscription.id,{effectiveFrom:'next_billing_period'});
   return {endsAt:canceled.scheduledChange?.effectiveAt??canceled.currentBillingPeriod?.endsAt??null};
  }
  if(subscription.status!=='active'||subscription.scheduledChange||subscription.collectionMode!=='automatic')throw new HttpError(409,'Resolve pending changes or payments before upgrading.');
  const current=offers.find(o=>o.kind==='subscription'&&process.env[o.priceEnv]===subscription.items[0]?.price.id);
  if(subscription.items.length!==1||subscription.items[0].quantity!==1||current?.code!=='weekly')throw new HttpError(409,'This subscription is no longer on Weekly. Refresh your billing page.');
  const offer=offers.find(o=>o.code==='monthly')!;const priceId=process.env[offer.priceEnv];
  if(!priceId)throw new HttpError(503,'Monthly billing is not configured.');
  const price=await paddle.prices.get(priceId);
  if(price.status!=='active'||price.unitPrice.amount!==String(offer.amount)||price.unitPrice.currencyCode!=='USD'||price.billingCycle?.interval!=='month'||price.billingCycle.frequency!==1||price.trialPeriod)throw new HttpError(503,'Monthly billing needs configuration review.');
  const change={items:[{priceId,quantity:1}],prorationBillingMode:'prorated_immediately' as const,onPaymentFailure:'prevent_change' as const};
  const preview=await paddle.subscriptions.previewUpdate(subscription.id,change);
  const result=preview.updateSummary?.result;
  const recurring=preview.recurringTransactionDetails?.totals.total;
  if(!result||recurring==null)throw new HttpError(503,'Could not calculate your upgrade. Please try again.');
  const quote={updatedAt:subscription.updatedAt,dueNow:result.action==='charge'?result.amount:'0',recurring,currency:preview.currencyCode,nextBilledAt:preview.nextBilledAt};
  if(input.action==='preview')return quote;
  if(input.updatedAt!==subscription.updatedAt||input.currency!==quote.currency||BigInt(quote.dueNow)>BigInt(input.maxDueNow))throw new HttpError(409,'Your quote changed. Close this dialog and preview the upgrade again.');
  await paddle.subscriptions.update(subscription.id,change);
  // No credit grants here. Verified transaction.completed events settle the payment.
  return {submitted:true};
 });
}
