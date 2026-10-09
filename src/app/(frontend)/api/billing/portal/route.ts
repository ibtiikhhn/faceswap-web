import { NextRequest } from 'next/server';
import { requireUser } from '@/server/auth';
import { getPool } from '@/server/db';
import { assertOrigin, HttpError } from '@/server/http';
import { billingErrorResponse, json } from '@/server/billing/http';
import { getPaddle, requirePaddle, paddleCustomerColumn, paddleEnvironment } from '@/server/billing/paddle/api';
export const runtime='nodejs';
export async function POST(request:NextRequest){
 try{
  requirePaddle();assertOrigin(request);
  const userId=await requireUser(request);
  const user=(await getPool().query<{paddle_customer_id:string|null}>(`select ${paddleCustomerColumn()} as paddle_customer_id from app.users where id=$1`,[userId])).rows[0];
  if(!user?.paddle_customer_id)throw new HttpError(404,'No billing account exists yet.');
  const session=await getPaddle().customerPortalSessions.create(user.paddle_customer_id,[]);
  return json({url:session.urls.general.overview});
 }catch(e){return billingErrorResponse(e);}
}
