import { whopConfirmation } from '@/server/billing/whop/confirmation';
import { reconcileRecentWhopPayments } from '@/server/billing/whop/reconcile';
import * as provider from '@/server/billing/whop/client';
import { testD1 } from './helpers/d1';
import { beforeEach,afterEach,it,expect,vi,describe } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import type { Whop } from '@whop/sdk';
import { type DbClient,withTransaction } from '@/server/db';
import { creditBalance,reserveCreditForJob,consumeReservation,releaseReservation } from '@/server/billing/credits';
import { settlePayment,verifyWhopEvent,syncMembership,syncDispute,processWhopEvents } from '@/server/billing/whop/events';
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
afterEach(async()=>{await db.close();vi.unstubAllEnvs();vi.restoreAllMocks();});
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
it('uses the saved checkout binding after Whop removes a completed hosted link',async()=>{
 await apply(payment());
 await apply(payment({checkout_configuration_id:null}));
 expect(await creditBalance(tx,uid)).toBe(200);
 await apply(payment({checkout_configuration_id:null,refunded_amount:money('5.00')}));
 expect(await creditBalance(tx,uid)).toBe(100);
 await apply(payment({checkout_configuration_id:null,refunded_amount:money('10.00')}));
 expect(await creditBalance(tx,uid)).toBe(0);
});
it('does not bind a first payment when its checkout reference is missing',async()=>{
 await expect(apply(payment({checkout_configuration_id:null}))).rejects.toThrow(/Unbound/);
 expect(await creditBalance(tx,uid)).toBe(0);
});
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

