import { NextRequest } from "next/server";
import { getActor } from "@/server/auth";
import { getPool } from "@/server/db";
import { creditBalances } from "@/server/billing/credits";
import { config503, fail, json } from "@/server/http";
import { listSwaps } from "@/server/swaps/service";
import { featureState } from "@/server/env";

export async function GET(request: NextRequest) {
  try {
    if (!featureState().database) return config503("Database");
    const actor = await getActor(request);
    const pool = getPool();
    const guest = actor.guestId
      ? await pool.query<{ trial_state: string }>("select trial_state from app.guest_sessions where id = $1", [actor.guestId])
      : { rows: [] };
    const user = actor.userId
      ? await pool.query<{ id: string; email: string; name: string | null; image: string | null }>("select id, email, name, image from app.users where id = $1", [actor.userId])
      : { rows: [] };
    const swaps = await listSwaps(pool, actor, 10);
    const credits = actor.userId ? await creditBalances(pool, actor.userId) : { available: 0, reserved: 0 };
    const subscription = actor.userId
      ? await pool.query<{ status: string; plan_code: string | null; current_period_end: string | null }>(
          `select s.status, s.plan_code as "planCode", s.current_period_end as "currentPeriodEnd"
           from app.subscriptions s
           where s.user_id = $1
           order by s.updated_at desc
           limit 1`,
          [actor.userId]
        )
      : { rows: [] };
    return json({
      authenticated: Boolean(actor.userId),
      user: user.rows[0] ?? null,
      credits,
      subscription: subscription.rows[0] ?? null,
      trial: { state: guest.rows[0]?.trial_state ?? null },
      history: swaps.rows
    });
  } catch (error) {
    return fail(error);
  }
}
