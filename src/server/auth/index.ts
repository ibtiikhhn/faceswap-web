import type { NextRequest } from 'next/server';
import { getPool, withTransaction } from '@/server/db';
import { getGuestFromRequest, claimGuestForUser } from '@/server/auth/guest';
import { HttpError } from '@/server/http';
import { featureState } from '@/server/env';
import { getAuth } from '@/server/auth/auth';
export type Actor = { userId?: string; guestId?: string };
export async function getActor(request: NextRequest): Promise<Actor> {
 const pool = getPool();
 const session = featureState().auth ? await getAuth().api.getSession({ headers: request.headers }) : null;
 const userId = session?.user?.id;
 if (userId) {
  const user = await pool.query('select id from app.users where id=$1 and suspended_at is null and deletion_requested_at is null', [userId]);
  if (!user.rowCount) throw new HttpError(403, 'This account is unavailable.', 'account_unavailable');
  const guest = await getGuestFromRequest(request, pool, userId);
  if (guest) await withTransaction(pool, tx => claimGuestForUser(tx, { guestId: guest.id, userId }));
  return { userId };
 }
 const guest = await getGuestFromRequest(request, pool);
 return { guestId: guest?.id };
}
export async function requireUser(request: NextRequest) {
 const actor = await getActor(request);
 if (!actor.userId) throw new HttpError(401, 'Please sign in to continue.', 'auth_required');
 return actor.userId;
}
