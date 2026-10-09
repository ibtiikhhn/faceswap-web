alter table app.users add column paddle_customer_id text unique;
alter table app.users add column paddle_sandbox_customer_id text unique;
alter table app.subscriptions alter column stripe_subscription_id drop not null;
alter table app.subscriptions add column paddle_subscription_id text unique;
alter table app.subscriptions add column paddle_environment text check(paddle_environment in ('sandbox','production'));
alter table app.subscriptions add column paddle_customer_id text;
alter table app.subscriptions add column paddle_price_id text;
alter table app.subscriptions add column latest_paddle_event_at timestamptz;
alter table app.subscriptions add column latest_paid_transaction_id text;

create table app.paddle_checkouts (
 id uuid primary key default gen_random_uuid(),
 environment text not null default 'sandbox' check(environment in ('sandbox','production')),
 user_id uuid not null references app.users(id),
 kind text not null check(kind in ('subscription','pack')),
 code text not null,
 price_id text not null,
 credits integer not null check(credits > 0),
 transaction_id text unique,
 state text not null default 'creating' check(state in ('creating','ready','completed','canceled','review')),
 created_at timestamptz not null default now()
);
create unique index paddle_one_open_checkout on app.paddle_checkouts(user_id,environment)
 where state in ('creating','ready','review');
create table app.paddle_event_inbox (
 id text primary key,
 environment text not null default 'sandbox' check(environment in ('sandbox','production')),
 type text not null,
 occurred_at timestamptz not null,
 payload jsonb not null,
 state text not null default 'pending' check(state in ('pending','processed','failed','ignored')),
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 last_error text,
 received_at timestamptz not null default now(),
 processed_at timestamptz
);
create index paddle_inbox_pending on app.paddle_event_inbox(state,next_attempt_at);
create table app.paddle_transactions (
 id text primary key,
 environment text not null default 'sandbox' check(environment in ('sandbox','production')),
 user_id uuid not null references app.users(id),
 subscription_id text,
 grant_id uuid references app.credit_grants(id),
 period_start timestamptz,
 period_end timestamptz,
 created_at timestamptz not null default now()
);
-- Refund/dispute tombstones prevent a late payment webhook from regranting credits.
create table app.paddle_adjustments (
 id text primary key,
 transaction_id text not null,
 action text not null,
 status text not null,
 type text,
 occurred_at timestamptz not null,
 payload jsonb not null,
 needs_review boolean not null default false
);
create index paddle_adjustment_transaction on app.paddle_adjustments(transaction_id);

create unique index paddle_subscription_paid_period on app.paddle_transactions(subscription_id,period_start,period_end) where subscription_id is not null;
