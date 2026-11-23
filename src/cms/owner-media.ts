import type { DbClient } from '@/server/db';
import { getPool } from '@/server/db';
import { HttpError } from '@/server/http';
import { getObject } from '@/server/storage';

export function assertCmsOwner(user: {collection?: string; role?: string} | null | undefined) {
  if (!user || user.collection !== 'owners' || user.role !== 'owner') throw new HttpError(403, 'Owner access required.', 'owner_required');
}
// Never return object keys or reusable signed URLs to the browser.
export async function ownerAssetResponse(user: {collection?:string;role?:string} | null | undefined, id: string,
  client: DbClient = getPool(), readObject: typeof getObject = getObject) {
  assertCmsOwner(user);
  if(!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400,'Invalid asset ID.','invalid_asset');
  const {rows}=await client.query<{object_key:string;content_type:string}>(`select a.object_key,a.content_type from app.assets a
    where a.id=$1 and a.status='active' and (a.expires_at is null or a.expires_at>now())
    and exists(select 1 from app.swap_jobs j where j.source_asset_id=a.id or j.target_asset_id=a.id or j.result_asset_id=a.id)`,[id]);
  if(!rows[0])throw new HttpError(404,'Photo expired, deleted or unavailable.','asset_unavailable');
  if(!['image/webp','image/jpeg','image/png'].includes(rows[0].content_type))throw new HttpError(404,'Unsupported image.','asset_unavailable');
  let body: Buffer;
  try { body=await readObject(rows[0].object_key); } catch {throw new HttpError(404,'Photo unavailable in storage.','asset_unavailable');}
  return new Response(new Uint8Array(body),{headers:{'Content-Type':rows[0].content_type,'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Referrer-Policy':'no-referrer'}});
}
