import fs from 'node:fs/promises';
import { getWhop,whopSettings } from '../src/server/billing/whop/client';
import { whopOffers,whopPlanInput } from '../src/server/billing/whop/catalog';

async function main(){
 if(process.argv.includes('--preview')){
  console.log('Hidden Whop offers; recurring initial fees are zero. No remote changes.');
  console.table(whopOffers.map(o=>({offer:o.code,USD:o.amount/100,credits:o.credits,period:o.days?`${o.days} days`:'one-time'})));
  return;
 }
 const {accountId,environment}=whopSettings();const client=getWhop();
 const saved:Record<string,string>={WHOP_ENVIRONMENT:environment,WHOP_ACCOUNT_ID:accountId};
 const productKey=`swapthisface:${environment}:catalog:v1`;
 const products=await client.products.list({account_id:accountId,first:100});
 const matches=[];
 for await(const product of products){if(product.title==='SwapThisFace.com')matches.push(product);}
 if(matches.length>1)throw new Error('Multiple SwapThisFace.com products found. Resolve the duplicate products before setup.');
 const product=matches[0]??await client.products.create({account_id:accountId,title:'SwapThisFace.com',visibility:'hidden',description:'AI single-face photo swapping for adults who have permission to use the uploaded photos. Recreate photos with your own face for creative entertainment.',metadata:{app:'swapthisface'}},{idempotencyKey:productKey});
 console.log(`WHOP_ENVIRONMENT=${environment}\nWHOP_ACCOUNT_ID=${accountId}\nWHOP_PRODUCT_ID=${product.id}`);
 saved.WHOP_PRODUCT_ID=product.id;
 const existing=await client.plans.list({account_id:accountId,product_ids:[product.id],first:100});
 const plans=[];for await(const plan of existing)plans.push(plan);
 for(const offer of whopOffers){
  const desired=whopPlanInput(offer,accountId,product.id);
  const candidates=plans.filter(p=>p.title===offer.title);
  if(candidates.length>1)throw new Error(`Multiple plans found for ${offer.code}; resolve duplicates first.`);
  const plan=candidates[0]?await client.plans.retrieve({id:candidates[0].id}):await client.plans.create(desired,{idempotencyKey:`${productKey}:${offer.code}`});
  if(plan.currency!=='usd'||plan.initial_price!==desired.initial_price||plan.renewal_price!==desired.renewal_price||plan.billing_period!==desired.billing_period||plan.plan_type!==desired.plan_type)throw new Error(`Existing ${offer.code} plan has different billing terms. No existing plan was modified.`);
  saved[offer.env]=plan.id;
  console.log(`${offer.env}=${plan.id}`);
 }
 if(process.argv.includes('--save')){
  const file=environment==='production'?'.env.production.local':'.env.local';
  let content=await fs.readFile(file,'utf8');
  for(const [key,value] of Object.entries(saved)){const re=new RegExp('^'+key+'=.*$','m');content=re.test(content)?content.replace(re,key+'='+value):content.trimEnd()+'\n'+key+'='+value+'\n';}
  await fs.writeFile(file,content,{mode:0o600});await fs.chmod(file,0o600);
 }
 console.log('Catalog prepared. Hidden plans can still have direct purchase links; do not distribute them before product review and verified webhook fulfillment. Checkout in the app has not been switched to Whop.');
}
main().catch(()=>{console.error('Whop setup failed. Check account/credentials, permissions, connectivity, and any duplicate or mismatched plans. No credentials were printed.');process.exitCode=1;});