it('does not revoke credits for tax-only refunds and uses the net service amount',async()=>{
 await apply(payment({total:money('12.00'),tax_amount:money('2.00'),tax_refunded_amount:money('2.00'),refunded_amount:money('2.00')}));
 expect(await creditBalance(tx,uid)).toBe(200);
 await apply(payment({total:money('12.00'),tax_amount:money('2.00'),tax_refunded_amount:money('2.00'),refunded_amount:money('7.00')}));
 expect(await creditBalance(tx,uid)).toBe(100);
 await apply(payment({total:money('12.00'),tax_amount:money('2.00'),tax_refunded_amount:money('2.00'),refunded_amount:money('12.00')}));
 expect(await creditBalance(tx,uid)).toBe(0);
});
it('keeps dispute holds across payment updates and rejects stale dispute resolutions',async()=>{
 await apply(payment());
 const dispute=(status:string,updated_at:string,id='dspt_test')=>({id,account_id:'biz_test',payment:{id:'pay_test'},status,updated_at} as Whop.Dispute);
 await withTransaction(tx,t=>syncDispute(t,dispute('needs_response','2026-10-20T00:00:00Z')));
 await apply(payment());expect(await creditBalance(tx,uid)).toBe(0);
 await withTransaction(tx,t=>syncDispute(t,dispute('won','2026-10-19T00:00:00Z')));
 expect(await creditBalance(tx,uid)).toBe(0);
 await withTransaction(tx,t=>syncDispute(t,dispute('won','2026-10-21T00:00:00Z')));
 expect(await creditBalance(tx,uid)).toBe(200);
 await withTransaction(tx,t=>syncDispute(t,dispute('lost','2026-10-22T00:00:00Z','dspt_other')));
 await withTransaction(tx,t=>syncDispute(t,dispute('warning_closed','2026-10-23T00:00:00Z')));
 expect(await creditBalance(tx,uid)).toBe(0);
});
it('normalizes offset membership dates and cancellation preserves the paid allowance',async()=>{
 await tx.query("update app.whop_checkouts set plan_id='plan_week',kind='subscription',code='weekly'");
 const p=payment({plan_id:'plan_week',membership_id:'mem_test',billing_reason:'subscription_create',subtotal:money('7.99'),total:money('7.99'),line_items:[{plan_id:'plan_week',quantity:1}]});
 await apply(p,member());
 await withTransaction(tx,t=>syncMembership(t,member({metadata:null,cancel_at_period_end:true,updated_at:'2090-01-01T05:00:00+05:00'})));
 expect(await creditBalance(tx,uid)).toBe(100);
 const stored=(await tx.query<{updated_at:string|Date;cancel_at_period_end:boolean}>('select updated_at,cancel_at_period_end from app.whop_memberships')).rows[0];
 expect(new Date(stored.updated_at).toISOString()).toBe('2090-01-01T00:00:00.000Z');
 expect(stored.cancel_at_period_end).toBe(true);
});
it('a failed renewal grants nothing; a paid new period grants once',async()=>{
 await tx.query("update app.whop_checkouts set plan_id='plan_week',kind='subscription',code='weekly'");
 const p=payment({plan_id:'plan_week',membership_id:'mem_test',billing_reason:'subscription_cycle',subtotal:money('7.99'),total:money('7.99'),line_items:[{plan_id:'plan_week',quantity:1}]});
 const oldStart=new Date(Date.now()-14*86400000).toISOString(),oldEnd=new Date(Date.now()-7*86400000).toISOString();
 await apply({...p,id:'pay_old',paid_at:oldStart},member({current_period_start:oldStart,current_period_end:oldEnd}));
 expect(await creditBalance(tx,uid)).toBe(0);
 await apply({...p,status:'open'},member({status:'past_due'}));
 expect(await creditBalance(tx,uid)).toBe(0);
 await apply(p,member());await apply(p,member());
 expect(await creditBalance(tx,uid)).toBe(100);
});
it('confirmation enforces ownership/environment and reports refunds and disputes',async()=>{
 expect(await whopConfirmation(tx,checkout,'00000000-0000-0000-0000-000000000001')).toBeNull();
 await apply(payment());expect(await whopConfirmation(tx,checkout,uid)).toEqual({state:'completed'});
 await apply(payment({refunded_amount:money('5.00')}));expect(await whopConfirmation(tx,checkout,uid)).toEqual({state:'partially_refunded'});
 await apply(payment({refunded_amount:money('10.00')}));expect(await whopConfirmation(tx,checkout,uid)).toEqual({state:'refunded'});
 await apply(payment({refunded_amount:money('10.00'),substatus:'dispute_lost'}));expect(await whopConfirmation(tx,checkout,uid)).toEqual({state:'disputed'});
 vi.stubEnv('WHOP_ENVIRONMENT','production');expect(await whopConfirmation(tx,checkout,uid)).toBeNull();
});
it('reconciles missed notifications without granting from listing data or duplicates',async()=>{
 const p=payment();
 vi.spyOn(provider,'getWhop').mockReturnValue({payments:{list:async()=>[p,payment({id:'pay_unbound',checkout_configuration_id:'ch_other'})]}} as unknown as ReturnType<typeof provider.getWhop>);
 await reconcileRecentWhopPayments(tx);await reconcileRecentWhopPayments(tx);
 expect(await creditBalance(tx,uid)).toBe(0);
 const rows=(await tx.query('select resource_id from app.whop_event_inbox')).rows;
 expect(rows).toEqual([{resource_id:'pay_test'}]);
});
it('claims one event at a time and a stale worker cannot acknowledge a newer attempt',async()=>{
 await tx.query("insert into app.whop_event_inbox(id,environment,type,resource_id) values('evt_one','sandbox','payment.succeeded','pay_test'),('evt_two','sandbox','payment.succeeded','pay_second')");
 let calls=0;
 vi.spyOn(provider,'getWhop').mockReturnValue({payments:{retrieve:async()=>{
  if(++calls===1){
   expect((await tx.query("select id from app.whop_event_inbox where state='processing'")).rows).toHaveLength(1);
   // Simulate another worker reclaiming this attempt after its lease expires.
   await tx.query("update app.whop_event_inbox set attempts=attempts+1 where state='processing'");
  }
  return payment();
 }},checkoutConfigurations:{delete:async()=>{}}} as unknown as ReturnType<typeof provider.getWhop>);
 await processWhopEvents(tx);
 const rows=(await tx.query<{state:string;attempts:number}>('select state,attempts from app.whop_event_inbox order by id')).rows;
 expect(rows).toEqual([{state:'processing',attempts:2},{state:'done',attempts:1}]);
 expect(await creditBalance(tx,uid)).toBe(200);
});
it('retries a failed provider request without blocking another payment',async()=>{
 await tx.query("insert into app.whop_event_inbox(id,environment,type,resource_id) values('evt_bad','sandbox','payment.succeeded','pay_bad'),('evt_good','sandbox','payment.succeeded','pay_test')");
 vi.spyOn(console,'error').mockImplementation(()=>{});
 vi.spyOn(provider,'getWhop').mockReturnValue({payments:{retrieve:async({id}:{id:string})=>{if(id==='pay_bad')throw new Error('temporary');return payment();}},checkoutConfigurations:{delete:async()=>{}}} as unknown as ReturnType<typeof provider.getWhop>);
 await processWhopEvents(tx);
 expect((await tx.query('select state from app.whop_event_inbox order by id')).rows).toEqual([{state:'failed'},{state:'done'}]);
 expect(await creditBalance(tx,uid)).toBe(200);
});

it('does not deliver or restore refunded credits reserved by an in-flight swap',async()=>{
 await apply(payment());
 const asset=(await tx.query<{id:string}>("insert into app.assets(user_id,kind,object_key,content_type,width,height,byte_count) values($1,'source','test-face','image/png',10,10,100) returning id",[uid])).rows[0].id;
 const job=(await tx.query<{id:string}>("insert into app.swap_jobs(user_id,source_asset_id,target_asset_id,mode,request_key) values($1,$2,$2,'paid_credit','refund-job') returning id",[uid,asset])).rows[0].id;
 await withTransaction(tx,t=>reserveCreditForJob(t,uid,job));
 expect(await creditBalance(tx,uid)).toBe(199);
 await apply(payment({refunded_amount:money('10.00')}));
 await expect(withTransaction(tx,t=>consumeReservation(t,job))).rejects.toMatchObject({code:'payment_revoked'});
 await withTransaction(tx,t=>releaseReservation(t,job));
 expect(await creditBalance(tx,uid)).toBe(0);
 expect((await tx.query('select reserved_amount,remaining_amount from app.credit_grants')).rows).toEqual([{reserved_amount:0,remaining_amount:0}]);
});

});
