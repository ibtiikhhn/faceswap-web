-- Fresh D1 schema. PostgreSQL migrations remain available for rollback.
CREATE TABLE IF NOT EXISTS app_accounts (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()%4)+1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "user_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "access_token" TEXT,
  "refresh_token" TEXT,
  "id_token" TEXT,
  "access_token_expires_at" TEXT,
  "refresh_token_expires_at" TEXT,
  "scope" TEXT,
  "password" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CONSTRAINT "accounts_pkey" PRIMARY KEY (id),
  CONSTRAINT "accounts_provider_id_account_id_key" UNIQUE (provider_id, account_id),
  CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_assets (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()%4)+1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "user_id" TEXT,
  "guest_id" TEXT,
  "kind" TEXT NOT NULL,
  "object_key" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "byte_count" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "expires_at" TEXT,
  "object_deleted_at" TEXT,
  CONSTRAINT "assets_kind_check" CHECK ((kind IN ('source', 'target', 'result'))),
  CONSTRAINT "assets_status_check" CHECK ((status IN ('active', 'deleted'))),
  CONSTRAINT "assets_pkey" PRIMARY KEY (id),
  CONSTRAINT "assets_object_key_key" UNIQUE (object_key),
  CONSTRAINT "assets_user_id_fkey" FOREIGN KEY (user_id) REFERENCES app_users(id),
  CONSTRAINT "assets_guest_id_fkey" FOREIGN KEY (guest_id) REFERENCES app_guest_sessions(id)
);

CREATE TABLE IF NOT EXISTS app_billing_revocations (
  "reference" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CONSTRAINT "billing_revocations_pkey" PRIMARY KEY (reference)
);

CREATE TABLE IF NOT EXISTS app_billing_risk_events (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()%4)+1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "customer_id" TEXT,
  "stripe_customer_id" TEXT,
  "event_type" TEXT NOT NULL,
  "stripe_object_id" TEXT,
  "reason" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "user_id" TEXT,
  CONSTRAINT "billing_risk_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "billing_risk_events_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES app_customers(id),
  CONSTRAINT "billing_risk_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS app_credit_grants (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()%4)+1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "user_id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "source_ref" TEXT NOT NULL,
  "original_amount" INTEGER NOT NULL,
  "remaining_amount" INTEGER NOT NULL,
  "reserved_amount" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CONSTRAINT "credit_grants_source_source_ref_key" UNIQUE (source, source_ref),
  CONSTRAINT "credit_grants_user_id_fkey" FOREIGN KEY (user_id) REFERENCES app_users(id),
  CONSTRAINT "credit_grants_original_amount_check" CHECK ((original_amount > 0)),
  CONSTRAINT "credit_grants_remaining_amount_check" CHECK ((remaining_amount >= 0)),
  CONSTRAINT "credit_grants_reserved_amount_check" CHECK ((reserved_amount >= 0)),
  CONSTRAINT "credit_grants_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS app_credit_ledger (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()%4)+1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "user_id" TEXT NOT NULL,
  "grant_id" TEXT,
  "job_id" TEXT,
  "kind" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CONSTRAINT "credit_ledger_pkey" PRIMARY KEY (id),
  CONSTRAINT "credit_ledger_idempotency_key_key" UNIQUE (idempotency_key),
  CONSTRAINT "credit_ledger_user_id_fkey" FOREIGN KEY (user_id) REFERENCES app_users(id),
  CONSTRAINT "credit_ledger_grant_id_fkey" FOREIGN KEY (grant_id) REFERENCES app_credit_grants(id),
  CONSTRAINT "credit_ledger_job_id_fkey" FOREIGN KEY (job_id) REFERENCES app_swap_jobs(id)
);

CREATE TABLE IF NOT EXISTS app_credit_reservations (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()%4)+1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "job_id" TEXT NOT NULL,
  "grant_id" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'reserved',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CONSTRAINT "credit_reservations_amount_check" CHECK ((amount > 0)),
  CONSTRAINT "credit_reservations_state_check" CHECK ((state IN ('reserved', 'consumed', 'released'))),
  CONSTRAINT "credit_reservations_pkey" PRIMARY KEY (id),
  CONSTRAINT "credit_reservations_job_id_key" UNIQUE (job_id),
  CONSTRAINT "credit_reservations_job_id_fkey" FOREIGN KEY (job_id) REFERENCES app_swap_jobs(id),
  CONSTRAINT "credit_reservations_grant_id_fkey" FOREIGN KEY (grant_id) REFERENCES app_credit_grants(id)
);

