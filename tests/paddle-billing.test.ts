import { createHmac } from 'node:crypto';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyPaddleEvent, eventSchema, processPaddleEvents, receivePaddleEvent } from '@/server/billing/paddle/events';
import { creditBalance } from '@/server/billing/credits';
import { withTransaction, type DbClient } from '@/server/db';
import { publicPaddleCatalog } from '@/server/billing/paddle/catalog';

let db:PGlite;let tx:DbClient;let uid:string;
const start=new Date(Date.now()-60_000).toISOString();
const end=new Date(Date.now()+7*86400_000).toISOString();
const later=new Date(Date.now()+1000).toISOString();
const period={starts_at:start,ends_at:end};
function payment(overrides:Record<string,unknown>={}){return eventSchema.parse({event_id:crypto.randomUUID(),event_type:'transaction.completed',occurred_at:start,data:{id:'txn_paid',status:'completed',customer_id:'ctm_test',origin:'api',subscription_id:null,items:[{price:{id:'pri_pack'},quantity:1}],...overrides}});}
function subscription(status='active',at=start){return eventSchema.parse({event_id:crypto.randomUUID(),event_type:'subscription.updated',occurred_at:at,data:{id:'sub_test',customer_id:'ctm_test',status,items:[{price:{id:'pri_week'},quantity:1}],current_billing_period:period}});}
async function intent(kind='pack',price='pri_pack',code='small',credits=200){await tx.query("insert into app.paddle_checkouts(user_id,kind,code,price_id,credits,transaction_id,state) values($1,$2,$3,$4,$5,'txn_paid','ready')",[uid,kind,code,price,credits]);}
async function apply(e:ReturnType<typeof payment>){await withTransaction(tx,t=>applyPaddleEvent(t,e));}
beforeEach(async()=>{
 vi.stubEnv('PADDLE_WEEKLY_PRICE_ID','pri_week');vi.stubEnv('PADDLE_PACK_200_PRICE_ID','pri_pack');
 db=new PGlite();tx=db as unknown as DbClient;
 for(const f of (await fs.readdir('migrations/app')).filter(f=>f.endsWith('.sql')).sort()){
  await db.exec((await fs.readFile(`migrations/app/${f}`,'utf8')).replace(/create extension if not exists pgcrypto;/gi,''));
 }
 uid=(await tx.query<{id:string}>("insert into app.users(email,paddle_sandbox_customer_id) values('paddle-test@example.com','ctm_test') returning id")).rows[0].id;
});
afterEach(async()=>{await db.close();vi.unstubAllEnvs();});
describe('Paddle credit settlement',()=>{
 it('grants a standalone pack once even with distinct duplicate event IDs',async()=>{
  await intent();await apply(payment());await apply(payment());
  expect(await creditBalance(tx,uid)).toBe(200);
  expect((await tx.query<{expires_at:null}>('select expires_at from app.credit_grants')).rows[0].expires_at).toBeNull();
 });
 it('does not trust an unbound transaction or customer metadata',async()=>{
  await expect(apply(payment({custom_data:{user_id:uid}}))).rejects.toThrow(/Unbound/);
  await intent();await expect(apply(payment({customer_id:'ctm_other'}))).rejects.toThrow(/Customer/);
  expect(await creditBalance(tx,uid)).toBe(0);
 });
 it('rejects modified quantity and price',async()=>{
  await intent();await expect(apply(payment({items:[{price:{id:'pri_pack'},quantity:2}]}))).rejects.toThrow(/catalog/);
  await expect(apply(payment({items:[{price:{id:'pri_week'},quantity:1}]}))).rejects.toThrow(/mismatch/);
 });
 it('requires confirmed payment and grants nothing for subscription state alone',async()=>{
  await apply(subscription());expect(await creditBalance(tx,uid)).toBe(0);
  await intent();await expect(apply(payment({status:'paid'}))).rejects.toThrow(/incomplete/);
 });
 it('grants a paid week and does not grant another allowance for the same billing period',async()=>{
  await intent('subscription','pri_week','weekly',100);await apply(subscription());
  const e=payment({subscription_id:'sub_test',billing_period:period,items:[{price:{id:'pri_week'},quantity:1}]});
  await apply(e);expect(await creditBalance(tx,uid)).toBe(100);
  await apply(payment({...e.data,id:'txn_duplicate_period',origin:'subscription_recurring'}));
  expect(await creditBalance(tx,uid)).toBe(100);
 });
 it('handles a payment delivered before the subscription by retrying from durable inbox',async()=>{
  await intent('subscription','pri_week','weekly',100);
  const e=payment({subscription_id:'sub_test',billing_period:period,items:[{price:{id:'pri_week'},quantity:1}]});
  await tx.query('insert into app.paddle_event_inbox(id,type,occurred_at,payload) values($1,$2,$3,$4::jsonb)',[e.event_id,e.event_type,e.occurred_at,JSON.stringify(e)]);
  await processPaddleEvents(tx);expect(await creditBalance(tx,uid)).toBe(0);
  await apply(subscription());await tx.query('update app.paddle_event_inbox set next_attempt_at=now()');
  await processPaddleEvents(tx);expect(await creditBalance(tx,uid)).toBe(100);
 });
 it('does not restore canceled access with an older subscription event; packs remain usable',async()=>{
  await apply(subscription('canceled',later));await apply(subscription('active',start));
  expect((await tx.query<{status:string}>('select status from app.subscriptions')).rows[0].status).toBe('canceled');
  await intent();await apply(payment());expect(await creditBalance(tx,uid)).toBe(200);
 });
 it('refuses prorated changes as full renewal allowances',async()=>{
  await apply(subscription());await expect(apply(payment({origin:'subscription_update',subscription_id:'sub_test'}))).rejects.toThrow(/Unbound/);
 });
 it('revokes full refunds and prevents out-of-order refunds from granting credits',async()=>{
  await intent();const adjustment=eventSchema.parse({event_id:'evt_refund',event_type:'adjustment.updated',occurred_at:start,data:{id:'adj_test',status:'approved',action:'refund',type:'full',transaction_id:'txn_paid',items:[{item_id:'txnitm_test',type:'full'}]}});
  await apply(adjustment);await apply(payment());expect(await creditBalance(tx,uid)).toBe(0);
 });
 it('removes remaining credits after an approved full refund',async()=>{
  await intent();await apply(payment());
  await apply(eventSchema.parse({event_id:'evt_refund',event_type:'adjustment.updated',occurred_at:start,data:{id:'adj_test',status:'approved',action:'refund',type:'full',transaction_id:'txn_paid'}}));
  expect(await creditBalance(tx,uid)).toBe(0);
 });
 it('publishes exactly the approved offers and defaults to purchases disabled',()=>{
  const catalog=publicPaddleCatalog({});
  expect(catalog.subscriptions.map(p=>[p.amount,p.includedCredits])).toEqual([[799,100],[1999,500]]);
  expect(catalog.creditPacks.map(p=>[p.amount,p.credits])).toEqual([[1000,200],[5000,1000]]);
  expect(catalog.subscriptions.every(p=>!p.configured)).toBe(true);
 });
});

