-- Allow members to upload avatars for non-auth family members stored under
-- family-members/<id>/ in the avatars bucket.
create policy "Members can upload household family member avatars"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and public.is_member()
    and (storage.foldername(name))[1] = 'family-members'
    and (storage.foldername(name))[2] in (
      select fm.id::text
      from public.family_members fm
      where fm.family_id = public.current_family_id()
    )
  );

create policy "Members can update household family member avatars"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and public.is_member()
    and (storage.foldername(name))[1] = 'family-members'
    and (storage.foldername(name))[2] in (
      select fm.id::text
      from public.family_members fm
      where fm.family_id = public.current_family_id()
    )
  );

create policy "Members can delete household family member avatars"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and public.is_member()
    and (storage.foldername(name))[1] = 'family-members'
    and (storage.foldername(name))[2] in (
      select fm.id::text
      from public.family_members fm
      where fm.family_id = public.current_family_id()
    )
  );

-- Allow primary/spouse to manage avatars for other enrolled household members.
-- The existing policy locks uploads to auth.uid()/<path>, which blocks editing
-- a spouse's avatar from the household member edit page.

create policy "Household leaders can upload household member avatars"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and public.is_member()
    -- The folder target must be an enrolled member of the same household
    and (storage.foldername(name))[1] in (
      select p.id::text
      from public.profiles p
      where p.family_id = public.current_family_id()
        and p.family_id is not null
        and p.id != auth.uid()
    )
    -- Current user must be primary or spouse
    and exists (
      select 1 from public.profiles self
      where self.id = auth.uid()
        and self.relationship in ('primary', 'spouse')
    )
  );

create policy "Household leaders can update household member avatars"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and public.is_member()
    and (storage.foldername(name))[1] in (
      select p.id::text
      from public.profiles p
      where p.family_id = public.current_family_id()
        and p.family_id is not null
        and p.id != auth.uid()
    )
    and exists (
      select 1 from public.profiles self
      where self.id = auth.uid()
        and self.relationship in ('primary', 'spouse')
    )
  );

create policy "Household leaders can delete household member avatars"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and public.is_member()
    and (storage.foldername(name))[1] in (
      select p.id::text
      from public.profiles p
      where p.family_id = public.current_family_id()
        and p.family_id is not null
        and p.id != auth.uid()
    )
    and exists (
      select 1 from public.profiles self
      where self.id = auth.uid()
        and self.relationship in ('primary', 'spouse')
    )
  );
