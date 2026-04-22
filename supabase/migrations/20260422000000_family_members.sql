-- Family members: lightweight records for children, spouses, parents, etc. without auth accounts
-- Supports family household structure and optional invite-to-join flow

-- ==================
-- FAMILY_MEMBERS TABLE
-- ==================
create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.family_units(id) on delete cascade,
  first_name text not null,
  last_name text,
  preferred_name text,
  birth_month smallint check (birth_month between 1 and 12),
  birth_day smallint check (birth_day between 1 and 31),
  birth_year smallint check (birth_year between 1900 and 2100),
  relationship text not null check (relationship in ('primary', 'spouse', 'child', 'parent', 'sibling', 'other')),
  avatar_url text,
  -- whether they attend the class (false = family member not in class roster)
  is_class_member boolean not null default false,
  -- if they later create an account, link it here
  claimed_profile_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.family_members enable row level security;

create index family_members_family_id_idx on public.family_members(family_id);
create index family_members_claimed_profile_idx on public.family_members(claimed_profile_id);

-- RLS: Members can view all family members (privacy handled at view level)
create policy "Members can view family members"
  on public.family_members for select
  using (public.is_member());

-- Admins can insert/update/delete
create policy "Admins can insert family members"
  on public.family_members for insert
  with check (public.is_admin());

create policy "Admins can update family members"
  on public.family_members for update
  using (public.is_admin());

create policy "Admins can delete family members"
  on public.family_members for delete
  using (public.is_admin());

-- Members can manage family members within their own household
create policy "Members can manage their own family members"
  on public.family_members for update
  using (
    public.is_member()
    and family_id in (
      select family_id from public.profiles
      where id = auth.uid()
    )
  );

-- ==================
-- TRIGGER: keep updated_at fresh
-- ==================
create trigger family_members_touch_updated_at
  before update on public.family_members
  for each row execute function public.touch_updated_at();