it('verifies signatures and rejects tampered or stale webhook bodies',async()=>{
 vi.stubEnv('PADDLE_API_KEY','pdl_sdbx_test');vi.stubEnv('PADDLE_ENVIRONMENT','sandbox');vi.stubEnv('PADDLE_WEBHOOK_SECRET','test_webhook_secret');
 const raw=JSON.stringify({event_id:'evt_signature',event_type:'test.unknown',occurred_at:start,data:{id:'test',status:'active'}});
 const ts=Math.floor(Date.now()/1000);
 const sign=(time:number)=>`ts=${time};h1=${createHmac('sha256','test_webhook_secret').update(`${time}:${raw}`).digest('hex')}`;
 await receivePaddleEvent(tx,raw,sign(ts));
 await receivePaddleEvent(tx,raw,sign(ts));
 expect((await tx.query('select id from app.paddle_event_inbox')).rows).toHaveLength(1);
 await expect(receivePaddleEvent(tx,raw+' ',sign(ts))).rejects.toThrow();
 await expect(receivePaddleEvent(tx,raw,sign(ts-60))).rejects.toThrow();
});

it('does not carry sandbox credits or queued sandbox events into live billing',async()=>{
 await intent();await apply(payment());expect(await creditBalance(tx,uid)).toBe(200);
 vi.stubEnv('PADDLE_ENVIRONMENT','production');
 expect(await creditBalance(tx,uid)).toBe(0);
 const e=payment({id:'txn_other'});
 await tx.query('insert into app.paddle_event_inbox(id,type,occurred_at,payload) values($1,$2,$3,$4::jsonb)',[e.event_id,e.event_type,e.occurred_at,JSON.stringify(e)]);
 await processPaddleEvents(tx);
 expect((await tx.query<{state:string}>('select state from app.paddle_event_inbox')).rows[0].state).toBe('pending');
 vi.stubEnv('PADDLE_ENVIRONMENT','sandbox');expect(await creditBalance(tx,uid)).toBe(200);
});

it('uses the matching initial subscription period when checkout omits billing_period',async()=>{
 await intent('subscription','pri_week','weekly',100);await apply(subscription());
 await apply(payment({subscription_id:'sub_test',billing_period:null,items:[{price:{id:'pri_week'},quantity:1}]}));
 expect(await creditBalance(tx,uid)).toBe(100);
});
