import fs from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { createSwapJob, markJobFailed, processSwapJob, queueStaleSwapJobs } from "@/server/swaps/service";
import { grantCredits } from "@/server/billing/credits";
import { hashGuestToken } from "@/server/auth/guest";
import * as customProvider from "@/server/swaps/providers/custom";
import { putObject, getObject } from "@/server/storage";
import type { DbClient } from "@/server/db";

async function db() {
  const client = new PGlite();
  const migrationDir = path.join(process.cwd(), "migrations", "app");
  const files = (await fs.readdir(migrationDir)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const migration = (await fs.readFile(path.join(migrationDir, file), "utf8"))
      .replace(/create extension if not exists pgcrypto;/gi, "")
      .replaceAll(
        "default gen_random_uuid()",
        "default ('00000000-0000-4000-8000-' || lpad(nextval('app.test_uuid_seq')::text, 12, '0'))::uuid",
      )
      .replace("create schema if not exists app;", "create schema if not exists app; create sequence if not exists app.test_uuid_seq;");
    await client.exec(migration);
  }
  return client as unknown as DbClient & PGlite;
}

async function createAsset(client: PGlite, owner: { userId?: string; guestId?: string }, kind: "source" | "target") {
  const row = await client.query<{ id: string }>(
    `insert into app.assets (user_id, guest_id, kind, object_key, content_type, width, height, byte_count)
     values ($1,$2,$3,$4,'image/webp',10,10,5)
     returning id`,
    [owner.userId ?? null, owner.guestId ?? null, kind, `${owner.userId ?? owner.guestId}/${kind}.webp`]
  );
  return row.rows[0].id;
}

async function createActiveSubscription(client: PGlite, userId: string) {
  await client.query(
    `insert into app.subscriptions
      (user_id, stripe_customer_id, stripe_subscription_id, status, current_period_end, paid_current_period_start, paid_current_period_end)
     values ($1, 'cus_test', $2, 'active', now() + interval '1 month', now(), now() + interval '1 month')`,
    [userId, `sub_${userId}`]
  );
}

async function testWebp() {
  return sharp({
    create: {
      width: 16,
      height: 16,
      channels: 3,
      background: { r: 80, g: 120, b: 180 },
    },
  }).webp().toBuffer();
}

