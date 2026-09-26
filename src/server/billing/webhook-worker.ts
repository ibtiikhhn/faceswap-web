import { getPool } from "../db";
import { findConfiguredEntitlementByPriceId } from "./catalog";
import {
  claimPendingStripeEvent,
  expireCreditsForStripeRisk,
  findCustomerIdByStripeCustomer,
  grantCreditsOnce,
  markStripeEventFailed,
  markStripeEventIgnored,
  markStripeEventProcessed,
  recordBillingRisk,
  upsertSubscriptionState,
} from "./repository";
import type { StripeWebhookProcessingResult } from "./types";
import {
  customerIdFromStripeObject,
  firstInvoiceLinePriceId,
  isPaidInvoice,
  objectId,
  periodEndFromInvoice,
  periodStartFromInvoice,
  subscriptionPeriod,
  subscriptionIdFromInvoice,
  isSubscriptionBillingReason,
} from "./webhook-utils";

export async function processStripeWebhookInbox(eventId?: string): Promise<StripeWebhookProcessingResult | null> {
  const inboxEvent = await claimPendingStripeEvent(eventId);
  if (!inboxEvent) return null;

  try {
    const event = inboxEvent.payload as any;
    const result = await processStripeEvent(event);
    if (result.status === "ignored") {
      await markStripeEventIgnored(inboxEvent.id, result.reason);
      return { ...result, eventId: inboxEvent.id };
    }

    await markStripeEventProcessed(inboxEvent.id);
    return { status: "processed", eventId: inboxEvent.id };
  } catch (error) {
    await markStripeEventFailed(inboxEvent.id, error);
    throw error;
  }
}

async function processStripeEvent(event: any): Promise<{ status: "processed" } | { status: "ignored"; reason: string }> {
  switch (event.type) {
    case "invoice.paid":
      return processPaidInvoice(event);
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.completed":
      return processCompletedCheckoutSession(event);
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return processSubscriptionChanged(event);
    case "invoice.payment_failed":
    case "charge.refunded":
    case "charge.dispute.created":
      return processConservativeRiskEvent(event);
    default:
      return { status: "ignored", reason: `Unhandled event type ${event.type}` };
  }
}

async function processPaidInvoice(event: any): Promise<{ status: "processed" } | { status: "ignored"; reason: string }> {
  const invoice = event.data.object;
  if (!isPaidInvoice(invoice)) {
    return { status: "ignored", reason: "Invoice is not paid." };
  }

  const stripeCustomerId = customerIdFromStripeObject(invoice);
  if (!stripeCustomerId) return { status: "ignored", reason: "Invoice has no customer." };

  const customerId = await findCustomerIdByStripeCustomer(stripeCustomerId);
  if (!customerId) return { status: "ignored", reason: "Invoice customer is not linked to an app customer." };
  const invoiceUserId = userIdFromStripeMetadata(invoice);
  if (invoiceUserId && invoiceUserId !== customerId) {
    await recordBillingRisk({
      customerId,
      stripeCustomerId,
      eventType: event.type,
      stripeObjectId: objectId(invoice),
      reason: "Invoice user metadata does not match the linked Stripe customer.",
      payload: invoice,
    });
    return { status: "ignored", reason: "Invoice user metadata does not match customer ownership." };
  }

  const subscriptionId=subscriptionIdFromInvoice(invoice);
  if(!subscriptionId || !isSubscriptionBillingReason(invoice)) return {status:'ignored',reason:'Invoice is not a recurring subscription entitlement.'};
  const priceId = firstInvoiceLinePriceId(invoice);
  const entitlement = findConfiguredEntitlementByPriceId(priceId);
  if (!entitlement || entitlement.kind !== "subscription") {
    return { status: "ignored", reason: "Invoice price is not a configured subscription entitlement." };
  }
  const paidPeriodStart = periodStartFromInvoice(invoice);
  const paidPeriodEnd = periodEndFromInvoice(invoice);
  if (!paidPeriodStart || !paidPeriodEnd || paidPeriodEnd <= paidPeriodStart) {
    return { status: "ignored", reason: "Paid invoice does not include a complete subscription period." };
  }

  await upsertSubscriptionState({
    customerId,
    stripeCustomerId,
    stripeSubscriptionId: subscriptionId,
    stripePriceId: priceId ?? null,
    planCode: entitlement.plan.code,
    status: "active",
    currentPeriodStart: paidPeriodStart,
    currentPeriodEnd: paidPeriodEnd,
    paidCurrentPeriodStart: paidPeriodStart,
    paidCurrentPeriodEnd: paidPeriodEnd,
    latestPaidInvoiceId: invoice.id,
    cancelAtPeriodEnd: false,
    stripeEventCreatedAt:new Date((event.created ?? 0)*1000),
    raw: invoice,
  });

  await grantCreditsOnce({
    customerId,
    amount: entitlement.plan.includedCredits ?? 0,
    source: "subscription_invoice",
    idempotencyKey: `subscription_invoice:${invoice.id}:${priceId}`,
    expiresAt: paidPeriodEnd,
    stripeCustomerId,
    stripeSubscriptionId: subscriptionId,
    stripeInvoiceId: invoice.id,
    metadata: {
      planCode: entitlement.plan.code,
      priceId,
      includedCredits: entitlement.plan.includedCredits,
      paidPeriodStart: paidPeriodStart.toISOString(),
      paidPeriodEnd: paidPeriodEnd.toISOString(),
      stripeEventId: event.id,
    },
  });

  return { status: "processed" };
}

