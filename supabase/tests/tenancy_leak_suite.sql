-- Cross-tenant leak-suite skeleton (CWA-7 / #209, Phase 0).
-- Auto-enumerates every public base table with an org_id column and
-- asserts a member of org A can never read org B's rows there. Today that's
-- just this migration's own organization_members scaffold table (the only
-- org_id-bearing table so far) — zero production tables carry org_id yet.
-- Coverage grows automatically as later CWA-7 phases add org_id + RLS to
-- production tables. organizations has no org_id column by design (it's
-- the tenant root table), so it can never be auto-discovered here — it
-- gets a direct, non-enumerated assertion below instead.
--
-- Run locally (rollback-safe, never mutates the shared local stack):
--
--   docker exec -i supabase_db_small-group-hub \
--     psql -U postgres -d postgres -f - < supabase/tests/tenancy_leak_suite.sql
--
-- Runs in CI via `supabase test db` against an ephemeral, isolated Postgres.

begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- Fixture: two throwaway users (profiles auto-created by the
-- handle_new_user trigger) each owning one org via the provisioning stub.
do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  org_a uuid;
  org_b uuid;
begin
  insert into auth.users (id, email) values
    (user_a, 'org-a-fixture@example.test'),
    (user_b, 'org-b-fixture@example.test');

  org_a := public.provision_organization('Leak Suite Org A', user_a);
  org_b := public.provision_organization('Leak Suite Org B', user_b);

  perform set_config('leak_suite.org_a', org_a::text, true);
  perform set_config('leak_suite.org_b', org_b::text, true);
  perform set_config('leak_suite.user_a', user_a::text, true);
end $$;

create temporary table tenancy_leak_results (line text) on commit drop;

do $$
declare
  org_a uuid := current_setting('leak_suite.org_a')::uuid;
  org_b uuid := current_setting('leak_suite.org_b')::uuid;
  user_a uuid := current_setting('leak_suite.user_a')::uuid;
  tables text[] := '{}';
  counts bigint[] := '{}';
  errors text[] := '{}';
  cross_count bigint;
  org_b_visible_count bigint;
  is_member_own boolean;
  is_member_other boolean;
  t text;
  i int;
begin
  select coalesce(array_agg(c.table_name::text order by c.table_name), '{}')
    into tables
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'org_id'
      and t.table_type = 'BASE TABLE';

  -- Query each table as an org A member; pgTAP bookkeeping happens after
  -- reset role, since the authenticated role cannot touch pgTAP's temp state.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', user_a)::text, true);

  foreach t in array tables loop
    begin
      execute format('select count(*) from public.%I where org_id = $1', t)
        into cross_count using org_b;
      counts := counts || cross_count;
      errors := errors || null::text;
    exception when others then
      -- Isolate per-table failures so one bad table (type mismatch, a
      -- policy that raises, etc.) doesn't abort every other table's check
      -- and leave `reset role` / pgTAP bookkeeping unreached.
      counts := counts || null::bigint;
      errors := errors || sqlerrm;
    end;
  end loop;

  -- organizations has no org_id column (see header) so it's never in
  -- `tables` above; check it directly with the same fixture.
  select count(*) into org_b_visible_count
    from public.organizations where id = org_b;

  is_member_own := public.is_org_member(org_a);
  is_member_other := public.is_org_member(org_b);

  reset role;

  if array_length(tables, 1) is null then
    insert into tenancy_leak_results
      select pass('no org_id-bearing tables yet — skeleton has nothing to enumerate (expected pre-org_id-rollout)');
  else
    for i in 1 .. array_length(tables, 1) loop
      if errors[i] is not null then
        insert into tenancy_leak_results
          select fail(format('org A member check errored on %s: %s', tables[i], errors[i]));
      else
        insert into tenancy_leak_results
          select ok(counts[i] = 0, format('org A member cannot read org B rows from %s', tables[i]));
      end if;
    end loop;
  end if;

  insert into tenancy_leak_results
    select ok(org_b_visible_count = 0, 'org A member cannot read org B''s organizations row');

  insert into tenancy_leak_results
    select ok(is_member_own, 'is_org_member() is true for org A member''s own org');
  insert into tenancy_leak_results
    select ok(not is_member_other, 'is_org_member() is false for org A member checking org B');

  insert into tenancy_leak_results
    select is(
      (select org_id from public.profiles where id = user_a),
      '00000000-0000-0000-0000-000000000001'::uuid,
      'handle_new_user() stamps new signups into the default org'
    );

  insert into tenancy_leak_results
    select ok(
      exists (
        select 1 from public.organization_members
        where org_id = '00000000-0000-0000-0000-000000000001'::uuid and profile_id = user_a
      ),
      'handle_new_user() inserts the matching organization_members row'
    );
end $$;

-- platform_admins RLS (new Phase 1 primitive): a platform admin can see
-- their own roster row; a non-admin (including a regular org member) can
-- see none. No bootstrap path exists yet to populate this table in normal
-- operation, but the policy is reachable the moment a row is seeded.
do $$
declare
  admin_user uuid := gen_random_uuid();
  plain_user uuid := gen_random_uuid();
  admin_visible_count int;
  plain_visible_count int;
begin
  insert into auth.users (id, email) values
    (admin_user, 'platform-admin-fixture@example.test'),
    (plain_user, 'plain-fixture@example.test');
  insert into public.platform_admins (profile_id) values (admin_user);

  set local role authenticated;

  perform set_config('request.jwt.claims', json_build_object('sub', admin_user)::text, true);
  select count(*) into admin_visible_count from public.platform_admins;

  perform set_config('request.jwt.claims', json_build_object('sub', plain_user)::text, true);
  select count(*) into plain_visible_count from public.platform_admins;

  reset role;

  insert into tenancy_leak_results
    select ok(admin_visible_count = 1, 'a platform admin can see platform_admins rows');
  insert into tenancy_leak_results
    select ok(plain_visible_count = 0, 'a non-admin cannot see platform_admins rows');
end $$;

select line from tenancy_leak_results;
select * from finish();
rollback;
