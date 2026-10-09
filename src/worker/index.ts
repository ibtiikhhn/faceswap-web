import { processPaddleEvents } from '@/server/billing/paddle/events'
import { PgBoss } from 'pg-boss'
import { env, featureState, requireEnv } from '@/server/env'
import { getPool } from '@/server/db'
import { deleteObject } from '@/server/storage'
import { processSwapJob, queueStaleSwapJobs } from '@/server/swaps/service'
import { runIsolatedNodeTask } from './isolated-task'

const parsed = env()
const SWAP_QUEUE = 'swap.process'
const pollMs = Number(process.env.WORKER_POLL_MS ?? 3000)

if (!parsed.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to run the worker.')
}

const boss = new PgBoss({
  connectionString: requireEnv('DATABASE_URL'),
  schema: 'pgboss',
  max: Number(process.env.QUEUE_DATABASE_POOL_MAX ?? 4),
})

await boss.start()
await boss.createQueue(SWAP_QUEUE, {
  policy: 'key_strict_fifo',
  retryLimit: 3,
  retryDelay: 10,
  expireInSeconds: 600,
  retentionSeconds: 7 * 24 * 3600,
})

await boss.work<{ jobId: string }>(SWAP_QUEUE, { batchSize: 1 }, async ([job]) => {
  await processSwapJob(getPool(), job.data.jobId)
})

async function dispatchOutbox() {
  const pool = getPool()
  await queueStaleSwapJobs(pool)
  await pool.query(
    `update app.outbox_events
     set state = 'failed', updated_at = now()
     where topic = 'swap.created'
       and state = 'processing'
       and attempts < 10
       and updated_at < now() - interval '5 minutes'`
  )
  const events = await pool.query<{ id: string; payload: { jobId: string } }>(
    `update app.outbox_events
     set state = 'processing', attempts = attempts + 1, updated_at = now()
     where id in (
       select id
       from app.outbox_events
       where topic = 'swap.created'
         and state in ('pending','failed')
         and attempts < 10
       order by created_at
       limit 25
       for update skip locked
     )
     returning id, payload`,
  )
  for (const event of events.rows) {
    try {
      await boss.send(SWAP_QUEUE, { jobId: event.payload.jobId }, { singletonKey: event.payload.jobId })
      await pool.query("update app.outbox_events set state = 'done', updated_at = now() where id = $1", [event.id])
    } catch (error) {
      console.error(error)
      await pool.query("update app.outbox_events set state = 'failed', updated_at = now() where id = $1", [event.id])
    }
  }
}

async function cleanupExpiredAssets() {
  const pool = getPool()
  const assets = await pool.query<{ id: string; object_key: string }>(
    `select id, object_key
     from app.assets
     where object_deleted_at is null
       and (status = 'deleted' or expires_at < now())
     order by expires_at
     limit 100`
  )
  for (const asset of assets.rows) {
    try {
      await pool.query("update app.assets set status = 'deleted' where id = $1", [asset.id])
      await deleteObject(asset.object_key)
      await pool.query(
        "update app.assets set status = 'deleted', object_deleted_at = now() where id = $1",
        [asset.id]
      )
    } catch (error) {
      console.error(error)
    }
  }
}

let lastCmsRun = 0
async function processScheduledPosts() {
  if (!featureState().payload || Date.now() - lastCmsRun < 60_000) return
  lastCmsRun = Date.now()
  await runIsolatedNodeTask(['--import', 'tsx', 'scripts/run-cms-jobs.ts'])
}

let timer: NodeJS.Timeout | undefined
let stopping = false
let running = false

async function tick() {
  if (running) return
  running = true
  try {
    if (featureState().swapsEnabled) await dispatchOutbox()
    await processPaddleEvents(getPool())
    await cleanupExpiredAssets()
    try { await processScheduledPosts() } catch (error) { console.error("Scheduled publishing failed; will retry.", error) }
  } finally {
    running = false
  }
}

function scheduleNextTick() {
  if (stopping) return
  timer = setTimeout(async () => {
    try {
      await tick()
    } catch (error) {
      console.error(error)
    } finally {
      scheduleNextTick()
    }
  }, pollMs)
}

async function shutdown() {
  if (stopping) return
  stopping = true
  if (timer) clearTimeout(timer)
  await boss.stop()
  process.exit(0)
}

await tick()
scheduleNextTick()

process.on('SIGTERM', () => {
  shutdown().catch((error) => {
    console.error(error)
    process.exit(1)
  })
})

process.on('SIGINT', () => {
  shutdown().catch((error) => {
    console.error(error)
    process.exit(1)
  })
})

console.log('FaceSwap worker is running.')
