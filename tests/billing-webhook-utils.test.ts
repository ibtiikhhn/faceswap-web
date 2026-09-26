import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  customerIdFromStripeObject,
  firstInvoiceLinePriceId,
  isPaidInvoice,
  objectId,
  periodEndFromInvoice,
  periodStartFromInvoice,
  subscriptionPeriod,
} from "../src/server/billing/webhook-utils";

describe("billing webhook utils", () => {
  it("extracts customer ids from expanded and unexpanded Stripe objects", () => {
    assert.equal(customerIdFromStripeObject({ customer: "cus_123" }), "cus_123");
    assert.equal(customerIdFromStripeObject({ customer: { id: "cus_456" } }), "cus_456");
    assert.equal(customerIdFromStripeObject({}), null);
  });

  it("extracts invoice price ids across Stripe invoice shapes", () => {
    assert.equal(firstInvoiceLinePriceId({ billing_reason:"subscription_cycle", lines: { data: [{ price: { id: "price_1" } }] } }), "price_1");
    assert.equal(
      firstInvoiceLinePriceId({ billing_reason:"subscription_cycle", lines: { data: [{ pricing: { price_details: { id: "price_2" } } }] } }),
      "price_2",
    );
    assert.equal(firstInvoiceLinePriceId({ billing_reason:"subscription_cycle", lines: { data: [] } }), null);
  });

  it("converts period timestamps to dates", () => {
    assert.equal(periodStartFromInvoice({ billing_reason:"subscription_cycle", lines: { data: [{ price:{id:"price"}, period: { start: 500 } }] } })?.toISOString(), "1970-01-01T00:08:20.000Z");
    assert.equal(periodEndFromInvoice({ billing_reason:"subscription_cycle", lines: { data: [{ price:{id:"price"}, period: { end: 1000 } }] } })?.toISOString(), "1970-01-01T00:16:40.000Z");
    assert.deepEqual(subscriptionPeriod({ current_period_start: 10, current_period_end: 20 }), {
      start: new Date(10_000),
      end: new Date(20_000),
    });
    assert.equal(objectId({ id: "evt_1" }), "evt_1");
  });

  it("requires both Stripe paid markers for paid invoices", () => {
    assert.equal(isPaidInvoice({ paid: true, status: "paid" }), true);
    assert.equal(isPaidInvoice({ paid: true, status: "open" }), false);
    assert.equal(isPaidInvoice({ paid: false, status: "paid" }), false);
  });
});
