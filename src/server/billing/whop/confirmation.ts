import type { DbClient } from '@/server/db';
import { whopEnvironment } from './settings';

/** Ownership and environment checks apply to every confirmation, including old return URLs. */
export async function whopConfirmation(db:DbClient,id:string,userId:string) {
 const checkout=(await db.query<{state:string}>(
  'select state from app.whop_checkouts where id::text=$1 and user_id=$2 and environment=$3',
  [id,userId,whopEnvironment()],
 )).rows[0];
 if(!checkout)return null;
 if(checkout.state!=='completed')return checkout;
 const payments=(await db.query<{revoked_credits:number;disputed:boolean;original_amount:number}>(
  `select p.revoked_credits,g.original_amount,
   (p.disputed or exists(select 1 from app.whop_disputes d where d.payment_id=p.id and d.environment=p.environment and d.status not in ('won','warning_closed'))) as disputed
   from app.whop_payments p join app.credit_grants g on g.id=p.grant_id
   where p.checkout_id=$1 and p.user_id=$2 and p.environment=$3`,[id,userId,whopEnvironment()],
 )).rows;
 // A completed intent alone is not proof of an available grant.
 if(!payments.length)return {state:'processing'};
 if(payments.some(p=>p.disputed))return {state:'disputed'};
 if(payments.every(p=>Number(p.revoked_credits)>=Number(p.original_amount)))return {state:'refunded'};
 if(payments.some(p=>Number(p.revoked_credits)>0))return {state:'partially_refunded'};
 return {state:'completed'};
}
