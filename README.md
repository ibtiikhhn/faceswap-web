# Facecraft

A Node.js/TypeScript photo face-swap SaaS with a Next.js studio, PostgreSQL jobs and credits, Google sign-in, Stripe billing, private photo storage, and Payload CMS. **Facecraft is a temporary brand.**

The real face-swap API is intentionally deferred. Development jobs produce explicitly labeled mock previews; they do not perform a face swap. Google, Stripe, R2, and deployment need your own service configuration.

## Run locally

Requires Node.js 22.12+ and npm. Install dependencies with `npm ci`.

1. Copy `.env.example` to `.env.local` and generate separate authentication/CMS secrets as described in the file.
2. Start PostgreSQL. For a quick local-only database, run `npm run db:dev` in its own terminal. Its data persists in `.data/postgres` and it listens on port 5433.
3. Run `npm run db:migrate`.
4. Run `npm run worker` in another terminal.
5. Run `npm run dev` and open the URL shown in the terminal.

A development `.env.local` may already exist in this workspace from integration testing. Its `APP_URL` uses port 3099, so run `npm run dev -- --port 3099` when using that file. Never commit `.env.local` or `.data`.

The local database uses PGlite's PostgreSQL wire adapter for convenience. Use standard PostgreSQL (Neon or Railway) in production; the local single-engine multiplexer is not proof of production concurrency behavior.

Public pages also render without credentials. Actions that need a missing service return a setup message rather than fake success. Local image storage is for development; use private R2 storage on Railway.

## Features

- Responsive landing page and studio with image previews, drag-and-drop uploads, progress, and result comparison.
- One successful guest trial, Google customer accounts, saved history and deletion.
- Server-side ownership checks, bounded image validation, and normalized image storage.
- PostgreSQL-backed jobs, credit reservations, and background processing.
- Stripe weekly/monthly/yearly plans, extra packs, portal, and webhook handling.
- Payload rich-text blog editor and separate owner administration.

Refer to [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the product rules. Proposed credit/retention rules remain configurable decisions; actual prices and allowances have not been chosen.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local web application |
| `npm run db:dev` | Local development database |
| `npm run db:migrate` | Application database migrations |
| `npm run worker` | Durable jobs and background maintenance |
| `npm run typecheck` | TypeScript validation |
| `npm test` | Accounting, billing, and authorization tests |
| `npm run build` | Production compilation |
| `npm run start` | Serve the production build |
| `npm run cms:migrate` | Apply Payload database migrations |
| `npm run cms:seed-admin` | Explicitly provision the owner account |

The project uses webpack for reproducible local builds; Turbopack stalled in this workstation's initial build. The dependency lockfile is committed with the source when you put the project into Git.

## Service configuration

### Google

Set `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET`. Configure the redirect URI as `APP_URL/api/auth/callback/google`, using the exact local port or production domain. Login and registration use the same Google flow. No fake developer login is exposed.

### Stripe

Use test mode during development. Set the secret and webhook signing secret, then configure server-owned recurring price IDs and their matching credit allowances. Weekly/monthly/yearly prices must use the corresponding Stripe interval. Credit packs use one-time prices. Do not reuse a price ID with changed credit terms after customers have purchased it.

The pricing page deliberately does not invent prices. See `.env.example` and [billing integration notes](src/server/billing/README.md). Live checkout remains pending business-country eligibility, final prices, Stripe setup, and end-to-end test payments.

### Storage

Set `STORAGE_DRIVER=r2` plus the endpoint, credentials, and private bucket. Blog media has a separate public bucket/URL. Customer images must never use the public CMS bucket. Development images live under `.data/uploads` by default and are not web-served directly.

### CMS

See [docs/CMS.md](docs/CMS.md) for migrations, owner bootstrap, content publishing, and admin configuration. Customer Google accounts do not grant CMS access.

## Verification

See [docs/VERIFICATION.md](docs/VERIFICATION.md) for completed checks and remaining implementation limits. With the web app, worker, and local database running, use `npm run test:smoke` to verify the full mock flow.

## Deployment and remaining work

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). The repository contains separate Railway configurations for web and worker services. No Railway resources or paid service accounts have been created by this build.

Before public launch, connect and validate the real face-swap API, configure Google/Stripe/R2, confirm pricing and retention rules, finish the business/privacy/terms details, and exercise the system against a standard PostgreSQL database and real provider responses. Mock output is rejected when `APP_ENV=production`.
