-- Tighten RLS so it matches what the API routes enforce:
--
-- 1. family_members INSERT/DELETE restricted to primary/spouse
--    The original migration allowed any is_member() in the same household.
--    Since the API routes now require primary/spouse, the DB policy should
--    match so direct API calls can't bypass the restriction.
--
-- 2. profiles UPDATE WITH CHECK extended to block role and email changes.
--    The previous WITH CHECK only ensured family_id stayed in the current
--    household. A crafted direct call could still change role or email.
--    New helper functions (security definer) let the WITH CHECK read the
--    current values without RLS recursion.

-- ==================
-- FAMILY_MEMBERS: tighten to primary/spouse only
-- ==================
drop policy if exists "Members can insert own household family members" on public.family_members;
drop policy if exists "Members can delete own household family members" on public.family_members;

create policy "Household leaders can insert own household family members"
  on public.family_members for insert
  with check (
    family_id = public.current_family_id()
    and public.is_member()
    and exists (
      select 1 from public.profiles self
      where self.id = auth.uid()
        and self.relationship in ('primary', 'spouse')
    )
  );

create policy "Household leaders can delete own household family members"
  on public.family_members for delete
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
-- HELPERS: security-definer lookups for stable column values.
-- Used by the profiles UPDATE WITH CHECK to compare new vs old without
-- causing RLS recursion (the definer runs as the function owner, bypassing
-- row-level security on the profiles table).
-- ==================
create or replace function public.get_profile_role(profile_id uuid)
returns text as $$
  select role from public.profiles where id = profile_id;
$$ language sql security definer stable;

create or replace function public.get_profile_email(profile_id uuid)
returns text as $$
  select email from public.profiles where id = profile_id;
$$ language sql security definer stable;

-- ==================
-- PROFILES UPDATE: extend WITH CHECK to block role and email changes.
-- relationship is intentionally left unrestricted — the household role picker
-- uses this policy to update it.
-- ==================
drop policy if exists "Household leaders can update household member profiles" on public.profiles;

create policy "Household leaders can update household member profiles"
  on public.profiles for update
  using (
    auth.uid() != id
    and family_id is not null
    and family_id = public.current_family_id()
    and exists (
      select 1 from public.profiles self
      where self.id = auth.uid()
        and self.relationship in ('primary', 'spouse')
        and self.role in ('member', 'content_editor', 'admin')
    )
  )
  with check (
    -- Must remain in the current household
    family_id = public.current_family_id()
    -- role cannot be changed (prevents privilege escalation)
    and role = public.get_profile_role(id)
    -- email cannot be changed (prevents account hijack via redirected notifications)
    and (email is not distinct from public.get_profile_email(id))
  );
