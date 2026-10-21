import { usingWhop, requireWhop } from '@/server/billing/whop/settings';
import { createWhopCheckout } from '@/server/billing/whop/checkout';
import { NextRequest } from 'next/server';
import { requireUser } from '@/server/auth';
import { assertOrigin, boundedBody, HttpError } from '@/server/http';
import { billingErrorResponse, json } from '@/server/billing/http';
import { requirePaddle } from '@/server/billing/paddle/api';
import { createPaddleCheckout } from '@/server/billing/paddle/checkout';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
 try {
  if(usingWhop())requireWhop();else requirePaddle();
  assertOrigin(request);
  const userId = await requireUser(request);
  const body = JSON.parse(new TextDecoder().decode(await boundedBody(request, 4096)));
  if (typeof body?.packCode !== 'string') throw new HttpError(400,'Choose a valid offer.','invalid_offer');
  if(usingWhop())return json(await createWhopCheckout(userId,body.packCode,'pack'));
  return json(await createPaddleCheckout(userId,body.packCode,'pack'));
 } catch(error) { return billingErrorResponse(error); }
}
