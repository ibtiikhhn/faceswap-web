// Recover a confirmed sandbox payment through the normal durable worker inbox.
// Never grants credits directly or clears an unpaid checkout.
import {createHmac,randomUUID} from 'node:crypto';
import {getWhop,whopSettings} from '../src/server/billing/whop/client';
import {getPool} from '../src/server/db';
const settings=whopSettings();
if(settings.environment!=='sandbox')throw new Error('Sandbox recovery only');
const paymentId=process.argv[2];
if(!/^pay_[A-Za-z0-9]+$/.test(paymentId??''))throw new Error('Pass the confirmed sandbox payment ID');
const client=getWhop(),db=getPool();
const payment=await client.payments.retrieve({id:paymentId});
if(payment.account_id!==settings.accountId||payment.status!=='paid'||!payment.checkout_configuration_id)throw new Error('Expected a paid checkout belonging to this sandbox account');
const intent=(await db.query<{id:string;plan_id:string}>('select id,plan_id from app.whop_checkouts where configuration_id=$1 and environment=$2',[payment.checkout_configuration_id,'sandbox'])).rows[0];
if(!intent||intent.plan_id!==payment.plan_id)throw new Error('No matching application checkout');
const url='https://swapthisface.com/api/webhooks/whop';
const secret=process.env.WHOP_WEBHOOK_SECRET;
if(!secret)throw new Error('Webhook signing secret required');
// An ignored event confirms the deployed verifier has the expected account and secret.
const id=`recovery_probe_${randomUUID()}`,timestamp=String(Math.floor(Date.now()/1000));
const raw=JSON.stringify({id,type:'integration.healthcheck',account_id:settings.accountId,data:{id:paymentId}});
const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','webhook-id':id,'webhook-timestamp':timestamp,'webhook-signature':'v1,'+createHmac('sha256',secret).update(`${id}.${timestamp}.${raw}`).digest('base64')},body:raw});
if(response.status!==200)throw new Error(`Deployed webhook verification failed (${response.status}); check Railway webhook variables before recovery.`);
console.log('Deployed webhook signature/account verification passed.');
let enabled=false;
for await(const hook of await client.webhooks.list({account_id:settings.accountId,first:100})){
 if(hook.url!==url)continue;
 if(!hook.enabled)await client.webhooks.update({id:hook.id,enabled:true});
 if(!(await client.webhooks.retrieve({id:hook.id})).enabled)throw new Error('Webhook could not be enabled');
 enabled=true;console.log('Sandbox webhook enabled and verified.');break;
}
if(!enabled)throw new Error('Sandbox webhook missing');
await db.query("insert into app.whop_event_inbox(id,environment,type,resource_id) values($1,'sandbox','payment.succeeded',$2) on conflict(id) do nothing",[`reconcile_sandbox_${paymentId}`,paymentId]);
console.log('Confirmed payment queued for normal worker settlement.');
await db.end();
