import { ApiError, type Paddle, type Transaction } from '@paddle/paddle-node-sdk';
import type { DbClient } from '@/server/db';
import { HttpError } from '@/server/http';
import { paddleCustomerColumn, paddleEnvironment } from './api';

export function providerErrorCode(error:unknown) {
 return error instanceof ApiError && /^[a-z0-9_]{1,100}$/.test(error.code) ? error.code : undefined;
}
export function checkoutFailureState(error:unknown,stage:'customer'|'transaction'|'persist') {
 // Before the transaction request there cannot be a payment transaction.
 // An explicit request rejection is also safe; timeouts/5xx remain uncertain.
 return stage==='customer' || (stage==='transaction' && error instanceof ApiError && error.type==='request_error') ? 'canceled' : 'review';
}
export async function recoverPaddleCheckout(db:DbClient,paddle:Pick<Paddle,'transactions'>,userId:string){
 const row=(await db.query<{id:string;price_id:string;created_at:Date|string}>("select id,price_id,created_at from app.paddle_checkouts where user_id=$1 and environment=$2 and state='review' and created_at < now()-interval '1 minute'",[userId,paddleEnvironment()])).rows[0];
 if(!row)return;
 const customer=(await db.query<{customer_id:string|null}>(`select ${paddleCustomerColumn()} as customer_id from app.users where id=$1`,[userId])).rows[0]?.customer_id;
 let found:Transaction|undefined;
 if(customer){
  const pages=paddle.transactions.list({customerId:[customer],perPage:30});
  let pageCount=0;
  while(pages.hasMore){
   if(++pageCount>20)throw new HttpError(409,'This pending checkout needs support review.','checkout_review');
   for(const transaction of await pages.next()){
    if(transaction.customData?.checkout_id!==row.id)continue;
    if(found || transaction.customerId!==customer || transaction.items.length!==1 || transaction.items[0].price?.id!==row.price_id || transaction.items[0].quantity!==1)throw new HttpError(409,'This pending checkout needs support review.','checkout_review');
    found=transaction;
   }
  }
 }
 if(!found || found.status==='canceled'){
  await db.query("update app.paddle_checkouts set state='canceled' where id=$1 and state='review'",[row.id]);
  return;
 }
 // Preserve a successful remote creation whose response was lost. Never create
 // another transaction until this one is paid, completed, or canceled.
 await db.query("update app.paddle_checkouts set transaction_id=$2,state='ready' where id=$1 and state='review'",[row.id,found.id]);
 if(!['draft','ready'].includes(found.status))throw new HttpError(409,'Your payment is processing. Check your billing page before trying again.','payment_processing');
}