CREATE TABLE IF NOT EXISTS app_customers (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()%4)+1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "auth_user_id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "stripe_customer_id" TEXT,
  "is_suspended" INTEGER NOT NULL DEFAULT false,
  "deletion_requested_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CONSTRAINT "customers_pkey" PRIMARY KEY (id),
  CONSTRAINT "customers_auth_user_id_key" UNIQUE (auth_user_id),
  CONSTRAINT "customers_stripe_customer_id_key" UNIQUE (stripe_customer_id),
  CONSTRAINT "customers_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES app_users(id)
);

CREATE TABLE IF NOT EXISTS app_guest_sessions (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()%4)+1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "token_hash" TEXT NOT NULL,
  "trial_state" TEXT NOT NULL DEFAULT 'available',
  "claimed_user_id" TEXT,
  "expires_at" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CONSTRAINT "guest_sessions_pkey" PRIMARY KEY (id),
  CONSTRAINT "guest_sessions_token_hash_key" UNIQUE (token_hash),
  CONSTRAINT "guest_sessions_claimed_user_id_fkey" FOREIGN KEY (claimed_user_id) REFERENCES app_users(id),
  CONSTRAINT "guest_sessions_trial_state_check" CHECK ((trial_state IN ('available', 'reserved', 'consumed', 'released')))
);

CREATE TABLE IF NOT EXISTS app_outbox_events (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()%4)+1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "topic" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CONSTRAINT "outbox_events_state_check" CHECK ((state IN ('pending', 'processing', 'done', 'failed'))),
  CONSTRAINT "outbox_events_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS app_owner_audit (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()%4)+1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "owner_id" TEXT NOT NULL,
  "user_id" TEXT,
  "action" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CONSTRAINT "owner_audit_pkey" PRIMARY KEY (id),
  CONSTRAINT "owner_audit_user_id_fkey" FOREIGN KEY (user_id) REFERENCES app_users(id)
);

CREATE TABLE IF NOT EXISTS app_paddle_adjustments (
  "id" TEXT NOT NULL,
  "transaction_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "type" TEXT,
  "occurred_at" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "needs_review" INTEGER NOT NULL DEFAULT false,
  CONSTRAINT "paddle_adjustments_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS app_paddle_checkouts (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()%4)+1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "environment" TEXT NOT NULL DEFAULT 'sandbox',
  "user_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "price_id" TEXT NOT NULL,
  "credits" INTEGER NOT NULL,
  "transaction_id" TEXT,
  "state" TEXT NOT NULL DEFAULT 'creating',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CONSTRAINT "paddle_checkouts_environment_check" CHECK ((environment IN ('sandbox', 'production'))),
  CONSTRAINT "paddle_checkouts_kind_check" CHECK ((kind IN ('subscription', 'pack'))),
  CONSTRAINT "paddle_checkouts_credits_check" CHECK ((credits > 0)),
  CONSTRAINT "paddle_checkouts_state_check" CHECK ((state IN ('creating', 'ready', 'completed', 'canceled', 'review'))),
  CONSTRAINT "paddle_checkouts_pkey" PRIMARY KEY (id),
  CONSTRAINT "paddle_checkouts_transaction_id_key" UNIQUE (transaction_id),
  CONSTRAINT "paddle_checkouts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES app_users(id)
);

CREATE TABLE IF NOT EXISTS app_paddle_event_inbox (
  "id" TEXT NOT NULL,
  "environment" TEXT NOT NULL DEFAULT 'sandbox',
  "type" TEXT NOT NULL,
  "occurred_at" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "last_error" TEXT,
  "received_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "processed_at" TEXT,
  CONSTRAINT "paddle_event_inbox_environment_check" CHECK ((environment IN ('sandbox', 'production'))),
  CONSTRAINT "paddle_event_inbox_state_check" CHECK ((state IN ('pending', 'processed', 'failed', 'ignored'))),
  CONSTRAINT "paddle_event_inbox_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS app_paddle_transactions (
  "id" TEXT NOT NULL,
  "environment" TEXT NOT NULL DEFAULT 'sandbox',
  "user_id" TEXT NOT NULL,
  "subscription_id" TEXT,
  "grant_id" TEXT,
  "period_start" TEXT,
  "period_end" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CONSTRAINT "paddle_transactions_environment_check" CHECK ((environment IN ('sandbox', 'production'))),
  CONSTRAINT "paddle_transactions_pkey" PRIMARY KEY (id),
  CONSTRAINT "paddle_transactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES app_users(id),
  CONSTRAINT "paddle_transactions_grant_id_fkey" FOREIGN KEY (grant_id) REFERENCES app_credit_grants(id)
);

