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

export function getPool() {
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
  return drizzle(getPool(), { schema })
}

export type AppDb = ReturnType<typeof getDb>

export async function withTransaction<T>(client: ConnectableDbClient, fn: (tx: DbClient) => Promise<T>): Promise<T> {
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
