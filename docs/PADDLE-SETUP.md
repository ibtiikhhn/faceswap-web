# Paddle integration — SwapThisFace

## Sandbox catalog created October 9, 2026 (Asia/Karachi)

| Offer | USD price | Credits | Product | Price ID |
|---|---:|---:|---|---|
| Weekly | 7.99/week | 100/week | pro_01m4enb3b5gadnkp7tnsc7f1z0 | pri_01m4enb3ks61ztns5nfvt7tqbf |
| Monthly | 19.99/month | 500/month | pro_01m4enb3xqrr44jka8jxpqvww6 | pri_01m4enb46bngq7tr007xvt3c2t |
| 200-credit pack | 10 once | 200 | pro_01m4enb56ckfwn4nzzcfqgvszc | pri_01m4enb5f0atxczmsq3n4v7pec |
| 1,000-credit pack | 50 once | 1,000 | pro_01m4enb5ryc37qrb9qa4n23bs8 | pri_01m4enb61vp8rde5rgtkqqzc9g |

Tax category: SaaS. Tax mode: location (inherited account setting); checkout displays applicable tax. Quantity fixed to one per purchase. No paid trial; the app's guest swap is separate. Pack credits do not expire and do not require a subscription. Subscription credits expire at the paid period end.

Client token created: `ctkn_01m4enc4m75rzb7pa1qh5j16fe`. Public token and price IDs are saved in ignored `.env.local`. The sandbox API key is supplied by the local shell's `PADDLE_SANDBOX_API_KEY`; it is not committed or copied into application source.

## Test deployment

The user chose sandbox testing on the existing swapthisface.com deployment. Keep APP_ENV=production and use PADDLE_ENVIRONMENT=sandbox during this test. Sandbox customers, grants, checkouts, and event processing are isolated from live billing by environment. Migrations have been tested against disposable databases; production migrations have not been run by this implementation task.

1. Deploy web and worker with the new code. Run `npm run db:migrate` before either starts (or use the existing release script).
2. Set these on the web and worker:
   - `APP_ENV=production`
   - `APP_URL=https://swapthisface.com` (or the chosen test hostname)
   - `PADDLE_ENVIRONMENT=sandbox`
   - `PADDLE_API_KEY`: sandbox secret from Paddle authentication settings
   - `PADDLE_CLIENT_TOKEN`: sandbox client token from Paddle
   - `PADDLE_WEBHOOK_SECRET`: notification destination's secret (not the API key)
   - `PADDLE_WEEKLY_PRICE_ID=pri_01m4enb3ks61ztns5nfvt7tqbf`
   - `PADDLE_MONTHLY_PRICE_ID=pri_01m4enb46bngq7tr007xvt3c2t`
   - `PADDLE_PACK_200_PRICE_ID=pri_01m4enb5f0atxczmsq3n4v7pec`
   - `PADDLE_PACK_1000_PRICE_ID=pri_01m4enb61vp8rde5rgtkqqzc9g`
   - Keep `PADDLE_BILLING_ENABLED=false` until the destination and checkout domain are ready.
3. In Paddle sandbox, set the default payment link to `https://swapthisface.com/checkout`. Use the actual test origin for local tunnels. Make sure the checkout domain is approved.
4. Sandbox notification destination `ntfset_01m4gez0xgd7jxhfzmxwvcaysw` was created at `https://swapthisface.com/api/webhooks/paddle`, with these events:
   `transaction.completed`, `subscription.created`, `subscription.updated`, `subscription.activated`, `subscription.resumed`, `subscription.paused`, `subscription.past_due`, `subscription.canceled`, `adjustment.created`, `adjustment.updated`.
   Use platform events for real sandbox checkouts, or all traffic when testing simulations. Its secret is saved in ignored .env.local as PADDLE_WEBHOOK_SECRET; copy it securely into Railway web and worker variables. It has not been applied to Railway yet.
5. Set `PADDLE_BILLING_ENABLED=true` on the web service; restart web and worker after variable changes.
6. Sign in, purchase each offer with a Paddle sandbox test card, and verify checkout, portal cancellation, renewals, failed payments, credits, and a full refund. A redirect alone never grants credits. The worker must be running.

## Settlement and operations

- Checkout authenticates the app user, validates the approved server catalog against Paddle, and records a checkout intent. Only the authenticated owner may open the transaction. API failures with an uncertain remote outcome move the intent to `review`; do not delete these rows and blindly retry.
- Abandoned ready/draft checkouts can be canceled from the pricing error notice before choosing another offer. A payment in progress cannot be canceled by that route.
- Webhooks verify the raw body with Paddle's SDK and persist a unique event ID before acknowledging. The worker applies events in a database transaction. Repeated transaction IDs and repeated subscription billing periods cannot grant twice.
- Subscription events order by provider occurrence time. A paid transaction never overwrites canceled/paused subscription status. Renewals require a known subscription. Browser metadata never supplies the credit count or user ownership.
- Full approved refunds and chargebacks expire the associated remaining credits. Partial refunds and reversal adjustments are flagged `needs_review`; support must reconcile those balances manually. Plan upgrades/prorations are not implemented and must not be enabled as self-service catalog changes.
- Inspect `app.paddle_event_inbox` for failed events. Attempts use exponential backoff, capped at 20. Correct the underlying issue and reset `attempts=0,next_attempt_at=now()` for the specific reviewed event. Raw payment payloads can contain personal information; do not post them publicly.
- Inspect `app.paddle_checkouts` in `review` for uncertain API outcomes. Reconcile with Paddle transactions using the stored `checkout_id` before changing local state. Confirm unpaid orphan transactions are canceled remotely before releasing an intent.
- For long downtime, replay missing events from Paddle's notification logs and reconcile transactions. Do not infer successful delivery from a success-page visit.

## Production remains disabled

Before live billing: complete the sandbox end-to-end test, finalize refund terms and outstanding business details, obtain Paddle website approval, create a separate live catalog/client token/API key/notification destination, and set the matching live IDs on both services. Use `PADDLE_ENVIRONMENT=production` with `APP_ENV=production` only. Switching PADDLE_ENVIRONMENT to production hides sandbox credit grants and uses a separate live customer mapping; sandbox records are retained for audit. Test swaps on the real face-swap provider can still incur provider usage. Never reuse sandbox IDs or secrets for live billing.
