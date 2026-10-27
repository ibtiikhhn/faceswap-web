import { usingWhop, whopEnvironment } from './whop/settings';
import { env } from "@/server/env";
import { HttpError } from "@/server/http";
import type { DbClient } from "@/server/db";

// A subscription grant belongs to one paid subscription; packs stand alone.
function usableGrant() {
if(usingWhop())return `(source in ('whop_${whopEnvironment()}_pack','whop_${whopEnvironment()}_subscription') and exists (
 select 1 from app.whop_payments p where p.grant_id=app.credit_grants.id and not p.disputed and not exists (select 1 from app.whop_disputes d where d.payment_id=p.id and d.environment=p.environment and d.status not in ('won','warning_closed')) and p.revoked_credits<app.credit_grants.original_amount
))`;

const prefix=env().PADDLE_ENVIRONMENT==='sandbox'?'paddle_sandbox':'paddle';
return `(source = '${prefix}_pack' or
 (source = '${prefix}_subscription' and exists (
  select 1 from app.paddle_transactions t join app.subscriptions s on s.paddle_subscription_id=t.subscription_id
  where t.grant_id=app.credit_grants.id and s.status='active' and s.paid_current_period_start<=now() and s.paid_current_period_end>now()
 )) or (source not like 'whop_%' and source not in ('paddle_pack','paddle_subscription','paddle_sandbox_pack','paddle_sandbox_subscription') and exists (
  select 1 from app.subscriptions s where s.user_id=app.credit_grants.user_id and s.paddle_subscription_id is null and s.status='active' and s.paid_current_period_end>now()
  and not exists (select 1 from app.billing_revocations r where r.reference=s.latest_paid_invoice_id)
 )))`;
}

export async function creditBalance(client: DbClient, userId: string) {
  const result = await client.query<{ available: string }>(
    `select coalesce(sum(remaining_amount), 0)::text as available
     from app.credit_grants
     where user_id = $1 and ${usableGrant()} and remaining_amount > 0 and (expires_at is null or expires_at > now())`,
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
     where user_id = $1 and ${usableGrant()} and (expires_at is null or expires_at > now())`,
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

  const grants = await client.query<{ id: string }>(
    `select id
     from app.credit_grants
     where user_id = $1
       and remaining_amount > 0
       and ${usableGrant()}
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
  if(usingWhop()) {
    // Recheck at delivery: a refund/dispute may arrive while the provider is rendering.
    // Expiry alone does not invalidate a credit that was reserved within its paid period.
    await client.query('select id from app.whop_payments where grant_id=$1 for update',[reservation.grant_id]);
    const eligible=await client.query(`select id from app.credit_grants
      where id=$1 and ${usableGrant()}
      and original_amount-coalesce((select revoked_credits from app.whop_payments where grant_id=app.credit_grants.id),0)
        > coalesce((select sum(amount) from app.credit_reservations where grant_id=app.credit_grants.id and state='consumed'),0)
      for update`,[reservation.grant_id]);
    if(!eligible.rows.length)throw new HttpError(409,'The payment for this swap was refunded or disputed.','payment_revoked');
  }
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
         remaining_amount = case when source like 'whop_%' then least(
           remaining_amount + case when expires_at is null or expires_at > now() then 1 else 0 end,
           greatest(0,original_amount - coalesce((select revoked_credits from app.whop_payments where grant_id=app.credit_grants.id),0)
             - (reserved_amount-1) - coalesce((select sum(amount) from app.credit_reservations where grant_id=app.credit_grants.id and state='consumed'),0)))
         else remaining_amount + case when expires_at is null or expires_at > now() then 1 else 0 end end
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
