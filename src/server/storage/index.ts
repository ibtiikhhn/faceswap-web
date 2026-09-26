import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/server/env";
import { getPool, type DbClient } from "@/server/db";
import { HttpError } from "@/server/http";

export const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_PIXELS = 25_000_000;

function randomId(bytes = 15) {
  return randomBytes(bytes).toString("base64url");
}

export type StoredImage = {
  assetId: string;
  key: string;
  contentType: string;
  width: number;
  height: number;
  byteCount: number;
};

function s3Client() {
  const parsed = env();
  if (parsed.STORAGE_DRIVER !== "r2") return null;
  if (!parsed.R2_ENDPOINT || !parsed.R2_ACCESS_KEY_ID || !parsed.R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 credentials are required when STORAGE_DRIVER=r2.");
  }
  return new S3Client({
    region: "auto",
    endpoint: parsed.R2_ENDPOINT,
    credentials: {
      accessKeyId: parsed.R2_ACCESS_KEY_ID,
      secretAccessKey: parsed.R2_SECRET_ACCESS_KEY
    }
  });
}

export async function validateAndNormalizeImage(file: File) {
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new HttpError(400, "Use a JPEG, PNG, or WebP image.", "unsupported_image_type");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new HttpError(400, "Image is larger than 10 MB.", "image_too_large");
  }
  const source = Buffer.from(await file.arrayBuffer());
  if (source.byteLength !== file.size || source.byteLength > MAX_UPLOAD_BYTES) {
    throw new HttpError(400, "Image is larger than 10 MB.", "image_too_large");
  }
  try {
    const image=sharp(source,{failOn:'warning',limitInputPixels:MAX_PIXELS});
    const metadata=await image.metadata();
    if(!metadata.format || !['jpeg','png','webp'].includes(metadata.format) || (metadata.pages ?? 1)>1) {
      throw new HttpError(400,'Choose a still JPEG, PNG, or WebP image.','unsupported_image_type');
    }
    if(!metadata.width || !metadata.height || metadata.width*metadata.height>MAX_PIXELS) throw new HttpError(400,'Image dimensions are too large.','image_dimensions_too_large');
    const output=await image.rotate().webp({quality:92}).toBuffer({resolveWithObject:true});
    return {buffer:output.data,contentType:'image/webp',width:output.info.width,height:output.info.height,byteCount:output.data.byteLength};
  } catch(error) {
    if(error instanceof HttpError)throw error;
    throw new HttpError(400,'This file could not be read as a valid photo.','invalid_image');
  }
}

export function localObjectPath(key:string) {
  const root=path.resolve(env().LOCAL_STORAGE_DIR);
  const resolved=path.resolve(root,key);
  if(!key || key.includes('\\') || !resolved.startsWith(root+path.sep)) throw new HttpError(400,'Invalid storage key.','invalid_storage_key');
  return resolved;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  const client = s3Client();
  if (client) {
    const parsed = env();
    if (!parsed.R2_PRIVATE_BUCKET) throw new Error("R2_PRIVATE_BUCKET is required.");
    await client.send(new PutObjectCommand({ Bucket: parsed.R2_PRIVATE_BUCKET, Key: key, Body: body, ContentType: contentType }));
    return;
  }
  const fullPath = localObjectPath(key);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, body);
}

export async function getObject(key: string) {
  const client = s3Client();
  if (client) {
    const parsed = env();
    if (!parsed.R2_PRIVATE_BUCKET) throw new Error("R2_PRIVATE_BUCKET is required.");
    const response = await client.send(new GetObjectCommand({ Bucket: parsed.R2_PRIVATE_BUCKET, Key: key }));
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) chunks.push(chunk);
    return Buffer.concat(chunks);
  }
  return fs.readFile(localObjectPath(key));
}

export async function deleteObject(key: string) {
  const client = s3Client();
  if (client) {
    const parsed = env();
    if (!parsed.R2_PRIVATE_BUCKET) throw new Error("R2_PRIVATE_BUCKET is required.");
    await client.send(new DeleteObjectCommand({ Bucket: parsed.R2_PRIVATE_BUCKET, Key: key }));
    return;
  }
  await fs.rm(localObjectPath(key), { force: true });
}

export async function signedDownloadUrl(key: string, ttlSeconds = 300) {
  const client = s3Client();
  if (!client) throw new Error('Local downloads must use an authenticated asset endpoint.');
  const parsed = env();
  if (!parsed.R2_PRIVATE_BUCKET) throw new Error("R2_PRIVATE_BUCKET is required.");
  return getSignedUrl(client, new GetObjectCommand({ Bucket: parsed.R2_PRIVATE_BUCKET, Key: key }), { expiresIn: ttlSeconds });
}

export async function createAsset(client: DbClient, input: {
  userId?: string;
  guestId?: string;
  kind: "source" | "target" | "result";
  key: string;
  contentType: string;
  width: number;
  height: number;
  byteCount: number;
  expiresAt?: Date | null;
  metadata?: Record<string, unknown>;
}) {
  const result = await client.query<{ id: string }>(
    `insert into app.assets
       (user_id, guest_id, kind, object_key, content_type, width, height, byte_count, expires_at, metadata, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active')
     returning id`,
    [
      input.userId ?? null,
      input.guestId ?? null,
      input.kind,
      input.key,
      input.contentType,
      input.width,
      input.height,
      input.byteCount,
      input.expiresAt ?? null,
      JSON.stringify(input.metadata ?? {})
    ]
  );
  return result.rows[0].id;
}

export async function storeUploadedAsset(client: DbClient = getPool(), input: {
  file: File;
  kind: "source" | "target";
  userId?: string;
  guestId?: string;
}) {
  const normalized = await validateAndNormalizeImage(input.file);
  const ownerPrefix = input.userId ? `users/${input.userId}` : `guests/${input.guestId}`;
  const key = `${ownerPrefix}/${input.kind}/${randomId()}.webp`;
  await putObject(key, normalized.buffer, normalized.contentType);
  let assetId:string;
  try {assetId = await createAsset(client, {
    ...normalized,
    userId: input.userId,
    guestId: input.guestId,
    kind: input.kind,
    key,
    expiresAt: new Date(Date.now() + 24 * 3600_000)
  });
  } catch(error) {await deleteObject(key).catch(()=>{});throw error;}
  return { assetId, key, ...normalized };
}

export async function assertAssetOwner(client: DbClient, assetId: string, actor: { userId?: string; guestId?: string }) {
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assetId)) throw new HttpError(404,'Asset not found.','asset_not_found');
  const result = await client.query<{ id: string; object_key: string; content_type: string; kind: string }>(
    `select id, object_key, content_type, kind from app.assets
     where id = $1 and status = 'active' and (expires_at is null or expires_at > now())
       and (($2::uuid is not null and user_id = $2::uuid)
         or ($3::uuid is not null and guest_id = $3::uuid and user_id is null))`,
    [assetId, actor.userId ?? null, actor.guestId ?? null]
  );
  if (!result.rows[0]) throw new HttpError(404, "Asset not found.", "asset_not_found");
  return result.rows[0];
}
