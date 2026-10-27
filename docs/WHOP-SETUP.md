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

## Payment reliability changes (October 25, 2026)

Run `npm run db:migrate` as the pre-deploy step before starting either updated service.
D1 migration `0002_whop_disputes.sql` (PostgreSQL `0011_whop_disputes.sql`) adds durable dispute state.
The migration is additive and restartable. Keep web and worker on the same commit and database.

- Billing runs independently from photo processing, asset cleanup, and CMS jobs. Each lane retries startup failures and drains in-flight work on graceful shutdown.
- Webhook processing claims one event at a time. Attempt-checked acknowledgments prevent an expired worker attempt from overwriting a newer attempt. Retries back off from 30 seconds to one hour, stopping after 30 attempts for operator review.
- Every five minutes, a bounded reconciliation pass checks the latest 25 paid payments for the configured product/account. It queues only payments bound to an existing checkout, payment, or membership. Settlement retrieves the payment again and validates ownership, price, plan, and environment before granting credits. This is a safety net, **not a replacement for enabled webhooks**; older missing payments and changes to older payments require targeted reconciliation/support review.
- Refunds revoke credits proportionally to the refunded service amount, excluding refunded tax. Cumulative revocation never decreases and repeated events cannot subtract twice.
- Disputes are tracked independently per dispute ID and provider update timestamp. A payment update cannot clear an unresolved dispute; resolving one dispute cannot clear another. Won/closed-inquiry states release that dispute's hold, subject to current payment status and refunds.
- A reserved credit is checked again when a swap result is committed. Refunded/disputed credits cannot deliver a result or reappear after failure. A credit reserved before natural expiry can still complete its job.
- Confirmation screens distinguish completed, partially refunded, refunded, and disputed payments. A return URL never grants credits.

Automated coverage includes D1 and PostgreSQL: duplicate fulfillment, ownership/environment isolation, wrong prices/quantities, refund-before-payment ordering, tax refunds, partial/full refunds, dispute ordering, renewal periods, failed renewals, cancellation preserving the paid allowance, missed-notification reconciliation, retry ownership, in-flight refund handling, and independent worker lanes.

Before live billing, verify on the deployed **sandbox**:

1. Web and worker migrations succeed; the Whop webhook is enabled for the deployed URL and its signing secret matches the web service.
2. Buy each recurring offer and a credit pack. Confirm the return page updates automatically, the account receives the correct allowance once, and the inbox event reaches `done`.
3. Replay a successful notification. The balance must not increase again.
4. Cancel renewal and confirm access remains until paid-period expiry. Verify a subsequent paid renewal produces one new allowance and a failed charge produces none using provider-supported sandbox testing.
5. Issue sandbox partial/full refunds and confirm credit adjustments. Check dispute behavior with provider-supported sandbox events where available.
6. Check the worker logs and inbox for exhausted retries or payments requiring period/ownership review. Investigate these before collecting live payments.

Immediate prorated plan upgrades remain unsupported. Historic subscription payments whose paid date falls outside the retrieved membership period are held for review rather than granted into the wrong period. The recent-payment fallback does not reconcile membership-only or dispute-only changes; reliable webhook delivery remains required. Switching providers/environments does not migrate old credit balances.

## Production provisioning and idle polling

See [the current production runbook](PRODUCTION-LAUNCH.md). Production provisioning uses `.env.production.local` explicitly; `npm run whop:setup` still loads the sandbox development file by default. Run `node --env-file=.env.production.local --import tsx scripts/setup-whop.ts --save` for live catalog creation/reuse. Run the webhook script with `--production`. It saves secrets privately and leaves the webhook and live billing disabled until the matching Railway configuration is deployed.

Workers use WORKER_IDLE_POLL_MS=30000 when the billing/swap queue is empty or a lane errors; WORKER_POLL_MS=3000 applies after productive work. Swap recovery runs every five minutes. This reduces idle D1 gateway requests substantially; the first queued job can wait about 30 seconds. Keep only one worker replica and monitor actual Cloudflare usage.
