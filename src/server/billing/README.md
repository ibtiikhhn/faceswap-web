# Billing backend contract

This slice expects the core backend to provide:

- `src/server/db/index.ts` with `getPool()`, returning a `pg.Pool` compatible object.
- `src/server/auth/session.ts` with `requireUser(request: Request)`, returning `{ id: string; email?: string | null }` for the authenticated app customer.
- PostgreSQL migrations that apply `src/server/billing/schema.sql` in the `app` schema.

Worker contract:

- Import `processStripeWebhookInbox` from `src/server/billing/webhook-worker`.
- Call `processStripeWebhookInbox()` to claim and process one pending Stripe event.
- Call `processStripeWebhookInbox(eventId)` after tests or manual replay when a specific inbox row should be processed.

Required dependencies once the app scaffold exists:

- `stripe`
- `pg`
- Next.js App Router with the `@/*` alias pointed at `src/*`

Required environment:

- `NEXT_PUBLIC_APP_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_WEEKLY` and `BILLING_WEEKLY_CREDITS`
- `STRIPE_PRICE_MONTHLY` and `BILLING_MONTHLY_CREDITS`
- `STRIPE_PRICE_YEARLY` and `BILLING_YEARLY_CREDITS`
- `STRIPE_PRICE_PACK_SMALL` and `BILLING_PACK_SMALL_CREDITS`
- `STRIPE_PRICE_PACK_MEDIUM` and `BILLING_PACK_MEDIUM_CREDITS`
- `STRIPE_PRICE_PACK_LARGE` and `BILLING_PACK_LARGE_CREDITS`

The public catalog never exposes Stripe Price IDs or invented display prices. Missing config returns `setup_required`.
