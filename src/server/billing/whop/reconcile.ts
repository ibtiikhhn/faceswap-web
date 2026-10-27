import { createHash } from 'node:crypto';
import type { DbClient } from '@/server/db';
import { getWhop,whopSettings } from './client';

/** Bounded safety net for missed webhooks. Settlement still retrieves and validates the payment. */
export async function reconcileRecentWhopPayments(db:DbClient) {
 if(!process.env.WHOP_API_KEY || !process.env.WHOP_ACCOUNT_ID)return;
 const {environment,accountId}=whopSettings();
 const payments=await getWhop().payments.list({account_id:accountId,product_id:process.env.WHOP_PRODUCT_ID,status:'paid',first:25,order:'created_at',direction:'desc'});
 let scanned=0;
 for await(const payment of payments) {
  if(++scanned>25)break;
  if(payment.account_id!==accountId)continue;
  const bound=(await db.query(`select id from app.whop_payments where id=$1 and environment=$4
   union all select id::text from app.whop_checkouts where configuration_id=$2 and environment=$4
   union all select id from app.whop_memberships where id=$3 and environment=$4`,[payment.id,payment.checkout_configuration_id,payment.membership_id,environment])).rows.length;
  if(!bound)continue;
  const version=createHash('sha256').update(`${environment}:${payment.id}:${payment.updated_at}`).digest('hex');
  await db.query(`insert into app.whop_event_inbox(id,environment,type,resource_id) values($1,$2,'payment.succeeded',$3) on conflict(id) do nothing`,[`reconcile_${version}`,environment,payment.id]);
  if(scanned===25)break;
 }
}
