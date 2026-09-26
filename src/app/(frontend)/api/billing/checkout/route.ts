import { getPool } from "@/server/db";
import { HttpError } from "@/server/http";
import { requireUser } from "@/server/auth";
import { requireSubscriptionPlan } from "@/server/billing/catalog";
import { billingErrorResponse, errorJson, isForbiddenOriginError, json, requireSameOrigin } from "@/server/billing/http";
import { getOrCreateStripeCustomerId } from "@/server/billing/repository";
import { createCheckoutSession } from "@/server/billing/stripe-actions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const userId = await requireUser(request as any);
    const existing = await getPool().query(
      "select id from app.subscriptions where user_id = $1 and status in ('active','trialing','past_due','incomplete','unpaid','paused') limit 1", [userId]);
    if (existing.rows[0]) throw new HttpError(409, "Manage your existing subscription from the billing page.", "subscription_exists");
    const body = await request.json();
    const plan = requireSubscriptionPlan(body?.planCode);
    const user = { id: userId };
    const customerId = await getOrCreateStripeCustomerId(user);
    const url = await createCheckoutSession({ kind: "subscription", user, plan }, customerId);

    return json({ url });
  } catch (error) {
    if (isForbiddenOriginError(error)) {
      return errorJson("forbidden_origin", "Billing mutations must come from this site.", 403);
    }
    return billingErrorResponse(error);
  }
}
