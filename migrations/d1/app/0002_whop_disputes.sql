CREATE TABLE IF NOT EXISTS app_whop_disputes (
 id TEXT PRIMARY KEY, environment TEXT NOT NULL, payment_id TEXT NOT NULL,
 status TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS whop_dispute_payment ON app_whop_disputes(environment,payment_id);
CREATE TRIGGER IF NOT EXISTS app_whop_disputes_insert_revision AFTER INSERT ON app_whop_disputes BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_whop_disputes_update_revision AFTER UPDATE ON app_whop_disputes BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_whop_disputes_delete_revision AFTER DELETE ON app_whop_disputes BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
