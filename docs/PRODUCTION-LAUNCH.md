# Production release — 27 October 2026

Target: https://swapthisface.com, real photo swaps, D1/R2 and Whop production billing.

## Release status

Live Whop product and all four plans have been created and remotely verified for ownership, USD prices and billing periods. Payment and membership reads work. Live webhook creation is blocked until the API key has `developer:manage_webhook`. The production credential file is git-ignored. No real payment has been attempted. Railway variables and deployed behavior have not been verified from this checkout.

## 1. Finish live webhook preparation

After granting the live API permission:

```sh
node --env-file=.env.production.local --import tsx scripts/setup-whop-webhook.ts --production
node --env-file=.env.production.local --import tsx scripts/verify-whop.ts
```

The setup creates a disabled webhook, saving its secret and ID in `.env.production.local`. Production verification reads the live catalog and basic settlement permissions; it does not create a paid checkout or charge a card. The four offers are $7.99/7 days for 100 swaps, $19.99/30 days for 500 swaps, $10/200 credits and $50/1000 credits. Packs need no subscription. Do not reuse sandbox IDs or the sandbox signing secret.

## 2. Railway configuration on BOTH web and worker

Keep existing production D1, R2, Google, auth and CMS secrets. Copy the live WHOP_API_KEY, WHOP_ACCOUNT_ID, WHOP_PRODUCT_ID, four WHOP_*_PLAN_ID values and WHOP_WEBHOOK_SECRET from `.env.production.local` privately into Railway.

```dotenv
APP_ENV=production
APP_URL=https://swapthisface.com
DATABASE_DRIVER=d1
SWAPS_ENABLED=true
SWAP_PROVIDER=external
MOCK_SWAP_ENABLED=false
STORAGE_DRIVER=r2
CUSTOM_SWAP_URL=https://faceswap-django.onrender.com/faceswap_file/
CUSTOM_SWAP_RESULT_HOSTS=img.theapi.app
BILLING_PROVIDER=whop
WHOP_ENVIRONMENT=production
WHOP_BILLING_ENABLED=false
PADDLE_BILLING_ENABLED=false
WORKER_POLL_MS=3000
WORKER_IDLE_POLL_MS=30000
```

Align NEXT_PUBLIC_APP_URL if present. Remove the old FACE_SWAP_PROVIDER=mock alias. Do not replace existing D1/R2/Google secrets with local development settings. Keep one Railway worker replica.

## 3. Deploy and activate

1. Deploy the same commit to web and worker. The web pre-deploy command must be `npm run release`; this runs app and CMS migrations. Do not start the new worker before migrations succeed. The additive D1 dispute migration is `0002_whop_disputes.sql`.
2. Web start: `npm run start`; worker start: `npm run worker`. Check `/api/health/ready` and both service logs. Do not use frequent external readiness polling; each readiness check queries D1.
3. Confirm the live webhook secret and production environment are deployed, then enable the live Whop webhook for `https://swapthisface.com/api/webhooks/whop`. Disable the old sandbox endpoint for this production URL.
4. Set WHOP_BILLING_ENABLED=true on both services and redeploy. Run `node --import tsx scripts/check-production.ts` inside the deployed environment. That check requires the full runtime configuration; the local production file contains Whop provisioning settings only and is not a complete Railway environment export.
5. Check the production checkout shows the correct offer, currency and renewal terms. The owner must make any real payment personally. Verify one credit grant, automatic balance refresh, downloaded output, webhook processing reaching done, and cancellation retaining the paid allowance. A configuration check alone does not prove live fulfillment.
6. Confirm Google sign-in, CMS login, real guest swap, private image storage, HTTPS/alternate-host redirect, policy links, robots, sitemap and favicon. Request homepage indexing after deployment.

## Request budget

The worker now checks idle queues every 30 seconds and returns to the fast interval after work. Errors use the slower interval. Swap recovery runs every five minutes instead of every three seconds. Idle Whop checks cost about 5760 gateway requests/day and idle swap dispatch about 2880/day, plus recovery, cleanup, CMS, reconciliation, health checks and real traffic. These are code-based estimates for one worker, not measured account usage. First queued work can wait up to roughly 30 seconds. Monitor Cloudflare per-worker request counts and D1 row usage after deployment.

## Operational boundaries

Confirm Whop product eligibility and your account tax settings before accepting public payments; identity verification alone does not establish product approval. Existing policy/operator contact details and processor retention terms must remain accurate. Do not describe legal compliance or provider approval as established by automated tests.

Keep sandbox history intact. Environment separation excludes sandbox billing credits automatically; never wipe customer data to switch modes. If problems arise, disable new purchases with WHOP_BILLING_ENABLED=false while keeping the production worker and webhook active to settle already-paid transactions. Do not switch credentials back to sandbox while production transactions are outstanding.

Sources: [Whop production transition](https://whop.com/blog/whop-sandbox/), [Cloudflare Worker limits](https://developers.cloudflare.com/workers/platform/limits/).
