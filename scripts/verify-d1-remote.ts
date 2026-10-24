import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {D1Client,remoteD1} from '../src/server/db/d1/client';
import {withTransaction} from '../src/server/db';
const app=new D1Client(remoteD1('app'));
const id=randomUUID(),email=`d1-check-${id}@example.invalid`;
try {
 const unauthorized=await fetch(`${process.env.D1_GATEWAY_URL}/app`,{method:'POST',body:'{}'});
 assert.equal(unauthorized.status,401);
 await assert.rejects(withTransaction(app,async tx=>{
  await tx.query('insert into app.users(id,email) values($1,$2)',[id,email]);
  await tx.query('insert into app.users(id,email) values($1,$2)',[id,email]);
 }));
 assert.equal((await app.query('select id from app.users where id=$1',[id])).rows.length,0);
 await app.query('insert into app.users(id,email,name) values($1,$2,$3)',[id,email,'0']);
 const increment=()=>withTransaction(app,async tx=>{
  const value=(await tx.query<{name:string}>('select name from app.users where id=$1',[id])).rows[0].name;
  await tx.query('update app.users set name=$2 where id=$1',[id,String(Number(value)+1)]);
 });
 await Promise.all([increment(),increment()]);
 assert.equal((await app.query<{name:string}>('select name from app.users where id=$1',[id])).rows[0].name,'2');
 const [raw]=await remoteD1('cms')([{sql:'SELECT 1 AS value, 2 AS value',params:[],raw:true}]);
 assert.deepEqual(raw.raw,[[1,2]]);
 const [owners]=await remoteD1('cms')([{sql:'SELECT id FROM owners LIMIT 0',params:[]}]);assert.equal(owners.success,true);
 console.log('Remote D1: unauthorized access rejected; batch rollback, concurrent writes, CMS schema and positional rows passed.');
}finally{await app.query('delete from app.users where id=$1 and email=$2',[id,email]);}
