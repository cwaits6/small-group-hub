-- Member directory: family_units table + expanded profile fields + privacy flags
-- Modeled after Instant Church Directory's contact data model.

-- ==================
-- FAMILY UNITS
-- ==================
create table public.family_units (
  id uuid primary key default gen_random_uuid(),
  family_name text not null,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  phone_home text,
  -- family-level privacy flags
  hide_address boolean not null default false,
  hide_phone_home boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.family_units enable row level security;

-- Members can view all family units (privacy handled at field level in queries)
create policy "Members can view family units"
  on public.family_units for select
  using (public.is_member());

-- Admins can insert/update/delete family units
create policy "Admins can insert family units"
  on public.family_units for insert
  with check (public.is_admin());

create policy "Admins can update family units"
  on public.family_units for update
  using (public.is_admin());

create policy "Admins can delete family units"
  on public.family_units for delete
  using (public.is_admin());

-- ==================
-- PROFILES EXPANSION
-- ==================
alter table public.profiles
  add column first_name text,
  add column last_name text,
  add column preferred_name text,
  add column avatar_url text,
  add column email text,
  add column phone_mobile text,
  add column phone_home text,
  add column phone_work text,
  -- individual address (overrides family if set)
  add column address_line1 text,
  add column address_line2 text,
  add column city text,
  add column state text,
  add column postal_code text,
  -- birthday: year optional for privacy
  add column birth_month smallint check (birth_month between 1 and 12),
  add column birth_day smallint check (birth_day between 1 and 31),
  add column birth_year smallint check (birth_year between 1900 and 2100),
  add column anniversary date,
  add column occupation text,
  add column employer text,
  add column family_id uuid references public.family_units(id) on delete set null,
  -- privacy flags
  add column is_unlisted boolean not null default false,
  add column hide_phone_mobile boolean not null default false,
  add column hide_phone_home boolean not null default false,
  add column hide_phone_work boolean not null default false,
  add column hide_email boolean not null default false,
  add column hide_address boolean not null default false,
  add column hide_birthday boolean not null default false,
  add column hide_anniversary boolean not null default false,
  add column hide_occupation boolean not null default false,
  add column updated_at timestamptz not null default now();

create index profiles_family_id_idx on public.profiles(family_id);
create index profiles_last_first_idx on public.profiles(last_name, first_name);

-- ==================
-- BACKFILL: split existing full_name into first/last (best effort)
-- ==================
-- Everything before the last space → first_name; last token → last_name.
-- Single-token names go into first_name only.
update public.profiles
set
  first_name = case
    when full_name is null or btrim(full_name) = '' then null
    when position(' ' in btrim(full_name)) = 0 then btrim(full_name)
    else btrim(substring(btrim(full_name) from 1 for (length(btrim(full_name)) - position(' ' in reverse(btrim(full_name))))))
  end,
  last_name = case
    when full_name is null or btrim(full_name) = '' then null
    when position(' ' in btrim(full_name)) = 0 then null
    else btrim(substring(btrim(full_name) from (length(btrim(full_name)) - position(' ' in reverse(btrim(full_name))) + 2)))
  end
where first_name is null and last_name is null;

-- Backfill email from auth.users for existing profiles
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

-- Drop the legacy full_name column — full names are now derived from
-- first_name + last_name at the application layer (see lib/names.ts).
alter table public.profiles drop column full_name;

-- ==================
-- UPDATE handle_new_user to populate new directory fields
-- ==================
-- New signups get email + best-effort first/last split populated up-front so
-- the directory doesn't show "(unnamed)" for new members. full_name is no
-- longer stored — it's composed from first_name + last_name at display time.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  _role text := 'pending';
  _full_name text := new.raw_user_meta_data->>'full_name';
  _first text;
  _last text;
begin
  if exists (
    select 1 from public.access_requests
    where email = new.email
      and status = 'approved'
  ) then
    _role := 'member';
  end if;

  if _full_name is not null and btrim(_full_name) <> '' then
    if position(' ' in btrim(_full_name)) = 0 then
      _first := btrim(_full_name);
      _last := null;
    else
      _first := btrim(substring(btrim(_full_name) from 1 for (length(btrim(_full_name)) - position(' ' in reverse(btrim(_full_name))))));
      _last := btrim(substring(btrim(_full_name) from (length(btrim(_full_name)) - position(' ' in reverse(btrim(_full_name))) + 2)));
    end if;
  end if;

  insert into public.profiles (id, first_name, last_name, email, role)
  values (new.id, _first, _last, new.email, _role);
  return new;
end;
$$ language plpgsql security definer;

-- ==================
-- TRIGGER: keep updated_at fresh on profile + family edits
-- ==================
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger family_units_touch_updated_at
  before update on public.family_units
  for each row execute function public.touch_updated_at();

-- ==================
-- RLS: member directory visibility
-- ==================
-- Members can view other non-unlisted member profiles (for directory browsing).
-- Admins already have full view via existing policy.
create policy "Members can view directory profiles"
  on public.profiles for select
  using (
    public.is_member()
    and is_unlisted = false
    and role in ('member', 'content_editor', 'admin')
  );

-- ==================
-- VIEW: profiles_directory — applies field-level privacy
-- ==================
-- Members query this view for directory browsing. Hidden fields are nulled.
-- security_invoker=true means the view runs under the caller's RLS, so unlisted
-- profiles are filtered out by the row-level policies above.
create view public.profiles_directory
with (security_invoker = true) as
select
  p.id,
  p.first_name,
  p.last_name,
  p.preferred_name,
  p.avatar_url,
  p.role,
  p.bio,
  p.family_id,
  p.created_at,
  case when p.hide_email then null else p.email end as email,
  case when p.hide_phone_mobile then null else p.phone_mobile end as phone_mobile,
  case when p.hide_phone_home then null else p.phone_home end as phone_home,
  case when p.hide_phone_work then null else p.phone_work end as phone_work,
  case when p.hide_address then null else p.address_line1 end as address_line1,
  case when p.hide_address then null else p.address_line2 end as address_line2,
  case when p.hide_address then null else p.city end as city,
  case when p.hide_address then null else p.state end as state,
  case when p.hide_address then null else p.postal_code end as postal_code,
  case when p.hide_birthday then null else p.birth_month end as birth_month,
  case when p.hide_birthday then null else p.birth_day end as birth_day,
  case when p.hide_birthday then null else p.birth_year end as birth_year,
  case when p.hide_anniversary then null else p.anniversary end as anniversary,
  case when p.hide_occupation then null else p.occupation end as occupation,
  case when p.hide_occupation then null else p.employer end as employer
from public.profiles p;

grant select on public.profiles_directory to authenticated;

-- ==================
-- VIEW: families_directory — applies field-level privacy
-- ==================
create view public.families_directory
with (security_invoker = true) as
select
  f.id,
  f.family_name,
  case when f.hide_address then null else f.address_line1 end as address_line1,
  case when f.hide_address then null else f.address_line2 end as address_line2,
  case when f.hide_address then null else f.city end as city,
  case when f.hide_address then null else f.state end as state,
  case when f.hide_address then null else f.postal_code end as postal_code,
  case when f.hide_phone_home then null else f.phone_home end as phone_home,
  f.created_at,
  f.updated_at
from public.family_units f;

grant select on public.families_directory to authenticated;
