import { NextRequest } from 'next/server';
import { requireUser } from '@/server/auth';
import { getPool } from '@/server/db';
import { assertOrigin, HttpError } from '@/server/http';
import { billingErrorResponse, json } from '@/server/billing/http';
import { getPaddle, requirePaddle, paddleCustomerColumn, paddleEnvironment } from '@/server/billing/paddle/api';
export async function POST(request:NextRequest){
 try{
  requirePaddle();assertOrigin(request);
  const userId=await requireUser(request);
  const pool=getPool();
  const row=(await pool.query<{id:string;transaction_id:string|null}>("select id,transaction_id from app.paddle_checkouts where user_id=$1 and environment=$2 and state='ready'",[userId,paddleEnvironment()])).rows[0];
  if(!row?.transaction_id)throw new HttpError(409,'No checkout is ready to cancel.');
  const paddle=getPaddle();
  const transaction=await paddle.transactions.get(row.transaction_id);
  if(transaction.status!=='canceled'){
   if(!['draft','ready'].includes(transaction.status))throw new HttpError(409,'Payment is already processing. Wait for confirmation before starting another checkout.');
   await paddle.transactions.update(row.transaction_id,{status:'canceled'});
  }
  await pool.query("update app.paddle_checkouts set state='canceled' where id=$1 and state='ready'",[row.id]);
  return json({canceled:true});
 }catch(e){return billingErrorResponse(e);}
}
