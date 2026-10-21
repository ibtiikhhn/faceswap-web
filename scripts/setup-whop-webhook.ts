import fs from 'node:fs/promises';
import { getWhop,whopSettings } from '../src/server/billing/whop/client';
import { whopEvents } from '../src/server/billing/whop/events';
const {accountId,environment}=whopSettings();
if(environment!=='sandbox')throw new Error('This setup command is for sandbox only.');
const client=getWhop();
const url='https://swapthisface.com/api/webhooks/whop';
try{
const hooks=await client.webhooks.list({account_id:accountId,first:100});
for await(const hook of hooks){if(hook.url===url){console.log('Webhook already exists. Keep its stored signing secret; enable after deployment.');process.exit(0);}}
 const hook=await client.webhooks.create({resource_id:accountId,url,enabled:false,events:[...whopEvents],api_version_date:'2026-10-15-1'},{idempotencyKey:'swapthisface:sandbox:webhook:v1'});
 if(!hook.webhook_secret)throw new Error('No signing secret returned');
 const file='.env.local';let content=await fs.readFile(file,'utf8');
 for(const [key,value] of Object.entries({WHOP_WEBHOOK_SECRET:hook.webhook_secret,WHOP_WEBHOOK_ID:hook.id,BILLING_PROVIDER:'whop',WHOP_BILLING_ENABLED:'true'})){
  const re=new RegExp('^'+key+'=.*$','m');content=re.test(content)?content.replace(re,key+'='+value):content.trimEnd()+'\n'+key+'='+value+'\n';
 }
 await fs.writeFile(file,content);
 console.log('Sandbox webhook created disabled. Signing secret saved locally without displaying it. Enable the webhook after deploying the route and copying variables to Railway.');
}catch{console.error('Webhook setup failed. Check webhook permissions and connectivity.');process.exitCode=1;}
