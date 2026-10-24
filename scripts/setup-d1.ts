import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
const token=process.env.CLOUDFLARE_API_TOKEN;
const account=process.env.CLOUDFLARE_ACCOUNT_ID ?? process.env.R2_ACCOUNT_ID ?? process.env.R2_ENDPOINT?.match(/https:\/\/([a-f0-9]+)\./)?.[1];
if(!token || !account) throw new Error('Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (or R2_ACCOUNT_ID).');
async function api(path:string,method='GET',body?:unknown) {
 const res=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const data=await res.json() as {success:boolean;result:Record<string,unknown>[]|Record<string,unknown>};
 if(!res.ok||!data.success)throw new Error(`Cloudflare ${method} ${path} failed (${res.status}); check token permissions.`);
 return data.result;
}
const existing=await api('/d1/database?per_page=100') as {name:string;uuid:string}[];
const ids:string[]=[];
for(const name of ['swapthisface-app','swapthisface-cms']) {
 const db=existing.find(x=>x.name===name) ?? await api('/d1/database','POST',{name}) as {uuid:string};
 ids.push(db.uuid);console.log(`${name}: ready`);
}
const config={name:'swapthisface-d1',main:'index.js',compatibility_date:'2026-10-01',workers_dev:true,d1_databases:ids.map((id,i)=>({binding:i?'CMS_DB':'APP_DB',database_name:i?'swapthisface-cms':'swapthisface-app',database_id:id}))};
await fs.writeFile('cloudflare/d1-gateway/wrangler.jsonc',JSON.stringify(config,null,2)+'\n');
const updates:Record<string,string>={CLOUDFLARE_ACCOUNT_ID:account,D1_APP_DATABASE_ID:ids[0],D1_CMS_DATABASE_ID:ids[1],D1_GATEWAY_SECRET:process.env.D1_GATEWAY_SECRET??randomBytes(32).toString('hex')};
let local=await fs.readFile('.env.local','utf8');
for(const [key,value] of Object.entries(updates)){const line=`${key}=${JSON.stringify(value)}`;const re=new RegExp(`^${key}=.*$`,'m');local=re.test(local)?local.replace(re,()=>line):local+'\n'+line;}
await fs.writeFile('.env.local',local+'\n',{mode:0o600});
console.log('Database IDs and gateway secret saved to .env.local. DATABASE_DRIVER has not been changed.');
