import fs from 'node:fs/promises';
const {CLOUDFLARE_API_TOKEN:token,CLOUDFLARE_ACCOUNT_ID:account,D1_APP_DATABASE_ID:app,D1_CMS_DATABASE_ID:cms,D1_GATEWAY_SECRET:secret}=process.env;
if(!token||!account||!app||!cms||!secret)throw new Error('Run setup-d1 first.');
const name='swapthisface-d1';
async function api(path:string,method='GET',body?:BodyInit) {
 const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`,{method,headers:{Authorization:`Bearer ${token}`,...(typeof body==='string'?{'Content-Type':'application/json'}:{})},body});
 const data=await response.json() as {success:boolean;result:{subdomain?:string};errors?:{code:number;message:string}[]};
 if(!response.ok||!data.success)throw new Error(`Cloudflare ${method} ${path} failed (${response.status}, codes: ${data.errors?.map(e=>e.code).join(',')}). Check Workers Scripts Edit permission and workers.dev setup.`);
 return data.result;
}
const domain=await api('/workers/subdomain');
if(!domain.subdomain)throw new Error('Create your workers.dev subdomain in Cloudflare Workers & Pages first.');
const form=new FormData();
form.set('metadata',new Blob([JSON.stringify({main_module:'index.js',compatibility_date:'2026-10-01',bindings:[{type:'d1',name:'APP_DB',id:app},{type:'d1',name:'CMS_DB',id:cms},{type:'secret_text',name:'D1_GATEWAY_SECRET',text:secret}]})],{type:'application/json'}));
form.set('index.js',new Blob([await fs.readFile('cloudflare/d1-gateway/index.js','utf8')],{type:'application/javascript+module'}),'index.js');
await api(`/workers/scripts/${name}`,'PUT',form);
await api(`/workers/scripts/${name}/subdomain`,'POST',JSON.stringify({enabled:true,previews_enabled:false}));
const url=`https://${name}.${domain.subdomain}.workers.dev`;
let local=await fs.readFile('.env.local','utf8');const line=`D1_GATEWAY_URL=${JSON.stringify(url)}`;
local=/^D1_GATEWAY_URL=.*$/m.test(local)?local.replace(/^D1_GATEWAY_URL=.*$/m,()=>line):local+'\n'+line;
await fs.writeFile('.env.local',local+'\n',{mode:0o600});
console.log('Private D1 gateway deployed. URL saved in .env.local. Database driver unchanged.');
