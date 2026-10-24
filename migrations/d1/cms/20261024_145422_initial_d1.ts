import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`owners_sessions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`created_at\` text,
  	\`expires_at\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`owners\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`owners_sessions_order_idx\` ON \`owners_sessions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`owners_sessions_parent_id_idx\` ON \`owners_sessions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`owners\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`role\` text DEFAULT 'owner' NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`email\` text NOT NULL,
  	\`reset_password_token\` text,
  	\`reset_password_expiration\` text,
  	\`salt\` text,
  	\`hash\` text,
  	\`login_attempts\` numeric DEFAULT 0,
  	\`lock_until\` text
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`owners_updated_at_idx\` ON \`owners\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`owners_created_at_idx\` ON \`owners\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS \`owners_email_idx\` ON \`owners\` (\`email\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`categories\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text NOT NULL,
  	\`slug\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS \`categories_slug_idx\` ON \`categories\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`categories_updated_at_idx\` ON \`categories\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`categories_created_at_idx\` ON \`categories\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`media\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`alt\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`url\` text,
  	\`thumbnail_u_r_l\` text,
  	\`filename\` text,
  	\`mime_type\` text,
  	\`filesize\` numeric,
  	\`width\` numeric,
  	\`height\` numeric,
  	\`focal_x\` numeric,
  	\`focal_y\` numeric,
  	\`sizes_card_url\` text,
  	\`sizes_card_width\` numeric,
  	\`sizes_card_height\` numeric,
  	\`sizes_card_mime_type\` text,
  	\`sizes_card_filesize\` numeric,
  	\`sizes_card_filename\` text,
  	\`sizes_social_url\` text,
  	\`sizes_social_width\` numeric,
  	\`sizes_social_height\` numeric,
  	\`sizes_social_mime_type\` text,
  	\`sizes_social_filesize\` numeric,
  	\`sizes_social_filename\` text
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`media_updated_at_idx\` ON \`media\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`media_created_at_idx\` ON \`media\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS \`media_filename_idx\` ON \`media\` (\`filename\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`media_sizes_card_sizes_card_filename_idx\` ON \`media\` (\`sizes_card_filename\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`media_sizes_social_sizes_social_filename_idx\` ON \`media\` (\`sizes_social_filename\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`posts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`slug\` text,
  	\`summary\` text,
  	\`cover_image_id\` integer,
  	\`cover_alt\` text,
  	\`category_id\` integer,
  	\`author_id\` integer,
  	\`published_at\` text,
  	\`content\` text,
  	\`seo_title\` text,
  	\`seo_description\` text,
  	\`canonical_url\` text,
  	\`social_image_id\` integer,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`_status\` text DEFAULT 'draft',
  	FOREIGN KEY (\`cover_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`category_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`author_id\`) REFERENCES \`owners\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`social_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS \`posts_slug_idx\` ON \`posts\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`posts_cover_image_idx\` ON \`posts\` (\`cover_image_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`posts_category_idx\` ON \`posts\` (\`category_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`posts_author_idx\` ON \`posts\` (\`author_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`posts_published_at_idx\` ON \`posts\` (\`published_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`posts_social_image_idx\` ON \`posts\` (\`social_image_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`posts_updated_at_idx\` ON \`posts\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`posts_created_at_idx\` ON \`posts\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`posts__status_idx\` ON \`posts\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`_posts_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_title\` text,
  	\`version_slug\` text,
  	\`version_summary\` text,
  	\`version_cover_image_id\` integer,
  	\`version_cover_alt\` text,
  	\`version_category_id\` integer,
  	\`version_author_id\` integer,
  	\`version_published_at\` text,
  	\`version_content\` text,
  	\`version_seo_title\` text,
  	\`version_seo_description\` text,
  	\`version_canonical_url\` text,
  	\`version_social_image_id\` integer,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version__status\` text DEFAULT 'draft',
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`latest\` integer,
  	\`autosave\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_cover_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_category_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_author_id\`) REFERENCES \`owners\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_social_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_posts_v_parent_idx\` ON \`_posts_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_posts_v_version_version_slug_idx\` ON \`_posts_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_posts_v_version_version_cover_image_idx\` ON \`_posts_v\` (\`version_cover_image_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_posts_v_version_version_category_idx\` ON \`_posts_v\` (\`version_category_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_posts_v_version_version_author_idx\` ON \`_posts_v\` (\`version_author_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_posts_v_version_version_published_at_idx\` ON \`_posts_v\` (\`version_published_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_posts_v_version_version_social_image_idx\` ON \`_posts_v\` (\`version_social_image_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_posts_v_version_version_updated_at_idx\` ON \`_posts_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_posts_v_version_version_created_at_idx\` ON \`_posts_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_posts_v_version_version__status_idx\` ON \`_posts_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_posts_v_created_at_idx\` ON \`_posts_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_posts_v_updated_at_idx\` ON \`_posts_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_posts_v_latest_idx\` ON \`_posts_v\` (\`latest\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_posts_v_autosave_idx\` ON \`_posts_v\` (\`autosave\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`redirects\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`from\` text NOT NULL,
  	\`to\` text NOT NULL,
  	\`permanent\` integer DEFAULT true,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS \`redirects_from_idx\` ON \`redirects\` (\`from\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`redirects_updated_at_idx\` ON \`redirects\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`redirects_created_at_idx\` ON \`redirects\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`payload_kv\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text NOT NULL,
  	\`data\` text NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS \`payload_kv_key_idx\` ON \`payload_kv\` (\`key\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`payload_jobs_log\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`executed_at\` text NOT NULL,
  	\`completed_at\` text NOT NULL,
  	\`task_slug\` text NOT NULL,
  	\`task_i_d\` text NOT NULL,
  	\`input\` text,
  	\`output\` text,
  	\`state\` text NOT NULL,
  	\`error\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`payload_jobs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_jobs_log_order_idx\` ON \`payload_jobs_log\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_jobs_log_parent_id_idx\` ON \`payload_jobs_log\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`payload_jobs\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`input\` text,
  	\`completed_at\` text,
  	\`total_tried\` numeric DEFAULT 0,
  	\`has_error\` integer DEFAULT false,
  	\`error\` text,
  	\`task_slug\` text,
  	\`queue\` text DEFAULT 'default',
  	\`wait_until\` text,
  	\`processing\` integer DEFAULT false,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_jobs_completed_at_idx\` ON \`payload_jobs\` (\`completed_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_jobs_total_tried_idx\` ON \`payload_jobs\` (\`total_tried\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_jobs_has_error_idx\` ON \`payload_jobs\` (\`has_error\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_jobs_task_slug_idx\` ON \`payload_jobs\` (\`task_slug\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_jobs_queue_idx\` ON \`payload_jobs\` (\`queue\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_jobs_wait_until_idx\` ON \`payload_jobs\` (\`wait_until\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_jobs_processing_idx\` ON \`payload_jobs\` (\`processing\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_jobs_updated_at_idx\` ON \`payload_jobs\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_jobs_created_at_idx\` ON \`payload_jobs\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`payload_locked_documents\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`global_slug\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_global_slug_idx\` ON \`payload_locked_documents\` (\`global_slug\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_updated_at_idx\` ON \`payload_locked_documents\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_created_at_idx\` ON \`payload_locked_documents\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`owners_id\` integer,
  	\`categories_id\` integer,
  	\`media_id\` integer,
  	\`posts_id\` integer,
  	\`redirects_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`owners_id\`) REFERENCES \`owners\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`categories_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`redirects_id\`) REFERENCES \`redirects\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_owners_id_idx\` ON \`payload_locked_documents_rels\` (\`owners_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_categories_id_idx\` ON \`payload_locked_documents_rels\` (\`categories_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_posts_id_idx\` ON \`payload_locked_documents_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_redirects_id_idx\` ON \`payload_locked_documents_rels\` (\`redirects_id\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`payload_preferences\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`value\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_preferences_key_idx\` ON \`payload_preferences\` (\`key\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_preferences_updated_at_idx\` ON \`payload_preferences\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_preferences_created_at_idx\` ON \`payload_preferences\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`payload_preferences_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`owners_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_preferences\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`owners_id\`) REFERENCES \`owners\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_preferences_rels_order_idx\` ON \`payload_preferences_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_preferences_rels_parent_idx\` ON \`payload_preferences_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_preferences_rels_path_idx\` ON \`payload_preferences_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_preferences_rels_owners_id_idx\` ON \`payload_preferences_rels\` (\`owners_id\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`payload_migrations\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`batch\` numeric,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_migrations_updated_at_idx\` ON \`payload_migrations\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_migrations_created_at_idx\` ON \`payload_migrations\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`site_settings\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`site_name\` text DEFAULT 'SwapThisFace.com' NOT NULL,
  	\`default_seo_title\` text,
  	\`default_seo_description\` text,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`owners_sessions\`;`)
  await db.run(sql`DROP TABLE \`owners\`;`)
  await db.run(sql`DROP TABLE \`categories\`;`)
  await db.run(sql`DROP TABLE \`media\`;`)
  await db.run(sql`DROP TABLE \`posts\`;`)
  await db.run(sql`DROP TABLE \`_posts_v\`;`)
  await db.run(sql`DROP TABLE \`redirects\`;`)
  await db.run(sql`DROP TABLE \`payload_kv\`;`)
  await db.run(sql`DROP TABLE \`payload_jobs_log\`;`)
  await db.run(sql`DROP TABLE \`payload_jobs\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_migrations\`;`)
  await db.run(sql`DROP TABLE \`site_settings\`;`)
}
