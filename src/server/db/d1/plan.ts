import type { DbClient } from '../index';
import { atomicD1, type D1Client } from './client';

export type PlannedClient = DbClient & { planned: true; write: (sql:string,params:unknown[])=>void };
export function isPlanned(db:DbClient):db is PlannedClient {return 'planned' in db && db.planned===true;}

// Writes are deferred. Callers must explicitly pre-read any rows returned by a write,
// and must never depend on reading their pending writes or perform external effects.
export async function plannedTransaction<T>(db:D1Client,fn:(tx:DbClient)=>Promise<T>) {
 return atomicD1(db,async (read,write)=>{
  const tx:PlannedClient={planned:true,write,query:async <R>(sql:string,params:unknown[]=[])=>{
   if (/^\s*select pg_advisory_xact_lock\(/i.test(sql)) return {rows:[] as R[],rowCount:0};
   if (/^\s*select\b/i.test(sql)) return read.query<R>(sql.replace(/\bfor update(?: of \w+)?(?: skip locked)?/gi,''),params);
   if (/\breturning\b/i.test(sql)) throw new Error('D1 planned write needs explicit pre-read rows.');
   write(sql,params);
   return {rows:[] as R[],rowCount:0};
  }};
  return fn(tx);
 });
}
/** The supplied rows must be derived from guarded pre-reads or an explicit new ID. */
export async function plannedReturning<T>(db:DbClient,sql:string,params:unknown[],rows:()=>Promise<T[]>) {
 if(!isPlanned(db))return db.query<T>(sql,params);
 const result=await rows();
 db.write(sql,params);
 return {rows:result,rowCount:result.length};
}
