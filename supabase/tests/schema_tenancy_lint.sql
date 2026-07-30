-- CI schema lint (CWA-7 / #209, Phase 0): every public base table must have
-- RLS enabled AND an org_id column, unless explicitly allowlisted below.
-- The allowlist covers every table that predates multi-tenancy and has not
-- yet been migrated to carry org_id. Remove entries as each table gains
-- org_id in later CWA-7 phases — an empty allowlist is the end goal.
--
-- Run locally (rollback-safe, never mutates the shared local stack):
--
--   docker exec -i supabase_db_small-group-hub \
--     psql -U postgres -d postgres -f - < supabase/tests/schema_tenancy_lint.sql
--
-- Runs in CI via `supabase test db` against an ephemeral, isolated Postgres.

begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

create temporary table tenancy_allowlist (table_name text primary key) on commit drop;
insert into tenancy_allowlist (table_name) values
  ('about_page'), ('access_requests'), ('announcements'),
  ('calendar_subscription_tokens'), ('class_teachers'), ('event_calendars'),
  ('events'), ('family_units'), ('family_members'), ('profiles'),
  ('family_invites'), ('feedback'), ('giving_fund_methods'), ('giving_funds'),
  ('lecture_series'), ('lectures'), ('member_groups'), ('page_content'),
  ('prayer_call_sessions'), ('prayer_requests'), ('prayer_responses'),
  ('profile_groups'), ('rsvps'), ('serving_broadcasts'),
  ('serving_signup_attendees'), ('serving_signups'), ('serving_team_settings'),
  ('site_settings'),
  -- Phase 0 scaffold tables (organization_members already carries org_id):
  ('organizations'), ('organization_members'),
  -- In-flight on another branch, present on the shared local stack only;
  -- does not exist in CI's ephemeral database built from this branch:
  ('payment_handles');

select is(
  (select count(*)::int from information_schema.tables t
    where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
      and t.table_name not in (select table_name from tenancy_allowlist)
      and not exists (
        select 1 from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = t.table_name and c.relrowsecurity
      )),
  0,
  'every non-allowlisted public table has RLS enabled'
);

select is(
  (select count(*)::int from information_schema.tables t
    where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
      and t.table_name not in (select table_name from tenancy_allowlist)
      and not exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = t.table_name
          and c.column_name = 'org_id'
      )),
  0,
  'every non-allowlisted public table has an org_id column'
);

select * from finish();
rollback;
