-- Update directory views to include member groups, family relationships, and anniversary

-- ==================
-- RECREATE: profiles_directory with groups aggregation
-- ==================
drop view if exists public.profiles_directory;

create view public.profiles_directory
with (security_invoker = true) as
select
  p.id,
  p.first_name,
  p.last_name,
  p.preferred_name,
  p.avatar_url,
  p.role,
  p.relationship,
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
  case when p.hide_birthday and not p.hide_birth_year then null else p.birth_year end as birth_year,
  case when p.hide_anniversary then null else p.anniversary end as anniversary,
  case when p.hide_occupation then null else p.occupation end as occupation,
  case when p.hide_occupation then null else p.employer end as employer,
  -- aggregate groups as JSONB array
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', mg.id,
        'name', mg.name,
        'color', mg.color,
        'icon', mg.icon
      ) order by mg.display_order
    ) filter (where mg.id is not null),
    '[]'::jsonb
  ) as groups
from public.profiles p
left join public.profile_groups pg on p.id = pg.profile_id
left join public.member_groups mg on pg.group_id = mg.id
where p.is_unlisted = false and p.role in ('member', 'content_editor', 'admin')
group by p.id;

grant select on public.profiles_directory to authenticated;

-- ==================
-- RECREATE: families_directory (unchanged, for backward compatibility)
-- ==================
drop view if exists public.families_directory;

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
  case when f.hide_anniversary then null else f.anniversary end as anniversary,
  f.created_at,
  f.updated_at
from public.family_units f;

grant select on public.families_directory to authenticated;

-- ==================
-- NEW VIEW: families_directory_full (for household browsing in app)
-- ==================
-- Returns family units with aggregated member lists (both profiles + family_members)
-- for displaying household cards in the directory
create view public.families_directory_full
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
  case when f.hide_anniversary then null else f.anniversary end as anniversary,
  f.created_at,
  f.updated_at,
  -- aggregate all profiles in this family as JSONB array
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'first_name', p.first_name,
        'last_name', p.last_name,
        'preferred_name', p.preferred_name,
        'avatar_url', p.avatar_url,
        'relationship', p.relationship,
        'is_class_member', true,
        'phone_mobile', case when p.hide_phone_mobile then null else p.phone_mobile end,
        'birth_month', case when p.hide_birthday then null else p.birth_month end,
        'birth_day', case when p.hide_birthday then null else p.birth_day end,
        'birth_year', case when p.hide_birthday and not p.hide_birth_year then null else p.birth_year end
      ) order by p.relationship asc
    ) filter (where p.id is not null and p.is_unlisted = false and p.role in ('member', 'content_editor', 'admin')),
    '[]'::jsonb
  ) as members,
  -- aggregate all family_members (lightweight records) as JSONB array
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', fm.id,
        'first_name', fm.first_name,
        'last_name', fm.last_name,
        'preferred_name', fm.preferred_name,
        'avatar_url', fm.avatar_url,
        'relationship', fm.relationship,
        'is_class_member', fm.is_class_member,
        'birth_month', fm.birth_month,
        'birth_day', fm.birth_day,
        'birth_year', fm.birth_year,
        'claimed_profile_id', fm.claimed_profile_id
      ) order by fm.relationship asc
    ) filter (where fm.id is not null),
    '[]'::jsonb
  ) as family_members_list
from public.family_units f
left join public.profiles p on f.id = p.family_id
left join public.family_members fm on f.id = fm.family_id
group by f.id;

grant select on public.families_directory_full to authenticated;
