# Whop billing deployment

## Implemented

Set `BILLING_PROVIDER=whop` to select Whop without deleting historical Paddle records. Prices are $7.99 / 7 days (100 swaps), $19.99 / 30 days (500 swaps), $10 / 200 credits and $50 / 1,000 credits. Packs work without a subscription. Recurring credits expire at the paid period end. No immediate prorated upgrade: cancel renewal and select the next plan after the paid period ends.

Hosted checkout is created server-side for an authenticated user. A durable intent binds the checkout configuration to that user. Only verified webhook notifications followed by authenticated API reads can grant credits; redirect query parameters never do. Payments and subscription periods deduplicate grants. Refunds reduce credits; disputes restrict the affected grant. Provider reads use SDK 2.6.0 and API version 2026-10-15-1.

## Account permissions

The company API key needs product/plan read and creation for catalog setup, checkout configuration creation, payment reads, membership reads and cancellation, member management for billing portal URLs, refund and dispute reads, and `developer:manage_webhook` to register the webhook. Use the matching sandbox account and key. Never put the key in a public Next.js variable.

## Railway deployment

1. Commit and push the code, including `migrations/app/0010_whop_billing.sql` and package lock. The existing pre-deploy/release process must run `npm run db:migrate` before the web and worker start.
2. Set these on **both web and worker**, copying values privately from `.env.local`:

   ```env
   BILLING_PROVIDER=whop
   WHOP_ENVIRONMENT=sandbox
   WHOP_BILLING_ENABLED=true
   WHOP_ACCOUNT_ID=...
   WHOP_API_KEY=...
   WHOP_PRODUCT_ID=...
   WHOP_WEEKLY_PLAN_ID=...
   WHOP_MONTHLY_PLAN_ID=...
   WHOP_PACK_200_PLAN_ID=...
   WHOP_PACK_1000_PLAN_ID=...
   WHOP_WEBHOOK_SECRET=...
   PADDLE_BILLING_ENABLED=false
   APP_URL=https://swapthisface.com
   ```

3. Run `npm run whop:webhook` locally once the API key has webhook management permission. It creates a **disabled sandbox webhook**, pins its API version, and saves the signing secret directly in `.env.local`. Copy that secret to Railway and redeploy both services. Do not commit it.
4. In the sandbox Developer dashboard, enable the endpoint `https://swapthisface.com/api/webhooks/whop` after deployment. The script subscribes to payment success/failure/action/cancellation, membership changes, refunds and disputes.
5. Confirm the worker is running. It processes the durable webhook inbox every tick. HTTP 200 means queued; credits are added after settlement, not merely receipt.
6. Make a sandbox purchase using a signed-in website account. Verify the redirect refreshes credits automatically, pricing shows the active plan, cancellation retains the paid allowance until expiry, and standalone packs work.
7. Test renewal, refund, replayed events, declined payment and account isolation. A provider dashboard sample event is not a real purchase and cannot grant credits to an unbound user.

## Operational review

Events retry 30 times. Review `app.whop_event_inbox` rows with `state='failed'` and `attempts>=30`; inspect their resource IDs in Whop. After resolving the cause, reset attempts and next_attempt_at to retry. Never insert credits just because a browser returned from checkout.

A payment arriving after its membership has advanced beyond the payment's period is held for review rather than incorrectly granting a fresh allowance. Discounts, altered prices, quantities, currencies and unsupported subscription changes also require review. Keep offers unchanged until their settlement rules have been deliberately implemented and tested.

Pending checkout recovery reuses the original provider idempotency key and link. A different offer is blocked while one is pending. To close an abandoned checkout, support must invalidate its provider configuration and reconcile any pending/paid payments before marking the local intent canceled. Do not merely clear the database flag while a payment can still complete.

## Live transition

Use production account/key/product/plan/webhook IDs, change `WHOP_ENVIRONMENT=production`, and ensure `APP_ENV=production`. Sandbox credits are excluded automatically. Obtain product eligibility confirmation from Whop and configure direct-sale tax handling before taking live payments. Account identity verification alone does not establish product eligibility; Whop tax handling for direct checkout depends on your selected account settings.

## References

- https://docs.whop.com/developer/guides/webhooks
- https://docs.whop.com/payments-and-billing/fees/taxes
- https://whop.com/buyer-terms/
