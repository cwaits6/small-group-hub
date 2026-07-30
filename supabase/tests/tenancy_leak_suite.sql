-- Cross-tenant leak-suite skeleton (CWA-7 / #209, Phase 0).
-- Auto-enumerates every public base table with an org_id column and
-- asserts a member of org A can never read org B's rows there. Zero
-- production tables carry org_id yet, so this suite currently proves the
-- mechanism against nothing and passes vacuously — it will automatically
-- gain real coverage as later CWA-7 phases add org_id + RLS per table.
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
  org_b uuid := current_setting('leak_suite.org_b')::uuid;
  user_a uuid := current_setting('leak_suite.user_a')::uuid;
  tables text[] := '{}';
  counts bigint[] := '{}';
  cross_count bigint;
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
    execute format('select count(*) from public.%I where org_id = $1', t)
      into cross_count using org_b;
    counts := counts || cross_count;
  end loop;

  reset role;

  if array_length(tables, 1) is null then
    insert into tenancy_leak_results
      select pass('no org_id-bearing tables yet — skeleton has nothing to enumerate (expected pre-org_id-rollout)');
  else
    for i in 1 .. array_length(tables, 1) loop
      insert into tenancy_leak_results
        select ok(counts[i] = 0, format('org A member cannot read org B rows from %s', tables[i]));
    end loop;
  end if;
end $$;

select line from tenancy_leak_results;
select * from finish();
rollback;
