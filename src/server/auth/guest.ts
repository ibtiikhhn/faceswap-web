import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { getPool, type DbClient } from "@/server/db";
import { HttpError } from "@/server/http";
import { env } from "@/server/env";

const COOKIE = "fs_guest";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function hashGuestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createGuestToken() {
  return `${randomBytes(12).toString("base64url")}.${randomBytes(32).toString("base64url")}`;
}

export async function getOrCreateGuest(request: NextRequest, client: DbClient = getPool()) {
  const supplied=request.cookies.get(COOKIE)?.value;
  if(supplied && supplied.length < 200) {
    const found=await client.query<{id:string;trial_state:string;claimed_user_id:string|null}>(
      'select id,trial_state,claimed_user_id from app.guest_sessions where token_hash=$1 and expires_at>now()', [hashGuestToken(supplied)]);
    if(found.rows[0]) {
      if(found.rows[0].claimed_user_id) throw new HttpError(401,'Sign in to access your saved studio.','auth_required');
      return {id:found.rows[0].id,token:supplied,isNew:false,trialState:found.rows[0].trial_state,cookieName:COOKIE,maxAge:MAX_AGE_SECONDS};
    }
  }
  const token=createGuestToken();
  const result=await client.query<{id:string;trial_state:string}>(
    'insert into app.guest_sessions(token_hash,expires_at) values($1,$2) returning id,trial_state',
    [hashGuestToken(token),new Date(Date.now()+MAX_AGE_SECONDS*1000)]);
  return {id:result.rows[0].id,token,isNew:true,trialState:result.rows[0].trial_state,cookieName:COOKIE,maxAge:MAX_AGE_SECONDS};
}

export async function getGuestFromRequest(request: NextRequest, client: DbClient = getPool(), claimedUserId?: string) {
  const token = request.cookies.get(COOKIE)?.value;
  if (!token) return null;
  const result = await client.query<{ id: string; trial_state: string }>(
    `select id, trial_state from app.guest_sessions
     where token_hash = $1 and expires_at > now()
       and (claimed_user_id is null or claimed_user_id = $2::uuid)`,
    [hashGuestToken(token), claimedUserId ?? null]
  );
  return result.rows[0] ? { id: result.rows[0].id, token, trialState: result.rows[0].trial_state } : null;
}

export async function claimGuestForUser(client: DbClient, input: { guestId: string; userId: string }) {
  const result = await client.query(
    `update app.guest_sessions
     set claimed_user_id = $2, updated_at = now()
     where id = $1
       and (claimed_user_id is null or claimed_user_id = $2)
     returning id`,
    [input.guestId, input.userId]
  );
  if (!result.rowCount) return false;
  await client.query(`update app.assets set user_id=$2,
    expires_at=case when kind='result' then greatest(expires_at,now()+interval '30 days') else expires_at end
    where guest_id=$1 and user_id is null and status='active'`, [input.guestId,input.userId]);
  await client.query('update app.swap_jobs set user_id=$2 where guest_id=$1 and user_id is null', [input.guestId,input.userId]);
  return true;
}

export function setGuestCookie(response: Response, token: string, maxAge = MAX_AGE_SECONDS) {
  response.headers.append(
    "Set-Cookie",
    `${COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${new URL(env().APP_URL).protocol === "https:" ? "; Secure" : ""}`
  );
}
