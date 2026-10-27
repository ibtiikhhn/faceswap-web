import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { D1Client, type D1Transport } from '@/server/db/d1/client';
export function testD1() {
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec('PRAGMA foreign_keys=ON');
 for(const file of readdirSync('migrations/d1/app').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(`migrations/d1/app/${file}`,'utf8'));
 const transport:D1Transport=async statements=>{
  sqlite.exec('BEGIN');
  try {
   const results=statements.map(({sql,params})=>{
    const query=sqlite.prepare(sql);
    const results=query.all(...params as SQLInputValue[]) as Record<string,unknown>[];
    const changes=sqlite.prepare('SELECT changes() AS n').get()!.n as number;
    return {results,success:true,meta:{changes}};
   });
   sqlite.exec('COMMIT');return results;
  }catch(error){sqlite.exec('ROLLBACK');if(String(error).includes('app_d1_guard'))throw new Error('D1_WRITE_CONFLICT');throw error;}
 };
 return Object.assign(new D1Client(transport),{close:async()=>sqlite.close(),sqlite});
}
