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
    (select auth.uid()) = id
    or (select public.is_admin())
    or (
      family_id = (select public.current_family_id())
      and role = public.get_profile_role(id)
      and (email is not distinct from public.get_profile_email(id))
    )
  );
