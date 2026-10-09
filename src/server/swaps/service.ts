import { env } from "@/server/env";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { getPool, withTransaction, type DbClient } from "@/server/db";
import { HttpError } from "@/server/http";
import { assertAssetOwner, createAsset, deleteObject, putObject } from "@/server/storage";
import { consumeReservation, releaseReservation, reserveCreditForJob } from "@/server/billing/credits";
import { runProviderSwap } from "@/server/swaps/provider";

const DEFAULT_TRIAL_DAILY_LIMIT = 100;

function randomId(bytes = 18) {
  return randomBytes(bytes).toString("base64url");
}

function trialDailyLimit() {
  const raw = Number(process.env.TRIAL_DAILY_LIMIT ?? DEFAULT_TRIAL_DAILY_LIMIT);
  if (!Number.isFinite(raw) || raw < 0) return DEFAULT_TRIAL_DAILY_LIMIT;
  return Math.floor(raw);
}

export type SwapRow = {
  id: string;
  state: string;
  mode?: string;
  error_code?: string | null;
  error_message?: string | null;
  created_at?: Date | string;
  finished_at?: Date | string | null;
  source_asset_id?: string;
  target_asset_id?: string;
  result_asset_id?: string | null;
  result_metadata?: { mock?: boolean; label?: string } | null;
};

const STALE_SWAP_JOB_MINUTES = 15;

export function formatSwapJob(row: SwapRow) {
  return {
    id: row.id,
    status: row.state,
    createdAt: row.created_at,
    resultAssetId: row.result_asset_id ?? null,
    isMock: Boolean(row.result_metadata?.mock),
    errorMessage: row.error_message ?? null,
  };
}

export async function createSwapJob(input: {
  client?: DbClient;
  actor: { userId?: string; guestId?: string };
  providerConsent?: boolean;
  sourceAssetId: string;
  targetAssetId: string;
  requestKey?: string;
}) {
  if (env().SWAPS_ENABLED === "false") throw new HttpError(503, "Photo swaps are coming soon.", "swaps_disabled");
  const client = input.client ?? getPool();
  const providerMode = env().SWAP_PROVIDER;
  if (providerMode === "external" && input.providerConsent !== true) throw new HttpError(400, "Permission for external face processing is required.", "provider_consent_required");
  if (!input.actor.userId && !input.actor.guestId) throw new HttpError(401, "A session is required.", "session_required");

  return withTransaction(client, async (tx) => {
    if (input.requestKey) {
      await tx.query("select pg_advisory_xact_lock(hashtext($1))", [input.requestKey]);
      const existing = await tx.query<{ id: string; state: string; source_asset_id: string; target_asset_id: string }>(
        `select id, state, source_asset_id, target_asset_id
         from app.swap_jobs
         where request_key = $1
           and (($2::uuid is not null and user_id = $2::uuid)
             or ($3::uuid is not null and guest_id = $3::uuid))
         limit 1`,
        [input.requestKey, input.actor.userId ?? null, input.actor.guestId ?? null]
      );
      if (existing.rows[0]) {
        if (existing.rows[0].source_asset_id !== input.sourceAssetId || existing.rows[0].target_asset_id !== input.targetAssetId) {
          throw new HttpError(409, "This request was already used for different photos.", "request_conflict");
        }
        return existing.rows[0];
      }
    }

    const source = await assertAssetOwner(tx, input.sourceAssetId, input.actor);
    const target = await assertAssetOwner(tx, input.targetAssetId, input.actor);
    if (source.kind !== "source" || target.kind !== "target") {
      throw new HttpError(400, "Choose a source face and a target photo.", "invalid_asset_kind");
    }
    const mode = input.actor.userId ? "paid_credit" : "guest_trial";
    if (input.actor.userId) {
      if (input.actor.guestId) {
        await tx.query(
          `update app.guest_sessions
           set claimed_user_id = $2, updated_at = now()
           where id = $1 and (claimed_user_id is null or claimed_user_id = $2)`,
          [input.actor.guestId, input.actor.userId]
        );
      }
    }
    if (!input.actor.userId && input.actor.guestId) {
      await tx.query("select pg_advisory_xact_lock(hashtext('app.guest_trial_daily_cap'))");
      const daily = await tx.query<{ count: string }>(
        `select count(*)::text as count
         from app.swap_jobs
         where mode = 'guest_trial'
           and state in ('queued','processing','saving','succeeded','retry_wait','reconciling')
           and created_at >= date_trunc('day', now())`
      );
      if (Number(daily.rows[0]?.count ?? 0) >= trialDailyLimit()) {
        throw new HttpError(429, "The free trial limit has been reached for today.", "trial_daily_limit_reached");
      }
      const claim = await tx.query(
        `update app.guest_sessions
         set trial_state = 'reserved', updated_at = now()
         where id = $1 and trial_state = 'available' and claimed_user_id is null
         returning id`,
        [input.actor.guestId]
      );
      if (!claim.rowCount) throw new HttpError(402, "The free trial has already been used.", "trial_used");
    }

    const job = await tx.query<{ id: string; state: string }>(
      `insert into app.swap_jobs (user_id, guest_id, source_asset_id, target_asset_id, mode, request_key, provider_mode, provider_consent_at)
       values ($1,$2,$3,$4,$5,$6,$7,case when $7 = 'external' then now() else null end)
       returning id, state`,
      [
        input.actor.userId ?? null,
        input.actor.guestId ?? null,
        input.sourceAssetId,
        input.targetAssetId,
        mode,
        input.requestKey ?? randomId(24),
        providerMode
      ]
    );
    if (input.actor.userId) await reserveCreditForJob(tx, input.actor.userId, job.rows[0].id);
    await tx.query(
      `insert into app.outbox_events (topic, payload)
       values ('swap.created', $1)`,
      [JSON.stringify({ jobId: job.rows[0].id })]
    );
    return job.rows[0];
  });
}

