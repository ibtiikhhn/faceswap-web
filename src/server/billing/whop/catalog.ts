/** Whop bills recurring offers in days. Do not label 30 days as a calendar month. */
export const whopOffers = [
 {code:'weekly',title:'Weekly — 100 swaps',kind:'subscription',amount:799,credits:100,days:7,env:'WHOP_WEEKLY_PLAN_ID'},
 {code:'monthly',title:'30 days — 500 swaps',kind:'subscription',amount:1999,credits:500,days:30,env:'WHOP_MONTHLY_PLAN_ID'},
 {code:'small',title:'200 swap credits',kind:'pack',amount:1000,credits:200,days:null,env:'WHOP_PACK_200_PLAN_ID'},
 {code:'large',title:'1,000 swap credits',kind:'pack',amount:5000,credits:1000,days:null,env:'WHOP_PACK_1000_PLAN_ID'},
] as const;
export function whopPlanInput(offer:typeof whopOffers[number],accountId:string,productId:string){
 const recurring=offer.kind==='subscription';
 return {
  account_id:accountId,product_id:productId,title:offer.title,currency:'usd',
  plan_type:recurring?'renewal':'one_time',billing_period:offer.days,
  // Whop adds initial_price to the first renewal charge: zero avoids charging twice.
  initial_price:recurring?0:offer.amount/100,renewal_price:recurring?offer.amount/100:0,
  trial_period_days:0,release_method:'buy_now',visibility:'hidden',unlimited_stock:true,
  adaptive_pricing_enabled:false,metadata:{app:'swapthisface',offer:offer.code,credits:offer.credits},
  description:recurring?`${offer.credits} single-face photo swaps every ${offer.days} days. Renews automatically until canceled. Unused period credits expire.`:`One-time purchase of ${offer.credits} single-face photo swap credits. No subscription required.`,
 };
}

export function publicWhopCatalog(values:Record<string,string|undefined>=process.env) {
 const ready=values.WHOP_BILLING_ENABLED==='true' && Boolean(values.WHOP_API_KEY && values.WHOP_ACCOUNT_ID && values.WHOP_WEBHOOK_SECRET && values.WHOP_PRODUCT_ID);
 const configured=(o:typeof whopOffers[number])=>ready && /^plan_[A-Za-z0-9]+$/.test(values[o.env]??'');
 return {provider:'whop',environment:values.WHOP_ENVIRONMENT??'sandbox',
 subscriptions:whopOffers.filter(o=>o.kind==='subscription').map(o=>({code:o.code,name:o.code==='weekly'?'Weekly':'30-day',interval:o.days===7?'week':'30 days',amount:o.amount,currency:'USD',includedCredits:o.credits,configured:configured(o)})),
 creditPacks:whopOffers.filter(o=>o.kind==='pack').map(o=>({code:o.code,name:o.title,amount:o.amount,currency:'USD',credits:o.credits,configured:configured(o)}))};
}
