import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { env } from "@/server/env";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "request_failed"
  ) {
    super(message);
  }
}

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

export function noStoreHeaders(contentType?: string) {
  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0"
  });
  if (contentType) headers.set("Content-Type", contentType);
  return headers;
}

export function fail(error: unknown) {
  if (error instanceof HttpError) {
    return json({ error: { code: error.code, message: error.message } }, error.status);
  }
  if (error instanceof ZodError) {
    return json({ error: { code: "validation_failed", message: "Invalid request.", issues: error.flatten() } }, 400);
  }
  if (error instanceof SyntaxError) return json({error:{code:'invalid_body',message:'Invalid request body.'}},400);
  console.error(error instanceof Error ? {name:error.name,message:error.message} : 'Request failed');
  return json({ error: { code: "internal_error", message: "Something went wrong." } }, 500);
}

export function config503(feature: string) {
  return json(
    {
      error: {
        code: "service_not_configured",
        message: `${feature} is not configured for this environment.`
      }
    },
    503
  );
}

export function assertOrigin(request: Request) {
  const origin=request.headers.get('origin');
  if(request.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403,'Cross-site requests are not allowed.','bad_origin');
  if(!origin) return; // Non-browser clients still require their own authenticated session.
  let valid=false;
  try { valid=new URL(origin).origin === new URL(env().APP_URL).origin; } catch {}
  if(!valid) throw new HttpError(403,'Cross-site requests are not allowed.','bad_origin');
}

/** Limit bytes while streaming, before parsing multipart or JSON into memory. */
export async function boundedBody(request: Request, maxBytes: number) {
  const declared=Number(request.headers.get('content-length'));
  if(declared>maxBytes) throw new HttpError(413,'Request is too large.','request_too_large');
  if(!request.body) return new Uint8Array();
  const reader=request.body.getReader();let total=0;const chunks:Uint8Array[]=[];
  try {
    while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;
      if(total>maxBytes){await reader.cancel();throw new HttpError(413,'Request is too large.','request_too_large');}chunks.push(value);}
  } finally {reader.releaseLock();}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}

const buckets = new Map<string, { count: number; resetAt: number }>();

export function assertRateLimit(request: Request, key: string, limit: number, windowMs: number) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();
  if(buckets.size>5000) { for(const [key,bucket] of buckets){ if(bucket.resetAt<=now)buckets.delete(key); } if(buckets.size>10000) buckets.clear(); }
  const current = buckets.get(bucketKey);
  if (!current || current.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return;
  }
  current.count += 1;
  if (current.count > limit) {
    throw new HttpError(429, "Too many requests. Please try again shortly.", "rate_limited");
  }
}
