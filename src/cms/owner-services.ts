import { plannedReturning } from '@/server/db/d1/plan';
import { isD1 } from '@/server/db/d1/client';
import { randomUUID } from 'node:crypto';
import { getPool, withTransaction, type DbClient } from '@/server/db';
import { HttpError } from '@/server/http';

export type OwnerActor = {
  id: string | number;
  email?: string | null;
};

export type OwnerCustomerSummary = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  stripeCustomerId: string | null;
  suspendedAt: string | null;
  createdAt: string;
  creditsAvailable: number;
  creditsReserved: number;
  swapsTotal: number;
  swapsSucceeded: number;
  swapsFailed: number;
};

export type OwnerSaasOverview = {
  totals: {
    users: number;
    suspendedUsers: number;
    creditsAvailable: number;
    swapsTotal: number;
    swapsSucceeded: number;
    swapsFailed: number;
  };
  users: OwnerCustomerSummary[];
  matchedUsers: number;
  page: number;
};

export async function listOwnerSaasOverview(
  client: DbClient = getPool(),
  options: {
    search?: string;
    page?: number;
    customerId?: string;
    access?: string;
  } = {},
): Promise<OwnerSaasOverview> {
  const page = ownerPage(options.page);
  const search = (options.search || '').trim().slice(0, 200).toLowerCase();
  const filter = `where ($1 = '' or lower(u.email) like $2 or lower(coalesce(u.name,'')) like $2) and ($3 = '' or u.id = nullif($3,'')::uuid) and ($4='' or ($4='active' and u.suspended_at is null) or ($4='suspended' and u.suspended_at is not null))`;
  const params = [
    search,
    `%${search}%`,
    options.customerId || '',
    ['active', 'suspended'].includes(options.access || '')
      ? options.access
      : '',
  ];
  const users = await client.query<{
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    stripe_customer_id: string | null;
    suspended_at: string | null;
    created_at: string;
    credits_available: string | number | null;
    credits_reserved: string | number | null;
    swaps_total: string | number | null;
    swaps_succeeded: string | number | null;
    swaps_failed: string | number | null;
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
     ${filter}
     order by u.created_at desc, u.id
     limit 25 offset $5`,
    [...params, (page - 1) * 25],
  );

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
  }));

  const [totals, matched] = await Promise.all([
    client.query<Record<string, number | string>>(`select
      (select count(*) from app.users) as users,
      (select count(*) from app.users where suspended_at is not null) as suspended,
      (select coalesce(sum(remaining_amount),0) from app.credit_grants where expires_at is null or expires_at > now()) as credits,
      (select count(*) from app.swap_jobs) as swaps,
      (select count(*) from app.swap_jobs where state='succeeded') as succeeded,
      (select count(*) from app.swap_jobs where state='failed') as failed`),
    client.query<{ count: number | string }>(
      `select count(*) as count from app.users u ${filter}`,
      params,
    ),
  ]);
  const t = totals.rows[0];
  return {
    totals: {
      users: Number(t.users),
      suspendedUsers: Number(t.suspended),
      creditsAvailable: Number(t.credits),
      swapsTotal: Number(t.swaps),
      swapsSucceeded: Number(t.succeeded),
      swapsFailed: Number(t.failed),
    },
    users: summaries,
    matchedUsers: Number(matched.rows[0].count),
    page,
  };
}

export async function grantOwnerCredits(input: {
  actor: OwnerActor;
  userId: string;
  amount: number;
  reason: string;
  client?: DbClient;
  requestKey?: string;
}) {
  if (
    !Number.isInteger(input.amount) ||
    input.amount < 1 ||
    input.amount > 10000
  ) {
    throw new HttpError(
      400,
      'Credit amount must be a whole number between 1 and 10000.',
      'invalid_credit_amount',
    );
  }

  const reason = input.reason.trim();
  if (reason.length < 4 || reason.length > 240) {
    throw new HttpError(
      400,
      'Reason must be between 4 and 240 characters.',
      'invalid_reason',
    );
  }

  if (input.requestKey && !/^[0-9a-f-]{36}$/i.test(input.requestKey))
    throw new HttpError(400, 'Invalid action reference.', 'invalid_request');
  const sourceRef = `owner:${input.actor.id}:${input.requestKey || randomUUID()}`;
  const run = async (tx: DbClient) => {
    const user = await tx.query<{ id: string }>(
      'select id from app.users where id = $1 for update',
      [input.userId],
    );
    if (!user.rows[0]) {
      throw new HttpError(404, 'User not found.', 'user_not_found');
    }

    const previous = await tx.query<{
      id: string;
      user_id: string;
      original_amount: number;
    }>(
      "select id,user_id,original_amount from app.credit_grants where source_ref=$1 and source='owner_adjustment'",
      [sourceRef],
    );
    if (previous.rows[0]) {
      if (
        previous.rows[0].user_id !== input.userId ||
        Number(previous.rows[0].original_amount) !== input.amount
      )
        throw new HttpError(
          409,
          'This action reference was already used. Reload before making a different adjustment.',
          'action_conflict',
        );
      return { grantId: previous.rows[0].id, sourceRef };
    }
    const id = randomUUID();
    const grant = await plannedReturning(
      tx,
      `insert into app.credit_grants (user_id, source, source_ref, original_amount, remaining_amount, reserved_amount, id)
       values ($1, 'owner_adjustment', $2, $3, $3, 0, $4)
       returning id`,
      [input.userId, sourceRef, input.amount, id],
      async () => [{ id }],
    );

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
    );

    return { grantId: grant.rows[0].id, sourceRef };
  };

  if (input.client && !isD1(input.client)) return run(input.client);
  return withTransaction(input.client ?? getPool(), run);
}

export async function setOwnerUserSuspension(input: {
  actor: OwnerActor;
  userId: string;
  suspended: boolean;
  reason: string;
  client?: DbClient;
}) {
  if (!/^[0-9a-f-]{36}$/i.test(input.userId))
    throw new HttpError(400, 'Invalid user ID.', 'invalid_user');
  const reason = input.reason.trim();
  if (reason.length < 4 || reason.length > 240)
    throw new HttpError(
      400,
      'Provide a reason between 4 and 240 characters.',
      'invalid_reason',
    );
  return withTransaction(input.client ?? getPool(), async (tx) => {
    const ready = await tx.query<{ ready: boolean }>(
      "select to_regclass('app.owner_audit') is not null as ready",
    );
    if (!ready.rows[0]?.ready)
      throw new HttpError(
        503,
        'Run the application migrations before changing account access.',
        'migration_required',
      );
    const user = await tx.query<{
      id: string;
      deletion_requested_at: Date | null;
    }>(
      'select id, deletion_requested_at from app.users where id=$1 for update',
      [input.userId],
    );
    if (!user.rows[0])
      throw new HttpError(404, 'User not found.', 'user_not_found');
    if (user.rows[0].deletion_requested_at)
      throw new HttpError(
        409,
        'An account pending deletion cannot be restored.',
        'account_deleted',
      );
    await tx.query(
      'update app.users set suspended_at = case when $2 then now() else null end, updated_at=now() where id=$1',
      [input.userId, input.suspended],
    );
    if (input.suspended)
      await tx.query('delete from app.sessions where user_id=$1', [
        input.userId,
      ]);
    await tx.query(
      'insert into app.owner_audit(owner_id,user_id,action,reason) values($1,$2,$3,$4)',
      [
        String(input.actor.id),
        input.userId,
        input.suspended ? 'suspend' : 'restore',
        reason,
      ],
    );
  });
}

export async function listOwnerOperations(client: DbClient = getPool()) {
  const readiness = await client.query<{ ready: boolean }>(
    "select to_regclass('app.owner_audit') is not null as ready",
  );
  const auditReady = Boolean(readiness.rows[0]?.ready);
  const [subscriptions, audit] = await Promise.all([
    client.query<{
      id: string;
      email: string;
      status: string;
      plan_code: string | null;
      paid_current_period_end: string | null;
      cancel_at_period_end: boolean;
    }>(
      `select s.id,u.email,s.status,s.plan_code,s.paid_current_period_end,s.cancel_at_period_end from app.subscriptions s join app.users u on u.id=s.user_id order by s.updated_at desc limit 50`,
    ),
    auditReady
      ? client.query<{
          id: string;
          owner_id: string;
          action: string;
          reason: string;
          created_at: string;
          email: string | null;
        }>(
          `select a.*,u.email from app.owner_audit a left join app.users u on u.id=a.user_id order by a.created_at desc limit 50`,
        )
      : Promise.resolve({ rows: [] }),
  ]);
  return { subscriptions: subscriptions.rows, audit: audit.rows, auditReady };
}

export type OwnerJob = {
  id: string;
  user_id: string | null;
  email: string | null;
  state: string;
  mode: string;
  provider_mode: string;
  provider_request_id: string | null;
  updated_at: string;
  created_at: string;
  finished_at: string | null;
  error_message: string | null;
  error_code: string | null;
  source_asset_id: string;
  target_asset_id: string;
  result_asset_id: string | null;
  source_status: string | null;
  target_status: string | null;
  result_status: string | null;
  source_expires: string | null;
  target_expires: string | null;
  result_expires: string | null;
  credit_state: string | null;
  credit_amount: number | null;
};
export function ownerPage(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(1, Math.min(100000, Math.floor(n))) : 1;
}
export async function listOwnerGenerations(
  options: {
    userId?: string;
    page?: number;
    state?: string;
    search?: string;
    stale?: boolean;
    mode?: string;
  } = {},
  client: DbClient = getPool(),
) {
  const page = ownerPage(options.page);
  const params = [
    options.userId || '',
    options.state || '',
    `%${(options.search || '').trim().toLowerCase().slice(0, 200)}%`,
    Boolean(options.stale),
    ['guest_trial', 'paid_credit'].includes(options.mode || '')
      ? options.mode
      : '',
  ];
  const filter = `where ($1='' or j.user_id=nullif($1,'')::uuid) and ($2='' or j.state=$2) and (lower(cast(j.id as text)) like $3 or lower(coalesce(u.email,'')) like $3) and (not $4 or (j.state in ('queued','validating','processing','saving','retry_wait','reconciling') and j.updated_at<now()-interval '15 minutes')) and ($5='' or j.mode=$5)`;
  const [jobs, count] = await Promise.all([
    client.query<OwnerJob>(
      `select j.id,j.user_id,u.email,j.state,j.mode,j.provider_mode,j.provider_request_id,j.updated_at,j.created_at,j.finished_at,j.error_message,j.error_code,
      j.source_asset_id,j.target_asset_id,j.result_asset_id,
      a.status as source_status,b.status as target_status,c.status as result_status,
      a.expires_at as source_expires,b.expires_at as target_expires,c.expires_at as result_expires,
      r.state as credit_state,r.amount as credit_amount
      from app.swap_jobs j left join app.users u on u.id=j.user_id
      left join app.assets a on a.id=j.source_asset_id left join app.assets b on b.id=j.target_asset_id
      left join app.assets c on c.id=j.result_asset_id left join app.credit_reservations r on r.job_id=j.id
      ${filter} order by j.created_at desc,j.id limit 12 offset $6`,
      [...params, (page - 1) * 12],
    ),
    client.query<{ count: number | string }>(
      `select count(*) as count from app.swap_jobs j left join app.users u on u.id=j.user_id ${filter}`,
      params,
    ),
  ]);
  return { jobs: jobs.rows, total: Number(count.rows[0].count), page };
}
export async function getOwnerCustomerActivity(
  userId: string,
  client: DbClient = getPool(),
) {
  const [subscriptions, ledger] = await Promise.all([
    client.query<{
      id: string;
      status: string;
      plan_code: string | null;
      paid_current_period_end: string | null;
      cancel_at_period_end: boolean;
    }>(
      'select id,status,plan_code,paid_current_period_end,cancel_at_period_end from app.subscriptions where user_id=$1 order by updated_at desc limit 10',
      [userId],
    ),
    client.query<{
      id: string;
      kind: string;
      amount: number;
      created_at: string;
      job_id: string | null;
      metadata: { reason?: string; actorEmail?: string };
    }>(
      'select id,kind,amount,created_at,job_id,metadata from app.credit_ledger where user_id=$1 order by created_at desc limit 30',
      [userId],
    ),
  ]);
  return { subscriptions: subscriptions.rows, ledger: ledger.rows };
}
