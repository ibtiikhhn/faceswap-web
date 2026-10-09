import { NextRequest } from 'next/server';
import { requireUser } from '@/server/auth';
import { assertOrigin, boundedBody, HttpError } from '@/server/http';
import { billingErrorResponse, json } from '@/server/billing/http';
import { requirePaddle } from '@/server/billing/paddle/api';
import { createPaddleCheckout } from '@/server/billing/paddle/checkout';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
 try {
  requirePaddle();
  assertOrigin(request);
  const userId = await requireUser(request);
  const body = JSON.parse(new TextDecoder().decode(await boundedBody(request, 4096)));
  if (typeof body?.packCode !== 'string') throw new HttpError(400,'Choose a valid offer.','invalid_offer');
  return json(await createPaddleCheckout(userId,body.packCode,'pack'));
 } catch(error) { return billingErrorResponse(error); }
}