describe("core swap accounting", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env.SWAP_PROVIDER = "mock";
    process.env.APP_ENV = "test";
    process.env.FACE_SWAP_PROVIDER = "mock";
    process.env.LOCAL_STORAGE_DIR = `storage/test-${crypto.randomUUID()}`;
    delete process.env.TRIAL_DAILY_LIMIT;
  });

  it("atomically permits one guest trial and blocks the second", async () => {
    const client = await db();
    const guest = await client.query<{ id: string }>(
      `insert into app.guest_sessions (token_hash, expires_at) values ($1, now() + interval '1 day') returning id`,
      [hashGuestToken("guest")]
    );
    const guestId = guest.rows[0].id;
    const source = await createAsset(client, { guestId }, "source");
    const target = await createAsset(client, { guestId }, "target");
    const first = await createSwapJob({ client, actor: { guestId }, sourceAssetId: source, targetAssetId: target, requestKey: "guest-first-request" });
    expect(first.state).toBe("queued");
    await expect(createSwapJob({ client, actor: { guestId }, sourceAssetId: source, targetAssetId: target, requestKey: "guest-second-request" }))
      .rejects.toMatchObject({ code: "trial_used" });
  });

  it("reuses an identical request but rejects changed photos and invalid roles", async () => {
    const client = await db();
    const guest = await client.query<{ id: string }>(
      "insert into app.guest_sessions (token_hash, expires_at) values ('replay', now() + interval '1 day') returning id");
    const guestId = guest.rows[0].id;
    const source = await createAsset(client, { guestId }, "source");
    const target = await createAsset(client, { guestId }, "target");
    const input = { client, actor: { guestId }, sourceAssetId: source, targetAssetId: target, requestKey: "replay" };
    await expect(createSwapJob({ ...input, sourceAssetId: target })).rejects.toMatchObject({ code: "invalid_asset_kind" });
    const first = await createSwapJob(input);
    expect((await createSwapJob(input)).id).toBe(first.id);
    await expect(createSwapJob({ ...input, targetAssetId: source })).rejects.toMatchObject({ code: "request_conflict" });
    await client.query("update app.swap_jobs set state = 'canceled' where id = $1", [first.id]);
    await markJobFailed(client, first.id, "late_error", "late provider error");
    const saved = await client.query<{ state: string }>("select state from app.swap_jobs where id = $1", [first.id]);
    expect(saved.rows[0].state).toBe("canceled");
  });

  it("enforces the global daily guest trial cap", async () => {
    process.env.TRIAL_DAILY_LIMIT = "1";
    const client = await db();
    const existingSource = await createAsset(client, {}, "source");
    const existingTarget = await createAsset(client, {}, "target");
    await client.query(
      `insert into app.swap_jobs (guest_id, source_asset_id, target_asset_id, request_key, mode, state)
       values (null, $1, $2, 'existing-cap-job', 'guest_trial', 'queued')`,
      [existingSource, existingTarget]
    );
    const guest = await client.query<{ id: string }>(
      `insert into app.guest_sessions (token_hash, expires_at) values ($1, now() + interval '1 day') returning id`,
      [hashGuestToken("guest-cap")]
    );
    const guestId = guest.rows[0].id;
    const source = await createAsset(client, { guestId }, "source");
    const target = await createAsset(client, { guestId }, "target");
    await expect(createSwapJob({ client, actor: { guestId }, sourceAssetId: source, targetAssetId: target, requestKey: "guest-over-cap" }))
      .rejects.toMatchObject({ code: "trial_daily_limit_reached" });
  });

  it("reserves a paid credit and releases it when the job fails", async () => {
    const client = await db();
    const user = await client.query<{ id: string }>("insert into app.users (email) values ('paid@example.com') returning id");
    const userId = user.rows[0].id;
    await createActiveSubscription(client, userId);
    await grantCredits(client, { userId, amount: 1, source: "test", sourceRef: "grant-1" });
    const source = await createAsset(client, { userId }, "source");
    const target = await createAsset(client, { userId }, "target");
    const job = await createSwapJob({ client, actor: { userId }, sourceAssetId: source, targetAssetId: target, requestKey: "paid-request" });
    let grant = await client.query<{ remaining_amount: number; reserved_amount: number }>("select remaining_amount, reserved_amount from app.credit_grants where user_id = $1", [userId]);
    expect(Number(grant.rows[0].remaining_amount)).toBe(0);
    expect(Number(grant.rows[0].reserved_amount)).toBe(1);
    await markJobFailed(client, job.id, "test_failure", "failed on purpose");
    grant = await client.query<{ remaining_amount: number; reserved_amount: number }>("select remaining_amount, reserved_amount from app.credit_grants where user_id = $1", [userId]);
    expect(Number(grant.rows[0].remaining_amount)).toBe(1);
    expect(Number(grant.rows[0].reserved_amount)).toBe(0);
  });

  it("uses a standalone Paddle pack and releases its credit on failure", async () => {
    const client = await db();
    const userId=(await client.query<{id:string}>("insert into app.users(email) values('pack@example.com') returning id")).rows[0].id;
    await grantCredits(client,{userId,amount:200,source:'paddle_sandbox_pack',sourceRef:'txn_pack_test'});
    const source=await createAsset(client,{userId},'source');
    const target=await createAsset(client,{userId},'target');
    const job=await createSwapJob({client,actor:{userId},sourceAssetId:source,targetAssetId:target});
    expect((await client.query<{remaining_amount:number}>('select remaining_amount from app.credit_grants')).rows[0].remaining_amount).toBe(199);
    await markJobFailed(client,job.id,'test_failure','Test failure');
    expect((await client.query<{remaining_amount:number}>('select remaining_amount from app.credit_grants')).rows[0].remaining_amount).toBe(200);
    await client.close();
  });

  it("rejects a user without eligible credits", async () => {
    const client = await db();
    const user = await client.query<{ id: string }>("insert into app.users (email) values ('gated@example.com') returning id");
    const userId = user.rows[0].id;
    await grantCredits(client, { userId, amount: 1, source: "test", sourceRef: "grant-gated" });
    const source = await createAsset(client, { userId }, "source");
    const target = await createAsset(client, { userId }, "target");
    await expect(createSwapJob({ client, actor: { userId }, sourceAssetId: source, targetAssetId: target, requestKey: "gated-request" }))
      .rejects.toMatchObject({ code: "credits_required" });
  });

  it("enforces asset ownership before creating a job", async () => {
    const client = await db();
    const one = await client.query<{ id: string }>("insert into app.users (email) values ('one@example.com') returning id");
    const two = await client.query<{ id: string }>("insert into app.users (email) values ('two@example.com') returning id");
    const source = await createAsset(client, { userId: one.rows[0].id }, "source");
    const target = await createAsset(client, { userId: two.rows[0].id }, "target");
    await expect(createSwapJob({ client, actor: { userId: one.rows[0].id }, sourceAssetId: source, targetAssetId: target, requestKey: "bad-owner-request" }))
      .rejects.toMatchObject({ code: "asset_not_found" });
  });

  it("marks mock provider output clearly and consumes the reserved credit on success", async () => {
    const client = await db();
    const user = await client.query<{ id: string }>("insert into app.users (email) values ('success@example.com') returning id");
    const userId = user.rows[0].id;
    await createActiveSubscription(client, userId);
    await grantCredits(client, { userId, amount: 1, source: "test", sourceRef: "grant-success" });
    const tinyWebp = await testWebp();
    await putObject(`${userId}/source.webp`, tinyWebp, "image/webp");
    await putObject(`${userId}/target.webp`, tinyWebp, "image/webp");
    const source = await createAsset(client, { userId }, "source");
    const target = await createAsset(client, { userId }, "target");
    await client.query("update app.assets set object_key = $2 where id = $1", [source, `${userId}/source.webp`]);
    await client.query("update app.assets set object_key = $2 where id = $1", [target, `${userId}/target.webp`]);
    const job = await createSwapJob({ client, actor: { userId }, sourceAssetId: source, targetAssetId: target, requestKey: "success-request" });
    process.env.SWAP_PROVIDER = "external";
    process.env.CUSTOM_SWAP_RESULT_HOSTS = "images.example.com";
    await processSwapJob(client, job.id);
    const saved = await client.query<{ state: string; metadata: { mock: boolean } }>(
      `select j.state, a.metadata from app.swap_jobs j join app.assets a on a.id = j.result_asset_id where j.id = $1`,
      [job.id]
    );
    expect(saved.rows[0].state).toBe("succeeded");
    expect(saved.rows[0].metadata.mock).toBe(true);
    const grant = await client.query<{ remaining_amount: number; reserved_amount: number }>("select remaining_amount, reserved_amount from app.credit_grants where user_id = $1", [userId]);
    expect(Number(grant.rows[0].remaining_amount)).toBe(0);
    expect(Number(grant.rows[0].reserved_amount)).toBe(0);
  });

  it("recovers stale in-progress jobs back through the outbox", async () => {
    const client = await db();
    const guest = await client.query<{ id: string }>(
      `insert into app.guest_sessions (token_hash, trial_state, expires_at)
       values ($1, 'reserved', now() + interval '1 day')
       returning id`,
      [hashGuestToken("stale")]
    );
    const guestId = guest.rows[0].id;
    const source = await createAsset(client, { guestId }, "source");
    const target = await createAsset(client, { guestId }, "target");
    const job = await client.query<{ id: string }>(
      `insert into app.swap_jobs (guest_id, source_asset_id, target_asset_id, request_key, mode, state, updated_at)
       values ($1,$2,$3,'stale-job','guest_trial','processing', now() - interval '30 minutes')
       returning id`,
      [guestId, source, target]
    );

    await queueStaleSwapJobs(client);

    const recovered = await client.query<{ state: string; error_code: string }>("select state, error_code from app.swap_jobs where id = $1", [job.rows[0].id]);
    expect(recovered.rows[0]).toMatchObject({ state: "retry_wait", error_code: "worker_recovered_stale_job" });
    const outbox = await client.query<{ job_id: string }>(
      "select payload->>'jobId' as job_id from app.outbox_events where topic = 'swap.created'"
    );
    expect(outbox.rows.map((row) => row.job_id)).toContain(job.rows[0].id);
  });

  it("finalizes a claimed guest job under the user while preserving guest-trial accounting", async () => {
    const client = await db();
    const tinyWebp = await testWebp();
    const guest = await client.query<{ id: string }>(
      `insert into app.guest_sessions (token_hash, expires_at) values ($1, now() + interval '1 day') returning id`,
      [hashGuestToken("claimed")]
    );
    const guestId = guest.rows[0].id;
    await putObject(`${guestId}/source.webp`, tinyWebp, "image/webp");
    await putObject(`${guestId}/target.webp`, tinyWebp, "image/webp");
    const source = await createAsset(client, { guestId }, "source");
    const target = await createAsset(client, { guestId }, "target");
    await client.query("update app.assets set object_key = $2 where id = $1", [source, `${guestId}/source.webp`]);
    await client.query("update app.assets set object_key = $2 where id = $1", [target, `${guestId}/target.webp`]);
    const job = await createSwapJob({ client, actor: { guestId }, sourceAssetId: source, targetAssetId: target, requestKey: "claimed-guest-job" });
    const user = await client.query<{ id: string }>("insert into app.users (email) values ('claimer@example.com') returning id");
    const userId = user.rows[0].id;
    await client.query("update app.guest_sessions set claimed_user_id = $2 where id = $1", [guestId, userId]);
    await client.query("update app.assets set user_id = $2 where guest_id = $1", [guestId, userId]);
    await client.query("update app.swap_jobs set user_id = $2 where id = $1", [job.id, userId]);

    await processSwapJob(client, job.id);

    const saved = await client.query<{ state: string; mode: string; asset_user_id: string; asset_guest_id: string; trial_state: string; reservations: string }>(
      `select j.state, j.mode, a.user_id as asset_user_id, a.guest_id as asset_guest_id, g.trial_state,
              (select count(*)::text from app.credit_reservations where job_id = j.id) as reservations
       from app.swap_jobs j
       join app.assets a on a.id = j.result_asset_id
       join app.guest_sessions g on g.id = j.guest_id
       where j.id = $1`,
      [job.id]
    );
    expect(saved.rows[0]).toMatchObject({
      state: "succeeded",
      mode: "guest_trial",
      asset_user_id: userId,
      asset_guest_id: guestId,
      trial_state: "consumed",
      reservations: "0",
    });
  });
});


