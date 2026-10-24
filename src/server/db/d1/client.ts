import type { DbClient } from '../index';
import { d1Sql,decodeD1Row } from './sql';
export type D1Statement={sql:string;params:unknown[];raw?:boolean};
export type D1Result={results:Record<string,unknown>[];success:boolean;meta:{changes:number};error?:string;raw?:unknown[][]};
export type D1Transport=(statements:D1Statement[])=>Promise<D1Result[]>;
export function d1Configured(){return Boolean(process.env.D1_GATEWAY_URL && process.env.D1_GATEWAY_SECRET);}
export const usingD1=()=>process.env.DATABASE_DRIVER==='d1';
export function remoteD1(database: 'app' | 'cms'):D1Transport {
 return async statements=>{
  const url=process.env.D1_GATEWAY_URL,token=process.env.D1_GATEWAY_SECRET;
  if(!url||!token)throw new Error('D1 gateway URL and secret are required.');
  const response=await fetch(`${url.replace(/\/$/,'')}/${database}`,{
   method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({statements}),signal:AbortSignal.timeout(20000),cache:'no-store'
  });
  const body=await response.json() as {result?:D1Result[];error?:string};
  if(!response.ok || !body.result || body.result.some(r=>!r.success)) throw new Error(body.error==='D1_WRITE_CONFLICT'?'D1_WRITE_CONFLICT':`D1 request failed (${response.status}). Check the gateway logs and migrations.`);
  return body.result;
 };
}
export class D1Client implements DbClient {
 readonly dialect='d1';
 constructor(readonly transport:D1Transport){}
 async query<T=Record<string,unknown>>(sql:string,params:unknown[]=[]){
  const [result]=await this.transport([d1Sql(sql,params)]);
  const rows=result.results.map(decodeD1Row) as T[];
  return {rows,rowCount:/^\s*(select|with)\b/i.test(sql)?rows.length:result.meta.changes};
 }
 async batch(statements:D1Statement[]){return this.transport(statements.map(s=>d1Sql(s.sql,s.params)));}
 async end(){}
 async connect():Promise<DbClient & {release:()=>void}>{throw new Error('Use atomicD1; interactive transactions are not supported.');}
}
export function isD1(client:DbClient):client is D1Client{return 'dialect' in client && client.dialect==='d1';}
/** A read-plan-write operation: guard every read with the app revision inside the atomic write batch.
 * Revision triggers cover every application table, including writes outside this helper.
 * The callback must not perform external side effects, and may be retried on contention.
 */
export async function atomicD1<T>(db:D1Client,plan:(read:DbClient,write:(sql:string,params?:unknown[])=>void)=>Promise<T>):Promise<T>{
 for(let attempt=0;attempt<5;attempt++){
  const version=(await db.query<{version:number}>('select version from app.d1_revision where id=1')).rows[0]?.version;
  if(version===undefined)throw new Error('D1 migrations are required.');
  const statements:D1Statement[]=[];
  const read:DbClient={query:async <R>(sql:string,params?:unknown[])=>{
   if(!/^\s*select\b/i.test(sql))throw new Error('D1 transaction reads must be SELECT statements.');
   return db.query<R>(sql,params);
  }};
  const value=await plan(read,(sql,params=[])=>statements.push({sql,params}));
  if(!statements.length)return value;
  try{
   await db.batch([
    {sql:'insert into app.d1_guard(ok) select case when version=$1 then 1 else 0 end from app.d1_revision where id=1',params:[version]},
    ...statements,{sql:'delete from app.d1_guard',params:[]}
   ]);
   return value;
  }catch(error){if(!(error instanceof Error) || !error.message.includes('D1_WRITE_CONFLICT') || attempt===4)throw error;}
 }
 throw new Error('D1 write contention');
}
