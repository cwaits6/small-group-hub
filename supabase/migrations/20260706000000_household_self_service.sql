-- Household self-service: allow household members to manage their own data.
-- Also fixes is_member() to include content_editor role.

-- ==================
-- FIX: is_member() now includes content_editor
-- content_editors are part of the community and should see the directory.
-- ==================
create or replace function public.is_member()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('member', 'content_editor', 'admin')
  );
$$ language sql security definer;

-- ==================
-- HELPER: security-definer function to get current user's family_id.
-- Used in RLS policies to avoid circular self-references on the profiles table.
-- ==================
create or replace function public.current_family_id()
returns uuid as $$
  select family_id from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- ==================
-- FAMILY_UNITS: household members can update their own family record
-- (address, phone, anniversary, family name, privacy flags)
-- ==================
create policy "Members can update own family unit"
  on public.family_units for update
  using (
    id = public.current_family_id()
    and public.is_member()
  );

-- ==================
-- FAMILY_MEMBERS: household members can add and remove non-auth members
-- (children, non-attending spouses, etc.)
-- An UPDATE policy already exists from the family_members migration.
-- ==================
create policy "Members can insert own household family members"
  on public.family_members for insert
  with check (
    family_id = public.current_family_id()
    and public.is_member()
  );

create policy "Members can delete own household family members"
  on public.family_members for delete
  using (
    family_id = public.current_family_id()
    and public.is_member()
  );

-- ==================
-- PROFILES: household primaries/spouses can update each other's profiles.
-- Covers editing a spouse's contact info, address, birthday, etc.
-- Does NOT allow changing roles, family assignment, or email (app enforces these).
-- ==================
create policy "Household leaders can update household member profiles"
  on public.profiles for update
  using (
    -- Not editing their own profile (own profile handled by existing policy)
    auth.uid() != id
    -- Both must be in the same non-null household
    and family_id is not null
    and family_id = public.current_family_id()
    -- Viewer must be primary or spouse relationship
    and exists (
      select 1 from public.profiles self
      where self.id = auth.uid()
        and self.relationship in ('primary', 'spouse')
        and self.role in ('member', 'content_editor', 'admin')
    )
  );

-- ==================
-- PROFILES SELECT: household members can view each other's full profiles
-- (needed for the household management page to load household members' data)
-- ==================
create policy "Household members can view each other's full profiles"
  on public.profiles for select
  using (
    family_id is not null
    and family_id = public.current_family_id()
    and auth.uid() != id
    and public.is_member()
  );
