-- CI schema lint (CWA-7 / #209, Phase 0; extended for CWA-8 / #210, Phase 1):
-- every public base table must have RLS enabled AND an org_id column that is
-- NOT NULL with a DEFAULT, unless explicitly allowlisted below.
-- Remove entries as each table gains org_id in later CWA-7 phases — an empty
-- allowlist is the end goal.
--
-- Run locally (rollback-safe, never mutates the shared local stack):
--
--   docker exec -i supabase_db_small-group-hub \
--     psql -U postgres -d postgres -f - < supabase/tests/schema_tenancy_lint.sql
--
-- Runs in CI via `supabase test db` against an ephemeral, isolated Postgres.

begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

create temporary table tenancy_allowlist (table_name text primary key) on commit drop;
insert into tenancy_allowlist (table_name) values
  -- Phase 0 scaffold: organizations is the tenant root table, so it has no
  -- org_id column by design (RLS is already enabled, so only the org_id
  -- check needs this exemption). organization_members already carries both
  -- org_id and RLS, so it's deliberately NOT allowlisted — it's the working
  -- example of the target end state and should stay under lint coverage.
  -- platform_admins is likewise org-orthogonal by design (Phase 1): it holds
  -- Two42-operator superusers who aren't pinned to any org:
  ('organizations'),
  ('platform_admins'),
  -- In-flight on another branch, present on the shared local stack only;
  -- does not exist in CI's ephemeral database built from this branch:
  ('payment_handles');

-- Negative-test probe: proves both checks below actually fail on a
-- violation, rather than silently becoming a no-op that always passes.
-- Deliberately: no RLS enabled, no org_id column, not allowlisted. A
-- regular (not temporary) table, since temp tables live in a pg_temp_*
-- schema and would be invisible to the public-schema checks below; the
-- enclosing rollback still guarantees it never persists.
create table public.tenancy_probe_violation (
  id uuid primary key default gen_random_uuid()
);

-- Second negative-test probe (Phase 1): HAS an org_id column, so it passes
-- the presence check above, but the column is deliberately nullable with no
-- default — proving the NOT NULL and DEFAULT checks below aren't vacuous.
create table public.tenancy_probe_no_default (
  id uuid primary key default gen_random_uuid(),
  org_id uuid  -- deliberately nullable, no default
);
-- RLS enabled so this probe only trips the NOT NULL/DEFAULT checks it
-- exists to exercise, not the unrelated RLS check above.
alter table public.tenancy_probe_no_default enable row level security;

-- Each catalog scan is computed once here and reused by both the "clean"
-- assertion (excludes the probe table) and the "lint actually flags
-- violations" assertion (includes it) below.
create temporary table rls_missing on commit drop as
  select t.table_name
  from information_schema.tables t
  where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
    and t.table_name not in (select table_name from tenancy_allowlist)
    and not exists (
      select 1 from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t.table_name and c.relrowsecurity
    );

create temporary table org_id_missing on commit drop as
  select t.table_name
  from information_schema.tables t
  where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
    and t.table_name not in (select table_name from tenancy_allowlist)
    and not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = t.table_name
        and c.column_name = 'org_id'
    );

select is(
  (select count(*)::int from rls_missing where table_name <> 'tenancy_probe_violation'),
  0,
  'every non-allowlisted public table has RLS enabled'
);

select isnt(
  (select count(*)::int from rls_missing),
  0,
  'lint DOES flag the injected no-RLS probe table when not excluded'
);

select is(
  (select count(*)::int from org_id_missing where table_name <> 'tenancy_probe_violation'),
  0,
  'every non-allowlisted public table has an org_id column'
);

select isnt(
  (select count(*)::int from org_id_missing),
  0,
  'lint DOES flag the injected no-org_id probe table when not excluded'
);

-- Phase 1 gate: org_id must be NOT NULL and carry a DEFAULT (fail-closed
-- app_current_org_id()) on every non-allowlisted table that has the column.
create temporary table org_id_nullable on commit drop as
  select t.table_name
  from information_schema.tables t
  where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
    and t.table_name not in (select table_name from tenancy_allowlist)
    and exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = t.table_name
        and c.column_name = 'org_id' and c.is_nullable = 'YES'
    );

create temporary table org_id_no_default on commit drop as
  select t.table_name
  from information_schema.tables t
  where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
    and t.table_name not in (select table_name from tenancy_allowlist)
    -- organization_members is a membership join table: org_id is half its
    -- natural key and must always be named explicitly by the caller
    -- (provision_organization, handle_new_user) — a fail-closed DEFAULT
    -- makes no sense there. It stays covered by every other check.
    and t.table_name <> 'organization_members'
    and exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = t.table_name
        and c.column_name = 'org_id' and c.column_default is null
    );

select is(
  (select count(*)::int from org_id_nullable where table_name <> 'tenancy_probe_no_default'),
  0,
  'every non-allowlisted table''s org_id column is NOT NULL'
);

select isnt(
  (select count(*)::int from org_id_nullable),
  0,
  'lint DOES flag the injected nullable-org_id probe table when not excluded'
);

select is(
  (select count(*)::int from org_id_no_default where table_name <> 'tenancy_probe_no_default'),
  0,
  'every non-allowlisted table''s org_id column has a DEFAULT'
);

select isnt(
  (select count(*)::int from org_id_no_default),
  0,
  'lint DOES flag the injected no-default probe table when not excluded'
);

select * from finish();
rollback;
