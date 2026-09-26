import { BillingSetupError } from "@/server/billing/catalog";
import { errorJson, json } from "@/server/billing/http";
import { insertStripeEventInbox } from "@/server/billing/repository";
import { constructStripeEvent } from "@/server/billing/stripe-actions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const event = await constructStripeEvent(rawBody, request.headers.get("stripe-signature"));
    const status = await insertStripeEventInbox(event);

    return json({ received: true, status }, { status: 202 });
  } catch (error) {
    if (error instanceof BillingSetupError) {
      return errorJson(error.code, error.message, 503, { missing: error.missing });
    }

    return errorJson("invalid_webhook", "Stripe webhook signature verification failed.", 400);
  }
}
