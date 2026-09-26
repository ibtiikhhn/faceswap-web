import fs from 'node:fs/promises';
import path from 'node:path';
import { getPool } from '@/server/db';
const pool=getPool();
const client=await pool.connect();
try {
 await client.query("select pg_advisory_lock(hashtext('facecraft-app-migrations'))");
 await client.query('create schema if not exists app; create table if not exists app.migrations(name text primary key, applied_at timestamptz not null default now())');
 const dir=path.join(process.cwd(),'migrations','app');
 for(const file of (await fs.readdir(dir)).filter(name=>name.endsWith('.sql')).sort()) {
  if((await client.query('select 1 from app.migrations where name=$1',[file])).rowCount) continue;
  await client.query('begin');
  try { await client.query(await fs.readFile(path.join(dir,file),'utf8')); await client.query('insert into app.migrations(name) values($1)',[file]); await client.query('commit'); console.log(`applied ${file}`); }
  catch(error){await client.query('rollback');throw error;}
 }
} finally { await client.query("select pg_advisory_unlock(hashtext('facecraft-app-migrations'))");client.release();await pool.end(); }
