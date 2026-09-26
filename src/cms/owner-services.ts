import { randomUUID } from 'node:crypto'
import { getPool, withTransaction, type DbClient } from '@/server/db'
import { HttpError } from '@/server/http'

export type OwnerActor = {
  id: string | number
  email?: string | null
}

export type OwnerCustomerSummary = {
  id: string
  email: string
  name: string | null
  image: string | null
  stripeCustomerId: string | null
  suspendedAt: string | null
  createdAt: string
  creditsAvailable: number
  creditsReserved: number
  swapsTotal: number
  swapsSucceeded: number
  swapsFailed: number
}

export type OwnerSaasOverview = {
  totals: {
    users: number
    suspendedUsers: number
    creditsAvailable: number
    swapsTotal: number
    swapsSucceeded: number
    swapsFailed: number
  }
  users: OwnerCustomerSummary[]
}

export async function listOwnerSaasOverview(client: DbClient = getPool()): Promise<OwnerSaasOverview> {
  const users = await client.query<{
    id: string
    email: string
    name: string | null
    image: string | null
    stripe_customer_id: string | null
    suspended_at: string | null
    created_at: string
    credits_available: string | number | null
    credits_reserved: string | number | null
    swaps_total: string | number | null
    swaps_succeeded: string | number | null
    swaps_failed: string | number | null
  }>(
    `select
       u.id,
       u.email,
       u.name,
       u.image,
       u.stripe_customer_id,
       u.suspended_at,
       u.created_at,
       coalesce(c.credits_available, 0) as credits_available,
       coalesce(c.credits_reserved, 0) as credits_reserved,
       coalesce(s.swaps_total, 0) as swaps_total,
       coalesce(s.swaps_succeeded, 0) as swaps_succeeded,
       coalesce(s.swaps_failed, 0) as swaps_failed
     from app.users u
     left join (
       select
         user_id,
         sum(remaining_amount) filter (where expires_at is null or expires_at > now()) as credits_available,
         sum(reserved_amount) as credits_reserved
       from app.credit_grants
       group by user_id
     ) c on c.user_id = u.id
     left join (
       select
         user_id,
         count(*) as swaps_total,
         count(*) filter (where state = 'succeeded') as swaps_succeeded,
         count(*) filter (where state = 'failed') as swaps_failed
       from app.swap_jobs
       where user_id is not null
       group by user_id
     ) s on s.user_id = u.id
     order by u.created_at desc
     limit 100`,
  )

  const summaries = users.rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.image,
    stripeCustomerId: row.stripe_customer_id,
    suspendedAt: row.suspended_at,
    createdAt: row.created_at,
    creditsAvailable: Number(row.credits_available ?? 0),
    creditsReserved: Number(row.credits_reserved ?? 0),
    swapsTotal: Number(row.swaps_total ?? 0),
    swapsSucceeded: Number(row.swaps_succeeded ?? 0),
    swapsFailed: Number(row.swaps_failed ?? 0),
  }))

  return {
    totals: {
      users: summaries.length,
      suspendedUsers: summaries.filter((user) => user.suspendedAt).length,
      creditsAvailable: summaries.reduce((sum, user) => sum + user.creditsAvailable, 0),
      swapsTotal: summaries.reduce((sum, user) => sum + user.swapsTotal, 0),
      swapsSucceeded: summaries.reduce((sum, user) => sum + user.swapsSucceeded, 0),
      swapsFailed: summaries.reduce((sum, user) => sum + user.swapsFailed, 0),
    },
    users: summaries,
  }
}

