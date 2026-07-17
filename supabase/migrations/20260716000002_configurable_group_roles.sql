-- Deployment-configurable group roles.
--
-- member_groups.functional_role hardwired specific seeded groups
-- ('prayer_team', 'greeter_team', 'prayer_warriors') to app features. Only
-- 'prayer_warriors' was ever consumed (the prayer wall RLS reads the
-- denormalized profiles.is_prayer_warrior flag); the other two booleans were
-- dead. Replace the enum with a grants_prayer_access capability flag that an
-- admin can put on any group, so each deployment designates its own prayer
-- group instead of depending on a seeded name.
--
-- profiles.is_prayer_warrior stays as a denormalized flag because the
-- prayer_requests RLS helper (public.is_prayer_warrior) reads it per request;
-- triggers below now own keeping it in sync (app code no longer writes it).

-- ==================
-- CAPABILITY FLAG
-- ==================
alter table public.member_groups
  add column grants_prayer_access boolean not null default false;

update public.member_groups
  set grants_prayer_access = true
  where functional_role = 'prayer_warriors';

-- ==================
-- DROP THE HARDCODED ROLE ENUM + DEAD PROFILE BOOLEANS
-- ==================
drop index if exists public.member_groups_functional_role_idx;

alter table public.member_groups
  drop column functional_role;

alter table public.profiles
  drop column is_prayer_team,
  drop column is_greeter_team;

-- ==================
-- TRIGGERS: keep profiles.is_prayer_warrior in sync with group membership
-- ==================
-- Membership changes: recompute the one affected profile. A profile is a
-- prayer warrior when it belongs to at least one group granting access, so
-- removal from one granting group doesn't clear the flag if another remains.
create or replace function public.sync_prayer_access_for_profile()
returns trigger as $$
declare
  _profile_id uuid := coalesce(new.profile_id, old.profile_id);
begin
  update public.profiles
  set is_prayer_warrior = exists (
    select 1
    from public.profile_groups pg
    join public.member_groups g on g.id = pg.group_id
    where pg.profile_id = _profile_id
      and g.grants_prayer_access
  )
  where id = _profile_id;
  return null;
end;
$$ language plpgsql security definer set search_path = '';

-- Deleting a granting group is covered too: the profile_groups rows go away
-- via on delete cascade, which fires this row trigger for each member.
create trigger profile_groups_sync_prayer_access
  after insert or delete on public.profile_groups
  for each row execute function public.sync_prayer_access_for_profile();

-- Flag toggled on an existing group: recompute everyone currently in it.
create or replace function public.sync_prayer_access_for_group()
returns trigger as $$
begin
  update public.profiles p
  set is_prayer_warrior = exists (
    select 1
    from public.profile_groups pg
    join public.member_groups g on g.id = pg.group_id
    where pg.profile_id = p.id
      and g.grants_prayer_access
  )
  where p.id in (
    select profile_id from public.profile_groups where group_id = new.id
  );
  return null;
end;
$$ language plpgsql security definer set search_path = '';

create trigger member_groups_sync_prayer_access
  after update of grants_prayer_access on public.member_groups
  for each row
  when (old.grants_prayer_access is distinct from new.grants_prayer_access)
  execute function public.sync_prayer_access_for_group();

-- ==================
-- BACKFILL: one-time recompute to correct any drift from the manual-sync era
-- ==================
update public.profiles p
set is_prayer_warrior = exists (
  select 1
  from public.profile_groups pg
  join public.member_groups g on g.id = pg.group_id
  where pg.profile_id = p.id
    and g.grants_prayer_access
)
where p.is_prayer_warrior is distinct from exists (
  select 1
  from public.profile_groups pg
  join public.member_groups g on g.id = pg.group_id
  where pg.profile_id = p.id
    and g.grants_prayer_access
);
