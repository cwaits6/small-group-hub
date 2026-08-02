-- Branding read-path regression guard (CWA-10 Phase 3, #212).
--
-- Before 20260801000002_org_branding_backfill.sql, public.organizations was
-- readable by NOBODY over PostgREST: the only permissive select policy
-- ("org members can view their orgs") is gated on organization_members,
-- which the app never populates, so anon AND authenticated both saw 0 rows
-- while the app silently fell back to env-var branding defaults. This suite
-- is the test that would have caught that — it pins the permissive SELECT
-- policy and the canonical branding shape for the seeded org.
--
-- Run locally through the shared stack's container (never `supabase test db`):
--
--   docker exec -i supabase_db_small-group-hub \
--     psql -U postgres -d postgres -f - < supabase/tests/branding_rls_suite.sql

begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- Shape contract: the backfilled org carries all four canonical keys.
select ok(
  (
    select branding ?& array['display_name', 'logo_url', 'accent', 'reply_to']
    from public.organizations
    where id = '00000000-0000-0000-0000-000000000001'
  ),
  'org #1 branding carries display_name, logo_url, accent, reply_to'
);

-- accent must survive resolveBranding()'s strict hex guard, or the app
-- silently falls back to the default and the backfill is dead weight.
select matches(
  (
    select branding ->> 'accent'
    from public.organizations
    where id = '00000000-0000-0000-0000-000000000001'
  ),
  '^#[0-9a-fA-F]{6}$',
  'org #1 branding.accent is a six-digit hex color'
);

-- anon resolving the org via the x-two42-org header reads exactly 1 row.
set local role anon;
reset request.jwt.claims;
select set_config('request.headers', json_build_object('x-two42-org', 'default')::text, true);
select is(
  (select count(*) from public.organizations),
  1::bigint,
  'anon with x-two42-org header reads exactly the request org row'
);

-- anon with no org header reads nothing (fail-closed).
select set_config('request.headers', '{}', true);
select is(
  (select count(*) from public.organizations),
  0::bigint,
  'anon with no org header reads no organizations (fail-closed)'
);

-- An authenticated member reads exactly their own org row.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'a0000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text,
  true
);
select is(
  (select count(*) from public.organizations),
  1::bigint,
  'authenticated member reads exactly their own org row'
);

reset role;
select * from finish();
rollback;
