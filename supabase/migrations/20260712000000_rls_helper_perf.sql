-- RLS helper performance pass.
--
-- 1) The role-check helpers (is_admin, is_member, is_content_editor,
--    is_group_leader, giving_stewards_can_manage, giving_can_manage_fund)
--    were created with default VOLATILE volatility, so Postgres must call
--    them once per row inside RLS filters and can never hoist them into a
--    one-time filter. They only read data, so declare them STABLE and pin
--    search_path (clears the function_search_path_mutable linter warning).
--
-- 2) Even as STABLE, a bare helper call in a policy is still evaluated per
--    row (verified with EXPLAIN ANALYZE: RLS security quals are not hoisted
--    into one-time filters). Wrap every zero-argument helper call in a
--    scalar subquery so it becomes an InitPlan evaluated once per
--    statement — same treatment 20260710000001 gave auth.uid().
--    Helpers that take a column argument (is_group_leader(group_id),
--    giving_can_manage_fund(fund_id)) are inherently per-row and stay bare.

-- ---------------------------------------------------------------------------
-- Helper functions: STABLE + pinned search_path (bodies unchanged)
-- ---------------------------------------------------------------------------

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('member', 'content_editor', 'admin')
  );
$$;

create or replace function public.is_content_editor() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('content_editor', 'admin')
  );
$$;

create or replace function public.is_group_leader(_group_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profile_groups
    where profile_id = auth.uid()
      and group_id = _group_id
      and is_leader = true
  );
$$;

create or replace function public.current_family_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select family_id from public.profiles where id = auth.uid();
$$;

create or replace function public.giving_stewards_can_manage() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select value from public.site_settings where key = 'giving_manage_mode'),
    'stewards'
  ) = 'stewards';
$$;

