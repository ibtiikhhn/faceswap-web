import { NextRequest } from "next/server";
import { getPool } from "@/server/db";
import { getActor } from "@/server/auth";
import { assertOrigin, assertRateLimit, config503, fail, json } from "@/server/http";
import { assertAssetOwner, deleteObject } from "@/server/storage";
import { featureState } from "@/server/env";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!featureState().database) return config503("Database");
    assertOrigin(request);
    assertRateLimit(request, "assets-delete", 30, 60_000);
    const { id } = await params;
    const pool = getPool();
    const actor = await getActor(request);
    const asset = await assertAssetOwner(pool, id, actor);
    await pool.query("update app.assets set status = 'deleted' where id = $1", [id]);
    // Deletion is durable even if object storage is temporarily unavailable; worker retries.
    try {await deleteObject(asset.object_key); await pool.query("update app.assets set object_deleted_at=now() where id=$1",[id]);}catch{ /* background cleanup will retry */ }
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
