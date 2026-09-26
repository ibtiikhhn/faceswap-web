import { HttpError } from "@/server/http";
import type { DbClient } from "@/server/db";

export async function creditBalance(client: DbClient, userId: string) {
  const result = await client.query<{ available: string }>(
    `select coalesce(sum(remaining_amount), 0)::text as available
     from app.credit_grants
     where user_id = $1 and remaining_amount > 0 and (expires_at is null or expires_at > now())`,
    [userId]
  );
  return Number(result.rows[0]?.available ?? 0);
}

export async function creditBalances(client: DbClient, userId: string) {
  const result = await client.query<{ available: string; reserved: string }>(
    `select
       coalesce(sum(remaining_amount), 0)::text as available,
       coalesce(sum(reserved_amount), 0)::text as reserved
     from app.credit_grants
     where user_id = $1 and (expires_at is null or expires_at > now())`,
    [userId]
  );
  return {
    available: Number(result.rows[0]?.available ?? 0),
    reserved: Number(result.rows[0]?.reserved ?? 0),
  };
}

export async function hasActiveSubscription(client: DbClient, userId: string) {
  const result = await client.query<{ ok: number }>(
    `select 1 as ok
     from app.subscriptions
     where user_id = $1
       and status = 'active'
       and paid_current_period_start is not null
       and paid_current_period_end > now()
       and not exists (select 1 from app.billing_revocations r where r.reference = app.subscriptions.latest_paid_invoice_id)
     limit 1`,
    [userId]
  );
  return Boolean(result.rows[0]);
}

export async function grantCredits(client: DbClient, input: {
  userId: string;
  amount: number;
  source: string;
  sourceRef: string;
  expiresAt?: Date | null;
}) {
  await client.query(
    `insert into app.credit_grants (user_id, source, source_ref, original_amount, remaining_amount, expires_at)
     values ($1,$2,$3,$4,$4,$5)
     on conflict (source, source_ref) do nothing`,
    [input.userId, input.source, input.sourceRef, input.amount, input.expiresAt ?? null]
  );
}

export async function reserveCreditForJob(client: DbClient, userId: string, jobId: string) {
  if (!(await hasActiveSubscription(client, userId))) {
    throw new HttpError(402, "An active subscription is required to use credits.", "subscription_required");
  }

  const grants = await client.query<{ id: string }>(
    `select id
     from app.credit_grants
     where user_id = $1
       and remaining_amount > 0
       and (expires_at is null or expires_at > now())
     order by expires_at nulls last, created_at
     for update skip locked
     limit 1`,
    [userId]
  );
  const grant = grants.rows[0];
  if (!grant) throw new HttpError(402, "No credits are available.", "credits_required");
  await client.query(
    `update app.credit_grants
     set remaining_amount = remaining_amount - 1, reserved_amount = reserved_amount + 1
     where id = $1`,
    [grant.id]
  );
  await client.query(
    `insert into app.credit_reservations (job_id, grant_id, amount)
     values ($1,$2,1)
     on conflict (job_id) do nothing`,
    [jobId, grant.id]
  );
  await client.query(
    `insert into app.credit_ledger (user_id, grant_id, job_id, kind, amount, idempotency_key)
     values ($1,$2,$3,'reserve',-1,$4)
     on conflict (idempotency_key) do nothing`,
    [userId, grant.id, jobId, `reserve:${jobId}`]
  );
}

export async function consumeReservation(client: DbClient, jobId: string) {
  const result = await client.query<{ id: string; grant_id: string; user_id: string }>(
    `select r.id, r.grant_id, j.user_id
     from app.credit_reservations r
     join app.swap_jobs j on j.id = r.job_id
     where r.job_id = $1 and r.state = 'reserved'
     for update`,
    [jobId]
  );
  const reservation = result.rows[0];
  if (!reservation?.user_id) return;
  await client.query("update app.credit_reservations set state = 'consumed', updated_at = now() where id = $1", [reservation.id]);
  await client.query("update app.credit_grants set reserved_amount = reserved_amount - 1 where id = $1", [reservation.grant_id]);
  await client.query(
    `insert into app.credit_ledger (user_id, grant_id, job_id, kind, amount, idempotency_key)
     values ($1,$2,$3,'consume',0,$4)
     on conflict (idempotency_key) do nothing`,
    [reservation.user_id, reservation.grant_id, jobId, `consume:${jobId}`]
  );
}

export async function releaseReservation(client: DbClient, jobId: string) {
  const result = await client.query<{ id: string; grant_id: string; user_id: string }>(
    `select r.id, r.grant_id, j.user_id
     from app.credit_reservations r
     join app.swap_jobs j on j.id = r.job_id
     where r.job_id = $1 and r.state = 'reserved'
     for update`,
    [jobId]
  );
  const reservation = result.rows[0];
  if (!reservation?.user_id) return;
  await client.query("update app.credit_reservations set state = 'released', updated_at = now() where id = $1", [reservation.id]);
  await client.query(
    `update app.credit_grants
     set reserved_amount = reserved_amount - 1,
         remaining_amount = remaining_amount + case when expires_at is null or expires_at > now() then 1 else 0 end
     where id = $1`,
    [reservation.grant_id]
  );
  await client.query(
    `insert into app.credit_ledger (user_id, grant_id, job_id, kind, amount, idempotency_key)
     values ($1,$2,$3,'release',1,$4)
     on conflict (idempotency_key) do nothing`,
    [reservation.user_id, reservation.grant_id, jobId, `release:${jobId}`]
  );
}
