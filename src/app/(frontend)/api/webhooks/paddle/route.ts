import { getPool } from '@/server/db';
import { boundedBody } from '@/server/http';
import { receivePaddleEvent } from '@/server/billing/paddle/events';
export const runtime='nodejs';
export async function POST(request:Request){
 try{
  const raw=new TextDecoder().decode(await boundedBody(request,1_000_000));
  await receivePaddleEvent(getPool(),raw,request.headers.get('paddle-signature')??'');
  return Response.json({received:true});
 }catch{return Response.json({error:'Webhook could not be accepted.'},{status:400});}
}
