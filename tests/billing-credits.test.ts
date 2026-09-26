import fs from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hasActiveSubscription } from "../src/server/billing/credits";

let client: PGlite;

async function createDb() {
  const db = new PGlite();
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
    await db.exec(sql);
  }

  return db;
}

async function insertUser(email: string) {
  const result = await client.query<{ id: string }>("insert into app.users (email) values ($1) returning id", [email]);
  return result.rows[0].id;
}

async function insertSubscription(userId: string, status: string, paidStart: string | null, paidEnd: string | null) {
  await client.query(
    `insert into app.subscriptions
      (user_id, stripe_customer_id, stripe_subscription_id, status, current_period_start, current_period_end,
       paid_current_period_start, paid_current_period_end)
     values ($1, 'cus_test', $2, $3, now(), now() + interval '1 month', $4, $5)`,
    [userId, `sub_${crypto.randomUUID()}`, status, paidStart, paidEnd],
  );
}

describe("billing credit access gate", () => {
  beforeEach(async () => {
    client = await createDb();
  });

  afterEach(async () => {
    await client.close();
  });

  it("requires an active subscription with a confirmed future paid period", async () => {
    const trialUserId = await insertUser("trial@example.com");
    await insertSubscription(trialUserId, "trialing", new Date().toISOString(), new Date(Date.now() + 86_400_000).toISOString());
    await expect(hasActiveSubscription(client as any, trialUserId)).resolves.toBe(false);

    const missingPaidUserId = await insertUser("missing-paid@example.com");
    await insertSubscription(missingPaidUserId, "active", null, null);
    await expect(hasActiveSubscription(client as any, missingPaidUserId)).resolves.toBe(false);

    const paidUserId = await insertUser("paid@example.com");
    await insertSubscription(
      paidUserId,
      "active",
      new Date().toISOString(),
      new Date(Date.now() + 86_400_000).toISOString(),
    );
    await expect(hasActiveSubscription(client as any, paidUserId)).resolves.toBe(true);
  });
});
