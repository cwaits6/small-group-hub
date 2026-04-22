-- Add relationship tracking and birthday/anniversary improvements to profiles and family_units

-- ==================
-- PROFILES: relationship + birthday year privacy
-- ==================
alter table public.profiles
  add column relationship text not null default 'primary' check (relationship in ('primary', 'spouse', 'child', 'parent', 'sibling', 'other')),
  add column hide_birth_year boolean not null default false,
  add column setup_completed boolean not null default false;

create index profiles_relationship_idx on public.profiles(relationship);

-- ==================
-- FAMILY_UNITS: anniversary (for couples)
-- ==================
alter table public.family_units
  add column anniversary date;

-- ==================
-- UPDATE: handle_new_user to set relationship for new signups
-- ==================
-- All new signups start as relationship='primary' (they are the primary account holder for their household)
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

  insert into public.profiles (id, first_name, last_name, email, role, relationship)
  values (new.id, _first, _last, new.email, _role, 'primary');
  return new;
end;
$$ language plpgsql security definer;
