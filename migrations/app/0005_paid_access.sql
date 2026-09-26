-- Upgrade environments that already applied the earlier billing schema.
alter table app.subscriptions
  add column if not exists paid_current_period_start timestamptz,
  add column if not exists paid_current_period_end timestamptz,
  add column if not exists latest_paid_invoice_id text;