CREATE TABLE IF NOT EXISTS app_sessions (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()%4)+1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "user_id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expires_at" TEXT NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CONSTRAINT "sessions_pkey" PRIMARY KEY (id),
  CONSTRAINT "sessions_token_key" UNIQUE (token),
  CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_stripe_event_inbox (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "api_version" TEXT,
  "livemode" INTEGER NOT NULL DEFAULT false,
  "payload" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "received_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "processing_started_at" TEXT,
  "processed_at" TEXT,
  "last_error" TEXT,
  CONSTRAINT "stripe_event_inbox_status_check" CHECK ((status IN ('pending', 'processing', 'processed', 'failed', 'ignored'))),
  CONSTRAINT "stripe_event_inbox_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS app_stripe_events (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'pending',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "processed_at" TEXT,
  CONSTRAINT "stripe_events_state_check" CHECK ((state IN ('pending', 'processed', 'failed'))),
  CONSTRAINT "stripe_events_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS app_subscriptions (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()%4)+1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "customer_id" TEXT,
  "stripe_subscription_id" TEXT,
  "status" TEXT NOT NULL,
  "current_period_start" TEXT,
  "current_period_end" TEXT,
  "cancel_at_period_end" INTEGER NOT NULL DEFAULT false,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "user_id" TEXT,
  "stripe_customer_id" TEXT,
  "stripe_price_id" TEXT,
  "plan_code" TEXT,
  "paid_current_period_start" TEXT,
  "paid_current_period_end" TEXT,
  "latest_paid_invoice_id" TEXT,
  "raw" TEXT NOT NULL DEFAULT '{}',
  "latest_stripe_event_created_at" TEXT,
  "paddle_subscription_id" TEXT,
  "paddle_environment" TEXT,
  "paddle_customer_id" TEXT,
  "paddle_price_id" TEXT,
  "latest_paddle_event_at" TEXT,
  "latest_paid_transaction_id" TEXT,
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY (id),
  CONSTRAINT "subscriptions_stripe_subscription_id_key" UNIQUE (stripe_subscription_id),
  CONSTRAINT "subscriptions_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES app_customers(id),
  CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE,
  CONSTRAINT "subscriptions_status_check" CHECK ((status IN ('incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused', 'incomplete_expired'))),
  CONSTRAINT "subscriptions_paddle_subscription_id_key" UNIQUE (paddle_subscription_id),
  CONSTRAINT "subscriptions_paddle_environment_check" CHECK ((paddle_environment IN ('sandbox', 'production')))
);

CREATE TABLE IF NOT EXISTS app_swap_jobs (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()%4)+1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "user_id" TEXT,
  "guest_id" TEXT,
  "source_asset_id" TEXT NOT NULL,
  "target_asset_id" TEXT NOT NULL,
  "result_asset_id" TEXT,
  "state" TEXT NOT NULL DEFAULT 'queued',
  "mode" TEXT NOT NULL DEFAULT 'guest_trial',
  "request_key" TEXT NOT NULL,
  "provider_request_id" TEXT,
  "error_code" TEXT,
  "error_message" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "finished_at" TEXT,
  "provider_mode" TEXT NOT NULL DEFAULT 'mock',
  "provider_consent_at" TEXT,
  CONSTRAINT "swap_jobs_state_check" CHECK ((state IN ('queued', 'validating', 'processing', 'saving', 'succeeded', 'retry_wait', 'reconciling', 'failed', 'canceled'))),
  CONSTRAINT "swap_jobs_mode_check" CHECK ((mode IN ('guest_trial', 'paid_credit'))),
  CONSTRAINT "swap_jobs_pkey" PRIMARY KEY (id),
  CONSTRAINT "swap_jobs_request_key_key" UNIQUE (request_key),
  CONSTRAINT "swap_jobs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES app_users(id),
  CONSTRAINT "swap_jobs_guest_id_fkey" FOREIGN KEY (guest_id) REFERENCES app_guest_sessions(id),
  CONSTRAINT "swap_jobs_source_asset_id_fkey" FOREIGN KEY (source_asset_id) REFERENCES app_assets(id),
  CONSTRAINT "swap_jobs_target_asset_id_fkey" FOREIGN KEY (target_asset_id) REFERENCES app_assets(id),
  CONSTRAINT "swap_jobs_result_asset_id_fkey" FOREIGN KEY (result_asset_id) REFERENCES app_assets(id),
  CONSTRAINT "swap_jobs_provider_mode_check" CHECK ((provider_mode IN ('mock', 'external'))),
  CONSTRAINT "swap_external_consent_required" CHECK (((provider_mode = 'mock') OR (provider_consent_at IS NOT NULL)))
);

