-- Retain active photos until explicit deletion. Never restore deleted records.
update app.assets set expires_at = null where status = 'active';
