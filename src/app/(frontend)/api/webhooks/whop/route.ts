import { getPool } from '@/server/db';
import { boundedBody } from '@/server/http';
import { receiveWhopEvent,verifyWhopEvent } from '@/server/billing/whop/events';
export const runtime='nodejs';
export async function POST(request:Request){
 if(!process.env.WHOP_WEBHOOK_SECRET)return new Response('Webhook not configured',{status:503});
 let raw:string;const headers=Object.fromEntries(request.headers);
 try{raw=new TextDecoder().decode(await boundedBody(request,1024*1024));verifyWhopEvent(raw,headers);}catch{return new Response('Invalid webhook',{status:400});}
 try{await receiveWhopEvent(getPool(),raw,headers);return new Response('OK');}catch{return new Response('Webhook storage unavailable',{status:503});}
}
