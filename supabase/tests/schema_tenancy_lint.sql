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
select plan(22);

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

-- Third negative-test probe (Phase 1): org_id is NOT NULL and HAS a
-- default, so it passes the two checks above, but the default isn't
-- app_current_org_id() — proving the wrong-default check below isn't
-- vacuous.
create table public.tenancy_probe_wrong_default (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default gen_random_uuid()  -- deliberately wrong default
);
alter table public.tenancy_probe_wrong_default enable row level security;

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

-- Phase 1 gate (tighter): org_id's DEFAULT must be app_current_org_id()
-- specifically, not just "any non-null default" — org_id_no_default above
-- would pass for a hardcoded UUID, gen_random_uuid(), or a copy-pasted
-- wrong function just as easily.
create temporary table org_id_wrong_default on commit drop as
  select t.table_name
  from information_schema.tables t
  where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
    and t.table_name not in (select table_name from tenancy_allowlist)
    and t.table_name <> 'organization_members'
    and exists (
      select 1
      from pg_catalog.pg_attrdef d
      join pg_catalog.pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
      join pg_catalog.pg_class c on c.oid = d.adrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t.table_name
        and a.attname = 'org_id'
        -- pg_get_expr renders the call schema-qualified or not depending on
        -- the session search_path; both spellings are the same function and
        -- ONLY these two exact renderings are valid.
        and pg_get_expr(d.adbin, d.adrelid) not in
          ('app_current_org_id()', 'public.app_current_org_id()')
    );

select is(
  (select count(*)::int from org_id_wrong_default where table_name <> 'tenancy_probe_wrong_default'),
  0,
  'every non-allowlisted table''s org_id DEFAULT is app_current_org_id() specifically'
);

select isnt(
  (select count(*)::int from org_id_wrong_default),
  0,
  'lint DOES flag the injected wrong-default probe table when not excluded'
);

-- Fail-closed runtime check: as the postgres/service-role role (no
-- auth.uid(), matching this file's own execution context), an org_id-less
-- insert on a representative plain-rollout table and a representative
-- PK-rescoped table must both be rejected, not silently misrouted.
select throws_ok(
  $$ insert into public.event_calendars (name) values ('tenancy-lint-probe') $$,
  '23502',
  null,
  'service-role insert into a plain org_id-rollout table is rejected without explicit org_id'
);

select throws_ok(
  $$ insert into public.page_content (slug, title, body) values ('tenancy-lint-probe-slug', 'Probe', 'x') $$,
  '23502',
  null,
  'service-role insert into a PK-rescoped table is rejected without explicit org_id'
);

-- PK/unique re-scoping (Review Focus Area #2): confirm the new composite
-- PK and the retained legacy single-column unique both actually exist for
-- each of the 4 re-scoped tables, so a later migration can't silently drop
-- the legacy unique (which current app onConflict targets still depend on)
-- or lose the composite PK without a test catching it.
select col_is_pk('public', 'page_content', array['org_id', 'slug'], 'page_content PK is (org_id, slug)');
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.page_content'::regclass
      and conname = 'page_content_slug_legacy_key' and contype = 'u'
  ),
  'page_content retains the slug-only legacy unique for legacy onConflict targets'
);

select col_is_pk('public', 'site_settings', array['org_id', 'key'], 'site_settings PK is (org_id, key)');
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.site_settings'::regclass
      and conname = 'site_settings_key_legacy_key' and contype = 'u'
  ),
  'site_settings retains the key-only legacy unique for legacy onConflict targets'
);

select col_is_pk('public', 'about_page', array['org_id', 'id'], 'about_page PK is (org_id, id)');
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.about_page'::regclass
      and conname = 'about_page_id_legacy_key' and contype = 'u'
  ),
  'about_page retains the id-only legacy unique (singleton guard)'
);

select col_is_pk('public', 'class_teachers', array['id'], 'class_teachers PK stays plain id');
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.class_teachers'::regclass
      and conname = 'class_teachers_org_id_profile_id_key' and contype = 'u'
  ),
  'class_teachers has (org_id, profile_id) unique'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.class_teachers'::regclass
      and conname = 'class_teachers_profile_id_legacy_key' and contype = 'u'
  ),
  'class_teachers retains the renamed legacy profile_id-only unique'
);

-- Backfill correctness (Review Focus Area #3), data level: every existing
-- row on every org_id-bearing, non-allowlisted table must have landed on
-- the constant default-org UUID, not just "non-null" (which the earlier
-- checks already cover). Requires dynamic SQL since this inspects row
-- data, not catalog metadata, per table.
create temporary table org_id_bad_backfill (table_name text) on commit drop;
do $$
declare
  t text;
  bad_count bigint;
begin
  for t in
    select ts.table_name from information_schema.tables ts
    where ts.table_schema = 'public' and ts.table_type = 'BASE TABLE'
      and ts.table_name not in (select table_name from tenancy_allowlist)
      and exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = ts.table_name
          and c.column_name = 'org_id'
      )
  loop
    execute format(
      'select count(*) from public.%I where org_id <> %L::uuid', t, '00000000-0000-0000-0000-000000000001'
    ) into bad_count;
    if bad_count > 0 then
      insert into org_id_bad_backfill values (t);
    end if;
  end loop;
end $$;

select is(
  (select count(*)::int from org_id_bad_backfill),
  0,
  'every org_id-bearing, non-allowlisted table has all existing rows backfilled to the default org'
);

select * from finish();
rollback;
