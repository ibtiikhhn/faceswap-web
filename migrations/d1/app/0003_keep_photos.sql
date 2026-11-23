-- Retain active photos until explicit deletion. Never restore deleted records.
update app_assets set expires_at = null where status = 'active';