export async function getSwap(client: DbClient, jobId: string, actor: { userId?: string; guestId?: string }) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) throw new HttpError(404, "Swap not found.", "swap_not_found");
  const result = await client.query(
    `select j.id, j.state, j.mode, j.error_code, j.error_message, j.created_at, j.finished_at,
            j.source_asset_id, j.target_asset_id, ra.id as result_asset_id,
            ra.object_key as result_key, ra.content_type as result_content_type, ra.metadata as result_metadata
     from app.swap_jobs j
     left join app.assets ra on ra.id = j.result_asset_id and ra.status <> 'deleted' and (ra.expires_at is null or ra.expires_at > now())
     where j.id = $1
       and (($2::uuid is not null and j.user_id = $2::uuid)
         or ($3::uuid is not null and j.guest_id = $3::uuid and j.user_id is null))`,
    [jobId, actor.userId ?? null, actor.guestId ?? null]
  );
  if (!result.rows[0]) throw new HttpError(404, "Swap not found.", "swap_not_found");
  return result.rows[0];
}

export async function listSwaps(client: DbClient, actor: { userId?: string; guestId?: string }, limit = 25) {
  return client.query(
    `select j.id, j.state, j.mode, j.error_code, j.error_message, j.created_at, j.finished_at,
            j.source_asset_id, j.target_asset_id, ra.id as result_asset_id, ra.metadata as result_metadata
     from app.swap_jobs j
     left join app.assets ra on ra.id = j.result_asset_id and ra.status <> 'deleted' and (ra.expires_at is null or ra.expires_at > now())
     where (($1::uuid is not null and j.user_id = $1::uuid)
       or ($2::uuid is not null and j.guest_id = $2::uuid and j.user_id is null))
     order by j.created_at desc
     limit $3`,
    [actor.userId ?? null, actor.guestId ?? null, limit]
  );
}

