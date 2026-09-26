import { requireUser } from "@/server/auth";
import { billingErrorResponse, errorJson, isForbiddenOriginError, json, requireSameOrigin } from "@/server/billing/http";
import { getOrCreateStripeCustomerId } from "@/server/billing/repository";
import { createPortalSession } from "@/server/billing/stripe-actions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const userId = await requireUser(request as any);
    const user = { id: userId };
    const customerId = await getOrCreateStripeCustomerId(user);
    const url = await createPortalSession(customerId);

    return json({ url });
  } catch (error) {
    if (isForbiddenOriginError(error)) {
      return errorJson("forbidden_origin", "Billing mutations must come from this site.", 403);
    }
    return billingErrorResponse(error);
  }
}
