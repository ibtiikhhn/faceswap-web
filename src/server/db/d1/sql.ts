/** Narrow compatibility for existing application queries, not a PostgreSQL emulator. */
export function d1Sql(sql:string,params:unknown[]=[]):{sql:string;params:unknown[]} {
 if(/\b(begin|commit|rollback|savepoint)\b|pg_advisory|\bfor\s+update\b/i.test(sql))throw new Error('D1 requires an atomic batch; interactive transactions and locks are unsupported.');
 let text=sql
  .replace(/\bapp\./g,'app_')
  .replace(/::(?:uuid|text|jsonb|timestamptz|int(?:eger)?|bigint)\b/gi,'')
  .replace(/now\(\)\s*([+-])\s*interval\s*'([0-9]+) (seconds?|minutes?|hours?|days?|months?)'/gi,(_,sign,n,unit)=>`strftime('%Y-%m-%dT%H:%M:%fZ','now','${sign}${n} ${unit}')`)
  .replace(/date_trunc\('day',\s*now\(\)\)/gi,"strftime('%Y-%m-%dT00:00:00.000Z','now')")
  .replace(/now\(\)/gi,"strftime('%Y-%m-%dT%H:%M:%fZ','now')")
  .replace(/\bgreatest\(/gi,'max(').replace(/\bleast\(/gi,'min(')
  .replace(/jsonb_build_object\(/gi,'json_object(')
  .replace(/to_regclass\('([a-z_]+)'\) is not null/gi,"exists(select 1 from sqlite_master where type='table' and name='$1')");
 const bound:unknown[]=[];
 // Do not substitute placeholders in quoted literals or identifiers.
 text=text.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\$(\d+)/g,(token,index)=>{
  if(!index)return token;
  const value=params[Number(index)-1];
  if(value===undefined)throw new Error('Missing SQL parameter');
  bound.push(value instanceof Date?value.toISOString():typeof value==='boolean'?Number(value):value);
  return '?';
 });
 if(/::|\binterval\b|\bpg_\w+|\bskip locked\b/i.test(text))throw new Error('Unsupported PostgreSQL syntax in D1 query');
 return {sql:text,params:bound};
}
const jsonColumns=new Set(['metadata','result_metadata','payload','raw']);
const booleanColumns=new Set(['cancel_at_period_end','cancelAtPeriodEnd','disputed','configuration_closed','email_verified','is_suspended','ready']);
export function decodeD1Row(row:Record<string,unknown>){
 return Object.fromEntries(Object.entries(row).map(([key,value])=>[key,jsonColumns.has(key)&&typeof value==='string'?JSON.parse(value):booleanColumns.has(key)&&value!==null?Boolean(value):value]));
}