export async function queueStaleSwapJobs(client: DbClient) {
  await withTransaction(client, async (tx) => {
    await tx.query(
      `update app.swap_jobs
       set state = 'retry_wait',
           error_code = 'worker_recovered_stale_job',
           error_message = 'The worker recovered this job after it was left in progress.',
           updated_at = now()
       where state in ('processing','saving','reconciling')
         and result_asset_id is null
         and updated_at < now() - ($1::int * interval '1 minute')`,
      [STALE_SWAP_JOB_MINUTES]
    );

    await tx.query(
      `insert into app.outbox_events (topic, payload)
       select 'swap.created', jsonb_build_object('jobId', id)
       from app.swap_jobs j
       where j.state in ('queued', 'retry_wait', 'reconciling')
         and not exists (
           select 1
           from app.outbox_events e
           where e.topic = 'swap.created'
             and e.payload->>'jobId' = j.id::text
             and (e.state in ('pending','processing') or e.updated_at > now() - interval '15 minutes')
         )`
    );
  });
}

export async function processSwapJob(client: DbClient, jobId: string) {
  if (env().SWAPS_ENABLED === "false") return null;
  const started = await withTransaction(client, async (tx) => {
    const claimed = await tx.query<{ id: string }>(
      `select id
       from app.swap_jobs
       where id = $1
         and state in ('queued','retry_wait')
       for update skip locked`,
      [jobId]
    );
    if (!claimed.rows[0]) return null;

    const result = await tx.query<{ source_key: string; target_key: string; provider_mode: "mock" | "external" }>(
      `update app.swap_jobs
       set state = 'processing',
           error_code = null,
           error_message = null,
           updated_at = now()
       where id = $1
       returning provider_mode,
         (select object_key from app.assets where id = source_asset_id) as source_key,
         (select object_key from app.assets where id = target_asset_id) as target_key`,
      [jobId]
    );
    return result.rows[0] ?? null;
  });
  const job = started;
  if (!job) return;
  let writtenKey: string | undefined;
  try {
    const usable = await client.query<{ id: string }>(`select a.id from app.assets a join app.swap_jobs j on a.id in (j.source_asset_id,j.target_asset_id)
      where j.id=$1 and j.state='processing' and a.status='active' and (a.expires_at is null or a.expires_at>now())`, [jobId]);
    if (usable.rows.length !== 2) throw new Error('Swap inputs are no longer available.');
    const provider = await runProviderSwap({ jobId, sourceKey: job.source_key, targetKey: job.target_key, mode: job.provider_mode });
    if (provider.status === "failed") {
      await markJobFailed(client, jobId, provider.code, provider.message);
      return;
    }
    const saving = await client.query("update app.swap_jobs set state = 'saving', provider_request_id = $2, updated_at = now() where id = $1 and state = 'processing' returning id", [jobId, provider.providerRequestId]);
    if (!saving.rows[0]) return;
    const stamped = provider.isMock ? await stampDevelopmentPreview(provider.resultBuffer) : provider.resultBuffer;
    const metadata = await sharp(stamped).metadata();
    await withTransaction(client, async (tx) => {
      const locked = await tx.query<{ user_id: string | null; guest_id: string | null; mode: string; state: string }>(
        `select user_id, guest_id, mode, state
         from app.swap_jobs
         where id = $1
         for update`,
        [jobId]
      );
      const current = locked.rows[0];
      if (!current || current.state === "succeeded") return;
      if (current.state !== "saving") {
        throw new Error(`Swap job is no longer saving; current state is ${current.state}.`);
      }
      if (!current.user_id && !current.guest_id) {
        throw new Error("Swap job has no owner.");
      }
      if (current.user_id) {
        const activeOwner = await tx.query<{ ok: number }>(
          `select 1 as ok
           from app.users u
           where u.id = $1
             and u.suspended_at is null
             and u.deletion_requested_at is null
             and not exists (
               select 1
               from app.customers c
               where c.auth_user_id = u.id
                 and (c.is_suspended = true or c.deletion_requested_at is not null)
             )
           limit 1`,
          [current.user_id]
        );
        if (!activeOwner.rows[0]) {
          throw new Error("Swap job owner is suspended or deleted.");
        }
      }

      const inputs = await tx.query<{ id: string }>(
        `select a.id from app.assets a
         join app.swap_jobs j on a.id in (j.source_asset_id, j.target_asset_id)
         where j.id = $1 and a.status <> 'deleted'
           and (a.expires_at is null or a.expires_at > now())
         for update of a`, [jobId]);
      if (inputs.rows.length !== 2) throw new Error("Input photos are no longer available.");
      const key = `${current.user_id ? `users/${current.user_id}` : `guests/${current.guest_id}`}/results/${randomId()}.webp`;
      writtenKey = key;
      await putObject(key, stamped, provider.contentType);
      const resultAssetId = await createAsset(tx, {
        userId: current.user_id ?? undefined,
        guestId: current.guest_id ?? undefined,
        kind: "result",
        key,
        contentType: provider.contentType,
        width: metadata.width ?? 1,
        height: metadata.height ?? 1,
        byteCount: stamped.byteLength,
        expiresAt: current.user_id ? new Date(Date.now() + 30 * 24 * 3600_000) : new Date(Date.now() + 24 * 3600_000),
        metadata: provider.isMock ? { mock: true, label: "DEVELOPMENT PREVIEW - no face swap was performed." } : { mock: false, provider: "custom-swap" }
      });
      await tx.query(
        `update app.swap_jobs
         set state = 'succeeded', result_asset_id = $2, finished_at = now(), updated_at = now()
        where id = $1`,
        [jobId, resultAssetId]
      );
      if (current.mode === "paid_credit") {
        await consumeReservation(tx, jobId);
      } else if (current.guest_id) {
        await tx.query("update app.guest_sessions set trial_state = 'consumed', updated_at = now() where id = $1", [current.guest_id]);
      }
    });
  } catch (error) {
    console.error("Swap processing failed", { jobId, error });
    if (writtenKey) await deleteObject(writtenKey).catch(() => undefined);
    await markJobFailed(client, jobId, "provider_or_storage_error", "The swap could not be completed. Please try again.");
  }
}

