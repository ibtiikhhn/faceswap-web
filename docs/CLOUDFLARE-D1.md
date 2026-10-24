# Cloudflare D1 migration

## Architecture

- Railway hosts the Next.js web service and image-processing worker.
- The private `swapthisface-d1` Cloudflare Worker exposes authenticated `/app` and `/cms` SQL endpoints.
- `swapthisface-app` stores accounts, sessions, jobs, credits, and Whop billing state.
- `swapthisface-cms` uses Payload's official D1 SQLite adapter for the blog and owner login.
- Photos stay in the existing R2 buckets. The image worker polls durable D1 outbox records; D1 mode does not start pg-boss.
- PostgreSQL remains an optional backend. This is a fresh D1 installation, not an import of Neon records, following the owner's confirmation that no production data needs migration.

## Completed in this workspace

Both databases and the private gateway have been created. App and CMS migrations have been applied. IDs, gateway URL, and the generated gateway secret are in ignored `.env.local`. Remote verification checked unauthorized rejection, batch rollback, concurrent updates, positional query results, and CMS schema availability. Temporary verification records were removed.

Railway has **not** been switched. No Neon data was deleted. No real payments or provider requests are made by the verification scripts.

## Final Railway switch

1. Deploy the migration code from this checkout. Do not switch an older build to D1.
2. On **both web and worker**, set these variables, copying the two gateway values privately from `.env.local`:

   ```dotenv
   DATABASE_DRIVER=d1
   D1_GATEWAY_URL=<D1_GATEWAY_URL from .env.local>
   D1_GATEWAY_SECRET=<D1_GATEWAY_SECRET from .env.local>
   BILLING_PROVIDER=whop
   PADDLE_BILLING_ENABLED=false
   ```

   Only the first three variables configure the database. Keep the existing Whop sandbox/live selection. The management token and account/database IDs are for provisioning and are not needed on Railway.
3. Keep the current Google, R2, face-swap, Whop, `BETTER_AUTH_SECRET`, and `PAYLOAD_SECRET` variables. `DATABASE_URL` is ignored in D1 mode; retain its value privately for rollback. PostgreSQL pool variables are also unused in D1 mode.
4. Web pre-deploy command: `npm run release`. Worker pre-deploy command: empty. Web start: `npm run start`. Worker start: `npm run worker`.
5. This fresh CMS has no owner account. Set `PAYLOAD_ADMIN_EMAIL` and `PAYLOAD_ADMIN_PASSWORD` on **web** for the first release. After the release reports owner creation, remove both bootstrap variables. Existing Neon owner credentials do not transfer automatically.
6. Redeploy web, then worker. Confirm `/api/health/ready` returns `{"ok":true}`. Test Google sign-in, one permitted photo swap, result download, account credits, CMS login, and publishing. Re-test Whop sandbox checkout/webhook fulfillment against the deployed D1 services before enabling live billing.

A pre-cutover rollback can use `DATABASE_DRIVER=postgres` and the original `DATABASE_URL`, but Neon quota must first be restored. Once D1 accepts real users or payments, switching to Neon without transferring those records would lose access to new state; do not do that casually.

## Provisioning and verification commands

Use Node 24+ for the local in-memory SQLite verification script. The deployed services support the existing Node 22 runtime.

```sh
npm run d1:setup
npm run d1:deploy
DATABASE_DRIVER=d1 npm run db:migrate
DATABASE_DRIVER=d1 npm run cms:migrate
npm run d1:verify
npm run d1:verify-local
```

`d1:setup` requires a Cloudflare token scoped to the account with D1 Edit and Workers Scripts Edit permissions. It creates/reuses the two named databases and generates a gateway secret without printing it. `d1:deploy` requires an existing workers.dev subdomain. Never expose the gateway secret through NEXT_PUBLIC variables or client-side code. Keep it identical on the gateway and both Railway services.

## Atomic writes and maintenance

D1 has no interactive PostgreSQL transactions. Business transactions plan their reads and writes, then submit a native D1 batch guarded by an application revision. Triggers update that revision on every application-table mutation. A conflicting revision rolls the whole batch back and causes a bounded retry. Transaction callbacks must not perform external effects or read their own pending writes. New operations with RETURNING need explicit guarded pre-reads or preallocated IDs; unported writes fail closed.

The narrow SQL compatibility layer covers this application's existing queries; it is not a general PostgreSQL implementation. Add D1 coverage when changing SQL. Use UTC ISO timestamps. The app and CMS have independent migration directories. Generate CMS migrations with `DATABASE_DRIVER=d1` so Payload selects the correct adapter.

Fresh app-schema DDL uses restartable IF NOT EXISTS operations in small batches to respect Workers query limits. Only a fully applied migration is marked complete. Future data migrations require their own atomic, idempotent design. Do not edit an already-applied migration to change an existing deployment.

D1 and Workers still have free-tier quotas. Monitor rows read/written, storage, Worker requests, and errors; repeated idle polling and contention can consume quota. Global revision contention may require redesign at higher write volume. Configure backups/exports and test recovery before taking real payments. The remote concurrency smoke check is not a load test.
