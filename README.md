# SwapThisFace.com

Node.js/TypeScript photo face-swap SaaS: Next.js studio, Google sign-in, Whop subscriptions and credit packs, private Cloudflare R2 photos, a Railway worker, and Payload CMS.

## Production database

Cloudflare D1 is accessed through a private Worker gateway. Separate databases store application and CMS records. See [Cloudflare D1 deployment](docs/CLOUDFLARE-D1.md) for provisioning, the final Railway switch, owner setup, verification, and rollback limitations.

Set `DATABASE_DRIVER=d1`, `D1_GATEWAY_URL`, and `D1_GATEWAY_SECRET` on both Railway services. The Cloudflare management API token is for provisioning only; do not put it in client code or Railway variables. Never commit `.env.local`.

## Run locally

Requires Node.js 22.12+ and npm; Node 24+ is needed for the in-memory SQLite verification script.

1. Run `npm ci`.
2. Configure `.env.local` using `.env.example`. Keep separate random values for `BETTER_AUTH_SECRET` and `PAYLOAD_SECRET`.
3. Run `npm run db:migrate` and `npm run cms:migrate` with the chosen database driver.
4. Run `npm run worker` in a separate terminal.
5. Run `npm run dev`; match its port to `APP_URL`.

The optional PostgreSQL development workflow uses `DATABASE_DRIVER=postgres` and `npm run db:dev` (PGlite on port 5433, persistent data in `.data/postgres`). PostgreSQL remains available for existing installations. D1 uses its own migrations and cannot import the PostgreSQL migration SQL directly.

Public pages render without service credentials. Unconfigured actions return setup errors. Mock swaps are labeled and rejected in production; container-local image storage is for development only.

## Features

- Responsive photo studio with upload validation, previews, status, comparison, and downloads.
- One guest trial, Google accounts, saved history, and account deletion.
- Private assets with server-side ownership checks and retention cleanup.
- Atomic credit reservations and durable background jobs; D1 mode does not use pg-boss.
- Whop 7-day and 30-day subscriptions, standalone credit packs, cancellation, and durable webhooks.
- Payload blog editor with drafts, publishing, media, and a separate owner dashboard.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local web application |
| `npm run db:migrate` | Application migrations for the configured backend |
| `npm run cms:migrate` | CMS migrations for the configured backend |
| `npm run cms:seed-admin` | Provision the owner using bootstrap environment variables |
| `npm run release` | App migrations, CMS migrations, optional owner creation |
| `npm run worker` | Background processing and maintenance |
| `npm run d1:setup` | Create/reuse D1 databases and generate gateway configuration |
| `npm run d1:deploy` | Deploy the private database gateway |
| `npm run d1:verify` | Verify remote gateway security and atomic writes |
| `npm run d1:verify-local` | In-memory auth/CMS migration and publishing verification |
| `npm run typecheck` | TypeScript validation |
| `npm test` | Accounting, billing, authorization, and migration tests |
| `npm run build` | Production build with webpack |
| `npm run start` | Serve the production build |

## Service setup

- Google: redirect URI `APP_URL/api/auth/callback/google` and the configured client ID/secret.
- Whop: [setup and sandbox checks](docs/WHOP-SETUP.md). Paddle and Stripe are retired; legacy code remains for PostgreSQL compatibility.
- R2: separate private customer uploads and public blog media; keep bucket credentials server-side.
- Face-swap provider: HTTPS gateway and an explicit allowlist of result-image hosts. Enable real processing only with working provider configuration.
- Railway: web runs `npm run start`; worker runs `npm run worker`. Web pre-deploy runs `npm run release`.

Cloudflare, Railway, storage, and provider APIs have quotas or costs. Monitor usage and failed jobs, and verify backup recovery before accepting live payments. Local SQLite and remote concurrency smoke checks do not substitute for a production load test or live Google/Whop/provider verification after deployment.
