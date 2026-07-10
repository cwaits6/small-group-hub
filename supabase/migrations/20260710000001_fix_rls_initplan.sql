-- Fix auth_rls_initplan warnings by wrapping auth.uid() in scalar subqueries.
-- This lets Postgres evaluate the current user once per statement instead of
-- once per row while preserving the same RLS semantics.

-- profiles
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using ((select auth.uid()) = id);

drop policy if exists "Household members can view each other's full profiles" on public.profiles;
create policy "Household members can view each other's full profiles"
  on public.profiles for select
  using (
    family_id is not null
    and family_id = public.current_family_id()
    and (select auth.uid()) != id
    and public.is_member()
  );

drop policy if exists "Household leaders can update household member profiles" on public.profiles;
create policy "Household leaders can update household member profiles"
  on public.profiles for update
  using (
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
  with check (
    family_id = public.current_family_id()
    and role = public.get_profile_role(id)
    and (email is not distinct from public.get_profile_email(id))
  );

-- rsvps
drop policy if exists "Members can insert own rsvp" on public.rsvps;
create policy "Members can insert own rsvp"
  on public.rsvps for insert
  with check ((select auth.uid()) = user_id and public.is_member());

drop policy if exists "Members can update own rsvp" on public.rsvps;
create policy "Members can update own rsvp"
  on public.rsvps for update
  using ((select auth.uid()) = user_id and public.is_member());

drop policy if exists "Members can delete own rsvp" on public.rsvps;
create policy "Members can delete own rsvp"
  on public.rsvps for delete
  using ((select auth.uid()) = user_id and public.is_member());

-- calendar_subscription_tokens
drop policy if exists "Members can view own subscription token" on public.calendar_subscription_tokens;
create policy "Members can view own subscription token"
  on public.calendar_subscription_tokens for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Members can create own subscription token" on public.calendar_subscription_tokens;
create policy "Members can create own subscription token"
  on public.calendar_subscription_tokens for insert
  with check ((select auth.uid()) = user_id);

-- family_invites
drop policy if exists "Household primary can insert family invites" on public.family_invites;
create policy "Household primary can insert family invites"
  on public.family_invites for insert
  with check (
    public.is_member()
    and family_id in (
      select family_id from public.profiles
      where id = (select auth.uid())
        and family_id is not null
    )
  );

drop policy if exists "Household primary can update family invites" on public.family_invites;
create policy "Household primary can update family invites"
  on public.family_invites for update
  using (
    public.is_member()
    and family_id in (
      select family_id from public.profiles
      where id = (select auth.uid())
        and family_id is not null
    )
  );

-- family_members
drop policy if exists "Household leaders can insert own household family members" on public.family_members;
create policy "Household leaders can insert own household family members"
  on public.family_members for insert
  with check (
    family_id = public.current_family_id()
    and public.is_member()
    and exists (
      select 1 from public.profiles self
      where self.id = (select auth.uid())
        and self.relationship in ('primary', 'spouse')
    )
  );

drop policy if exists "Household leaders can update own household family members" on public.family_members;
create policy "Household leaders can update own household family members"
  on public.family_members for update
  using (
    family_id = public.current_family_id()
    and public.is_member()
    and exists (
      select 1 from public.profiles self
      where self.id = (select auth.uid())
        and self.relationship in ('primary', 'spouse')
    )
  );

drop policy if exists "Household leaders can delete own household family members" on public.family_members;
create policy "Household leaders can delete own household family members"
  on public.family_members for delete
  using (
    family_id = public.current_family_id()
    and public.is_member()
    and exists (
      select 1 from public.profiles self
      where self.id = (select auth.uid())
        and self.relationship in ('primary', 'spouse')
    )
  );

-- serving_signups
drop policy if exists "Members can create serving signups" on public.serving_signups;
create policy "Members can create serving signups"
  on public.serving_signups for insert
  with check (
    created_by = (select auth.uid())
    and (
      public.is_admin()
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
    or public.is_admin()
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
          or public.is_admin()
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
          or public.is_admin()
          or public.is_group_leader(s.group_id)
        )
    )
  );

-- serving_broadcasts
drop policy if exists "Leaders and admins can log serving broadcasts" on public.serving_broadcasts;
create policy "Leaders and admins can log serving broadcasts"
  on public.serving_broadcasts for insert
  with check (
    sent_by = (select auth.uid())
    and (public.is_admin() or public.is_group_leader(group_id))
  );

-- giving_funds
drop policy if exists "Admins and self-stewards can create funds" on public.giving_funds;
create policy "Admins and self-stewards can create funds"
  on public.giving_funds for insert
  with check (
    created_by = (select auth.uid())
    and (
      public.is_admin()
      or (
        public.giving_stewards_can_manage()
        and public.is_member()
        and steward_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Admins and stewards can update funds" on public.giving_funds;
create policy "Admins and stewards can update funds"
  on public.giving_funds for update
  using (
    public.is_admin()
    or (public.giving_stewards_can_manage() and steward_id = (select auth.uid()))
  );

drop policy if exists "Admins and stewards can delete funds" on public.giving_funds;
create policy "Admins and stewards can delete funds"
  on public.giving_funds for delete
  using (
    public.is_admin()
    or (public.giving_stewards_can_manage() and steward_id = (select auth.uid()))
  );

-- prayer_requests
drop policy if exists "Members can view visible prayer requests" on public.prayer_requests;
create policy "Members can view visible prayer requests"
  on public.prayer_requests for select
  using (
    (select public.is_member())
    and (
      author_id = (select auth.uid())
      or not visible_to_warriors
      or (visible_to_warriors and (select public.is_prayer_warrior()))
    )
  );

drop policy if exists "Members can post own prayer requests" on public.prayer_requests;
create policy "Members can post own prayer requests"
  on public.prayer_requests for insert
  with check ((select public.is_member()) and author_id = (select auth.uid()));

drop policy if exists "Posters and admins can update prayer requests" on public.prayer_requests;
create policy "Posters and admins can update prayer requests"
  on public.prayer_requests for update
  using (author_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "Posters and admins can delete prayer requests" on public.prayer_requests;
create policy "Posters and admins can delete prayer requests"
  on public.prayer_requests for delete
  using (author_id = (select auth.uid()) or (select public.is_admin()));

-- prayer_responses
drop policy if exists "Members can pray for visible requests" on public.prayer_responses;
create policy "Members can pray for visible requests"
  on public.prayer_responses for insert
  with check (
    (select public.is_member())
    and profile_id = (select auth.uid())
    and exists (select 1 from public.prayer_requests r where r.id = request_id)
  );

drop policy if exists "Members can withdraw own prayer responses" on public.prayer_responses;
create policy "Members can withdraw own prayer responses"
  on public.prayer_responses for delete
  using (profile_id = (select auth.uid()));
