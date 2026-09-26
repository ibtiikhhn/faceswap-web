import { env } from "@/server/env";
import { BillingSetupError } from "./catalog";
import { getStripe } from "./stripe";
import type { CreateCheckoutInput } from "./types";

export async function constructStripeEvent(rawBody: string, signature: string | null): Promise<any> {
  if (!signature) {
    throw new BillingSetupError("Stripe webhook signature header is missing.", []);
  }

  const parsed = env();
  if (!parsed.STRIPE_WEBHOOK_SECRET) {
    throw new BillingSetupError("STRIPE_WEBHOOK_SECRET must be configured before webhooks can run.", [
      "STRIPE_WEBHOOK_SECRET",
    ]);
  }

  return getStripe().webhooks.constructEvent(rawBody, signature, parsed.STRIPE_WEBHOOK_SECRET);
}

export async function createCheckoutSession(input: CreateCheckoutInput, stripeCustomerId: string): Promise<string> {
  const parsed = env();
  if (!parsed.APP_URL) {
    throw new BillingSetupError("APP_URL must be configured before checkout can run.", ["APP_URL"]);
  }

  const stripe = getStripe();
  const successUrl = new URL("/dashboard/billing?checkout=success", parsed.APP_URL).toString();
  const cancelUrl = new URL("/pricing?checkout=cancelled", parsed.APP_URL).toString();

  const price = input.kind === "subscription" ? input.plan.stripePriceId : input.pack.stripePriceId;
  if (!price) {
    throw new BillingSetupError("Stripe Price ID is not configured for this checkout item.", []);
  }

  const metadata: Record<string, string> =
    input.kind === "subscription"
      ? {
          user_id: input.user.id,
          checkout_kind: input.kind,
          plan_code: input.plan.code,
          price_id: price,
        }
      : {
          user_id: input.user.id,
          checkout_kind: input.kind,
          pack_code: input.pack.code,
          price_id: price,
        };

  const session = await stripe.checkout.sessions.create({
    mode: input.kind === "subscription" ? "subscription" : "payment",
    customer: stripeCustomerId,
    client_reference_id: input.user.id,
    line_items: [{ price, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    subscription_data: input.kind === "subscription" ? { metadata } : undefined,
    payment_intent_data: input.kind === "credit_pack" ? { metadata } : undefined,
    allow_promotion_codes: true,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout URL.");
  }

  return session.url;
}

export async function createPortalSession(stripeCustomerId: string): Promise<string> {
  const parsed = env();
  if (!parsed.APP_URL) {
    throw new BillingSetupError("APP_URL must be configured before portal can run.", ["APP_URL"]);
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: new URL("/dashboard/billing", parsed.APP_URL).toString(),
  });

  return session.url;
}