describe('external swap settlement', () => {
  it.each([false,true])('persists real results or releases trial on failure (failure=%s)',async(failure)=>{
    process.env.APP_ENV='test';process.env.SWAP_PROVIDER='external';process.env.CUSTOM_SWAP_RESULT_HOSTS='images.example.com';
    process.env.LOCAL_STORAGE_DIR=`storage/test-${crypto.randomUUID()}`;
    const client=await db(); const bytes=await testWebp();
    const guest=(await client.query<{id:string}>("insert into app.guest_sessions(token_hash,expires_at) values('external',now()+interval '1 day') returning id")).rows[0].id;
    const source=await createAsset(client,{guestId:guest},'source');const target=await createAsset(client,{guestId:guest},'target');
    await putObject(`${guest}/source.webp`,bytes,'image/webp');await putObject(`${guest}/target.webp`,bytes,'image/webp');
    const input={client,actor:{guestId:guest},sourceAssetId:source,targetAssetId:target,requestKey:'external-request'};
    await expect(createSwapJob(input)).rejects.toMatchObject({code:'provider_consent_required'});
    const job=await createSwapJob({...input,providerConsent:true});
    const submit=vi.spyOn(customProvider,'customSwap');
    if(failure)submit.mockRejectedValue(new customProvider.CustomSwapError('provider_busy','The service is busy.'));else submit.mockResolvedValue(bytes);
    try {
      await processSwapJob(client,job.id);await processSwapJob(client,job.id);
      expect(submit).toHaveBeenCalledTimes(1);
      const saved=(await client.query<{state:string;provider_mode:string;provider_consent_at:string}>("select state,provider_mode,provider_consent_at from app.swap_jobs where id=$1",[job.id])).rows[0];
      expect(saved.state).toBe(failure?'failed':'succeeded');expect(saved.provider_mode).toBe('external');expect(saved.provider_consent_at).toBeTruthy();
      expect((await client.query<{trial_state:string}>('select trial_state from app.guest_sessions where id=$1',[guest])).rows[0].trial_state).toBe(failure?'available':'consumed');
      if(!failure){const asset=(await client.query<{metadata:{mock:boolean};object_key:string}>('select a.metadata,a.object_key from app.assets a join app.swap_jobs j on a.id=j.result_asset_id where j.id=$1',[job.id])).rows[0];expect(asset.metadata.mock).toBe(false);expect(await getObject(asset.object_key)).toEqual(bytes);}
    } finally {submit.mockRestore();process.env.SWAP_PROVIDER='mock';await client.close();}
  });
});
