import { getPool } from "../db";
import type { AuthenticatedUser } from "./types";

type Queryable = {
  query<T = any>(sql: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
};

type TransactionClient = Queryable & {
  release(): void;
};

export type StripeEventInboxRow = {
  id: string;
  type: string;
  status: "pending" | "processing" | "processed" | "failed" | "ignored";
  payload: unknown;
};

export async function withBillingTransaction<T>(callback: (client: TransactionClient) => Promise<T>): Promise<T> {
  const client = (await getPool().connect()) as TransactionClient;
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type BillingCustomer = {
  customerId: string;
  stripeCustomerId: string;
};

export async function getOrCreateBillingCustomer(user: AuthenticatedUser): Promise<BillingCustomer> {
  return withBillingTransaction(async (client) => {
    const existing = await client.query<{ id: string; stripe_customer_id: string | null }>(
      "select id, stripe_customer_id from app.users where id = $1 for update",
      [user.id],
    );
    if (existing.rows[0]?.stripe_customer_id) {
      return {
        customerId: existing.rows[0].id,
        stripeCustomerId: existing.rows[0].stripe_customer_id,
      };
    }

    return createAndStoreStripeCustomer(client, user);
  });
}

export async function getOrCreateStripeCustomerId(user: AuthenticatedUser): Promise<string> {
  const customer = await getOrCreateBillingCustomer(user);
  return customer.stripeCustomerId;
}

async function createAndStoreStripeCustomer(client: Queryable, user: AuthenticatedUser): Promise<BillingCustomer> {
  const { getStripe } = await import("./stripe");
  const stripe = await getStripe();
  const customer = await stripe.customers.create({
    email: user.email || undefined,
    metadata: {
      user_id: user.id,
    },
  }, {idempotencyKey:`customer:${user.id}`});

  const stored = await client.query<{ id: string; stripe_customer_id: string }>(
    `insert into app.users (id, email, stripe_customer_id)
     values ($1, $2, $3)
     on conflict (id)
     do update set stripe_customer_id = excluded.stripe_customer_id, updated_at = now()
     returning id, stripe_customer_id`,
    [user.id, user.email || "", customer.id],
  );

  return {
    customerId: stored.rows[0].id,
    stripeCustomerId: stored.rows[0].stripe_customer_id,
  };
}

export async function insertStripeEventInbox(event: any): Promise<"inserted" | "duplicate"> {
  const inserted = await getPool().query(
    `insert into app.stripe_event_inbox (id, type, api_version, livemode, payload, status)
     values ($1, $2, $3, $4, $5::jsonb, 'pending')
     on conflict (id) do nothing`,
    [event.id, event.type, event.api_version ?? null, Boolean(event.livemode), JSON.stringify(event)],
  );

  return inserted.rowCount === 1 ? "inserted" : "duplicate";
}

export async function claimPendingStripeEvent(eventId?: string): Promise<StripeEventInboxRow | null> {
  const values = eventId ? [eventId] : [];
  await getPool().query("update app.stripe_event_inbox set status='failed' where status='processing' and processing_started_at<now()-interval '5 minutes'");
  const where = eventId ? "where id = $1 and status in ('pending', 'failed')" : "where status in ('pending', 'failed') and attempts < 10 and (processing_started_at is null or processing_started_at < now()-interval '10 seconds')";

  return withBillingTransaction(async (client) => {
    const result = await client.query<StripeEventInboxRow>(
      `select id, type, status, payload
       from app.stripe_event_inbox
       ${where}
       order by received_at
       for update skip locked
       limit 1`,
      values,
    );

    const row = result.rows[0];
    if (!row) return null;

    await client.query(
      `update app.stripe_event_inbox
       set status = 'processing', attempts = attempts + 1, processing_started_at = now(), last_error = null
       where id = $1`,
      [row.id],
    );

    return row;
  });
}

export async function markStripeEventProcessed(eventId: string): Promise<void> {
  await getPool().query(
    `update app.stripe_event_inbox
     set status = 'processed', processed_at = now(), last_error = null
     where id = $1`,
    [eventId],
  );
}

export async function markStripeEventIgnored(eventId: string, reason: string): Promise<void> {
  await getPool().query(
    `update app.stripe_event_inbox
     set status = 'ignored', processed_at = now(), last_error = $2
     where id = $1`,
    [eventId, reason],
  );
}

export async function markStripeEventFailed(eventId: string, error: unknown): Promise<void> {
  await getPool().query(
    `update app.stripe_event_inbox
     set status = 'failed', last_error = $2
     where id = $1`,
    [eventId, error instanceof Error ? error.message : String(error)],
  );
}

export async function findCustomerIdByStripeCustomer(stripeCustomerId: string): Promise<string | null> {
  const result = await getPool().query<{ id: string }>(
    "select id from app.users where stripe_customer_id = $1",
    [stripeCustomerId],
  );
  return result.rows[0]?.id ?? null;
}

export async function grantCreditsOnce(input: {
  customerId: string;
  amount: number;
  source: "subscription_invoice" | "credit_pack";
  idempotencyKey: string;
  expiresAt: Date | null;
  stripeCustomerId: string;
  stripeSubscriptionId?: string | null;
  stripeInvoiceId?: string | null;
  stripePaymentIntentId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<"granted" | "duplicate"> {
  return withBillingTransaction(async (client) => {
    const references = [input.stripePaymentIntentId, input.stripeInvoiceId].filter((ref): ref is string => Boolean(ref)).sort();
    for (const reference of references) await client.query('select pg_advisory_xact_lock(hashtext($1))', [`billing:${reference}`]);
    const revoked=await client.query('select 1 from app.billing_revocations where reference=any($1::text[])',[[input.stripePaymentIntentId,input.stripeInvoiceId].filter(Boolean)]);
    if(revoked.rowCount) return 'duplicate';
    const grant = await client.query<{ id: string }>(
      `insert into app.credit_grants
        (user_id, source, source_ref, original_amount, remaining_amount, reserved_amount, expires_at)
       values ($1, $2, $3, $4, $4, 0, $5)
       on conflict (source, source_ref) do nothing
       returning id`,
      [
        input.customerId,
        input.source === "subscription_invoice" ? "subscription" : "pack",
        input.idempotencyKey,
        input.amount,
        input.expiresAt,
      ],
    );

    if (grant.rowCount !== 1) return "duplicate";

    await client.query(
      `insert into app.credit_ledger
        (user_id, grant_id, kind, amount, idempotency_key, metadata)
       values ($1, $2, 'grant', $3, $4, $5::jsonb)
       on conflict (idempotency_key) do nothing`,
      [
        input.customerId,
        grant.rows[0].id,
        input.amount,
        `ledger:${input.idempotencyKey}`,
        JSON.stringify({
          ...input.metadata,
          actorType: "stripe",
          actorId: input.stripeCustomerId,
          reason: input.source,
          stripeSubscriptionId: input.stripeSubscriptionId ?? null,
          stripeInvoiceId: input.stripeInvoiceId ?? null,
          stripePaymentIntentId: input.stripePaymentIntentId ?? null,
        }),
      ],
    );

    return "granted";
  });
}

export async function upsertSubscriptionState(input: {
  customerId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string | null;
  planCode: string | null;
  status: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  paidCurrentPeriodStart?: Date | null;
  paidCurrentPeriodEnd?: Date | null;
  latestPaidInvoiceId?: string | null;
  stripeEventCreatedAt: Date;
  cancelAtPeriodEnd: boolean;
  raw: unknown;
}): Promise<void> {
  await getPool().query(
    `insert into app.subscriptions
      (user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, plan_code, status,
       current_period_start, current_period_end, paid_current_period_start, paid_current_period_end,
       latest_paid_invoice_id, latest_stripe_event_created_at, cancel_at_period_end, raw)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
     on conflict (stripe_subscription_id)
     do update set
       user_id = excluded.user_id,
       stripe_customer_id = excluded.stripe_customer_id,
       stripe_price_id = case when excluded.latest_stripe_event_created_at >= coalesce(app.subscriptions.latest_stripe_event_created_at, 'epoch') then excluded.stripe_price_id else app.subscriptions.stripe_price_id end,
       plan_code = case when excluded.latest_stripe_event_created_at >= coalesce(app.subscriptions.latest_stripe_event_created_at, 'epoch') then excluded.plan_code else app.subscriptions.plan_code end,
       status = case when excluded.latest_stripe_event_created_at >= coalesce(app.subscriptions.latest_stripe_event_created_at, 'epoch') then excluded.status else app.subscriptions.status end,
       current_period_start = case when excluded.latest_stripe_event_created_at >= coalesce(app.subscriptions.latest_stripe_event_created_at, 'epoch') then excluded.current_period_start else app.subscriptions.current_period_start end,
       current_period_end = case when excluded.latest_stripe_event_created_at >= coalesce(app.subscriptions.latest_stripe_event_created_at, 'epoch') then excluded.current_period_end else app.subscriptions.current_period_end end,
       paid_current_period_start = greatest(excluded.paid_current_period_start, app.subscriptions.paid_current_period_start),
       paid_current_period_end = greatest(excluded.paid_current_period_end, app.subscriptions.paid_current_period_end),
       latest_paid_invoice_id = case when excluded.paid_current_period_end >= coalesce(app.subscriptions.paid_current_period_end, 'epoch') then coalesce(excluded.latest_paid_invoice_id, app.subscriptions.latest_paid_invoice_id) else app.subscriptions.latest_paid_invoice_id end,
       latest_stripe_event_created_at = greatest(excluded.latest_stripe_event_created_at, app.subscriptions.latest_stripe_event_created_at),
       cancel_at_period_end = case when excluded.latest_stripe_event_created_at >= coalesce(app.subscriptions.latest_stripe_event_created_at, 'epoch') then excluded.cancel_at_period_end else app.subscriptions.cancel_at_period_end end,
       raw = case when excluded.latest_stripe_event_created_at >= coalesce(app.subscriptions.latest_stripe_event_created_at, 'epoch') then excluded.raw else app.subscriptions.raw end,
       updated_at = now()
`,
    [
      input.customerId,
      input.stripeCustomerId,
      input.stripeSubscriptionId,
      input.stripePriceId,
      input.planCode,
      input.status,
      input.currentPeriodStart,
      input.currentPeriodEnd,
      input.paidCurrentPeriodStart ?? null,
      input.paidCurrentPeriodEnd ?? null,
      input.latestPaidInvoiceId ?? null,
      input.stripeEventCreatedAt,
      input.cancelAtPeriodEnd,
      JSON.stringify(input.raw ?? {}),
    ],
  );
}

export async function recordBillingRisk(input: {
  customerId: string | null;
  stripeCustomerId: string | null;
  eventType: string;
  stripeObjectId: string | null;
  reason: string;
  payload: unknown;
}): Promise<void> {
  await getPool().query(
    `insert into app.billing_risk_events
      (user_id, stripe_customer_id, event_type, stripe_object_id, reason, payload)
     values ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      input.customerId,
      input.stripeCustomerId,
      input.eventType,
      input.stripeObjectId,
      input.reason,
      JSON.stringify(input.payload),
    ],
  );
}

export async function expireCreditsForStripeRisk(input: {
  stripePaymentIntentId?: string | null;
  stripeInvoiceId?: string | null;
}): Promise<number> {
  return withBillingTransaction(async (client) => {
  const references=[input.stripePaymentIntentId,input.stripeInvoiceId].filter((ref): ref is string => Boolean(ref)).sort();
  for (const reference of references) await client.query('select pg_advisory_xact_lock(hashtext($1))', [`billing:${reference}`]);
  for(const reference of references) await client.query('insert into app.billing_revocations(reference) values($1) on conflict do nothing',[reference]);
  const sourceRefs: string[] = [];
  if (input.stripePaymentIntentId) sourceRefs.push(`credit_pack:${input.stripePaymentIntentId}:%`);
  if (input.stripeInvoiceId) sourceRefs.push(`subscription_invoice:${input.stripeInvoiceId}:%`);
  if (sourceRefs.length === 0) return 0;

  const result = await client.query(
    `update app.credit_grants
     set expires_at = least(coalesce(expires_at, now()), now())
     where source_ref like any($1::text[])
       and (expires_at is null or expires_at > now())`,
    [sourceRefs],
  );

  return result.rowCount ?? 0;
  });
}
