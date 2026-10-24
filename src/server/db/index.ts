import { D1Client, usingD1, remoteD1, isD1 } from './d1/client'
import { plannedTransaction } from './d1/plan'
import { d1Binding } from './d1/binding'
import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import * as d1Schema from './d1/auth-schema'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { requireEnv } from '@/server/env'
import * as schema from './schema'

export type DbClient = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>
}

type ConnectableDbClient = DbClient & {
  connect?: () => Promise<DbClient & { release: () => void }>
}

let pool: pg.Pool | undefined
let d1: D1Client | undefined

export function getPool(): DbClient & { connect: () => Promise<DbClient & {release:()=>void}>; end:()=>Promise<void> } {
  if (usingD1()) return d1 ??= new D1Client(remoteD1('app'))
  if (!pool) {
    pool = new pg.Pool({
      connectionString: requireEnv('DATABASE_URL'),
      max: Number(process.env.DATABASE_POOL_MAX ?? 8),
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
    })
  }
  return pool
}

export function getDb() {
  if (usingD1()) return drizzleD1(d1Binding('app'), { schema: d1Schema })
  return drizzle(getPool() as pg.Pool, { schema })
}

export type AppDb = ReturnType<typeof getDb>

export async function withTransaction<T>(client: ConnectableDbClient, fn: (tx: DbClient) => Promise<T>): Promise<T> {
  if (isD1(client)) return plannedTransaction(client, fn)
  const tx = typeof client.connect === 'function' ? await client.connect() : client
  try {
    await tx.query('begin')
    const result = await fn(tx)
    await tx.query('commit')
    return result
  } catch (error) {
    await tx.query('rollback')
    throw error
  } finally {
    if ('release' in tx && typeof tx.release === 'function') tx.release()
  }
}
