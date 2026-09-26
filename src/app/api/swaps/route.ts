import { NextRequest } from "next/server";
import { z } from "zod";
import { getPool } from "@/server/db";
import { getActor } from "@/server/auth";
import { getOrCreateGuest, setGuestCookie } from "@/server/auth/guest";
import { assertOrigin, assertRateLimit, config503, fail, json } from "@/server/http";
import { createSwapJob, formatSwapJob, listSwaps } from "@/server/swaps/service";
import { featureState } from "@/server/env";

const swapRequestSchema = z.object({
  sourceAssetId: z.string().uuid(),
  targetAssetId: z.string().uuid(),
  requestKey: z.string().min(12).max(80).optional(),
});

export async function GET(request: NextRequest) {
  try {
    if (!featureState().database) return config503("Database");
    const actor = await getActor(request);
    const swaps = await listSwaps(getPool(), actor);
    return json({ jobs: swaps.rows.map((swap: any) => formatSwapJob(swap)) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!featureState().database) return config503("Database");
    assertOrigin(request);
    assertRateLimit(request, "swaps", 15, 60_000);
    const pool = getPool();
    let actor = await getActor(request);
    let guestCookie: { token: string; maxAge: number } | null = null;
    if (!actor.userId && !actor.guestId) {
      const guest = await getOrCreateGuest(request, pool);
      actor = { guestId: guest.id };
      guestCookie = { token: guest.token, maxAge: guest.maxAge };
    }
    const body = swapRequestSchema.parse(await request.json());
    const job = await createSwapJob({
      client: pool,
      actor,
      sourceAssetId: body.sourceAssetId,
      targetAssetId: body.targetAssetId,
      requestKey: body.requestKey
    });
    const response = json({ job: formatSwapJob(job) }, 201);
    if (guestCookie) setGuestCookie(response, guestCookie.token, guestCookie.maxAge);
    return response;
  } catch (error) {
    return fail(error);
  }
}
