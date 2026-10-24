import {getWhop,whopSettings} from '../src/server/billing/whop/client';
import {getPool} from '../src/server/db';
import {creditBalances} from '../src/server/billing/credits';
const settings=whopSettings();if(settings.environment!=='sandbox')throw new Error('Sandbox diagnostic only');
const db=getPool();
for(const [label,sql] of Object.entries({checkouts:'select id,environment,code,state,configuration_id,configuration_closed,created_at from app.whop_checkouts order by created_at desc limit 10',inbox:'select id,type,resource_id,state,attempts,next_attempt_at,created_at from app.whop_event_inbox order by created_at desc limit 15',payments:'select id,environment,checkout_id,grant_id,revoked_credits,disputed from app.whop_payments order by updated_at desc limit 10'}))console.log(label,JSON.stringify((await db.query(sql)).rows));
const client=getWhop();
let count=0;for await(const p of await client.payments.list({account_id:settings.accountId,first:10})){console.log('provider payment',JSON.stringify({id:p.id,status:p.status,plan_id:p.plan_id,checkout_configuration_id:p.checkout_configuration_id,product_id:p.product_id,currency:p.currency,subtotal:p.subtotal,total:p.total,billing_reason:p.billing_reason,line_items:p.line_items.map(i=>({plan_id:i.plan_id,quantity:i.quantity})),membership_id:p.membership_id}));if(++count>=10)break;}
for await(const hook of await client.webhooks.list({account_id:settings.accountId,first:100})){if(hook.url.includes('swapthisface.com'))console.log('webhook',JSON.stringify({id:hook.id,url:hook.url,enabled:hook.enabled,events:hook.events}));}
for(const row of (await db.query<{user_id:string}>("select distinct user_id from app.whop_payments where environment='sandbox' limit 10")).rows)console.log('Account credit balance',JSON.stringify(await creditBalances(db,row.user_id)));
await db.end();
