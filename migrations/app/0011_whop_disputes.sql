create table if not exists app.whop_disputes (
 id text primary key, environment text not null, payment_id text not null,
 status text not null, updated_at timestamptz not null
);
create index if not exists whop_dispute_payment on app.whop_disputes(environment,payment_id);
