export type BillingInterval = "week" | "month" | "year";

export type SubscriptionPlanCode = "weekly" | "monthly" | "yearly";

export type CreditPackCode = "small" | "medium" | "large";

export type SubscriptionPlanConfig = {
  code: SubscriptionPlanCode;
  name: string;
  interval: BillingInterval;
  priceEnv: string;
  fallbackPriceEnv?: string;
  creditsEnv: string;
  stripePriceId: string | null;
  includedCredits: number | null;
};

export type CreditPackConfig = {
  code: CreditPackCode;
  name: string;
  priceEnv: string;
  fallbackPriceEnv?: string;
  creditsEnv: string;
  stripePriceId: string | null;
  credits: number | null;
};

export type PublicBillingCatalog = {
  subscriptions: Array<{
    code: SubscriptionPlanCode;
    name: string;
    interval: BillingInterval;
    configured: boolean;
    includedCredits: number | null;
  }>;
  creditPacks: Array<{
    code: CreditPackCode;
    name: string;
    configured: boolean;
    credits: number | null;
  }>;
};

const subscriptionDefinitions = [
  {
    code: "weekly",
    name: "Weekly",
    interval: "week",
    priceEnv: "STRIPE_WEEKLY_PRICE_ID",
    fallbackPriceEnv: "STRIPE_PRICE_WEEKLY",
    creditsEnv: "BILLING_WEEKLY_CREDITS",
  },
  {
    code: "monthly",
    name: "Monthly",
    interval: "month",
    priceEnv: "STRIPE_MONTHLY_PRICE_ID",
    fallbackPriceEnv: "STRIPE_PRICE_MONTHLY",
    creditsEnv: "BILLING_MONTHLY_CREDITS",
  },
  {
    code: "yearly",
    name: "Yearly",
    interval: "year",
    priceEnv: "STRIPE_YEARLY_PRICE_ID",
    fallbackPriceEnv: "STRIPE_PRICE_YEARLY",
    creditsEnv: "BILLING_YEARLY_CREDITS",
  },
] as const;

const packDefinitions = [
  {
    code: "small",
    name: "Small credit pack",
    priceEnv: "STRIPE_CREDIT_PACK_PRICE_ID",
    fallbackPriceEnv: "STRIPE_PRICE_PACK_SMALL",
    creditsEnv: "BILLING_PACK_SMALL_CREDITS",
  },
  {
    code: "medium",
    name: "Medium credit pack",
    priceEnv: "STRIPE_PRICE_PACK_MEDIUM",
    fallbackPriceEnv: undefined,
    creditsEnv: "BILLING_PACK_MEDIUM_CREDITS",
  },
  {
    code: "large",
    name: "Large credit pack",
    priceEnv: "STRIPE_PRICE_PACK_LARGE",
    fallbackPriceEnv: undefined,
    creditsEnv: "BILLING_PACK_LARGE_CREDITS",
  },
] as const;

function readEnv(env: NodeJS.ProcessEnv, key: string, fallbackKey?: string): string | null {
  return env[key] || (fallbackKey ? env[fallbackKey] : undefined) || null;
}

export class BillingSetupError extends Error {
  readonly code = "setup_required";
  readonly missing: string[];

  constructor(message: string, missing: string[] = []) {
    super(message);
    this.name = "BillingSetupError";
    this.missing = missing;
  }
}

export function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  if (!/^[1-9]\d*$/.test(value)) return null;
  return Number(value);
}

export function getSubscriptionPlans(env: NodeJS.ProcessEnv = process.env): SubscriptionPlanConfig[] {
  return subscriptionDefinitions.map((plan) => ({
    ...plan,
    stripePriceId: readEnv(env, plan.priceEnv, plan.fallbackPriceEnv),
    includedCredits: parsePositiveInt(env[plan.creditsEnv]),
  }));
}

export function getCreditPacks(env: NodeJS.ProcessEnv = process.env): CreditPackConfig[] {
  return packDefinitions.map((pack) => ({
    ...pack,
    stripePriceId: readEnv(env, pack.priceEnv, pack.fallbackPriceEnv),
    credits: parsePositiveInt(env[pack.creditsEnv]),
  }));
}

export function getPublicBillingCatalog(env: NodeJS.ProcessEnv = process.env): PublicBillingCatalog {
  return {
    subscriptions: getSubscriptionPlans(env).map((plan) => ({
      code: plan.code,
      name: plan.name,
      interval: plan.interval,
      configured: Boolean(plan.stripePriceId && plan.includedCredits),
      includedCredits: plan.includedCredits,
    })),
    creditPacks: getCreditPacks(env).map((pack) => ({
      code: pack.code,
      name: pack.name,
      configured: Boolean(pack.stripePriceId && pack.credits),
      credits: pack.credits,
    })),
  };
}

export function requireSubscriptionPlan(
  code: string,
  env: NodeJS.ProcessEnv = process.env,
): SubscriptionPlanConfig {
  const plan = getSubscriptionPlans(env).find((candidate) => candidate.code === code);
  if (!plan) {
    throw new BillingSetupError("Unknown subscription plan.", []);
  }

  const missing = [plan.priceEnv].filter(() => !readEnv(env, plan.priceEnv, plan.fallbackPriceEnv));
  if (!plan.stripePriceId || !plan.includedCredits) {
    throw new BillingSetupError(`Subscription plan ${plan.code} is not configured.`, missing);
  }

  return plan;
}

export function requireCreditPack(code: string, env: NodeJS.ProcessEnv = process.env): CreditPackConfig {
  const pack = getCreditPacks(env).find((candidate) => candidate.code === code);
  if (!pack) {
    throw new BillingSetupError("Unknown credit pack.", []);
  }

  const missing = [pack.priceEnv].filter(() => !readEnv(env, pack.priceEnv, pack.fallbackPriceEnv));
  if (!pack.stripePriceId || !pack.credits) {
    throw new BillingSetupError(`Credit pack ${pack.code} is not configured.`, missing);
  }

  return pack;
}

export function findConfiguredEntitlementByPriceId(
  priceId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
):
  | { kind: "subscription"; plan: SubscriptionPlanConfig }
  | { kind: "pack"; pack: CreditPackConfig }
  | null {
  if (!priceId) return null;

  const plan = getSubscriptionPlans(env).find((candidate) => candidate.stripePriceId === priceId);
  if (plan && plan.includedCredits) return { kind: "subscription", plan };

  const pack = getCreditPacks(env).find((candidate) => candidate.stripePriceId === priceId);
  if (pack && pack.credits) return { kind: "pack", pack };

  return null;
}
