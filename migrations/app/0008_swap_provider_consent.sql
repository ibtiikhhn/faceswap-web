-- Existing queued previews remain mock jobs when external processing is enabled.
alter table app.swap_jobs add column if not exists provider_mode text not null default 'mock'
  check (provider_mode in ('mock', 'external'));
alter table app.swap_jobs add column if not exists provider_consent_at timestamptz;
alter table app.swap_jobs add constraint swap_external_consent_required
  check (provider_mode = 'mock' or provider_consent_at is not null);
