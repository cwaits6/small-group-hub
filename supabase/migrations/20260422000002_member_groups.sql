-- Flexible admin-defined member groups system
-- Replaces fixed is_prayer_team / is_greeter_team booleans with a user-extensible group model
-- Booleans remain as denormalized cache for performance in scheduling queries

-- ==================
-- PROFILES: add functional role booleans (denormalized cache)
-- ==================
alter table public.profiles
  add column if not exists is_prayer_team boolean not null default false,
  add column if not exists is_greeter_team boolean not null default false;

-- ==================
-- MEMBER_GROUPS TABLE
-- ==================
create table public.member_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  color text,  -- hex color code for UI chips, e.g., '#059669'
  icon text,   -- lucide icon name, e.g., 'heart', 'users', 'cross'
  display_order int not null default 0,
  -- functional_role links to a scheduling/permission feature
  -- null = purely informational group (men, women, young families, etc.)
  -- 'prayer_team' = syncs with profiles.is_prayer_team boolean
  -- 'greeter_team' = syncs with profiles.is_greeter_team boolean
  functional_role text check (functional_role in ('prayer_team', 'greeter_team')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.member_groups enable row level security;

create index member_groups_display_order_idx on public.member_groups(display_order);
create index member_groups_functional_role_idx on public.member_groups(functional_role);

-- RLS: Members can view; admins can manage
create policy "Members can view member groups"
  on public.member_groups for select
  using (public.is_member());

create policy "Admins can insert member groups"
  on public.member_groups for insert
  with check (public.is_admin());

create policy "Admins can update member groups"
  on public.member_groups for update
  using (public.is_admin());

create policy "Admins can delete member groups"
  on public.member_groups for delete
  using (public.is_admin());

-- ==================
-- PROFILE_GROUPS JOIN TABLE
-- ==================
create table public.profile_groups (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.member_groups(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (profile_id, group_id)
);

alter table public.profile_groups enable row level security;

create index profile_groups_group_id_idx on public.profile_groups(group_id);

-- RLS: Members can view; admins can manage
create policy "Members can view profile groups"
  on public.profile_groups for select
  using (public.is_member());

create policy "Admins can insert profile groups"
  on public.profile_groups for insert
  with check (public.is_admin());

create policy "Admins can delete profile groups"
  on public.profile_groups for delete
  using (public.is_admin());

-- No seed rows: groups are deployment-specific and created by admins at
-- /admin/groups. (Historical note: this migration originally seeded Prayer
-- Team and Greeter Team; the inserts were removed after this version was
-- applied to existing databases, so only fresh deployments see the change.)

-- ==================
-- BACKFILL: Create group assignments from existing is_prayer_team / is_greeter_team flags
-- ==================
-- Link all profiles with is_prayer_team=true to the Prayer Team group
do $$
declare
  _prayer_team_id uuid;
  _greeter_team_id uuid;
begin
  _prayer_team_id := (select id from public.member_groups where functional_role = 'prayer_team');
  _greeter_team_id := (select id from public.member_groups where functional_role = 'greeter_team');

  if _prayer_team_id is not null then
    insert into public.profile_groups (profile_id, group_id, assigned_at)
    select p.id, _prayer_team_id, now()
    from public.profiles p
    where p.is_prayer_team = true
    on conflict do nothing;
  end if;

  if _greeter_team_id is not null then
    insert into public.profile_groups (profile_id, group_id, assigned_at)
    select p.id, _greeter_team_id, now()
    from public.profiles p
    where p.is_greeter_team = true
    on conflict do nothing;
  end if;
end $$;

-- ==================
-- TRIGGER: keep updated_at fresh
-- ==================
create trigger member_groups_touch_updated_at
  before update on public.member_groups
  for each row execute function public.touch_updated_at();
