import { reconcileRecentWhopPayments } from '@/server/billing/whop/reconcile'
import { startPollLoop } from './poll-loop'
import { usingD1 } from '@/server/db/d1/client'
import { processWhopEvents } from '@/server/billing/whop/events'
import { processPaddleEvents } from '@/server/billing/paddle/events'
import { PgBoss } from 'pg-boss'
import { featureState, requireEnv } from '@/server/env'
import { getPool } from '@/server/db'
import { deleteObject } from '@/server/storage'
import { processSwapJob, queueStaleSwapJobs } from '@/server/swaps/service'
import { runIsolatedNodeTask } from './isolated-task'

const SWAP_QUEUE = 'swap.process'
const pollMs = Number(process.env.WORKER_POLL_MS ?? 3000)
const idleMs = Math.max(pollMs, Number(process.env.WORKER_IDLE_POLL_MS ?? 30000))

if (!featureState().database) {
  throw new Error('Database configuration is required to run the worker.')
}

const boss = usingD1() ? null : new PgBoss({
  connectionString: requireEnv('DATABASE_URL'),
  schema: 'pgboss',
  max: Number(process.env.QUEUE_DATABASE_POOL_MAX ?? 4),
})

await boss?.start()
await boss?.createQueue(SWAP_QUEUE, {
  policy: 'key_strict_fifo',
  retryLimit: 3,
  retryDelay: 10,
  expireInSeconds: 600,
  retentionSeconds: 7 * 24 * 3600,
})

await boss?.work<{ jobId: string }>(SWAP_QUEUE, { batchSize: 1 }, async ([job]) => {
  await processSwapJob(getPool(), job.data.jobId)
})

async function recoverStaleJobs() {
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
 }

async function dispatchOutbox() {
  const pool = getPool()
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
       limit ${usingD1() ? 1 : 25}
       ${usingD1() ? '' : 'for update skip locked'}
     )
     returning id, payload`,
  )
  for (const event of events.rows) {
    try {
      if (!boss) await processSwapJob(pool,event.payload.jobId)
      else await boss.send(SWAP_QUEUE, { jobId: event.payload.jobId }, { singletonKey: event.payload.jobId })
      await pool.query("update app.outbox_events set state = 'done', updated_at = now() where id = $1", [event.id])
    } catch (error) {
      console.error(error)
      await pool.query("update app.outbox_events set state = 'failed', updated_at = now() where id = $1", [event.id])
    }
  }
  return events.rows.length > 0
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

// Billing must not wait for image generation, R2 cleanup, or CMS work.
const stopLanes = [
  startPollLoop(async () => { await reconcileRecentWhopPayments(getPool()) }, 300_000, () => console.error('Payment reconciliation failed; retrying. Check provider permissions and availability.')),
  startPollLoop(async () => processWhopEvents(getPool()), pollMs, () => console.error('Whop processing failed; retrying. Check the billing inbox and database availability.'), {idleMs}),
  startPollLoop(async () => { if (!usingD1()) await processPaddleEvents(getPool()) }, pollMs, error => console.error('Paddle processing failed; retrying.', error)),
  startPollLoop(async () => featureState().swapsEnabled ? dispatchOutbox() : false, pollMs, error => console.error('Swap dispatch failed; retrying.', error), {idleMs}),
  startPollLoop(async () => { if (featureState().swapsEnabled) await recoverStaleJobs() }, 300_000, error => console.error('Swap recovery failed; retrying.', error)),
  startPollLoop(cleanupExpiredAssets, 60_000, error => console.error('Asset cleanup failed; retrying.', error)),
  startPollLoop(processScheduledPosts, 60_000, error => console.error('Scheduled publishing failed; retrying.', error)),
]
let stopping = false
async function shutdown() {
  if (stopping) return
  stopping = true
  // Let in-flight transactions complete instead of exiting between fulfillment and acknowledgment.
  await Promise.all(stopLanes.map(stop => stop()))
  await boss?.stop()
  process.exit(0)
}

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
