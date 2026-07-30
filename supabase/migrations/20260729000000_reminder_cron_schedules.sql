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
-- Until both secrets exist, these jobs still run on schedule but fail:
-- if `cron_project_url` is missing, net.http_post raises before queuing
-- anything (nothing shows up in net._http_response); if only
-- `cron_service_role_key` is missing, the request goes out with a bad
-- Authorization header and the failure shows up in net._http_response.
-- Either way, `select * from cron.job_run_details order by start_time desc
-- limit 10;` shows whether the job ran and why it failed.
--
-- The standard Supabase Postgres image (hosted, local CLI stack, and the
-- official self-host docker-compose) already preloads pg_cron and pg_net via
-- shared_preload_libraries. A non-standard Postgres install must add them to
-- shared_preload_libraries manually — that can't be done from a SQL migration.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- `private` is not in the API-exposed schema list (see supabase/config.toml),
-- so this helper is reachable only from SQL (migrations, pg_cron), never via
-- PostgREST — it builds requests authenticated with the service-role key.
create schema if not exists private;

-- Shared by every reminder job below: look up both vault secrets once, then
-- POST to the given Edge Function path with the given body. Parameterizing
-- job_name/schedule/function_path/body keeps that shape defined in one place
-- instead of once per cron.schedule() call.
create or replace function private.schedule_edge_reminder(
  job_name text,
  schedule text,
  function_path text,
  body jsonb
) returns void
language plpgsql
set search_path = ''
as $$
begin
  perform cron.schedule(
    job_name,
    schedule,
    format(
      $sql$
      with secrets as (
        select name, decrypted_secret
        from vault.decrypted_secrets
        where name in ('cron_project_url', 'cron_service_role_key')
      )
      select net.http_post(
        url := (select decrypted_secret from secrets where name = 'cron_project_url') || %L,
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from secrets where name = 'cron_service_role_key'),
          'Content-Type', 'application/json'
        ),
        body := %L::jsonb
      );
      $sql$,
      function_path,
      body::text
    )
  );
end;
$$;

revoke all on function private.schedule_edge_reminder(text, text, text, jsonb) from public;

-- cron.schedule() upserts by job name (pg_cron >= 1.4), so re-applying this
-- migration — or applying it over jobs created by the original manual setup —
-- converges each job to the definition below rather than duplicating it.

select private.schedule_edge_reminder(
  'send-event-reminders-daily',
  '0 8 * * *',
  '/functions/v1/send-event-reminders',
  '{}'::jsonb
);

select private.schedule_edge_reminder(
  'send-serving-reminders-daily',
  '0 8 * * *',
  '/functions/v1/send-serving-reminders',
  '{"mode":"daily"}'::jsonb
);

select private.schedule_edge_reminder(
  'send-serving-monthly-broadcast',
  '0 8 1 * *',
  '/functions/v1/send-serving-reminders',
  '{"mode":"monthly"}'::jsonb
);
