export function customerIdFromStripeObject(value: any): string | null {
  const customer = value?.customer;
  if (typeof customer === "string") return customer;
  if (customer && typeof customer.id === "string") return customer.id;
  return null;
}

export function objectId(value: any): string | null {
  return typeof value?.id === "string" ? value.id : null;
}

export function firstInvoiceLinePriceId(invoice: any): string | null {
  const line = subscriptionEntitlementInvoiceLine(invoice);
  const price = line?.price ?? line?.pricing?.price_details;
  return typeof price?.id === "string" ? price.id : typeof price?.price === "string" ? price.price : null;
}

export function subscriptionEntitlementInvoiceLine(invoice: any): any | null {
  if (!isSubscriptionBillingReason(invoice)) return null;

  const lines = invoice?.lines?.data;
  if (!Array.isArray(lines)) return null;

  return lines.find((line) => {
    if (line?.proration === true || line?.parent?.subscription_item_details?.proration === true) return false;
    const parentType = line?.parent?.type;
    if (parentType && parentType !== "subscription_item_details") return false;
    return Boolean(line?.subscription || line?.parent?.subscription_item_details || line?.price || line?.pricing);
  }) ?? null;
}

export function periodStartFromInvoice(invoice: any): Date | null {
  const linePeriodStart = subscriptionEntitlementInvoiceLine(invoice)?.period?.start;
  if (typeof linePeriodStart === "number") return new Date(linePeriodStart * 1000);

  if (typeof invoice?.period_start === "number") return new Date(invoice.period_start * 1000);
  return null;
}

export function periodEndFromInvoice(invoice: any): Date | null {
  const linePeriodEnd = subscriptionEntitlementInvoiceLine(invoice)?.period?.end;
  if (typeof linePeriodEnd === "number") return new Date(linePeriodEnd * 1000);

  if (typeof invoice?.period_end === "number") return new Date(invoice.period_end * 1000);
  return null;
}

export function isPaidInvoice(invoice: any): boolean {
  return invoice?.status === "paid" && invoice?.paid !== false && (invoice?.paid === true || invoice?.amount_remaining === 0);
}

export function isSubscriptionBillingReason(invoice: any): boolean {
  return invoice?.billing_reason === "subscription_create" || invoice?.billing_reason === "subscription_cycle";
}

export function subscriptionIdFromInvoice(invoice: any): string | null {
  if (typeof invoice?.subscription === "string") return invoice.subscription;
  if (typeof invoice?.subscription?.id === "string") return invoice.subscription.id;
  const parentSubscription = invoice?.parent?.subscription_details?.subscription;
  if (typeof parentSubscription === "string") return parentSubscription;
  if (typeof parentSubscription?.id === "string") return parentSubscription.id;

  const lineSubscription = subscriptionEntitlementInvoiceLine(invoice)?.subscription;
  if (typeof lineSubscription === "string") return lineSubscription;
  if (typeof lineSubscription?.id === "string") return lineSubscription.id;

  return null;
}

export function subscriptionPeriod(subscription: any): { start: Date | null; end: Date | null } {
  const start = typeof (subscription?.current_period_start ?? subscription?.items?.data?.[0]?.current_period_start) === "number"
    ? new Date((subscription.current_period_start ?? subscription.items.data[0].current_period_start) * 1000)
    : null;
  const end = typeof (subscription?.current_period_end ?? subscription?.items?.data?.[0]?.current_period_end) === "number"
    ? new Date((subscription.current_period_end ?? subscription.items.data[0].current_period_end) * 1000)
    : null;

  return { start, end };
}
