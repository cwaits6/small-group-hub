-- Storage buckets for image uploads
-- avatars: profile photos (~400x400, ~50-80KB JPEG)
-- event-images: event cover photos (~1200px wide, ~200-300KB JPEG)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 524288, array['image/jpeg', 'image/png', 'image/webp']),
  ('event-images', 'event-images', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Public read access for both buckets
create policy "Public can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Public can view event images"
  on storage.objects for select
  using (bucket_id = 'event-images');

-- Authenticated members can upload to their own avatar path (userId/...)
create policy "Members can upload own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and public.is_member()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated members can update/replace their own avatar
create policy "Members can update own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Members can delete their own avatar
create policy "Members can delete own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Content editors and admins can upload event images
create policy "Editors can upload event images"
  on storage.objects for insert
  with check (
    bucket_id = 'event-images'
    and public.is_content_editor()
  );

create policy "Editors can update event images"
  on storage.objects for update
  using (
    bucket_id = 'event-images'
    and public.is_content_editor()
  );

create policy "Editors can delete event images"
  on storage.objects for delete
  using (
    bucket_id = 'event-images'
    and public.is_content_editor()
  );
