-- Signup + provisioning tenancy suite (CWA-9 / #211, Phase 2, §5 / §6 / §9.3).
-- Proves handle_new_user() is fail-closed (raises rather than guesses),
-- provision_organization() builds a complete org in one transaction and is
-- unreachable from PostgREST roles, the org-scoped helpers resolve per-org,
-- and the exact PostgREST upsert shape the about_page editor sends still
-- works per-org after the legacy global uniques were dropped.
--
-- Run locally (rollback-safe):
--
--   docker exec -i supabase_db_small-group-hub \
--     psql -U postgres -d postgres -f - < supabase/tests/tenancy_signup_provisioning_suite.sql

begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- ── Fixtures ────────────────────────────────────────────────────────────────
do $$
declare
  org_a uuid;
  org_b uuid;
  owner_a uuid := gen_random_uuid();
  owner_b uuid := gen_random_uuid();
begin
  org_a := public.provision_organization('Signup Suite Org A', 'signup-suite-org-a', 'su-owner-a@leak.example.test');
  org_b := public.provision_organization('Signup Suite Org B', 'signup-suite-org-b', 'su-owner-b@leak.example.test');
  insert into auth.users (id, email) values
    (owner_a, 'su-owner-a@leak.example.test'),
    (owner_b, 'su-owner-b@leak.example.test');
  perform set_config('su.org_a', org_a::text, true);
  perform set_config('su.org_b', org_b::text, true);
  perform set_config('su.owner_a', owner_a::text, true);
  perform set_config('su.owner_b', owner_b::text, true);
end $$;

-- ── provision_organization() completeness (§6) ──────────────────────────────

select is(
  (select count(*)::int from public.member_groups
    where org_id = current_setting('su.org_a')::uuid and functional_role is not null),
  3, 'provisioning creates exactly 3 functional groups');

select ok(
  (select grants_prayer_access from public.member_groups
    where org_id = current_setting('su.org_a')::uuid and functional_role = 'prayer_warriors'),
  'prayer_warriors group grants prayer access');

select ok(
  (select is_serving_role from public.member_groups
    where org_id = current_setting('su.org_a')::uuid and functional_role = 'serving_team'),
  'serving_team group is a serving role');

select ok(
  exists (select 1 from public.member_groups
    where org_id = current_setting('su.org_a')::uuid and functional_role = 'leaders'),
  'leaders group exists');

select is(
  (select value from public.site_settings
    where org_id = current_setting('su.org_a')::uuid and key = 'prayer_calendar_id'),
  (select id::text from public.event_calendars
    where org_id = current_setting('su.org_a')::uuid and name = 'Prayer Calls'),
  'prayer_calendar_id points at the provisioned prayer calendar');

select is(
  (select count(*)::int from public.site_settings
    where org_id = current_setting('su.org_a')::uuid),
  10, 'provisioning seeds the full settings-key list');

select is(
  (select count(*)::int from public.site_settings
    where org_id = current_setting('su.org_a')::uuid and is_public),
  1, 'only site_name is anon-readable among provisioned settings');

select ok(
  exists (select 1 from public.about_page
    where org_id = current_setting('su.org_a')::uuid),
  'provisioning creates the org''s about_page row');

select ok(
  exists (select 1 from public.access_requests
    where org_id = current_setting('su.org_a')::uuid
      and email = 'su-owner-a@leak.example.test' and status = 'approved'),
  'provisioning creates the approved owner access request');

select is(
  (select org_id from public.profiles
    where id = current_setting('su.owner_a')::uuid),
  current_setting('su.org_a')::uuid,
  'owner signup after provisioning resolves into the provisioned org');

-- Owner re-pin: a pre-existing profile is moved into the new org.
do $$
declare
  org_c uuid;
begin
  -- su-owner-b already has a profile pinned to org B; provisioning org C
  -- with the same owner email must re-pin them.
  org_c := public.provision_organization('Signup Suite Org C', 'signup-suite-org-c', 'su-owner-b@leak.example.test');
  perform set_config('su.org_c', org_c::text, true);
end $$;

select is(
  (select org_id from public.profiles where id = current_setting('su.owner_b')::uuid),
  current_setting('su.org_c')::uuid,
  'provisioning re-pins an existing owner profile''s org_id');

select ok(
  exists (select 1 from public.organization_members
    where org_id = current_setting('su.org_c')::uuid
      and profile_id = current_setting('su.owner_b')::uuid),
  'provisioning records the re-pinned owner''s organization membership');

-- Guardrails
select throws_ok(
  $$ select public.provision_organization('Dup Org', 'signup-suite-org-a', 'dup@leak.example.test') $$,
  '23505', null,
  'duplicate slug is rejected');

select ok(
  not exists (select 1 from public.organizations where name = 'Dup Org'),
  'the failed duplicate-slug call left no partial org behind (atomic)');

select throws_ok(
  $$ select public.provision_organization('Bad Slug Org', 'Bad_Slug!', 'bad@leak.example.test') $$,
  'TN003', null,
  'invalid slug is rejected');

-- Not callable from PostgREST roles: EXECUTE is revoked.
do $$
declare
  anon_err text := null;
  auth_err text := null;
begin
  set local role anon;
  begin
    perform public.provision_organization('Sneaky Org', 'sneaky-org', 'sneak@leak.example.test');
  exception when others then
    anon_err := sqlstate;
  end;
  reset role;
  set local role authenticated;
  begin
    perform public.provision_organization('Sneaky Org 2', 'sneaky-org-2', 'sneak2@leak.example.test');
  exception when others then
    auth_err := sqlstate;
  end;
  reset role;
  perform set_config('su.anon_err', coalesce(anon_err, 'no error'), true);
  perform set_config('su.auth_err', coalesce(auth_err, 'no error'), true);
end $$;

select is(current_setting('su.anon_err'), '42501',
  'anon cannot execute provision_organization()');
select is(current_setting('su.auth_err'), '42501',
  'authenticated cannot execute provision_organization()');

-- ── handle_new_user() fail-closed resolution (§5) ───────────────────────────

-- No approved request, no invite → rejected.
select throws_ok(
  $$ insert into auth.users (id, email)
     values (gen_random_uuid(), 'stranger@leak.example.test') $$,
  'TN001', null,
  'signup with no approved access request or invite is rejected');

-- Approved in two orgs → ambiguous, rejected.
do $$
begin
  insert into public.access_requests (org_id, name, email, status)
    values (current_setting('su.org_a')::uuid, 'both orgs', 'ambiguous@leak.example.test', 'approved'),
           (current_setting('su.org_b')::uuid, 'both orgs', 'ambiguous@leak.example.test', 'approved');
end $$;

select throws_ok(
  $$ insert into auth.users (id, email)
     values (gen_random_uuid(), 'ambiguous@leak.example.test') $$,
  'TN002', null,
  'signup matching approved invitations in two orgs is rejected as ambiguous');

-- Client-supplied raw_user_meta_data can NEVER pick the org.
do $$
declare
  u uuid := gen_random_uuid();
begin
  insert into public.access_requests (org_id, name, email, status)
    values (current_setting('su.org_a')::uuid, 'meta victim', 'user-meta@leak.example.test', 'approved');
  insert into auth.users (id, email, raw_user_meta_data)
    values (u, 'user-meta@leak.example.test',
            jsonb_build_object('org_id', current_setting('su.org_b'), 'full_name', 'Meta Victim'));
  perform set_config('su.user_meta_user', u::text, true);
end $$;

select is(
  (select org_id from public.profiles where id = current_setting('su.user_meta_user')::uuid),
  current_setting('su.org_a')::uuid,
  'raw_user_meta_data org_id is ignored — the approved request''s org wins');

-- Server-set raw_app_meta_data may disambiguate within the resolved set…
do $$
declare
  u uuid := gen_random_uuid();
begin
  -- ambiguous@ still has approved requests in A and B; app metadata picks B.
  insert into auth.users (id, email, raw_app_meta_data)
    values (u, 'ambiguous@leak.example.test',
            jsonb_build_object('org_id', current_setting('su.org_b')));
  perform set_config('su.app_meta_user', u::text, true);
end $$;

select is(
  (select org_id from public.profiles where id = current_setting('su.app_meta_user')::uuid),
  current_setting('su.org_b')::uuid,
  'raw_app_meta_data disambiguates between two legitimate matches');

-- …but can never WIDEN the set beyond it.
select throws_ok(
  $$ insert into auth.users (id, email, raw_app_meta_data)
     values (gen_random_uuid(), 'widen-attempt@leak.example.test',
             jsonb_build_object('org_id', current_setting('su.org_a'))) $$,
  'TN001', null,
  'raw_app_meta_data cannot conjure an org with no matching invitation');

-- Unclaimed family invite alone resolves the org, at role pending.
do $$
declare
  u uuid := gen_random_uuid();
  _family uuid;
  _fm uuid;
begin
  insert into public.family_units (org_id, family_name)
    values (current_setting('su.org_a')::uuid, 'invite family') returning id into _family;
  insert into public.family_members (org_id, family_id, first_name, relationship)
    values (current_setting('su.org_a')::uuid, _family, 'invitee', 'spouse') returning id into _fm;
  insert into public.family_invites (org_id, family_id, family_member_id, invite_email)
    values (current_setting('su.org_a')::uuid, _family, _fm, 'invitee@leak.example.test');
  insert into auth.users (id, email) values (u, 'invitee@leak.example.test');
  perform set_config('su.invitee', u::text, true);
end $$;

select is(
  (select org_id from public.profiles where id = current_setting('su.invitee')::uuid),
  current_setting('su.org_a')::uuid,
  'an unclaimed family invite resolves the signup''s org');

select is(
  (select role from public.profiles where id = current_setting('su.invitee')::uuid),
  'pending',
  'invite-only signup starts as pending (approval logic unchanged)');

-- ── giving_stewards_can_manage(): per-org settings, no 21000 (§4.2) ────────
do $$
declare
  a_result text := 'unset';
  b_result text := 'unset';
begin
  update public.site_settings set value = 'admins'
    where org_id = current_setting('su.org_b')::uuid and key = 'giving_manage_mode';

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', current_setting('su.owner_a'))::text, true);
  begin
    a_result := public.giving_stewards_can_manage()::text;
  exception when others then
    a_result := 'raised ' || sqlstate;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', current_setting('su.user_meta_user'))::text, true);
  begin
    -- user-meta@ landed in org A; use owner of org B instead? owner_b was
    -- re-pinned to org C, so query as the app-meta user, who is in org B.
    perform set_config('request.jwt.claims', json_build_object('sub', current_setting('su.app_meta_user'))::text, true);
    b_result := public.giving_stewards_can_manage()::text;
  exception when others then
    b_result := 'raised ' || sqlstate;
  end;
  reset role;
  perform set_config('su.giving_a', a_result, true);
  perform set_config('su.giving_b', b_result, true);
end $$;

select is(current_setting('su.giving_a'), 'true',
  'giving_stewards_can_manage() reads org A''s own value (stewards) without raising');
select is(current_setting('su.giving_b'), 'false',
  'giving_stewards_can_manage() reads org B''s own value (admins) without raising');

-- ── Org-scoped id-taking helpers (§4.1) ─────────────────────────────────────
do $$
declare
  org_a uuid := current_setting('su.org_a')::uuid;
  org_b uuid := current_setting('su.org_b')::uuid;
  owner_a uuid := current_setting('su.owner_a')::uuid;
  group_a uuid;
  group_b uuid;
  fund_b uuid;
  lead_own text; lead_other text; manage_other text;
begin
  select id into group_a from public.member_groups where org_id = org_a and functional_role = 'serving_team';
  select id into group_b from public.member_groups where org_id = org_b and functional_role = 'serving_team';
  insert into public.profile_groups (org_id, profile_id, group_id, is_leader)
    values (org_a, owner_a, group_a, true);
  insert into public.giving_funds (org_id, name, steward_id)
    values (org_b, 'B fund', current_setting('su.app_meta_user')::uuid)
    returning id into fund_b;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', owner_a)::text, true);
  lead_own := public.is_group_leader(group_a)::text;
  lead_other := public.is_group_leader(group_b)::text;
  manage_other := public.giving_can_manage_fund(fund_b)::text;
  reset role;

  perform set_config('su.lead_own', lead_own, true);
  perform set_config('su.lead_other', lead_other, true);
  perform set_config('su.manage_other', manage_other, true);
end $$;

select is(current_setting('su.lead_own'), 'true',
  'is_group_leader() is true for the caller''s own-org group');
select is(current_setting('su.lead_other'), 'false',
  'is_group_leader() is false for another org''s group id');
select is(current_setting('su.manage_other'), 'false',
  'giving_can_manage_fund() is false for another org''s fund id');

-- ── PostgREST about_page upsert shape after the legacy-unique drop (§3.5) ──
-- This is the exact statement PostgREST generates for the AboutEditor's
-- .upsert() (no on_conflict param → the PK (org_id, id) is the arbiter;
-- org_id fills from its fail-closed DEFAULT).
do $$
declare
  owner_a uuid := current_setting('su.owner_a')::uuid;
  upsert_err text := null;
begin
  update public.profiles set role = 'admin' where id = owner_a;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', owner_a)::text, true);
  begin
    insert into public.about_page (id, body, updated_by, updated_at)
    values (true, 'edited by org A', owner_a, now())
    on conflict (org_id, id) do update
      set body = excluded.body, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  exception when others then
    upsert_err := sqlstate || ': ' || sqlerrm;
  end;
  reset role;
  perform set_config('su.upsert_err', coalesce(upsert_err, 'ok'), true);
end $$;

select is(current_setting('su.upsert_err'), 'ok',
  'the PostgREST-shaped about_page upsert (PK arbiter, defaulted org_id) succeeds');

select is(
  (select body from public.about_page where org_id = current_setting('su.org_a')::uuid),
  'edited by org A',
  'the upsert updated org A''s about_page row');

select is(
  (select body from public.about_page where org_id = current_setting('su.org_b')::uuid),
  '',
  'org B''s about_page row is untouched by org A''s upsert');

select * from finish();
rollback;
