import { NextRequest } from "next/server";
import { getPool } from "@/server/db";
import { getActor } from "@/server/auth";
import { config503, fail, noStoreHeaders } from "@/server/http";
import { assertAssetOwner, getObject } from "@/server/storage";
import { featureState } from "@/server/env";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!featureState().database) return config503("Database");
    const { id } = await params;
    const actor = await getActor(request);
    const asset = await assertAssetOwner(getPool(), id, actor);
    const buffer = await getObject(asset.object_key);
    return new Response(buffer, {
      headers: noStoreHeaders(asset.content_type)
    });
  } catch (error) {
    return fail(error);
  }
}
