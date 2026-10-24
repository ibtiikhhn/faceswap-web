import { expect,it,afterEach } from 'vitest';
import {testD1} from './helpers/d1';
import {withTransaction} from '@/server/db';
const databases:ReturnType<typeof testD1>[]=[];
function database(){const db=testD1();databases.push(db);return db;}
afterEach(async()=>{for(const db of databases.splice(0))await db.close();});
it('rolls back all batch writes when a later statement fails',async()=>{
 const db=database();
 await expect(withTransaction(db,async tx=>{
  await tx.query("insert into app.users(email) values('rollback@test.local')");
  await tx.query("insert into app.users(email) values('rollback@test.local')");
 })).rejects.toThrow();
 expect((await db.query('select * from app.users')).rows).toHaveLength(0);
});
it('retries a stale read without losing another writer’s update',async()=>{
 const db=database();await db.query("insert into app.users(email,name) values('concurrency@test.local','0')");
 let reads=0;let release!:()=>void;
 const barrier=new Promise<void>(r=>release=r);
 async function increment(){await withTransaction(db,async tx=>{
  const n=Number((await tx.query<{name:string}>('select name from app.users')).rows[0].name);
  if(++reads<=2){if(reads===2)release();await barrier;}
  await tx.query('update app.users set name=$1',[String(n+1)]);
 });}
 await Promise.all([increment(),increment()]);
 expect((await db.query<{name:string}>('select name from app.users')).rows[0].name).toBe('2');
 expect(reads).toBe(3);
});
it('rejects unported RETURNING writes instead of inventing results',async()=>{
 const db=database();await expect(withTransaction(db,tx=>tx.query("insert into app.users(email) values('reject@test.local') returning id"))).rejects.toThrow(/pre-read/);
 expect((await db.query('select * from app.users')).rows).toHaveLength(0);
});