async function processCompletedCheckoutSession(
  event: any,
): Promise<{ status: "processed" } | { status: "ignored"; reason: string }> {
  const session = event.data.object;
  if (session.mode !== "payment") {
    return { status: "ignored", reason: "Checkout session is not a one-time credit pack payment." };
  }

  if (session.payment_status !== "paid") {
    return { status: "ignored", reason: "Checkout session payment is not paid yet." };
  }

  const stripeCustomerId = customerIdFromStripeObject(session);
  if (!stripeCustomerId) return { status: "ignored", reason: "Checkout session has no customer." };

  const customerId = await findCustomerIdByStripeCustomer(stripeCustomerId);
  if (!customerId) return { status: "ignored", reason: "Checkout customer is not linked to an app customer." };
  const checkoutUserId = typeof session.client_reference_id === "string"
    ? session.client_reference_id
    : session.metadata?.user_id;
  if (checkoutUserId && checkoutUserId !== customerId) {
    await recordBillingRisk({
      customerId,
      stripeCustomerId,
      eventType: event.type,
      stripeObjectId: objectId(session),
      reason: "Checkout session user metadata does not match the linked Stripe customer.",
      payload: session,
    });
    return { status: "ignored", reason: "Checkout session user metadata does not match customer ownership." };
  }

  const priceId = session.line_items?.data?.[0]?.price?.id ?? session.metadata?.price_id ?? null;
  const entitlement = findConfiguredEntitlementByPriceId(priceId);
  if (!entitlement || entitlement.kind !== "pack") {
    return { status: "ignored", reason: "Checkout price is not a configured credit pack." };
  }

  await grantCreditsOnce({
    customerId,
    amount: entitlement.pack.credits ?? 0,
    source: "credit_pack",
    idempotencyKey: `credit_pack:${typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? session.id}:${priceId}`,
    expiresAt: null,
    stripeCustomerId,
    stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
    metadata: {
      packCode: entitlement.pack.code,
      priceId,
      credits: entitlement.pack.credits,
      checkoutSessionId: session.id,
      stripeEventId: event.id,
    },
  });

  return { status: "processed" };
}

