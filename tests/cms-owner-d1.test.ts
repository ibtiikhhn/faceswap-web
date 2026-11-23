import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { testD1 } from './helpers/d1';
import { listOwnerSaasOverview, listOwnerGenerations, getOwnerCustomerActivity, listOwnerOperations } from '@/cms/owner-services';

it('loads owner customer, generation and billing views on D1 and preserves explicitly deleted assets', async () => {
 const db=testD1();
 try {
  const user=(await db.query<{id:string}>("insert into app.users(email,name) values('owner-test@example.com','Test Customer') returning id")).rows[0].id;
  const ids:string[]=[];
  for(const kind of ['source','target','result'])ids.push((await db.query<{id:string}>("insert into app.assets(user_id,kind,object_key,content_type,width,height,byte_count,expires_at) values($1,$2,$2,'image/webp',100,100,10,'2020-01-01') returning id",[user,kind])).rows[0].id);
  await db.query("insert into app.swap_jobs(user_id,source_asset_id,target_asset_id,result_asset_id,state,request_key) values($1,$2,$3,$4,'succeeded','d1-owner-job')",[user,...ids]);
  await db.query("update app.assets set status='deleted' where id=$1",[ids[1]]);
  db.sqlite.exec(readFileSync('migrations/d1/app/0003_keep_photos.sql','utf8'));
  const summary=await listOwnerSaasOverview(db,{search:'TEST CUSTOMER',customerId:user});
  expect(summary.matchedUsers).toBe(1);expect(summary.totals.swapsSucceeded).toBe(1);
  const history=await listOwnerGenerations({userId:user},db);
  expect(history.total).toBe(1);expect(history.jobs[0]).toMatchObject({source_expires:null,target_status:'deleted',result_asset_id:ids[2],result_expires:null});
  expect((await listOwnerGenerations({state:'failed'},db)).total).toBe(0);
  expect(await getOwnerCustomerActivity(user,db)).toEqual({subscriptions:[],ledger:[]});
  expect((await listOwnerOperations(db)).auditReady).toBe(true);
 }finally{await db.close();}
});