async function stampDevelopmentPreview(buffer: Buffer) {
  const image = sharp(buffer).rotate();
  const metadata = await image.metadata();
  const width = metadata.width ?? 640;
  const height = metadata.height ?? 640;
  const fontSize = Math.max(24, Math.round(width / 18));
  const svg = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="${Math.max(0, height - fontSize * 3)}" width="${width}" height="${fontSize * 3}" fill="rgba(0,0,0,0.68)"/>
      <text x="${Math.round(width / 2)}" y="${Math.max(fontSize, height - fontSize * 1.35)}"
        text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}"
        font-weight="700" fill="#fff">DEVELOPMENT PREVIEW - no face swap</text>
    </svg>
  `);
  return image.composite([{ input: svg, top: 0, left: 0 }]).webp({ quality: 92 }).toBuffer();
}

export async function markJobFailed(client: DbClient, jobId: string, code: string, message: string) {
  await withTransaction(client, async (tx) => {
    const job = await tx.query<{ user_id: string | null; guest_id: string | null; mode: string }>(
      `update app.swap_jobs
       set state = 'failed', error_code = $2, error_message = $3, finished_at = now(), updated_at = now()
       where id = $1 and state in ('queued','processing','saving','retry_wait','reconciling')
       returning user_id, guest_id, mode`,
      [jobId, code, message]
    );
    const row = job.rows[0];
    if (!row) return;
    if (row.mode === "paid_credit") await releaseReservation(tx, jobId);
    if (row.mode === "guest_trial" && row.guest_id) {
      await tx.query("update app.guest_sessions set trial_state = 'available', updated_at = now() where id = $1 and trial_state = 'reserved'", [row.guest_id]);
    }
  });
}
