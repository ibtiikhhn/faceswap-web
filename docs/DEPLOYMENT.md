# Railway deployment

## Services

Deploy two services from this repository using the same Dockerfile:

- **Web:** configuration `railway.json`; `npm run start`; expose HTTPS through the custom domain.
- **Worker:** configuration `railway.worker.json`; `npm run worker`; no public domain and no HTTP health-check path.

Add a PostgreSQL database in Neon or Railway and create private R2 storage. Use independent staging and production data, buckets, Stripe configuration, and secrets. The local PGlite server is strictly a development aid.

## Release sequence

1. Install/build from the committed lockfile.
2. Set all required environment variables, including `APP_URL` matching the domain.
3. Apply application migrations once (`npm run db:migrate`).
4. Apply CMS migrations once (`npm run cms:migrate`) before starting CMS traffic.
5. Provision the owner account through the seed script. Remove the bootstrap password from Railway variables after provisioning.
6. Start the web and worker services.
7. Verify readiness, a guest trial, authenticated asset isolation, subscriptions in Stripe test mode, cleanup, and restart recovery.
8. Connect the real provider and complete final live-service checks before exposing paid access.

Do not put migration commands in every web replica's start command. Use a Railway pre-deploy/release command or a separate controlled release run. CMS and app tables are independently managed in their own schemas.

Set the **web** pre-deploy command to exactly `npm run release`. It runs app migrations, CMS migrations, and (when both bootstrap variables are present) owner creation in order. Each step has a numbered log entry, and any failed step stops the release. For initial setup, set `PAYLOAD_ADMIN_EMAIL` and `PAYLOAD_ADMIN_PASSWORD`; remove both after the owner is created. Keep `DATABASE_URL` and `PAYLOAD_SECRET`. Leave the worker pre-deploy command empty. This single command avoids depending on shell interpretation of `&&` in deployment settings.

## Environment and secrets

- `APP_ENV=staging` permits labeled mock previews in a staging environment.
- `APP_ENV=production` rejects the mock provider. Production cannot process real swaps until the final adapter has been implemented.
- `NODE_ENV=production` controls optimized Node/Next behavior; it is intentionally distinct from the application environment so local production builds can be tested.
- Set production Google OAuth redirect URLs and separate secure random values for `BETTER_AUTH_SECRET` and `PAYLOAD_SECRET`.
- Set `STORAGE_DRIVER=r2`; container-local photo storage does not survive redeploys and is unsuitable for production.
- Use Stripe test secrets in staging and live secrets only after account eligibility and product configuration are settled.
- Give the worker the same database/private-storage/provider configuration as the web application, with the minimum operational access needed.

## Checks and operations

### CMS transaction timeouts

Set `CMS_DATABASE_POOL_MAX=4` or higher on web and worker. The installed Payload PostgreSQL adapter holds one connection for reconnect handling; its operations need additional connections for transactions and reads. The app enforces a minimum of four. Count the web, worker, queue, and CMS pools together against the database connection quota.

Scheduled publishing runs once per minute in a separate, short-lived Node process. An unhandled Payload client error now fails that batch rather than terminating swap processing. The parent stops a batch after two minutes and retries on a later tick; connections held by the failed child close when it exits. If a batch times out while actually publishing a post, inspect the CMS job status before manually retrying that individual job.

Repeated publishing errors still require investigation: verify the CMS migrations ran on the same database, use a direct database connection for the worker, and check the database connection quota. Do not disable database transaction timeouts or TLS verification to hide the problem.

- HTTP liveness: `/api/health/live`; readiness: `/api/health/ready`.
- Monitor failed jobs, stalled jobs, webhook failures, worker restarts, credit reversals, database/storage usage, and trial spending.
- Confirm standard PostgreSQL concurrency behavior under simultaneous submissions; PGlite's local multiplexer does not substitute for that load test.
- Verify database backups and perform a restoration drill before launch. Free-tier recovery windows may be limited; choose and document a backup retention policy.
- Confirm R2 object deletion and application retention jobs run after worker restarts.
- Set Railway budget alerts and review Neon compute use: a frequently polling worker can prevent database suspension.
- Avoid recording image bytes, signed URLs, secrets, or full OAuth/payment payloads in logs.

## What has not been deployed

This build prepares application code and deployment configuration. It does not create Railway services, configure your domain, provision third-party accounts, or run a real Stripe charge. Those steps need the corresponding account configuration and the face-swap provider details.
