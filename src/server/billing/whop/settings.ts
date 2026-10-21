import { HttpError } from '@/server/http';
import { whopSettings } from './client';
export const usingWhop = () => process.env.BILLING_PROVIDER === 'whop';
export function whopEnvironment(){const value=process.env.WHOP_ENVIRONMENT??'sandbox';if(value!=='sandbox'&&value!=='production')throw new Error('Invalid Whop environment');return value;}
export function whopReady(values:NodeJS.ProcessEnv=process.env) {
 return values.WHOP_BILLING_ENABLED==='true' && Boolean(values.WHOP_API_KEY && values.WHOP_ACCOUNT_ID && values.WHOP_WEBHOOK_SECRET && values.WHOP_PRODUCT_ID);
}
export function requireWhop() {
 if(!usingWhop() || !whopReady() || process.env.SWAPS_ENABLED==='false') throw new HttpError(503,'Purchases are not available yet.','billing_unavailable');
 const settings=whopSettings();
 if(settings.environment==='production' && process.env.APP_ENV!=='production')throw new HttpError(503,'Live payments require the production app environment.','billing_unavailable');
 return settings;
}
export function safeWhopUrl(value:string|null|undefined) {
 const url=new URL(value??'');
 const host=whopEnvironment()==='sandbox'?'sandbox.whop.com':'whop.com';
 if(url.protocol!=='https:' || url.hostname!==host || url.username || url.password)throw new Error('Unexpected Whop URL');
 return url.href;
}
