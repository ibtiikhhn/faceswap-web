create table if not exists app.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text not null unique,
  stripe_price_id text,
  plan_code text,
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table app.subscriptions
  add column if not exists customer_id uuid,
  add column if not exists user_id uuid references app.users(id) on delete cascade,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_price_id text,
  add column if not exists plan_code text,
  add column if not exists paid_current_period_start timestamptz,
  add column if not exists paid_current_period_end timestamptz,
  add column if not exists latest_paid_invoice_id text,
  add column if not exists raw jsonb not null default '{}'::jsonb;

alter table app.subscriptions
  alter column customer_id drop not null;

alter table app.subscriptions drop constraint if exists subscriptions_status_check;
alter table app.subscriptions
  add constraint subscriptions_status_check
  check (status in ('incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused', 'incomplete_expired'));

update app.subscriptions s
set user_id = c.auth_user_id,
    stripe_customer_id = c.stripe_customer_id
from app.customers c
where s.customer_id = c.id
  and s.user_id is null;

create index if not exists subscriptions_user_status_idx
  on app.subscriptions (user_id, status, current_period_end);

create index if not exists subscriptions_stripe_customer_idx
  on app.subscriptions (stripe_customer_id);

create table if not exists app.stripe_event_inbox (
  id text primary key,
  type text not null,
  api_version text,
  livemode boolean not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'processed', 'failed', 'ignored')),
  attempts integer not null default 0,
  received_at timestamptz not null default now(),
  processing_started_at timestamptz,
  processed_at timestamptz,
  last_error text
);

create index if not exists stripe_event_inbox_pending_idx
  on app.stripe_event_inbox (status, received_at);

create table if not exists app.billing_risk_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app.users(id) on delete set null,
  stripe_customer_id text,
  event_type text not null,
  stripe_object_id text,
  reason text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table app.billing_risk_events
  add column if not exists customer_id uuid,
  add column if not exists user_id uuid references app.users(id) on delete set null;

update app.billing_risk_events e
set user_id = c.auth_user_id
from app.customers c
where e.customer_id = c.id
  and e.user_id is null;

create index if not exists billing_risk_events_user_idx
  on app.billing_risk_events (user_id, created_at desc);