create or replace function public.giving_can_manage_fund(_fund_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or (
    public.giving_stewards_can_manage() and exists (
      select 1 from public.giving_funds f
      where f.id = _fund_id and f.steward_id = auth.uid()
    )
  );
$$;

-- Trigger function: stays volatile (it writes), but pin search_path.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  _role text := 'pending';
  _full_name text := new.raw_user_meta_data->>'full_name';
  _first text;
  _last text;
begin
  if exists (
    select 1 from public.access_requests
    where email = new.email
      and status = 'approved'
  ) then
    _role := 'member';
  end if;

  if _full_name is not null and btrim(_full_name) <> '' then
    if position(' ' in btrim(_full_name)) = 0 then
      _first := btrim(_full_name);
      _last := null;
    else
      _first := btrim(substring(btrim(_full_name) from 1 for (length(btrim(_full_name)) - position(' ' in reverse(btrim(_full_name))))));
      _last := btrim(substring(btrim(_full_name) from (length(btrim(_full_name)) - position(' ' in reverse(btrim(_full_name))) + 2)));
    end if;
  end if;

  insert into public.profiles (id, first_name, last_name, email, role, relationship)
  values (new.id, _first, _last, new.email, _role, 'primary');
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Policies mixing helpers with column references: wrap helpers in (select ...)
-- ---------------------------------------------------------------------------

-- profiles
drop policy if exists "Profiles are visible per access rules" on public.profiles;
create policy "Profiles are visible per access rules"
  on public.profiles for select
  using (
    (select auth.uid()) = id
    or (select public.is_admin())
    or (
      family_id is not null
      and family_id = (select public.current_family_id())
      and (select auth.uid()) != id
      and (select public.is_member())
    )
    or (
      (select public.is_member())
      and is_unlisted = false
      and role in ('member', 'content_editor', 'admin')
    )
  );

drop policy if exists "Profiles are updatable per access rules" on public.profiles;
create policy "Profiles are updatable per access rules"
  on public.profiles for update
  using (
    (select auth.uid()) = id
    or (select public.is_admin())
    or (
      (select auth.uid()) != id
      and family_id is not null
      and family_id = (select public.current_family_id())
      and exists (
        select 1 from public.profiles self
        where self.id = (select auth.uid())
          and self.relationship in ('primary', 'spouse')
          and self.role in ('member', 'content_editor', 'admin')
      )
    )
  )
  with check (
    (select auth.uid()) = id
    or (select public.is_admin())
    or (
      family_id = (select public.current_family_id())
      and role = public.get_profile_role(id)
      and (email is not distinct from public.get_profile_email(id))
    )
  );

-- family_members
drop policy if exists "Admins and household leaders can insert family members" on public.family_members;
create policy "Admins and household leaders can insert family members"
  on public.family_members for insert
  with check (
    (select public.is_admin())
    or (
      family_id = (select public.current_family_id())
      and (select public.is_member())
      and exists (
        select 1 from public.profiles self
        where self.id = (select auth.uid())
          and self.relationship in ('primary', 'spouse')
      )
    )
  );

drop policy if exists "Admins and household leaders can update family members" on public.family_members;
create policy "Admins and household leaders can update family members"
  on public.family_members for update
  using (
    (select public.is_admin())
    or (
      family_id = (select public.current_family_id())
      and (select public.is_member())
      and exists (
        select 1 from public.profiles self
        where self.id = (select auth.uid())
          and self.relationship in ('primary', 'spouse')
      )
    )
  )
  with check (
    (select public.is_admin())
    or (
      family_id = (select public.current_family_id())
      and (select public.is_member())
      and exists (
        select 1 from public.profiles self
        where self.id = (select auth.uid())
          and self.relationship in ('primary', 'spouse')
      )
    )
  );

drop policy if exists "Admins and household leaders can delete family members" on public.family_members;
create policy "Admins and household leaders can delete family members"
  on public.family_members for delete
  using (
    (select public.is_admin())
    or (
      family_id = (select public.current_family_id())
      and (select public.is_member())
      and exists (
        select 1 from public.profiles self
        where self.id = (select auth.uid())
          and self.relationship in ('primary', 'spouse')
      )
    )
  );

-- family_invites
drop policy if exists "Admins and household primary can insert family invites" on public.family_invites;
create policy "Admins and household primary can insert family invites"
  on public.family_invites for insert
  with check (
    (select public.is_admin())
    or exists (
      select 1 from public.profiles self
      where self.id = (select auth.uid())
        and self.family_id = family_invites.family_id
        and self.family_id is not null
        and self.relationship = 'primary'
    )
  );

drop policy if exists "Admins and household primary can update family invites" on public.family_invites;
create policy "Admins and household primary can update family invites"
  on public.family_invites for update
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.profiles self
      where self.id = (select auth.uid())
        and self.family_id = family_invites.family_id
        and self.family_id is not null
        and self.relationship = 'primary'
    )
  )
  with check (
    (select public.is_admin())
    or exists (
      select 1 from public.profiles self
      where self.id = (select auth.uid())
        and self.family_id = family_invites.family_id
        and self.family_id is not null
        and self.relationship = 'primary'
    )
  );

-- family_units
drop policy if exists "Admins and members can update family units" on public.family_units;
create policy "Admins and members can update family units"
  on public.family_units for update
  using (
    (select public.is_admin())
    or (
      id = (select public.current_family_id())
      and (select public.is_member())
    )
  )
  with check (
    (select public.is_admin())
    or (
      id = (select public.current_family_id())
      and (select public.is_member())
    )
  );

