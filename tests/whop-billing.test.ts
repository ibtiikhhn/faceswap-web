import { testD1 } from './helpers/d1';
import { beforeEach,afterEach,it,expect,vi,describe } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import type { Whop } from '@whop/sdk';
import { type DbClient,withTransaction } from '@/server/db';
import { creditBalance } from '@/server/billing/credits';
import { settlePayment,verifyWhopEvent,syncMembership } from '@/server/billing/whop/events';
import { publicWhopCatalog } from '@/server/billing/whop/catalog';
describe.each(['postgres','d1'])('Whop billing on %s',backend=>{
let db:PGlite,tx:DbClient,uid:string,checkout:string;
const start=new Date(Date.now()-3600000).toISOString(),end=new Date(Date.now()+6*86400000).toISOString();
const money=(amount:string)=>({amount,currency:'usd',decimals:2,display_decimals:2});
function payment(extra:Record<string,unknown>={}){return {id:'pay_test',account_id:'biz_test',product_id:'prod_test',plan_id:'plan_pack',status:'paid',currency:'usd',subtotal:money('10.00'),total:money('10.00'),refunded_amount:money('0.00'),promo_code_id:null,line_items:[{plan_id:'plan_pack',quantity:1}],checkout_configuration_id:'ch_test',membership_id:null,billing_reason:'one_time',paid_at:new Date().toISOString(),updated_at:new Date().toISOString(),...extra} as unknown as Whop.Payment;}
function member(extra:Record<string,unknown>={}){return {id:'mem_test',account:{id:'biz_test'},plan_id:'plan_week',metadata:{checkout_id:checkout},status:'active',current_period_start:start,current_period_end:end,cancel_at_period_end:false,updated_at:new Date().toISOString(),...extra} as unknown as Whop.Membership;}
async function apply(p:Whop.Payment,m:Whop.Membership|null=null){return withTransaction(tx,t=>settlePayment(t,p,m));}
beforeEach(async()=>{
 vi.stubEnv('BILLING_PROVIDER','whop');vi.stubEnv('WHOP_ENVIRONMENT','sandbox');vi.stubEnv('WHOP_API_KEY','test');vi.stubEnv('WHOP_ACCOUNT_ID','biz_test');vi.stubEnv('WHOP_PRODUCT_ID','prod_test');vi.stubEnv('WHOP_PACK_200_PLAN_ID','plan_pack');vi.stubEnv('WHOP_WEEKLY_PLAN_ID','plan_week');
 db=backend==='d1'?testD1() as unknown as PGlite:new PGlite();tx=db as unknown as DbClient;
 if(backend!=='d1')for(const f of (await fs.readdir('migrations/app')).filter(f=>f.endsWith('.sql')).sort())await db.exec((await fs.readFile(`migrations/app/${f}`,'utf8')).replace(/create extension if not exists pgcrypto;/gi,''));
 uid=(await tx.query<{id:string}>("insert into app.users(email) values('whop@example.com') returning id")).rows[0].id;
 checkout=(await tx.query<{id:string}>("insert into app.whop_checkouts(user_id,environment,code,kind,plan_id,configuration_id,state) values($1,'sandbox','small','pack','plan_pack','ch_test','ready') returning id",[uid])).rows[0].id;
});
afterEach(async()=>{await db.close();vi.unstubAllEnvs();});
it('grants standalone credits exactly once and hides them in production',async()=>{await apply(payment());await apply(payment());expect(await creditBalance(tx,uid)).toBe(200);vi.stubEnv('WHOP_ENVIRONMENT','production');expect(await creditBalance(tx,uid)).toBe(0);});
it('rejects an unbound checkout, other account, wrong amount or quantity',async()=>{
 for(const data of [{checkout_configuration_id:'ch_other'},{account_id:'biz_other'},{subtotal:money('1.00')},{line_items:[{plan_id:'plan_pack',quantity:2}]}])await expect(apply(payment(data))).rejects.toThrow();
 expect(await creditBalance(tx,uid)).toBe(0);
});
it('never fulfills a pending payment',async()=>{await apply(payment({status:'pending'}));expect(await creditBalance(tx,uid)).toBe(0);});
it('revokes refunds, including refund-before-success ordering',async()=>{
 await apply(payment({refunded_amount:money('10.00')}));expect(await creditBalance(tx,uid)).toBe(0);
 await apply(payment({refunded_amount:money('0.00')}));expect(await creditBalance(tx,uid)).toBe(0);
});
it('applies partial refunds once',async()=>{await apply(payment());await apply(payment({refunded_amount:money('5.00')}));await apply(payment({refunded_amount:money('5.00')}));expect(await creditBalance(tx,uid)).toBe(100);});
it('membership activation alone grants no credits; paid periods deduplicate',async()=>{
 await tx.query("update app.whop_checkouts set plan_id='plan_week',kind='subscription',code='weekly'");
 const m=member();await syncMembership(tx,m);expect(await creditBalance(tx,uid)).toBe(0);
 const p=payment({plan_id:'plan_week',membership_id:'mem_test',billing_reason:'subscription_create',subtotal:money('7.99'),total:money('7.99'),line_items:[{plan_id:'plan_week',quantity:1}]});
 await apply(p,m);await apply({...p,id:'pay_duplicate'},m);expect(await creditBalance(tx,uid)).toBe(100);
});
it('does not assign a historical payment to the current membership period',async()=>{
 await tx.query("update app.whop_checkouts set plan_id='plan_week',kind='subscription',code='weekly'");
 await expect(apply(payment({plan_id:'plan_week',membership_id:'mem_test',billing_reason:'subscription_cycle',paid_at:'2020-01-01T00:00:00Z',subtotal:money('7.99'),total:money('7.99'),line_items:[{plan_id:'plan_week',quantity:1}]}),member())).rejects.toThrow(/period/);
});
it('verifies exact signed bytes, timestamp and account',()=>{
 const key='ws_'+'a'.repeat(64);vi.stubEnv('WHOP_WEBHOOK_SECRET',key);
 const id='msg_test',timestamp=String(Math.floor(Date.now()/1000));const raw=JSON.stringify({id,type:'payment.succeeded',account_id:'biz_test',data:{id:'pay_test'}});
 const headers={'webhook-id':id,'webhook-timestamp':timestamp,'webhook-signature':'v1,'+createHmac('sha256',key).update(`${id}.${timestamp}.${raw}`).digest('base64')};
 expect(verifyWhopEvent(raw,headers).id).toBe(id);
 expect(()=>verifyWhopEvent(raw+' ',headers)).toThrow();
 expect(()=>verifyWhopEvent(raw,{...headers,'webhook-timestamp':'1'})).toThrow();
 vi.stubEnv('WHOP_ACCOUNT_ID','biz_other');expect(()=>verifyWhopEvent(raw,headers)).toThrow();
});
it('publishes disabled offers by default and a truthful 30-day cadence',()=>{const c=publicWhopCatalog({});expect(c.subscriptions.every(p=>!p.configured)).toBe(true);expect(c.subscriptions[1].interval).toBe('30 days');});

});