CREATE TABLE IF NOT EXISTS app_users (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()%4)+1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "email" TEXT NOT NULL,
  "name" TEXT,
  "image" TEXT,
  "email_verified" INTEGER NOT NULL DEFAULT false,
  "stripe_customer_id" TEXT,
  "suspended_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "deletion_requested_at" TEXT,
  "paddle_customer_id" TEXT,
  "paddle_sandbox_customer_id" TEXT,
  CONSTRAINT "users_pkey" PRIMARY KEY (id),
  CONSTRAINT "users_email_key" UNIQUE (email),
  CONSTRAINT "users_stripe_customer_id_key" UNIQUE (stripe_customer_id),
  CONSTRAINT "users_paddle_customer_id_key" UNIQUE (paddle_customer_id),
  CONSTRAINT "users_paddle_sandbox_customer_id_key" UNIQUE (paddle_sandbox_customer_id)
);

CREATE TABLE IF NOT EXISTS app_verifications (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()%4)+1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expires_at" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CONSTRAINT "verifications_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS app_whop_checkouts (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()%4)+1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "user_id" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "configuration_id" TEXT,
  "purchase_url" TEXT,
  "state" TEXT NOT NULL DEFAULT 'creating',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "configuration_closed" INTEGER NOT NULL DEFAULT false,
  CONSTRAINT "whop_checkouts_environment_check" CHECK ((environment IN ('sandbox', 'production'))),
  CONSTRAINT "whop_checkouts_kind_check" CHECK ((kind IN ('subscription', 'pack'))),
  CONSTRAINT "whop_checkouts_pkey" PRIMARY KEY (id),
  CONSTRAINT "whop_checkouts_configuration_id_key" UNIQUE (configuration_id),
  CONSTRAINT "whop_checkouts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES app_users(id)
);

CREATE TABLE IF NOT EXISTS app_whop_event_inbox (
  "id" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "resource_id" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CONSTRAINT "whop_event_inbox_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS app_whop_memberships (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "period_start" TEXT,
  "period_end" TEXT,
  "cancel_at_period_end" INTEGER NOT NULL DEFAULT false,
  "updated_at" TEXT NOT NULL,
  CONSTRAINT "whop_memberships_pkey" PRIMARY KEY (id),
  CONSTRAINT "whop_memberships_user_id_fkey" FOREIGN KEY (user_id) REFERENCES app_users(id)
);

CREATE TABLE IF NOT EXISTS app_whop_payments (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "checkout_id" TEXT,
  "membership_id" TEXT,
  "period_start" TEXT,
  "period_end" TEXT,
  "grant_id" TEXT,
  "revoked_credits" INTEGER NOT NULL DEFAULT 0,
  "disputed" INTEGER NOT NULL DEFAULT false,
  "updated_at" TEXT NOT NULL,
  CONSTRAINT "whop_payments_pkey" PRIMARY KEY (id),
  CONSTRAINT "whop_payments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES app_users(id),
  CONSTRAINT "whop_payments_checkout_id_fkey" FOREIGN KEY (checkout_id) REFERENCES app_whop_checkouts(id),
  CONSTRAINT "whop_payments_grant_id_fkey" FOREIGN KEY (grant_id) REFERENCES app_credit_grants(id)
);

