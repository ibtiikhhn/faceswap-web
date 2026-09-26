import { getPool } from "@/server/db";
import { hasActiveSubscription } from "@/server/billing/credits";
import { HttpError } from "@/server/http";
import { requireUser } from "@/server/auth";
import { requireCreditPack } from "@/server/billing/catalog";
import { billingErrorResponse, errorJson, isForbiddenOriginError, json, requireSameOrigin } from "@/server/billing/http";
import { getOrCreateStripeCustomerId } from "@/server/billing/repository";
import { createCheckoutSession } from "@/server/billing/stripe-actions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const userId = await requireUser(request as any);
    if(!await hasActiveSubscription(getPool(),userId)) throw new HttpError(402,"An active paid subscription is required to buy credit packs.","subscription_required");
    const body = await request.json();
    const pack = requireCreditPack(body?.packCode);
    const user = { id: userId };
    const customerId = await getOrCreateStripeCustomerId(user);
    const url = await createCheckoutSession({ kind: "credit_pack", user, pack }, customerId);

    return json({ url });
  } catch (error) {
    if (isForbiddenOriginError(error)) {
      return errorJson("forbidden_origin", "Billing mutations must come from this site.", 403);
    }
    return billingErrorResponse(error);
  }
}
