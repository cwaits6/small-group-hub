-- Follow-up to 20260706000003:
--
-- 1. Tighten family_members UPDATE to primary/spouse only.
--    The previous migration covered INSERT and DELETE but left the existing
--    "Members can manage their own family members" UPDATE policy in place,
--    which allows any household member to modify rows.
--
-- 2. Scope get_profile_role / get_profile_email to the caller's household.
--    Both functions are SECURITY DEFINER and previously had no family_id
--    guard, meaning any authenticated user could call them via RPC and read
--    role/email for any profile. Scoping to current_family_id() limits
--    exposure to profiles the caller already has SELECT access to.
--    An explicit search_path is also set to prevent search-path injection.

-- ==================
-- FAMILY_MEMBERS UPDATE: replace any-member policy with leader-only
-- ==================
drop policy if exists "Members can manage their own family members" on public.family_members;

create policy "Household leaders can update own household family members"
  on public.family_members for update
  using (
    family_id = public.current_family_id()
    and public.is_member()
    and exists (
      select 1 from public.profiles self
      where self.id = auth.uid()
        and self.relationship in ('primary', 'spouse')
    )
  );

-- ==================
-- HELPERS: scope to caller's household + explicit search_path
-- ==================
create or replace function public.get_profile_role(profile_id uuid)
returns text as $$
  select role
  from public.profiles
  where id = profile_id
    and family_id = public.current_family_id();
$$ language sql security definer stable set search_path = '';

create or replace function public.get_profile_email(profile_id uuid)
returns text as $$
  select email
  from public.profiles
  where id = profile_id
    and family_id = public.current_family_id();
$$ language sql security definer stable set search_path = '';
