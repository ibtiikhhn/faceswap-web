import { getWhop,whopSettings } from '../src/server/billing/whop/client';
import { whopOffers,whopPlanInput } from '../src/server/billing/whop/catalog';
import { safeWhopUrl } from '../src/server/billing/whop/settings';
async function main(){
 const {environment,accountId}=whopSettings();console.log(`Verifying ${environment} catalog`);
 const client=getWhop();const productId=process.env.WHOP_PRODUCT_ID!;
 for(const offer of whopOffers){
  const plan=await client.plans.retrieve({id:process.env[offer.env]!});const expected=whopPlanInput(offer,accountId,productId);
  if(plan.account?.id!==accountId||plan.product?.id!==productId||plan.currency!=='usd'||plan.initial_price!==expected.initial_price||plan.renewal_price!==expected.renewal_price||plan.billing_period!==expected.billing_period||plan.plan_type!==expected.plan_type)throw new Error('Catalog mismatch');
  console.log(`${offer.code}: remote catalog verified`);
 }
 if(environment==='sandbox'){
 const checkout=await client.checkoutConfigurations.create({account_id:accountId,plan_id:process.env.WHOP_PACK_200_PLAN_ID!,metadata:{integration_probe:true},redirect_url:'https://swapthisface.com/dashboard/billing'});
 try{safeWhopUrl(checkout.purchase_url);console.log('Sandbox hosted checkout URL verified. No payment attempted.');}
 finally{await client.checkoutConfigurations.delete({id:checkout.id});console.log('Temporary checkout removed.');}
 }
 // Read calls validate the worker's basic settlement permissions without logging buyer data.
 await client.payments.list({account_id:accountId,first:1});
 await client.memberships.list({account_id:accountId,first:1});
 console.log('Payment and membership read permissions verified.');
}
main().catch(e=>{console.error('Whop verification failed',{type:e?.constructor?.name,status:e?.statusCode});process.exitCode=1;});
