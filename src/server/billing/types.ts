import type { CreditPackConfig, SubscriptionPlanConfig } from "./catalog";

export type AuthenticatedUser = {
  id: string;
  email?: string | null;
};

export type CheckoutKind = "subscription" | "credit_pack";

export type BillingCheckoutRequest =
  | {
      kind: "subscription";
      planCode: string;
    }
  | {
      kind: "credit_pack";
      packCode: string;
    };

export type CreateCheckoutInput =
  | {
      kind: "subscription";
      user: AuthenticatedUser;
      plan: SubscriptionPlanConfig;
    }
  | {
      kind: "credit_pack";
      user: AuthenticatedUser;
      pack: CreditPackConfig;
    };

export type StoredStripeCustomer = {
  userId: string;
  stripeCustomerId: string;
};

export type StripeWebhookProcessingResult =
  | { status: "processed"; eventId: string }
  | { status: "ignored"; eventId: string; reason: string }
  | { status: "duplicate"; eventId: string };
