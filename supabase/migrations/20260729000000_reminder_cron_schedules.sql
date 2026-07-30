-- Captures the pg_cron schedules that drive send-event-reminders and
-- send-serving-reminders. Previously these existed only as manually-run SQL
-- in the remote project (see git history on the edge function files) — a
-- point-in-time restore or self-hoster had no way to reproduce them.
--
-- These jobs call out to Edge Functions over pg_net, which needs a project
-- URL and a service-role key. Those must NEVER be committed to this public
-- repo, so they're read from Supabase Vault by name instead. Populate them
-- once per environment (this is a data operation via the SQL editor / CLI,
-- not a schema change — it does not conflict with "never touch remote
-- schema outside CI"):
--
--   select vault.create_secret('https://<project-ref>.supabase.co', 'cron_project_url');
--   select vault.create_secret('<service-role-key>', 'cron_service_role_key');
--
-- Until both secrets exist, these jobs still run on schedule but their
-- net.http_post calls will fail (null url/Authorization) — check
-- `select * from net._http_response order by created desc limit 10;` if
-- reminders stop after a restore or fresh self-host.
--
-- The standard Supabase Postgres image (hosted, local CLI stack, and the
-- official self-host docker-compose) already preloads pg_cron and pg_net via
-- shared_preload_libraries. A non-standard Postgres install must add them to
-- shared_preload_libraries manually — that can't be done from a SQL migration.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- cron.schedule() upserts by job name (pg_cron >= 1.4), so re-applying this
-- migration — or applying it over jobs created by the original manual setup —
-- converges each job to the definition below rather than duplicating it.

select cron.schedule(
  'send-event-reminders-daily',
  '0 8 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'cron_project_url') || '/functions/v1/send-event-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'send-serving-reminders-daily',
  '0 8 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'cron_project_url') || '/functions/v1/send-serving-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"mode":"daily"}'::jsonb
  );
  $$
);

select cron.schedule(
  'send-serving-monthly-broadcast',
  '0 8 1 * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'cron_project_url') || '/functions/v1/send-serving-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"mode":"monthly"}'::jsonb
  );
  $$
);
