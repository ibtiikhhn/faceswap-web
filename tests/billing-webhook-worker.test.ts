import fs from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DbClient } from "@/server/db";

type TestClient = DbClient & PGlite & {
  connect(): Promise<DbClient & { release(): void }>;
};

let currentClient: TestClient;

vi.mock("../src/server/db", () => ({
  getPool: () => currentClient,
}));

async function createDb() {
  const client = new PGlite() as TestClient;
  client.connect = async () => ({
    query: client.query.bind(client),
    release: () => {},
  });

  const migrationDir = path.join(process.cwd(), "migrations", "app");
  const files = (await fs.readdir(migrationDir)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = (await fs.readFile(path.join(migrationDir, file), "utf8"))
      .replace(/create extension if not exists pgcrypto;/gi, "")
      .replaceAll(
        "default gen_random_uuid()",
        "default ('00000000-0000-4000-8000-' || lpad(nextval('app.test_uuid_seq')::text, 12, '0'))::uuid",
      )
      .replace(
        "create schema if not exists app;",
        "create schema if not exists app; create sequence if not exists app.test_uuid_seq;",
      );
    await client.exec(sql);
  }

  return client;
}

async function insertUser(client: TestClient, email: string, stripeCustomerId = "cus_test") {
  const result = await client.query<{ id: string }>(
    "insert into app.users (email, stripe_customer_id) values ($1, $2) returning id",
    [email, stripeCustomerId],
  );
  return result.rows[0].id;
}

async function enqueueStripeEvent(client: TestClient, event: any) {
  const { insertStripeEventInbox } = await import("../src/server/billing/repository");
  return insertStripeEventInbox(event);
}

