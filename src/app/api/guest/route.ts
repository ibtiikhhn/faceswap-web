import { NextRequest } from "next/server";
import { getActor } from "@/server/auth";
import { getPool } from "@/server/db";
import { getOrCreateGuest, setGuestCookie } from "@/server/auth/guest";
import { assertOrigin, assertRateLimit, config503, fail, json } from "@/server/http";
import { featureState } from "@/server/env";

export async function POST(request: NextRequest) {
  try {
    if (!featureState().database) return config503("Database");
    assertOrigin(request);
    assertRateLimit(request, "guest", 30, 60_000);
    const actor=await getActor(request);
    if(actor.userId) return json({authenticated:true});
    const guest = await getOrCreateGuest(request, getPool());
    const response = json({ guestId: guest.id, trialState: guest.trialState });
    if (guest.isNew) setGuestCookie(response, guest.token, guest.maxAge);
    return response;
  } catch (error) {
    return fail(error);
  }
}
