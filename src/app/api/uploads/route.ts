import { NextRequest } from "next/server";
import { getPool } from "@/server/db";
import { getActor } from "@/server/auth";
import { getOrCreateGuest, setGuestCookie } from "@/server/auth/guest";
import { assertOrigin, assertRateLimit, boundedBody, config503, fail, HttpError, json } from "@/server/http";
import { storeUploadedAsset } from "@/server/storage";
import { featureState } from "@/server/env";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    if (!featureState().swapsEnabled) throw new HttpError(503, "Photo swaps are coming soon. Uploads are currently closed.", "swaps_disabled");
    if (!featureState().database) return config503("Database");
    assertOrigin(request);
    assertRateLimit(request, "uploads", 20, 60_000);
    const pool = getPool();
    let actor = await getActor(request);
    let guestCookie: { token: string; maxAge: number } | null = null;
    if (!actor.userId && !actor.guestId) {
      const guest = await getOrCreateGuest(request, pool);
      actor = { guestId: guest.id };
      guestCookie = { token: guest.token, maxAge: guest.maxAge };
    }

    const contentType=request.headers.get('content-type') ?? '';
    if(!contentType.startsWith('multipart/form-data;')) throw new HttpError(415,'Use a multipart photo upload.','unsupported_upload');
    const bytes=await boundedBody(request,10*1024*1024+64*1024);
    const form=await new Response(bytes,{headers:{'Content-Type':contentType}}).formData();
    const kind = form.get("kind");
    const file = form.get("file");
    if (kind !== "source" && kind !== "target") throw new HttpError(400, "Upload kind must be source or target.", "bad_upload_kind");
    if (!(file instanceof File)) throw new HttpError(400, "Image file is required.", "file_required");

    const asset = await storeUploadedAsset(pool, {
      file,
      kind,
      userId: actor.userId,
      guestId: actor.guestId
    });
    const response = json({ asset: { id: asset.assetId } });
    if (guestCookie) setGuestCookie(response, guestCookie.token, guestCookie.maxAge);
    return response;
  } catch (error) {
    return fail(error);
  }
}
