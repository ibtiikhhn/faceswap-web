alter table app.users add column if not exists deletion_requested_at timestamptz;
alter table app.assets add column if not exists object_deleted_at timestamptz;
create index if not exists assets_expiration_idx on app.assets(expires_at) where status='active';
create index if not exists assets_pending_delete_idx on app.assets(status) where object_deleted_at is null;
