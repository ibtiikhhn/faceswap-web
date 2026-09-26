import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth";
import { getPool, withTransaction } from "@/server/db";
import { releaseReservation } from "@/server/billing/credits";
import { assertOrigin, assertRateLimit, config503, fail, HttpError, json } from "@/server/http";
import { featureState } from "@/server/env";

export async function POST(request: NextRequest) {
  try {
    if (!featureState().database) return config503("Database");
    assertOrigin(request);
    assertRateLimit(request, "account-deletion", 5, 60_000);
    const userId = await requireUser(request);

    await withTransaction(getPool(), async (tx) => {
      const activeSubscription = await tx.query<{ id: string }>(
        `select s.id
         from app.subscriptions s
         where s.user_id = $1
           and s.status in ('active', 'trialing', 'past_due', 'incomplete', 'unpaid', 'paused')
         limit 1`,
        [userId]
      );
      if (activeSubscription.rows[0]) {
        throw new HttpError(409, "Cancel the active subscription before deleting this account.", "active_subscription");
      }

      const activeJobs = await tx.query<{ id: string }>(
        `update app.swap_jobs
         set state = 'canceled',
             error_code = 'account_deleted',
             error_message = 'Account deletion canceled this job.',
             finished_at = now(),
             updated_at = now()
         where user_id = $1
           and state in ('queued', 'validating', 'processing', 'saving', 'retry_wait', 'reconciling')
         returning id`,
        [userId]
      );
      for (const job of activeJobs.rows) {
        await releaseReservation(tx, job.id);
      }

      await tx.query("update app.assets set status = 'deleted' where user_id = $1 and status <> 'deleted'", [userId]);
      await tx.query("delete from app.sessions where user_id = $1", [userId]);
      await tx.query("update app.users set suspended_at = now(), deletion_requested_at=now(), updated_at = now() where id = $1", [userId]);
      await tx.query(
        `update app.customers
         set is_suspended = true, deletion_requested_at = now(), updated_at = now()
         where auth_user_id = $1`,
        [userId]
      );
    });

    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
