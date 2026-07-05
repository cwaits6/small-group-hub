-- Family portrait photos for the directory (Instant Church Directory parity).
-- Admins upload one photo per household; it shows on household rows and the
-- household detail sheet, falling back to member avatar clusters.

alter table public.family_units
  add column if not exists photo_url text;

-- ==================
-- RECREATE: families_directory with photo_url
-- ==================
drop view if exists public.families_directory;

create view public.families_directory
with (security_invoker = true) as
select
  f.id,
  f.family_name,
  f.photo_url,
  case when f.hide_address then null else f.address_line1 end as address_line1,
  case when f.hide_address then null else f.address_line2 end as address_line2,
  case when f.hide_address then null else f.city end as city,
  case when f.hide_address then null else f.state end as state,
  case when f.hide_address then null else f.postal_code end as postal_code,
  case when f.hide_phone_home then null else f.phone_home end as phone_home,
  f.anniversary,
  f.created_at,
  f.updated_at
from public.family_units f;

grant select on public.families_directory to authenticated;

-- ==================
-- RECREATE: families_directory_full with photo_url
-- (definition from 20260704000000_fix_birth_year_privacy plus photo_url)
-- ==================
drop view if exists public.families_directory_full;

create view public.families_directory_full
with (security_invoker = true) as
select
  f.id,
  f.family_name,
  f.photo_url,
  case when f.hide_address then null else f.address_line1 end as address_line1,
  case when f.hide_address then null else f.address_line2 end as address_line2,
  case when f.hide_address then null else f.city end as city,
  case when f.hide_address then null else f.state end as state,
  case when f.hide_address then null else f.postal_code end as postal_code,
  case when f.hide_phone_home then null else f.phone_home end as phone_home,
  f.anniversary,
  f.created_at,
  f.updated_at,
  coalesce(
    (
      select jsonb_agg(
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
          'birth_year', case when p.hide_birthday or p.hide_birth_year then null else p.birth_year end
        ) order by p.relationship asc
      )
      from public.profiles p
      where p.family_id = f.id
        and p.is_unlisted = false
        and p.role in ('member', 'content_editor', 'admin')
    ),
    '[]'::jsonb
  ) as members,
  coalesce(
    (
      select jsonb_agg(
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
      )
      from public.family_members fm
      where fm.family_id = f.id
    ),
    '[]'::jsonb
  ) as family_members_list
from public.family_units f;

grant select on public.families_directory_full to authenticated;

-- ==================
-- STORAGE: admins manage family photos under avatars/families/<familyId>/
-- ==================
create policy "Admins can upload family photos"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and public.is_admin()
    and (storage.foldername(name))[1] = 'families'
  );

create policy "Admins can update family photos"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and public.is_admin()
    and (storage.foldername(name))[1] = 'families'
  );

create policy "Admins can delete family photos"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and public.is_admin()
    and (storage.foldername(name))[1] = 'families'
  );