CREATE INDEX IF NOT EXISTS assets_owner_idx ON app_assets (user_id, guest_id);
CREATE INDEX IF NOT EXISTS swap_jobs_owner_idx ON app_swap_jobs (user_id, guest_id, created_at DESC);
CREATE INDEX IF NOT EXISTS credit_grants_spend_idx ON app_credit_grants (user_id, expires_at, created_at);
CREATE INDEX IF NOT EXISTS outbox_pending_idx ON app_outbox_events (state, created_at);
CREATE INDEX IF NOT EXISTS subscriptions_customer_status_idx ON app_subscriptions (customer_id, status, current_period_end);
CREATE INDEX IF NOT EXISTS stripe_event_inbox_pending_idx ON app_stripe_event_inbox (status, received_at);
CREATE INDEX IF NOT EXISTS billing_risk_events_customer_idx ON app_billing_risk_events (customer_id, created_at);
CREATE INDEX IF NOT EXISTS subscriptions_user_status_idx ON app_subscriptions (user_id, status, current_period_end);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_idx ON app_subscriptions (stripe_customer_id);
CREATE INDEX IF NOT EXISTS billing_risk_events_user_idx ON app_billing_risk_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS assets_expiration_idx ON app_assets (expires_at) WHERE (status = 'active');
CREATE INDEX IF NOT EXISTS assets_pending_delete_idx ON app_assets (status) WHERE (object_deleted_at IS NULL);
CREATE UNIQUE INDEX IF NOT EXISTS paddle_one_open_checkout ON app_paddle_checkouts (user_id, environment) WHERE (state IN ('creating', 'ready', 'review'));
CREATE INDEX IF NOT EXISTS paddle_inbox_pending ON app_paddle_event_inbox (state, next_attempt_at);
CREATE UNIQUE INDEX IF NOT EXISTS whop_paid_period ON app_whop_payments (environment, membership_id, period_start, period_end) WHERE (membership_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS paddle_adjustment_transaction ON app_paddle_adjustments (transaction_id);
CREATE UNIQUE INDEX IF NOT EXISTS paddle_subscription_paid_period ON app_paddle_transactions (subscription_id, period_start, period_end) WHERE (subscription_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS whop_open_checkout ON app_whop_checkouts (user_id, environment) WHERE (state IN ('creating', 'ready'));

CREATE TABLE IF NOT EXISTS app_d1_revision(id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL);
INSERT OR IGNORE INTO app_d1_revision VALUES(1,0);
CREATE TABLE IF NOT EXISTS app_d1_guard(ok INTEGER NOT NULL CONSTRAINT app_d1_guard CHECK(ok=1));
CREATE TRIGGER IF NOT EXISTS app_accounts_insert_revision AFTER INSERT ON app_accounts BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_accounts_update_revision AFTER UPDATE ON app_accounts BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_accounts_delete_revision AFTER DELETE ON app_accounts BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_assets_insert_revision AFTER INSERT ON app_assets BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_assets_update_revision AFTER UPDATE ON app_assets BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_assets_delete_revision AFTER DELETE ON app_assets BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_billing_revocations_insert_revision AFTER INSERT ON app_billing_revocations BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_billing_revocations_update_revision AFTER UPDATE ON app_billing_revocations BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_billing_revocations_delete_revision AFTER DELETE ON app_billing_revocations BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_billing_risk_events_insert_revision AFTER INSERT ON app_billing_risk_events BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_billing_risk_events_update_revision AFTER UPDATE ON app_billing_risk_events BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_billing_risk_events_delete_revision AFTER DELETE ON app_billing_risk_events BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_credit_grants_insert_revision AFTER INSERT ON app_credit_grants BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_credit_grants_update_revision AFTER UPDATE ON app_credit_grants BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_credit_grants_delete_revision AFTER DELETE ON app_credit_grants BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_credit_ledger_insert_revision AFTER INSERT ON app_credit_ledger BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_credit_ledger_update_revision AFTER UPDATE ON app_credit_ledger BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_credit_ledger_delete_revision AFTER DELETE ON app_credit_ledger BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_credit_reservations_insert_revision AFTER INSERT ON app_credit_reservations BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_credit_reservations_update_revision AFTER UPDATE ON app_credit_reservations BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_credit_reservations_delete_revision AFTER DELETE ON app_credit_reservations BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_customers_insert_revision AFTER INSERT ON app_customers BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_customers_update_revision AFTER UPDATE ON app_customers BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_customers_delete_revision AFTER DELETE ON app_customers BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_guest_sessions_insert_revision AFTER INSERT ON app_guest_sessions BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_guest_sessions_update_revision AFTER UPDATE ON app_guest_sessions BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_guest_sessions_delete_revision AFTER DELETE ON app_guest_sessions BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_outbox_events_insert_revision AFTER INSERT ON app_outbox_events BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_outbox_events_update_revision AFTER UPDATE ON app_outbox_events BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_outbox_events_delete_revision AFTER DELETE ON app_outbox_events BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_owner_audit_insert_revision AFTER INSERT ON app_owner_audit BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_owner_audit_update_revision AFTER UPDATE ON app_owner_audit BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_owner_audit_delete_revision AFTER DELETE ON app_owner_audit BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_paddle_adjustments_insert_revision AFTER INSERT ON app_paddle_adjustments BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_paddle_adjustments_update_revision AFTER UPDATE ON app_paddle_adjustments BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_paddle_adjustments_delete_revision AFTER DELETE ON app_paddle_adjustments BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_paddle_checkouts_insert_revision AFTER INSERT ON app_paddle_checkouts BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_paddle_checkouts_update_revision AFTER UPDATE ON app_paddle_checkouts BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_paddle_checkouts_delete_revision AFTER DELETE ON app_paddle_checkouts BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_paddle_event_inbox_insert_revision AFTER INSERT ON app_paddle_event_inbox BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_paddle_event_inbox_update_revision AFTER UPDATE ON app_paddle_event_inbox BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_paddle_event_inbox_delete_revision AFTER DELETE ON app_paddle_event_inbox BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_paddle_transactions_insert_revision AFTER INSERT ON app_paddle_transactions BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_paddle_transactions_update_revision AFTER UPDATE ON app_paddle_transactions BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_paddle_transactions_delete_revision AFTER DELETE ON app_paddle_transactions BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_sessions_insert_revision AFTER INSERT ON app_sessions BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_sessions_update_revision AFTER UPDATE ON app_sessions BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_sessions_delete_revision AFTER DELETE ON app_sessions BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_stripe_event_inbox_insert_revision AFTER INSERT ON app_stripe_event_inbox BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_stripe_event_inbox_update_revision AFTER UPDATE ON app_stripe_event_inbox BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_stripe_event_inbox_delete_revision AFTER DELETE ON app_stripe_event_inbox BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_stripe_events_insert_revision AFTER INSERT ON app_stripe_events BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_stripe_events_update_revision AFTER UPDATE ON app_stripe_events BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_stripe_events_delete_revision AFTER DELETE ON app_stripe_events BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_subscriptions_insert_revision AFTER INSERT ON app_subscriptions BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_subscriptions_update_revision AFTER UPDATE ON app_subscriptions BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_subscriptions_delete_revision AFTER DELETE ON app_subscriptions BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_swap_jobs_insert_revision AFTER INSERT ON app_swap_jobs BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_swap_jobs_update_revision AFTER UPDATE ON app_swap_jobs BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_swap_jobs_delete_revision AFTER DELETE ON app_swap_jobs BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_users_insert_revision AFTER INSERT ON app_users BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_users_update_revision AFTER UPDATE ON app_users BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_users_delete_revision AFTER DELETE ON app_users BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_verifications_insert_revision AFTER INSERT ON app_verifications BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_verifications_update_revision AFTER UPDATE ON app_verifications BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_verifications_delete_revision AFTER DELETE ON app_verifications BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_whop_checkouts_insert_revision AFTER INSERT ON app_whop_checkouts BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_whop_checkouts_update_revision AFTER UPDATE ON app_whop_checkouts BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_whop_checkouts_delete_revision AFTER DELETE ON app_whop_checkouts BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_whop_event_inbox_insert_revision AFTER INSERT ON app_whop_event_inbox BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_whop_event_inbox_update_revision AFTER UPDATE ON app_whop_event_inbox BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_whop_event_inbox_delete_revision AFTER DELETE ON app_whop_event_inbox BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_whop_memberships_insert_revision AFTER INSERT ON app_whop_memberships BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_whop_memberships_update_revision AFTER UPDATE ON app_whop_memberships BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_whop_memberships_delete_revision AFTER DELETE ON app_whop_memberships BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_whop_payments_insert_revision AFTER INSERT ON app_whop_payments BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_whop_payments_update_revision AFTER UPDATE ON app_whop_payments BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS app_whop_payments_delete_revision AFTER DELETE ON app_whop_payments BEGIN UPDATE app_d1_revision SET version=version+1 WHERE id=1; END;

CREATE INDEX IF NOT EXISTS whop_inbox_pending ON app_whop_event_inbox(environment,state,next_attempt_at);
CREATE INDEX IF NOT EXISTS whop_payment_grant ON app_whop_payments(grant_id);
CREATE INDEX IF NOT EXISTS reservations_grant_state ON app_credit_reservations(grant_id,state);
CREATE INDEX IF NOT EXISTS swap_trial_daily ON app_swap_jobs(mode,created_at,state);
CREATE INDEX IF NOT EXISTS swap_worker_queue ON app_swap_jobs(state,updated_at);
