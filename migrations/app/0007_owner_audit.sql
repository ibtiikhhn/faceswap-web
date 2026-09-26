create table if not exists app.owner_audit (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  user_id uuid references app.users(id),
  action text not null,
  reason text not null,
  created_at timestamptz not null default now()
);
