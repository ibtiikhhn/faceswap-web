# Local verification — 26 September 2026

## Verified

- Production compilation and TypeScript checks pass.
- 37 automated tests pass for swap accounting, paid-access gates, webhook handling, upload validation, ownership, guest claiming, CMS access, and owner credit grants.
- `npm run test:smoke` exercises actual local HTTP routes and the background worker: normalized uploads, private downloads, queued mock processing, saved output, duplicate requests, history, one successful guest trial, spoofed-image rejection, and origin enforcement.
- `node --env-file-if-exists=.env.local --import tsx scripts/smoke-cms.ts` creates disposable CMS fixtures, tests login, draft/revision privacy, publication and owner dashboard rendering, then removes those fixtures.
- Application migrations through 0006 and CMS migrations apply to the local database. Migration 0007 (owner audit) is pending: its execution approval was rejected. Run `npm run db:migrate` when ready; access controls remain disabled until it is applied.

## Validation still required before launch

- Google OAuth with the project's credentials and authorized redirect URI.
- Stripe test-mode checkout, renewals, refunds, disputes, customer portal and webhook delivery with actual configured prices.
- Private R2 storage and public CMS media on the selected account.
- Production PostgreSQL concurrency, backup/restore, worker crash and unknown-provider-outcome recovery.
- Real face-swap provider integration and result quality. Local results are explicitly labeled mock previews.
- Railway deployment, custom domain, production secrets, final pricing and business details.

## Known implementation limits

- The admin currently provides the CMS editor, customer/swap summaries and audited manual credit grants. It also lists recent jobs/subscriptions and supports audited suspension/restoration. Billing changes and refunds are managed in Stripe.
- Scheduled publishing runs in the worker once per minute. Safe internal blog redirects are supported; draft preview links remain pending.
- Photo expiration is currently measured from upload/result creation. Expired and user-deleted photos are cleaned by the worker; bucket-level orphan reconciliation remains pending.
- Webhooks use a durable retrying inbox. Periodic reconciliation against Stripe remains pending.
- Request rate limits are per process; add a shared limiter before scaling web replicas. Anonymous trial cookies cannot establish a unique human across cleared browsers; the daily global trial cap limits exposure.
- No production concurrency claims follow from PGlite's local development multiplexer.
