import { getPool,withTransaction } from '@/server/db';
import { HttpError } from '@/server/http';
import { getWhop,whopSettings } from './client';
import { safeWhopUrl } from './settings';
import { syncMembership } from './events';
export async function whopMembership(userId:string) {
 const {environment,accountId}=whopSettings();
 const row=(await getPool().query<{id:string}>("select id from app.whop_memberships where user_id=$1 and environment=$2 order by (status in ('active','trialing','past_due')) desc,updated_at desc limit 1",[userId,environment])).rows[0];
 if(!row)throw new HttpError(404,'No subscription exists yet. Credit-pack receipts are available in your Whop account.');
 const membership=await getWhop().memberships.retrieve({id:row.id});
 if(membership.account.id!==accountId)throw new HttpError(403,'Billing account mismatch.');
 return membership;
}
export async function whopPortal(userId:string){
 try{return {url:safeWhopUrl((await whopMembership(userId)).manage_url)};}
 catch(error){
  if(error instanceof HttpError && error.status===404){
   const {environment}=whopSettings();
   return {url:`https://${environment==='sandbox'?'sandbox.whop.com':'whop.com'}/@me/settings/orders/`};
  }
  throw error;
 }
}
export async function manageWhopSubscription(userId:string,body:unknown){
 if(!body || typeof body!=='object' || !('action' in body) || body.action!=='cancel')throw new HttpError(400,'To switch plans, cancel renewal and choose your next plan after the paid period ends.');
 const membership=await whopMembership(userId);
 const updated=await getWhop().memberships.cancel({id:membership.id,cancel_at_period_end:true});
 await withTransaction(getPool(),tx=>syncMembership(tx,updated));
 return {endsAt:updated.current_period_end};
}
