import Stripe from "stripe";
import { env } from "@/server/env";
import { HttpError } from "@/server/http";

let stripeClient: Stripe | null = null;

export function getStripe() {
  const parsed = env();
  if (!parsed.STRIPE_SECRET_KEY) throw new HttpError(503, "Stripe is not configured yet.", "stripe_not_configured");
  stripeClient ??= new Stripe(parsed.STRIPE_SECRET_KEY);
  return stripeClient;
}

export type BillingPlan = {
  code: "weekly" | "monthly" | "yearly";
  priceId?: string;
  label: string;
};

export const billingPlans: BillingPlan[] = [
  { code: "weekly", label: "Weekly", priceId: env().STRIPE_WEEKLY_PRICE_ID },
  { code: "monthly", label: "Monthly", priceId: env().STRIPE_MONTHLY_PRICE_ID },
  { code: "yearly", label: "Yearly", priceId: env().STRIPE_YEARLY_PRICE_ID }
];

export function priceForPlan(code: string) {
  const plan = billingPlans.find((item) => item.code === code);
  if (!plan?.priceId) throw new HttpError(400, "This plan is not configured yet.", "plan_not_configured");
  return plan.priceId;
}
