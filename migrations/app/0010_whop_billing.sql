create table app.whop_checkouts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references app.users(id),
 environment text not null check(environment in ('sandbox','production')), code text not null,
 kind text not null check(kind in ('subscription','pack')), plan_id text not null,
 configuration_id text unique, purchase_url text, state text not null default 'creating',
 created_at timestamptz not null default now()
);
create unique index whop_open_checkout on app.whop_checkouts(user_id,environment) where state in ('creating','ready');
create table app.whop_memberships (
 id text primary key, user_id uuid not null references app.users(id), environment text not null,
 plan_id text not null, code text not null, status text not null,
 period_start timestamptz, period_end timestamptz, cancel_at_period_end boolean not null default false,
 updated_at timestamptz not null
);
create table app.whop_payments (
 id text primary key, user_id uuid not null references app.users(id), environment text not null,
 checkout_id uuid references app.whop_checkouts(id), membership_id text,
 period_start timestamptz, period_end timestamptz, grant_id uuid references app.credit_grants(id),
 revoked_credits integer not null default 0, disputed boolean not null default false,
 updated_at timestamptz not null
);
create unique index whop_paid_period on app.whop_payments(environment,membership_id,period_start,period_end) where membership_id is not null;
create table app.whop_event_inbox (
 id text primary key, environment text not null, type text not null, resource_id text not null,
 state text not null default 'pending', attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(), created_at timestamptz not null default now()
);
alter table app.whop_checkouts add column configuration_closed boolean not null default false;
