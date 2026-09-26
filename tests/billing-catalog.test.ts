import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  findConfiguredEntitlementByPriceId,
  getPublicBillingCatalog,
  parsePositiveInt,
  requireCreditPack,
  requireSubscriptionPlan,
} from "../src/server/billing/catalog";

describe("billing catalog", () => {
  it("parses positive integer env values only", () => {
    assert.equal(parsePositiveInt("1"), 1);
    assert.equal(parsePositiveInt("25"), 25);
    assert.equal(parsePositiveInt("0"), null);
    assert.equal(parsePositiveInt("-1"), null);
    assert.equal(parsePositiveInt("1.5"), null);
    assert.equal(parsePositiveInt(undefined), null);
  });

  it("does not expose Stripe price ids in the public catalog", () => {
    const catalog = getPublicBillingCatalog({
      STRIPE_PRICE_WEEKLY: "price_week",
      BILLING_WEEKLY_CREDITS: "10",
    } as unknown as NodeJS.ProcessEnv);

    assert.equal(catalog.subscriptions[0].configured, true);
    assert.equal(catalog.subscriptions[0].includedCredits, 10);
    assert.equal("stripePriceId" in catalog.subscriptions[0], false);
  });

  it("requires server configured plans and packs", () => {
    const env = {
      STRIPE_PRICE_MONTHLY: "price_month",
      BILLING_MONTHLY_CREDITS: "100",
      STRIPE_PRICE_PACK_SMALL: "price_pack",
      BILLING_PACK_SMALL_CREDITS: "20",
    } as unknown as NodeJS.ProcessEnv;

    assert.equal(requireSubscriptionPlan("monthly", env).stripePriceId, "price_month");
    assert.equal(requireCreditPack("small", env).credits, 20);
    assert.throws(() => requireSubscriptionPlan("weekly", env), /not configured/);
  });

  it("maps configured price ids to entitlement metadata", () => {
    const env = {
      STRIPE_PRICE_YEARLY: "price_year",
      BILLING_YEARLY_CREDITS: "1200",
      STRIPE_PRICE_PACK_MEDIUM: "price_pack_medium",
      BILLING_PACK_MEDIUM_CREDITS: "60",
    } as unknown as NodeJS.ProcessEnv;

    assert.deepEqual(findConfiguredEntitlementByPriceId("price_year", env)?.kind, "subscription");
    assert.deepEqual(findConfiguredEntitlementByPriceId("price_pack_medium", env)?.kind, "pack");
    assert.equal(findConfiguredEntitlementByPriceId("price_unknown", env), null);
  });
});
