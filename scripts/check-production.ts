import { getEnv, featureState } from '../src/server/env';
import { whopOffers } from '../src/server/billing/whop/catalog';
import { whopReady } from '../src/server/billing/whop/settings';

// Configuration-only check: never logs values, makes purchases, or mutates the database.
try {
 const env=getEnv();const features=featureState();const failures:string[]=[];
 const check=(ok:unknown,message:string)=>{if(!ok)failures.push(message);};
 check(env.APP_ENV==='production','APP_ENV must be production');
 check(env.APP_URL==='https://swapthisface.com','APP_URL must be https://swapthisface.com');
 check(!env.NEXT_PUBLIC_APP_URL||env.NEXT_PUBLIC_APP_URL===env.APP_URL,'NEXT_PUBLIC_APP_URL must match APP_URL');
 check(features.database,'Database configuration is incomplete');
 check(features.auth,'Google authentication configuration is incomplete');
 check(features.payload,'CMS secret is missing');
 check(env.SWAPS_ENABLED==='true'&&env.SWAP_PROVIDER==='external','Live external swaps must be enabled');
 check(env.STORAGE_DRIVER==='r2'&&features.storage,'Private R2 storage configuration is incomplete');
 check(process.env.BILLING_PROVIDER==='whop','BILLING_PROVIDER must be whop');
 check(process.env.WHOP_ENVIRONMENT==='production','WHOP_ENVIRONMENT must be production');
 check(whopReady(),'Whop billing must be enabled with API key, account, product and signing secret');
 for(const offer of whopOffers)check(/^plan_[A-Za-z0-9]+$/.test(process.env[offer.env]??''),`${offer.env} is missing or invalid`);
 check(env.PADDLE_BILLING_ENABLED!=='true','Retired Paddle billing must be disabled');
 const fast=Number(process.env.WORKER_POLL_MS??3000),idle=Number(process.env.WORKER_IDLE_POLL_MS??30000);
 check(Number.isFinite(fast)&&fast>=100&&Number.isFinite(idle)&&idle>=Math.max(fast,30000),'Worker idle polling must be at least 30000 ms and no faster than busy polling');
 if(failures.length){console.error('Production configuration is NOT ready:\n'+failures.map(v=>'- '+v).join('\n'));process.exitCode=1;}
 else console.log('Production configuration checks passed. Separately verify remote catalog, enabled webhook, migrations and deployed end-to-end behavior.');
} catch {console.error('Production environment validation failed. Check variable formats and external provider settings. No secret values were printed.');process.exitCode=1;}
