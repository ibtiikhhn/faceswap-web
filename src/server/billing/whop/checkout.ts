import { getPool,withTransaction } from '@/server/db';
import { HttpError } from '@/server/http';
import { getWhop } from './client';
import { requireWhop,safeWhopUrl } from './settings';
import { whopOffers,whopPlanInput } from './catalog';

export async function createWhopCheckout(userId:string,code:string,kind:'subscription'|'pack') {
 const {environment,accountId}=requireWhop();
 const offer=whopOffers.find(o=>o.code===code && o.kind===kind);
 if(!offer)throw new HttpError(400,'Choose a valid offer.','invalid_offer');
 const planId=process.env[offer.env];const productId=process.env.WHOP_PRODUCT_ID;
 if(!planId||!productId)throw new HttpError(503,'This offer is not configured.');
 const client=getWhop();const plan=await client.plans.retrieve({id:planId});
 const desired=whopPlanInput(offer,accountId,productId);
 if(plan.account?.id!==accountId || plan.product?.id!==productId || plan.currency!=='usd' || plan.plan_type!==desired.plan_type || plan.initial_price!==desired.initial_price || plan.renewal_price!==desired.renewal_price || plan.billing_period!==desired.billing_period || plan.trial_period_days || plan.expiration_days || plan.split_pay_required_payments || plan.adaptive_pricing_enabled)throw new HttpError(503,'This offer needs configuration review.');
 const pool=getPool();
 const intent=await withTransaction(pool,async tx=>{
  await tx.query('select id from app.users where id=$1 for update',[userId]);
  if(kind==='subscription' && (await tx.query("select id from app.whop_memberships where user_id=$1 and environment=$2 and (status in ('active','trialing','past_due') or period_end>now())",[userId,environment])).rows.length)throw new HttpError(409,'Manage your existing subscription from your billing page.','subscription_exists');
  const existing=(await tx.query<{id:string;code:string;purchase_url:string|null}>("select * from app.whop_checkouts where user_id=$1 and environment=$2 and state in ('creating','ready')",[userId,environment])).rows[0];
  if(existing){
   if(existing.code!==code)throw new HttpError(409,'A checkout is already pending. Finish that checkout or contact support before choosing another offer.','checkout_pending');
   return existing;
  }
  return (await tx.query<{id:string;code:string;purchase_url:string|null}>('insert into app.whop_checkouts(user_id,environment,code,kind,plan_id) values($1,$2,$3,$4,$5) returning *',[userId,environment,code,kind,planId])).rows[0];
 });
 if(intent.purchase_url)return {url:safeWhopUrl(intent.purchase_url)};
 // A retry after a timeout uses the same provider idempotency key, never a second purchase intent.
 const configuration=await client.checkoutConfigurations.create({account_id:accountId,plan_id:planId,mode:'payment',metadata:{checkout_id:intent.id},redirect_url:`${new URL(process.env.APP_URL??'http://localhost:3000').origin}/dashboard/billing?checkout=success&transaction=${intent.id}`},{idempotencyKey:`swapthisface:${environment}:${intent.id}`});
 const url=safeWhopUrl(configuration.purchase_url);
 await pool.query("update app.whop_checkouts set configuration_id=$2,purchase_url=$3,state='ready' where id=$1 and state='creating'",[intent.id,configuration.id,url]);
 return {url};
}