-- giving_funds
drop policy if exists "Admins and self-stewards can create funds" on public.giving_funds;
create policy "Admins and self-stewards can create funds"
  on public.giving_funds for insert
  with check (
    created_by = (select auth.uid())
    and (
      (select public.is_admin())
      or (
        (select public.giving_stewards_can_manage())
        and (select public.is_member())
        and steward_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Admins and stewards can update funds" on public.giving_funds;
create policy "Admins and stewards can update funds"
  on public.giving_funds for update
  using (
    (select public.is_admin())
    or ((select public.giving_stewards_can_manage()) and steward_id = (select auth.uid()))
  );

drop policy if exists "Admins and stewards can delete funds" on public.giving_funds;
create policy "Admins and stewards can delete funds"
  on public.giving_funds for delete
  using (
    (select public.is_admin())
    or ((select public.giving_stewards_can_manage()) and steward_id = (select auth.uid()))
  );

-- announcements
drop policy if exists "Members and published announcements are visible" on public.announcements;
create policy "Members and published announcements are visible"
  on public.announcements for select
  using ((select public.is_member()) or is_published = true);

-- rsvps
drop policy if exists "Members and admins can insert rsvps" on public.rsvps;
create policy "Members and admins can insert rsvps"
  on public.rsvps for insert
  with check (
    ((select auth.uid()) = user_id and (select public.is_member()))
    or (select public.is_admin())
  );

drop policy if exists "Members and admins can update rsvps" on public.rsvps;
create policy "Members and admins can update rsvps"
  on public.rsvps for update
  using (
    ((select auth.uid()) = user_id and (select public.is_member()))
    or (select public.is_admin())
  )
  with check (
    ((select auth.uid()) = user_id and (select public.is_member()))
    or (select public.is_admin())
  );

drop policy if exists "Members and admins can delete rsvps" on public.rsvps;
create policy "Members and admins can delete rsvps"
  on public.rsvps for delete
  using (
    ((select auth.uid()) = user_id and (select public.is_member()))
    or (select public.is_admin())
  );

-- serving_team_settings
drop policy if exists "Leaders and admins can insert serving settings" on public.serving_team_settings;
create policy "Leaders and admins can insert serving settings"
  on public.serving_team_settings for insert
  with check ((select public.is_admin()) or public.is_group_leader(group_id));

drop policy if exists "Leaders and admins can update serving settings" on public.serving_team_settings;
create policy "Leaders and admins can update serving settings"
  on public.serving_team_settings for update
  using ((select public.is_admin()) or public.is_group_leader(group_id));

-- serving_broadcasts
drop policy if exists "Leaders and admins can view serving broadcasts" on public.serving_broadcasts;
create policy "Leaders and admins can view serving broadcasts"
  on public.serving_broadcasts for select
  using ((select public.is_admin()) or public.is_group_leader(group_id));

drop policy if exists "Leaders and admins can log serving broadcasts" on public.serving_broadcasts;
create policy "Leaders and admins can log serving broadcasts"
  on public.serving_broadcasts for insert
  with check (
    sent_by = (select auth.uid())
    and ((select public.is_admin()) or public.is_group_leader(group_id))
  );

-- serving_signups
drop policy if exists "Members can create serving signups" on public.serving_signups;
create policy "Members can create serving signups"
  on public.serving_signups for insert
  with check (
    created_by = (select auth.uid())
    and (
      (select public.is_admin())
      or public.is_group_leader(group_id)
      or exists (
        select 1 from public.profile_groups pg
        where pg.profile_id = (select auth.uid()) and pg.group_id = serving_signups.group_id
      )
    )
  );

drop policy if exists "Members can delete own serving signups" on public.serving_signups;
create policy "Members can delete own serving signups"
  on public.serving_signups for delete
  using (
    created_by = (select auth.uid())
    or (select public.is_admin())
    or public.is_group_leader(group_id)
  );

-- serving_signup_attendees
drop policy if exists "Signup owners can add attendees" on public.serving_signup_attendees;
create policy "Signup owners can add attendees"
  on public.serving_signup_attendees for insert
  with check (
    exists (
      select 1 from public.serving_signups s
      where s.id = signup_id
        and (
          s.created_by = (select auth.uid())
          or (select public.is_admin())
          or public.is_group_leader(s.group_id)
        )
    )
  );

drop policy if exists "Signup owners can remove attendees" on public.serving_signup_attendees;
create policy "Signup owners can remove attendees"
  on public.serving_signup_attendees for delete
  using (
    exists (
      select 1 from public.serving_signups s
      where s.id = signup_id
        and (
          s.created_by = (select auth.uid())
          or (select public.is_admin())
          or public.is_group_leader(s.group_id)
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Single-helper policies: same (select ...) wrap
-- ---------------------------------------------------------------------------

-- about_page
drop policy if exists "Members can read about page" on public.about_page;
create policy "Members can read about page"
  on public.about_page for select
  using ((select public.is_member()));

drop policy if exists "Editors can insert about page" on public.about_page;
create policy "Editors can insert about page"
  on public.about_page for insert
  with check ((select public.is_content_editor()));

drop policy if exists "Editors can update about page" on public.about_page;
create policy "Editors can update about page"
  on public.about_page for update
  using ((select public.is_content_editor()));

-- access_requests
drop policy if exists "Admins can view access requests" on public.access_requests;
create policy "Admins can view access requests"
  on public.access_requests for select
  using ((select public.is_admin()));

drop policy if exists "Admins can update access requests" on public.access_requests;
create policy "Admins can update access requests"
  on public.access_requests for update
  using ((select public.is_admin()));

-- announcements
drop policy if exists "Admins can insert announcements" on public.announcements;
create policy "Admins can insert announcements"
  on public.announcements for insert
  with check ((select public.is_admin()));

drop policy if exists "Admins can update announcements" on public.announcements;
create policy "Admins can update announcements"
  on public.announcements for update
  using ((select public.is_admin()));

drop policy if exists "Admins can delete announcements" on public.announcements;
create policy "Admins can delete announcements"
  on public.announcements for delete
  using ((select public.is_admin()));

-- class_teachers
drop policy if exists "Members can read class teachers" on public.class_teachers;
create policy "Members can read class teachers"
  on public.class_teachers for select
  using ((select public.is_member()));

drop policy if exists "Editors can insert class teachers" on public.class_teachers;
create policy "Editors can insert class teachers"
  on public.class_teachers for insert
  with check ((select public.is_content_editor()));

drop policy if exists "Editors can update class teachers" on public.class_teachers;
create policy "Editors can update class teachers"
  on public.class_teachers for update
  using ((select public.is_content_editor()));

drop policy if exists "Editors can delete class teachers" on public.class_teachers;
create policy "Editors can delete class teachers"
  on public.class_teachers for delete
  using ((select public.is_content_editor()));

-- event_calendars
drop policy if exists "Admins can insert event calendars" on public.event_calendars;
create policy "Admins can insert event calendars"
  on public.event_calendars for insert
  with check ((select public.is_admin()));

drop policy if exists "Admins can update event calendars" on public.event_calendars;
create policy "Admins can update event calendars"
  on public.event_calendars for update
  using ((select public.is_admin()));

drop policy if exists "Admins can delete event calendars" on public.event_calendars;
create policy "Admins can delete event calendars"
  on public.event_calendars for delete
  using ((select public.is_admin()));

-- events
drop policy if exists "Members can view all events" on public.events;
create policy "Members can view all events"
  on public.events for select
  using ((select public.is_member()));

drop policy if exists "Admins can insert events" on public.events;
create policy "Admins can insert events"
  on public.events for insert
  with check ((select public.is_admin()));

drop policy if exists "Admins can update events" on public.events;
create policy "Admins can update events"
  on public.events for update
  using ((select public.is_admin()));

drop policy if exists "Admins can delete events" on public.events;
create policy "Admins can delete events"
  on public.events for delete
  using ((select public.is_admin()));

-- family_invites
drop policy if exists "Members can view family invites" on public.family_invites;
create policy "Members can view family invites"
  on public.family_invites for select
  using ((select public.is_member()));

-- family_members
drop policy if exists "Members can view family members" on public.family_members;
create policy "Members can view family members"
  on public.family_members for select
  using ((select public.is_member()));

-- family_units
drop policy if exists "Members can view family units" on public.family_units;
create policy "Members can view family units"
  on public.family_units for select
  using ((select public.is_member()));

drop policy if exists "Admins can insert family units" on public.family_units;
create policy "Admins can insert family units"
  on public.family_units for insert
  with check ((select public.is_admin()));

drop policy if exists "Admins can delete family units" on public.family_units;
create policy "Admins can delete family units"
  on public.family_units for delete
  using ((select public.is_admin()));

-- giving_fund_methods
drop policy if exists "Members can view fund methods" on public.giving_fund_methods;
create policy "Members can view fund methods"
  on public.giving_fund_methods for select
  using ((select public.is_member()));

-- giving_funds
drop policy if exists "Members can view giving funds" on public.giving_funds;
create policy "Members can view giving funds"
  on public.giving_funds for select
  using ((select public.is_member()));

-- lecture_series
drop policy if exists "Admins can insert series" on public.lecture_series;
create policy "Admins can insert series"
  on public.lecture_series for insert
  with check ((select public.is_admin()));

drop policy if exists "Admins can update series" on public.lecture_series;
create policy "Admins can update series"
  on public.lecture_series for update
  using ((select public.is_admin()));

drop policy if exists "Admins can delete series" on public.lecture_series;
create policy "Admins can delete series"
  on public.lecture_series for delete
  using ((select public.is_admin()));

-- lectures
drop policy if exists "Admins can insert lectures" on public.lectures;
create policy "Admins can insert lectures"
  on public.lectures for insert
  with check ((select public.is_admin()));

drop policy if exists "Admins can update lectures" on public.lectures;
create policy "Admins can update lectures"
  on public.lectures for update
  using ((select public.is_admin()));

drop policy if exists "Admins can delete lectures" on public.lectures;
create policy "Admins can delete lectures"
  on public.lectures for delete
  using ((select public.is_admin()));

-- member_groups
drop policy if exists "Members can view member groups" on public.member_groups;
create policy "Members can view member groups"
  on public.member_groups for select
  using ((select public.is_member()));

drop policy if exists "Admins can insert member groups" on public.member_groups;
create policy "Admins can insert member groups"
  on public.member_groups for insert
  with check ((select public.is_admin()));

drop policy if exists "Admins can update member groups" on public.member_groups;
create policy "Admins can update member groups"
  on public.member_groups for update
  using ((select public.is_admin()));

drop policy if exists "Admins can delete member groups" on public.member_groups;
create policy "Admins can delete member groups"
  on public.member_groups for delete
  using ((select public.is_admin()));

-- page_content
drop policy if exists "Editors can insert page content" on public.page_content;
create policy "Editors can insert page content"
  on public.page_content for insert
  with check ((select public.is_content_editor()));

drop policy if exists "Editors can update page content" on public.page_content;
create policy "Editors can update page content"
  on public.page_content for update
  using ((select public.is_content_editor()));

drop policy if exists "Admins can delete page content" on public.page_content;
create policy "Admins can delete page content"
  on public.page_content for delete
  using ((select public.is_admin()));

-- profile_groups
drop policy if exists "Members can view profile groups" on public.profile_groups;
create policy "Members can view profile groups"
  on public.profile_groups for select
  using ((select public.is_member()));

drop policy if exists "Admins can insert profile groups" on public.profile_groups;
create policy "Admins can insert profile groups"
  on public.profile_groups for insert
  with check ((select public.is_admin()));

drop policy if exists "Admins can update profile groups" on public.profile_groups;
create policy "Admins can update profile groups"
  on public.profile_groups for update
  using ((select public.is_admin()));

drop policy if exists "Admins can delete profile groups" on public.profile_groups;
create policy "Admins can delete profile groups"
  on public.profile_groups for delete
  using ((select public.is_admin()));

-- rsvps
drop policy if exists "Members and admins can view rsvps" on public.rsvps;
create policy "Members and admins can view rsvps"
  on public.rsvps for select
  using ((select public.is_member()) or (select public.is_admin()));

-- serving_signup_attendees
drop policy if exists "Members can view serving attendees" on public.serving_signup_attendees;
create policy "Members can view serving attendees"
  on public.serving_signup_attendees for select
  using ((select public.is_member()));

-- serving_signups
drop policy if exists "Members can view serving signups" on public.serving_signups;
create policy "Members can view serving signups"
  on public.serving_signups for select
  using ((select public.is_member()));

-- serving_team_settings
drop policy if exists "Members can view serving settings" on public.serving_team_settings;
create policy "Members can view serving settings"
  on public.serving_team_settings for select
  using ((select public.is_member()));

drop policy if exists "Admins can delete serving settings" on public.serving_team_settings;
create policy "Admins can delete serving settings"
  on public.serving_team_settings for delete
  using ((select public.is_admin()));

-- site_settings
drop policy if exists "Admins can update settings" on public.site_settings;
create policy "Admins can update settings"
  on public.site_settings for update
  using ((select public.is_admin()));
