-- Phase 2 tenancy (CWA-9 / #211), Task 10: real provision_organization() (§6).
-- Replaces the Phase 0/1 fixture stub (_name, _owner_id) with provisioning
-- that builds a complete, usable org in one transaction — everything or
-- nothing.
--
-- Functional group names (maintainer decision, 2026-07-31, resolving plan
-- §12 open item 1): prayer_warriors / serving_team / leaders.
--
-- Owner flow (§5 contract): provisioning creates the org AND an approved
-- access_requests row for the owner's email BEFORE any auth user exists, so
-- the owner's subsequent signup resolves fail-closed through
-- handle_new_user(). A profile with that email that already belongs to
-- another org is rejected (TN004), never moved — see step 7.
--
-- Authorization: SECURITY DEFINER + search_path = '' + REVOKE from
-- public/anon/authenticated is the WHOLE story. In Phase 2 the only callers
-- are migrations, seeds, and pgTAP (all run as postgres, which bypasses
-- ACLs). Phase 4 adds the guarded self-serve entry point. Adding a GRANT
-- without a caller check re-opens PostgREST RPC to this function.

drop function public.provision_organization(text, uuid);

create function public.provision_organization(
  _name        text,
  _slug        text,
  _owner_email text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  _org_id uuid;
  _cal_id uuid;
begin
  if _slug !~ '^[a-z0-9][a-z0-9-]{1,62}$' then
    raise exception 'invalid organization slug: %', _slug using errcode = 'TN003';
  end if;

  -- 1. The org itself. branding carries only the tenant-overridable keys
  -- from #221 / docs/design/DESIGN.md: display_name, logo_url, accent.
  insert into public.organizations (name, slug, branding, status)
  values (
    _name,
    _slug,
    jsonb_build_object('display_name', _name, 'logo_url', null, 'accent', null),
    'active'
  )
  returning id into _org_id;

  -- 2. The three functional groups, keyed by functional_role (partial
  -- unique on (org_id, functional_role)). These are the groups the schema's
  -- behaviour flags require; app surfaces look them up by functional_role,
  -- never by display name.
  insert into public.member_groups
    (org_id, name, functional_role, grants_prayer_access, is_serving_role, display_order)
  values
    (_org_id, 'Prayer Warriors', 'prayer_warriors', true,  false, 0),
    (_org_id, 'Serving Team',    'serving_team',    false, true,  1),
    (_org_id, 'Leaders',         'leaders',         false, false, 2);

  -- 3. Prayer calendar, wired into settings: lib/prayerCalls.ts and
  -- app/prayer read prayer_calendar_id, and a missing value degrades the
  -- prayer surface — which is why the calendar is provisioning, not
  -- onboarding.
  insert into public.event_calendars (org_id, name, color)
  values (_org_id, 'Prayer Calls', '#7c9885')
  returning id into _cal_id;

  -- 4. Settings defaults — the full key list in one auditable place.
  -- serving_link_mode's deploy default is applied at read time by
  -- getServingLinkMode() (SERVING_LINK_MODE env); the seed row here matches
  -- the migration-seeded default. Only site_name is anon-readable (#215).
  insert into public.site_settings (org_id, key, value, is_public)
  values
    (_org_id, 'site_name',               '',            true),
    (_org_id, 'directory_app_url',       '',            false),
    (_org_id, 'weekly_zoom_url',         '',            false),
    (_org_id, 'zoom_meeting_time',       '',            false),
    (_org_id, 'weekly_prayer_call_url',  '',            false),
    (_org_id, 'weekly_prayer_call_time', '',            false),
    (_org_id, 'serving_link_mode',       'signed',      false),
    (_org_id, 'giving_manage_mode',      'stewards',    false),
    (_org_id, 'giving_dashboard_tile',   'on',          false),
    (_org_id, 'prayer_calendar_id',      _cal_id::text, false);

  -- 5. Empty about page (per-org singleton: PK is (org_id, id), id CHECKed
  -- true).
  insert into public.about_page (org_id, id, body) values (_org_id, true, '');

  -- 6. Approved access request for the owner, so their signup resolves
  -- under handle_new_user()'s fail-closed rules.
  insert into public.access_requests (org_id, name, email, status, reviewed_at)
  values (_org_id, _name || ' owner', _owner_email, 'approved', now());

  -- 7. The owner email must not already have a profile. The org created
  -- above holds no profiles yet, so ANY existing profile with this email
  -- necessarily belongs to another org — and a profile is never moved
  -- between orgs. An unscoped `update profiles set org_id = _org_id where
  -- email = ...` would be a cross-tenant write: once Phase 4 exposes a
  -- caller, passing a competing org's admin email would re-pin that admin
  -- into the caller's org — an account-takeover primitive that a "who may
  -- provision" guard does not address. Raise instead, matching
  -- handle_new_user()'s TN001/TN002: an email that already belongs
  -- elsewhere is a conflict for a human to resolve, not something to
  -- silently resolve by moving the account. The owner's profiles and
  -- organization_members rows are created by handle_new_user() when they
  -- sign up AFTER provisioning, through the approved access request above.
  if exists (
    -- Case-insensitive to match handle_new_user(): profile emails come from
    -- GoTrue lowercased, while _owner_email arrives as typed.
    select 1 from public.profiles where lower(email) = lower(_owner_email)
  ) then
    raise exception 'owner email % already belongs to another organization', _owner_email
      using errcode = 'TN004';
  end if;

  return _org_id;
end;
$$;

revoke execute on function public.provision_organization(text, text, text)
  from public, anon, authenticated;
