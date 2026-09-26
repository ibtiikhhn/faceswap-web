alter table app.subscriptions add column if not exists latest_stripe_event_created_at timestamptz;
create table if not exists app.billing_revocations (
  reference text primary key,
  created_at timestamptz not null default now()
);
