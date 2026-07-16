-- ============================================================
-- Fix: profiles UPDATE policy self-reference recursion
-- ============================================================
-- "Profiles are updatable per access rules" referenced public.profiles
-- directly in an EXISTS subquery. A policy that references its own table
-- recurses when Postgres applies it, so every non-admin profile UPDATE
-- failed with:
--   42P17: infinite recursion detected in policy for relation "profiles"
-- Move the household-manager check into a SECURITY DEFINER helper (same
-- pattern as is_admin/is_member) so the policy no longer self-references.

create or replace function public.is_household_manager() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and relationship in ('primary', 'spouse')
      and role in ('member', 'content_editor', 'admin')
  );
$$;

-- Own-row lookups for the self-update branch. get_profile_role/email are
-- household-scoped (family_id = current_family_id()) so they return null
-- for profiles without a family — e.g. during the setup wizard. These read
-- the caller's own row unconditionally.
create or replace function public.get_own_role() returns text
language sql stable security definer set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.get_own_email() returns text
language sql stable security definer set search_path = ''
as $$
  select email from public.profiles where id = auth.uid();
$$;

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
      and (select public.is_household_manager())
    )
  )
  with check (
    (
      -- Self-updates cannot change role (privilege escalation) or email
      -- (login identity — kept in sync from auth.users by trigger).
      -- family_id and relationship stay self-editable: the setup wizard
      -- sets one's own family and the household picker sets relationship.
      (select auth.uid()) = id
      and role = (select public.get_own_role())
      and (email is not distinct from (select public.get_own_email()))
    )
    or (select public.is_admin())
    or (
      family_id = (select public.current_family_id())
      and role = public.get_profile_role(id)
      and (email is not distinct from public.get_profile_email(id))
    )
  );
