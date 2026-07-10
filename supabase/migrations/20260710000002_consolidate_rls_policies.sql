-- Consolidate overlapping permissive RLS policies for the same table/action.
-- Multiple permissive policies are OR-combined by Postgres; these policies
-- make that OR explicit so each action evaluates one policy instead of many.

-- announcements SELECT
drop policy if exists "Members can view all announcements" on public.announcements;
drop policy if exists "Published announcements visible to all" on public.announcements;

create policy "Members and published announcements are visible"
  on public.announcements for select
  using (public.is_member() or is_published = true);

-- family_invites INSERT/UPDATE
drop policy if exists "Admins can insert family invites" on public.family_invites;
drop policy if exists "Household primary can insert family invites" on public.family_invites;

create policy "Admins and household primary can insert family invites"
  on public.family_invites for insert
  with check (
    public.is_admin()
    or exists (
      select 1 from public.profiles self
      where self.id = (select auth.uid())
        and self.family_id = family_invites.family_id
        and self.family_id is not null
        and self.relationship = 'primary'
    )
  );

drop policy if exists "Admins can update family invites" on public.family_invites;
drop policy if exists "Household primary can update family invites" on public.family_invites;

create policy "Admins and household primary can update family invites"
  on public.family_invites for update
  using (
    public.is_admin()
    or exists (
      select 1 from public.profiles self
      where self.id = (select auth.uid())
        and self.family_id = family_invites.family_id
        and self.family_id is not null
        and self.relationship = 'primary'
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.profiles self
      where self.id = (select auth.uid())
        and self.family_id = family_invites.family_id
        and self.family_id is not null
        and self.relationship = 'primary'
    )
  );

-- family_members INSERT/UPDATE/DELETE
drop policy if exists "Admins can insert family members" on public.family_members;
drop policy if exists "Household leaders can insert own household family members" on public.family_members;

create policy "Admins and household leaders can insert family members"
  on public.family_members for insert
  with check (
    public.is_admin()
    or (
      family_id = public.current_family_id()
      and public.is_member()
      and exists (
        select 1 from public.profiles self
        where self.id = (select auth.uid())
          and self.relationship in ('primary', 'spouse')
      )
    )
  );

drop policy if exists "Admins can update family members" on public.family_members;
drop policy if exists "Household leaders can update own household family members" on public.family_members;

create policy "Admins and household leaders can update family members"
  on public.family_members for update
  using (
    public.is_admin()
    or (
      family_id = public.current_family_id()
      and public.is_member()
      and exists (
        select 1 from public.profiles self
        where self.id = (select auth.uid())
          and self.relationship in ('primary', 'spouse')
      )
    )
  )
  with check (
    public.is_admin()
    or (
      family_id = public.current_family_id()
      and public.is_member()
      and exists (
        select 1 from public.profiles self
        where self.id = (select auth.uid())
          and self.relationship in ('primary', 'spouse')
      )
    )
  );

drop policy if exists "Admins can delete family members" on public.family_members;
drop policy if exists "Household leaders can delete own household family members" on public.family_members;

create policy "Admins and household leaders can delete family members"
  on public.family_members for delete
  using (
    public.is_admin()
    or (
      family_id = public.current_family_id()
      and public.is_member()
      and exists (
        select 1 from public.profiles self
        where self.id = (select auth.uid())
          and self.relationship in ('primary', 'spouse')
      )
    )
  );

-- family_units UPDATE
drop policy if exists "Admins can update family units" on public.family_units;
drop policy if exists "Members can update own family unit" on public.family_units;

create policy "Admins and members can update family units"
  on public.family_units for update
  using (
    public.is_admin()
    or (
      id = public.current_family_id()
      and public.is_member()
    )
  )
  with check (
    public.is_admin()
    or (
      id = public.current_family_id()
      and public.is_member()
    )
  );

-- profiles SELECT
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Household members can view each other's full profiles" on public.profiles;
drop policy if exists "Members can view directory profiles" on public.profiles;

create policy "Profiles are visible per access rules"
  on public.profiles for select
  using (
    (select auth.uid()) = id
    or public.is_admin()
    or (
      family_id is not null
      and family_id = public.current_family_id()
      and (select auth.uid()) != id
      and public.is_member()
    )
    or (
      public.is_member()
      and is_unlisted = false
      and role in ('member', 'content_editor', 'admin')
    )
  );

-- profiles UPDATE
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins can update profiles" on public.profiles;
drop policy if exists "Household leaders can update household member profiles" on public.profiles;

create policy "Profiles are updatable per access rules"
  on public.profiles for update
  using (
    (select auth.uid()) = id
    or public.is_admin()
    or (
      (select auth.uid()) != id
      and family_id is not null
      and family_id = public.current_family_id()
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
    or public.is_admin()
    or (
      family_id = public.current_family_id()
      and role = public.get_profile_role(id)
      and (email is not distinct from public.get_profile_email(id))
    )
  );

-- rsvps SELECT/INSERT/UPDATE/DELETE
drop policy if exists "Members can view rsvps" on public.rsvps;
drop policy if exists "Members can insert own rsvp" on public.rsvps;
drop policy if exists "Members can update own rsvp" on public.rsvps;
drop policy if exists "Members can delete own rsvp" on public.rsvps;
drop policy if exists "Admins full access rsvps" on public.rsvps;

create policy "Members and admins can view rsvps"
  on public.rsvps for select
  using (public.is_member() or public.is_admin());

create policy "Members and admins can insert rsvps"
  on public.rsvps for insert
  with check (
    ((select auth.uid()) = user_id and public.is_member())
    or public.is_admin()
  );

create policy "Members and admins can update rsvps"
  on public.rsvps for update
  using (
    ((select auth.uid()) = user_id and public.is_member())
    or public.is_admin()
  )
  with check (
    ((select auth.uid()) = user_id and public.is_member())
    or public.is_admin()
  );

create policy "Members and admins can delete rsvps"
  on public.rsvps for delete
  using (
    ((select auth.uid()) = user_id and public.is_member())
    or public.is_admin()
  );