async function processSubscriptionChanged(
  event: any,
): Promise<{ status: "processed" } | { status: "ignored"; reason: string }> {
  const subscription = event.data.object;
  const stripeCustomerId = customerIdFromStripeObject(subscription);
  if (!stripeCustomerId) return { status: "ignored", reason: "Subscription has no customer." };

  const customerId = await findCustomerIdByStripeCustomer(stripeCustomerId);
  if (!customerId) return { status: "ignored", reason: "Subscription customer is not linked to an app customer." };
  const subscriptionUserId = userIdFromStripeMetadata(subscription);
  if (subscriptionUserId && subscriptionUserId !== customerId) {
    await recordBillingRisk({
      customerId,
      stripeCustomerId,
      eventType: event.type,
      stripeObjectId: objectId(subscription),
      reason: "Subscription user metadata does not match the linked Stripe customer.",
      payload: subscription,
    });
    return { status: "ignored", reason: "Subscription user metadata does not match customer ownership." };
  }

  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
  const entitlement = findConfiguredEntitlementByPriceId(priceId);
  const periods = subscriptionPeriod(subscription);

  await upsertSubscriptionState({
    customerId,
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    planCode: entitlement?.kind === "subscription" ? entitlement.plan.code : null,
    status: subscription.status,
    currentPeriodStart: periods.start,
    currentPeriodEnd: periods.end,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    stripeEventCreatedAt:new Date((event.created ?? 0)*1000),
    raw: subscription,
  });

  return { status: "processed" };
}

async function processConservativeRiskEvent(
  event: any,
): Promise<{ status: "processed" } | { status: "ignored"; reason: string }> {
  let stripeObject = event.data.object;
  if(event.type==='charge.dispute.created' && typeof stripeObject.charge==='string') {
    const { getStripe }=await import('./stripe');
    const charge=await getStripe().charges.retrieve(stripeObject.charge);
    stripeObject={...stripeObject,customer:charge.customer,payment_intent:charge.payment_intent};
  }
  if(event.type==='invoice.payment_failed') {
    const id=subscriptionIdFromInvoice(stripeObject);
    if(id) await getPool().query(`update app.subscriptions set status='past_due',latest_stripe_event_created_at=$2,updated_at=now()
      where stripe_subscription_id=$1 and (latest_stripe_event_created_at is null or latest_stripe_event_created_at<=$2)`,[id,new Date((event.created??0)*1000)]);
  }
  const stripeCustomerId = customerIdFromStripeObject(stripeObject);
  const customerId = stripeCustomerId ? await findCustomerIdByStripeCustomer(stripeCustomerId) : null;
  const stripePaymentIntentId = stripePaymentIntentIdFromRiskObject(stripeObject);
  const stripeInvoiceId = stripeInvoiceIdFromRiskObject(stripeObject);
  await expireCreditsForStripeRisk({ stripePaymentIntentId, stripeInvoiceId });

  await recordBillingRisk({
    customerId,
    stripeCustomerId,
    eventType: event.type,
    stripeObjectId: objectId(stripeObject),
    reason: "Payment risk event requires conservative owner review before granting or restoring credits.",
    payload: stripeObject,
  });

  return { status: "processed" };
}

function userIdFromStripeMetadata(value: any): string | null {
  const metadataCandidates = [
    value?.metadata,
    value?.subscription_details?.metadata,
    value?.parent?.subscription_details?.metadata,
    value?.subscription?.metadata,
  ];
  for (const metadata of metadataCandidates) {
    if (typeof metadata?.user_id === "string") return metadata.user_id;
  }
  return null;
}

function stripePaymentIntentIdFromRiskObject(value: any): string | null {
  const paymentIntent = value?.payment_intent ?? value?.paymentIntent;
  if (typeof paymentIntent === "string") return paymentIntent;
  if (paymentIntent && typeof paymentIntent.id === "string") return paymentIntent.id;
  return null;
}

function stripeInvoiceIdFromRiskObject(value: any): string | null {
  const invoice = value?.invoice;
  if (typeof invoice === "string") return invoice;
  if (invoice && typeof invoice.id === "string") return invoice.id;
  return null;
}
