import { NextRequest } from 'next/server';
import { requireUser } from '@/server/auth';
import { getPool } from '@/server/db';
import { HttpError } from '@/server/http';
import { billingErrorResponse, json } from '@/server/billing/http';
import { requirePaddle } from '@/server/billing/paddle/api';
export async function GET(request: NextRequest) {
 try {
  const settings=requirePaddle();
  const userId=await requireUser(request);
  const id=request.nextUrl.searchParams.get('id');
  if(!id || !/^txn_[a-z0-9]{26}$/.test(id)) throw new HttpError(400,'Invalid checkout.');
  const result=await getPool().query<{state:string}>('select state from app.paddle_checkouts where transaction_id=$1 and user_id=$2 and environment=$3',[id,userId,settings.PADDLE_ENVIRONMENT]);
  if(!result.rows[0]) throw new HttpError(404,'Checkout not found.');
  return json({transactionId:id,state:result.rows[0].state,token:settings.PADDLE_CLIENT_TOKEN,environment:settings.PADDLE_ENVIRONMENT});
 }catch(e){return billingErrorResponse(e);}
}