describe("billing webhook worker", () => {
  beforeEach(async () => {
    currentClient = await createDb();
    process.env.STRIPE_PRICE_MONTHLY = "price_month";
    process.env.BILLING_MONTHLY_CREDITS = "30";
    process.env.STRIPE_PRICE_PACK_SMALL = "price_pack";
    process.env.BILLING_PACK_SMALL_CREDITS = "5";
  });

  afterEach(async () => {
    vi.resetModules();
    delete process.env.STRIPE_PRICE_MONTHLY;
    delete process.env.BILLING_MONTHLY_CREDITS;
    delete process.env.STRIPE_PRICE_PACK_SMALL;
    delete process.env.BILLING_PACK_SMALL_CREDITS;
    await currentClient.close();
  });

  it("grants paid subscription invoice credits once and records active subscription state", async () => {
    const userId = await insertUser(currentClient, "sub@example.com");
    const event = {
      id: "evt_invoice_paid",
      type: "invoice.paid",
      api_version: "2026-09-30",
      livemode: false,
      data: {
        object: {
          id: "in_1",
          customer: "cus_test",
          subscription: "sub_1",
          status: "paid",
          paid: true,
          billing_reason: "subscription_cycle",
          lines: { data: [{ price: { id: "price_month" }, period: { start: 1_000, end: 2_000 } }] },
        },
      },
    };

    await enqueueStripeEvent(currentClient, event);
    const { processStripeWebhookInbox } = await import("../src/server/billing/webhook-worker");
    await expect(processStripeWebhookInbox("evt_invoice_paid")).resolves.toMatchObject({ status: "processed" });

    const grants = await currentClient.query<{ remaining_amount: number }>(
      "select remaining_amount from app.credit_grants where user_id = $1",
      [userId],
    );
    expect(Number(grants.rows[0].remaining_amount)).toBe(30);

    const subscriptions = await currentClient.query<{
      status: string;
      plan_code: string;
      paid_current_period_start: string | null;
      paid_current_period_end: string | null;
      latest_paid_invoice_id: string | null;
    }>(
      "select status, plan_code, paid_current_period_start, paid_current_period_end, latest_paid_invoice_id from app.subscriptions where user_id = $1",
      [userId],
    );
    expect(subscriptions.rows[0]).toMatchObject({
      status: "active",
      plan_code: "monthly",
      latest_paid_invoice_id: "in_1",
    });
    expect(subscriptions.rows[0].paid_current_period_start).toBeTruthy();
    expect(subscriptions.rows[0].paid_current_period_end).toBeTruthy();

    await enqueueStripeEvent(currentClient, { ...event, id: "evt_invoice_paid_again" });
    await expect(processStripeWebhookInbox("evt_invoice_paid_again")).resolves.toMatchObject({ status: "processed" });
    const grantCount = await currentClient.query<{ count: string }>(
      "select count(*)::text from app.credit_grants where user_id = $1",
      [userId],
    );
    expect(grantCount.rows[0].count).toBe("1");
  });

  it("grants paid credit packs idempotently by payment intent", async () => {
    const userId = await insertUser(currentClient, "pack@example.com");
    const { processStripeWebhookInbox } = await import("../src/server/billing/webhook-worker");
    const event = {
      id: "evt_pack",
      type: "checkout.session.completed",
      api_version: "2026-09-30",
      livemode: false,
      data: {
        object: {
          id: "cs_1",
          mode: "payment",
          customer: "cus_test",
          client_reference_id: userId,
          payment_status: "paid",
          payment_intent: "pi_1",
          metadata: { user_id: userId, price_id: "price_pack" },
        },
      },
    };

    await enqueueStripeEvent(currentClient, event);
    await enqueueStripeEvent(currentClient, { ...event, id: "evt_pack_duplicate" });
    await processStripeWebhookInbox("evt_pack");
    await processStripeWebhookInbox("evt_pack_duplicate");

    const grants = await currentClient.query<{ remaining_amount: number; source_ref: string }>(
      "select remaining_amount, source_ref from app.credit_grants where user_id = $1",
      [userId],
    );
    expect(grants.rows).toHaveLength(1);
    expect(Number(grants.rows[0].remaining_amount)).toBe(5);
    expect(grants.rows[0].source_ref).toBe("credit_pack:pi_1:price_pack");
  });

  it("ignores paid subscription invoices without complete paid periods", async () => {
    const userId = await insertUser(currentClient, "missing-period@example.com");
    const { processStripeWebhookInbox } = await import("../src/server/billing/webhook-worker");
    const event = {
      id: "evt_invoice_missing_period",
      type: "invoice.paid",
      api_version: "2026-09-30",
      livemode: false,
      data: {
        object: {
          id: "in_missing_period",
          customer: "cus_test",
          subscription: "sub_missing_period",
          status: "paid",
          paid: true,
          billing_reason: "subscription_cycle",
          lines: { data: [{ price: { id: "price_month" } }] },
        },
      },
    };

    await enqueueStripeEvent(currentClient, event);
    await expect(processStripeWebhookInbox("evt_invoice_missing_period")).resolves.toMatchObject({
      status: "ignored",
      reason: "Paid invoice does not include a complete subscription period.",
    });

    const grants = await currentClient.query<{ count: string }>(
      "select count(*)::text from app.credit_grants where user_id = $1",
      [userId],
    );
    expect(grants.rows[0].count).toBe("0");
  });

  it("records customer identity mismatches without granting invoice credits", async () => {
    const userId = await insertUser(currentClient, "mismatch@example.com");
    const { processStripeWebhookInbox } = await import("../src/server/billing/webhook-worker");
    const event = {
      id: "evt_invoice_mismatch",
      type: "invoice.paid",
      api_version: "2026-09-30",
      livemode: false,
      data: {
        object: {
          id: "in_mismatch",
          customer: "cus_test",
          subscription: "sub_mismatch",
          status: "paid",
          paid: true,
          billing_reason: "subscription_cycle",
          subscription_details: { metadata: { user_id: "00000000-0000-4000-8000-999999999999" } },
          lines: { data: [{ price: { id: "price_month" }, period: { start: 1_000, end: 2_000 } }] },
        },
      },
    };

    await enqueueStripeEvent(currentClient, event);
    await expect(processStripeWebhookInbox("evt_invoice_mismatch")).resolves.toMatchObject({ status: "ignored" });

    const risks = await currentClient.query<{ user_id: string; reason: string }>("select user_id, reason from app.billing_risk_events");
    expect(risks.rows[0]).toMatchObject({
      user_id: userId,
      reason: "Invoice user metadata does not match the linked Stripe customer.",
    });
    const grants = await currentClient.query<{ count: string }>(
      "select count(*)::text from app.credit_grants where user_id = $1",
      [userId],
    );
    expect(grants.rows[0].count).toBe("0");
  });

  it("records payment failures and refunds as risk events without changing credits", async () => {
    const userId = await insertUser(currentClient, "risk@example.com");
    const { processStripeWebhookInbox } = await import("../src/server/billing/webhook-worker");
    const event = {
      id: "evt_refund",
      type: "charge.refunded",
      api_version: "2026-09-30",
      livemode: false,
      data: { object: { id: "ch_1", customer: "cus_test" } },
    };

    await enqueueStripeEvent(currentClient, event);
    await processStripeWebhookInbox("evt_refund");

    const risks = await currentClient.query<{ event_type: string; user_id: string }>(
      "select event_type, user_id from app.billing_risk_events",
    );
    expect(risks.rows[0]).toMatchObject({ event_type: "charge.refunded", user_id: userId });

    const grants = await currentClient.query<{ count: string }>("select count(*)::text from app.credit_grants");
    expect(grants.rows[0].count).toBe("0");
  });

  it("expires grants tied to refunded payment intents so released reservations cannot restore them", async () => {
    const userId = await insertUser(currentClient, "refund-pack@example.com");
    await currentClient.query(
      `insert into app.credit_grants (user_id, source, source_ref, original_amount, remaining_amount, reserved_amount)
       values ($1, 'pack', 'credit_pack:pi_refunded:price_pack', 5, 4, 1)`,
      [userId],
    );
    const { processStripeWebhookInbox } = await import("../src/server/billing/webhook-worker");
    const event = {
      id: "evt_refund_pack",
      type: "charge.refunded",
      api_version: "2026-09-30",
      livemode: false,
      data: { object: { id: "ch_refund_pack", customer: "cus_test", payment_intent: "pi_refunded" } },
    };

    await enqueueStripeEvent(currentClient, event);
    await processStripeWebhookInbox("evt_refund_pack");

    const grants = await currentClient.query<{ expired: boolean }>(
      "select expires_at <= now() as expired from app.credit_grants where user_id = $1",
      [userId],
    );
    expect(grants.rows[0].expired).toBe(true);
  });
});
