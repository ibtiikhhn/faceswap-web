alter table app.guest_sessions drop constraint if exists guest_sessions_trial_state_check;
alter table app.guest_sessions
  add constraint guest_sessions_trial_state_check
  check (trial_state in ('available', 'reserved', 'consumed', 'released'));

create table if not exists app.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references app.users(id),
  email text not null,
  name text,
  stripe_customer_id text unique,
  is_suspended boolean not null default false,
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references app.customers(id),
  stripe_subscription_id text not null unique,
  status text not null check (status in ('incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.stripe_event_inbox (
  id text primary key,
  type text not null,
  api_version text,
  livemode boolean not null default false,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'processed', 'failed', 'ignored')),
  attempts integer not null default 0,
  received_at timestamptz not null default now(),
  processing_started_at timestamptz,
  processed_at timestamptz,
  last_error text
);

create table if not exists app.billing_risk_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references app.customers(id),
  stripe_customer_id text,
  event_type text not null,
  stripe_object_id text,
  reason text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists subscriptions_customer_status_idx on app.subscriptions(customer_id, status, current_period_end);
create index if not exists stripe_event_inbox_pending_idx on app.stripe_event_inbox(status, received_at);
create index if not exists billing_risk_events_customer_idx on app.billing_risk_events(customer_id, created_at);
