create schema if not exists app;
create extension if not exists pgcrypto;

create table if not exists app.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  image text,
  email_verified boolean not null default false,
  stripe_customer_id text unique,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app.users(id) on delete cascade,
  provider_id text not null,
  account_id text not null,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, account_id)
);

create table if not exists app.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app.users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.verifications (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  value text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.guest_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  trial_state text not null default 'available' check (trial_state in ('available', 'reserved', 'consumed')),
  claimed_user_id uuid references app.users(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app.users(id),
  guest_id uuid references app.guest_sessions(id),
  kind text not null check (kind in ('source', 'target', 'result')),
  object_key text not null unique,
  content_type text not null,
  width integer not null,
  height integer not null,
  byte_count integer not null,
  status text not null default 'active' check (status in ('active', 'deleted')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists app.swap_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app.users(id),
  guest_id uuid references app.guest_sessions(id),
  source_asset_id uuid not null references app.assets(id),
  target_asset_id uuid not null references app.assets(id),
  result_asset_id uuid references app.assets(id),
  state text not null default 'queued' check (state in ('queued', 'validating', 'processing', 'saving', 'succeeded', 'retry_wait', 'reconciling', 'failed', 'canceled')),
  mode text not null default 'guest_trial' check (mode in ('guest_trial', 'paid_credit')),
  request_key text not null unique,
  provider_request_id text,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists app.credit_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app.users(id),
  source text not null,
  source_ref text not null,
  original_amount integer not null check (original_amount > 0),
  remaining_amount integer not null check (remaining_amount >= 0),
  reserved_amount integer not null default 0 check (reserved_amount >= 0),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source, source_ref)
);

create table if not exists app.credit_reservations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references app.swap_jobs(id),
  grant_id uuid not null references app.credit_grants(id),
  amount integer not null check (amount > 0),
  state text not null default 'reserved' check (state in ('reserved', 'consumed', 'released')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app.users(id),
  grant_id uuid references app.credit_grants(id),
  job_id uuid references app.swap_jobs(id),
  kind text not null,
  amount integer not null,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists app.outbox_events (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  payload jsonb not null,
  state text not null default 'pending' check (state in ('pending', 'processing', 'done', 'failed')),
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.stripe_events (
  id text primary key,
  type text not null,
  payload jsonb not null,
  state text not null default 'pending' check (state in ('pending', 'processed', 'failed')),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists assets_owner_idx on app.assets(user_id, guest_id);
create index if not exists swap_jobs_owner_idx on app.swap_jobs(user_id, guest_id, created_at desc);
create index if not exists credit_grants_spend_idx on app.credit_grants(user_id, expires_at nulls last, created_at);
create index if not exists outbox_pending_idx on app.outbox_events(state, created_at);