export async function grantOwnerCredits(input: {
  actor: OwnerActor
  userId: string
  amount: number
  reason: string
  client?: DbClient
}) {
  if (!Number.isInteger(input.amount) || input.amount < 1 || input.amount > 10000) {
    throw new HttpError(400, 'Credit amount must be a whole number between 1 and 10000.', 'invalid_credit_amount')
  }

  const reason = input.reason.trim()
  if (reason.length < 4 || reason.length > 240) {
    throw new HttpError(400, 'Reason must be between 4 and 240 characters.', 'invalid_reason')
  }

  const run = async (tx: DbClient) => {
    const user = await tx.query<{ id: string }>('select id from app.users where id = $1 for update', [input.userId])
    if (!user.rows[0]) {
      throw new HttpError(404, 'User not found.', 'user_not_found')
    }

    const sourceRef = `owner:${input.actor.id}:${randomUUID()}`
    const grant = await tx.query<{ id: string }>(
      `insert into app.credit_grants (user_id, source, source_ref, original_amount, remaining_amount, reserved_amount)
       values ($1, 'owner_adjustment', $2, $3, $3, 0)
       returning id`,
      [input.userId, sourceRef, input.amount],
    )

    await tx.query(
      `insert into app.credit_ledger (user_id, grant_id, kind, amount, idempotency_key, metadata)
       values ($1, $2, 'grant', $3, $4, $5::jsonb)`,
      [
        input.userId,
        grant.rows[0].id,
        input.amount,
        `ledger:${sourceRef}`,
        JSON.stringify({
          actorType: 'owner',
          actorId: String(input.actor.id),
          actorEmail: input.actor.email ?? null,
          reason,
        }),
      ],
    )

    return { grantId: grant.rows[0].id, sourceRef }
  }

  if (input.client) return run(input.client)
  return withTransaction(getPool(), run)
}

export async function setOwnerUserSuspension(input: {
  actor: OwnerActor; userId: string; suspended: boolean; reason: string; client?: DbClient
}) {
  if (!/^[0-9a-f-]{36}$/i.test(input.userId)) throw new HttpError(400, 'Invalid user ID.', 'invalid_user');
  const reason = input.reason.trim();
  if (reason.length < 4 || reason.length > 240) throw new HttpError(400, 'Provide a reason between 4 and 240 characters.', 'invalid_reason');
  return withTransaction(input.client ?? getPool(), async tx => {
    const ready = await tx.query<{ ready: boolean }>("select to_regclass('app.owner_audit') is not null as ready")
    if (!ready.rows[0]?.ready) throw new HttpError(503, 'Run the application migrations before changing account access.', 'migration_required')
    const user = await tx.query<{ id: string; deletion_requested_at: Date | null }>('select id, deletion_requested_at from app.users where id=$1 for update', [input.userId]);
    if (!user.rows[0]) throw new HttpError(404, 'User not found.', 'user_not_found');
    if (user.rows[0].deletion_requested_at) throw new HttpError(409, 'An account pending deletion cannot be restored.', 'account_deleted');
    await tx.query('update app.users set suspended_at = case when $2 then now() else null end, updated_at=now() where id=$1', [input.userId, input.suspended]);
    if (input.suspended) await tx.query('delete from app.sessions where user_id=$1', [input.userId]);
    await tx.query('insert into app.owner_audit(owner_id,user_id,action,reason) values($1,$2,$3,$4)', [String(input.actor.id), input.userId, input.suspended ? 'suspend' : 'restore', reason]);
  });
}

export async function listOwnerOperations(client: DbClient = getPool()) {
  const readiness = await client.query<{ ready: boolean }>("select to_regclass('app.owner_audit') is not null as ready")
  const auditReady = Boolean(readiness.rows[0]?.ready)
  const [jobs, subscriptions, audit] = await Promise.all([
    client.query<{ id: string; email: string | null; state: string; mode: string; created_at: string; error_message: string | null }>(
      `select j.id,u.email,j.state,j.mode,j.created_at,j.error_message from app.swap_jobs j left join app.users u on u.id=j.user_id order by j.created_at desc limit 50`),
    client.query<{ id: string; email: string; status: string; plan_code: string | null; paid_current_period_end: string | null; cancel_at_period_end: boolean }>(
      `select s.id,u.email,s.status,s.plan_code,s.paid_current_period_end,s.cancel_at_period_end from app.subscriptions s join app.users u on u.id=s.user_id order by s.updated_at desc limit 50`),
    auditReady ? client.query<{ id: string; owner_id: string; action: string; reason: string; created_at: string; email: string | null }>(
      `select a.*,u.email from app.owner_audit a left join app.users u on u.id=a.user_id order by a.created_at desc limit 50`) : Promise.resolve({ rows: [] }),
  ]);
  return { jobs: jobs.rows, subscriptions: subscriptions.rows, audit: audit.rows, auditReady };
}
