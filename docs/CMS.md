# CMS and Owner Admin

Payload CMS is mounted at `/admin` in its own Next route group. Customer Google accounts do not grant CMS access.

The owner SaaS console is available at `/admin/saas` after owner login. It reads customer account, credit, and swap summaries through `src/cms/owner-services.ts`. Manual credit grants require a reason and write both a credit grant and a credit ledger entry containing the owner identity.

The overview also lists the latest 50 jobs and subscriptions. Access suspension/restoration requires a reason and creates an audit record; suspension revokes customer sessions but does not cancel Stripe billing.

## Setup

1. Set `DATABASE_URL` and `PAYLOAD_SECRET`.
2. Run app migrations for the `app` schema.
3. Run Payload migrations for the `cms` schema.
4. Set `PAYLOAD_ADMIN_EMAIL` and `PAYLOAD_ADMIN_PASSWORD`.
5. Run `npm run cms:seed-admin`.

The `owners` collection is invite-only. Public self-registration is disabled in collection access, the Payload first-user REST endpoint is blocked at `/api/owners/first-register`, and the renamed admin bootstrap route returns 404. Use the seed CLI to create the first owner.

## Content model

- `posts`: drafts, scheduled publishing, revisions, rich text, summary, cover image, category, author, and SEO fields.
- `categories`: public taxonomy.
- `media`: public blog images stored locally in development or in the public R2 bucket when configured.
- `redirects`: owner-managed internal blog redirects. Use `/blog/old-slug` and `/blog/new-slug`.
- `site-settings`: global SEO and brand defaults.

Scheduled publishing is processed by `npm run worker` once per minute.

## Public helpers

`src/server/cms.ts` exports:

- `getPublishedPosts(): Promise<{ setupRequired: boolean; posts: PublishedPost[] }>`
- `getPublishedPost(slug): Promise<{ setupRequired: boolean; post: PublishedPost | null }>`

When CMS env vars are missing, helpers return `setupRequired: true` and empty content. They do not fake articles.

Public reads use `overrideAccess: false`, `draft: false`, and an explicit `_status = published` plus `publishedAt <= now()` filter. Version history is owner-only so draft revisions are not exposed through the public Payload API.

## Migration contract

- App/customer billing tables live in the `app` schema and are created by `migrations/app/0001_initial.sql`.
- Payload content and owner auth tables live in the `cms` schema and are created by Payload migrations in `migrations/cms`.
- The CMS owner SaaS service currently targets the active `app.users`, `app.credit_grants`, `app.credit_ledger`, and `app.swap_jobs` table contract. If the billing/core layer moves fully to `customers`/`customer_id`, update `src/cms/owner-services.ts` in the same change so the admin surface remains a service client, not a direct table editor.
