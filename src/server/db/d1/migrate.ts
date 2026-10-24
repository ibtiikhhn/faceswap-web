import fs from 'node:fs/promises';
import path from 'node:path';
import {remoteD1} from './client';
export async function migrateD1() {
 const transport=remoteD1('app');
 await transport([{sql:'CREATE TABLE IF NOT EXISTS app_migrations(name TEXT PRIMARY KEY,applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)',params:[]}]);
 const directory=path.join(process.cwd(),'migrations/d1/app');
 for(const file of (await fs.readdir(directory)).filter(n=>n.endsWith('.sql')).sort()) {
  const [found]=await transport([{sql:'SELECT name FROM app_migrations WHERE name=?',params:[file]}]);
  if(found.results.length)continue;
  // Fresh-schema DDL is restartable (IF NOT EXISTS). Apply in small batches
  // within Workers Free D1 query limits. Mark complete only after every batch.
  // Future data migrations must provide their own atomic, idempotent operations.
  const sql=await fs.readFile(path.join(directory,file),'utf8');
  const statements=sql.split(/;\s*(?=CREATE|INSERT|--|$)/i).map(s=>s.trim()).filter(Boolean).map(sql=>({sql,params:[] as unknown[]}));
  for(let offset=0;offset<statements.length;offset+=25)await transport(statements.slice(offset,offset+25));
  await transport([{sql:'INSERT INTO app_migrations(name) VALUES(?) ON CONFLICT(name) DO NOTHING',params:[file]}]);
  console.log(`applied D1 ${file}`);
 }
}
