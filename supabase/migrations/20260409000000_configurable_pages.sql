-- Add content_editor role to profiles check constraint
alter table public.profiles
  drop constraint profiles_role_check,
  add constraint profiles_role_check
    check (role in ('pending', 'member', 'content_editor', 'admin'));

-- Helper: check if user is content_editor or admin
create or replace function public.is_content_editor()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('content_editor', 'admin')
  );
$$ language sql security definer;

-- Update is_member to include content_editor
create or replace function public.is_member()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('member', 'content_editor', 'admin')
  );
$$ language sql security definer;

-- Page content table (markdown pages editable via admin UI)
create table public.page_content (
  slug text primary key,
  title text not null,
  body text not null default '',
  updated_by uuid references auth.users,
  updated_at timestamptz not null default now()
);

alter table public.page_content enable row level security;

-- Anyone can read page content
create policy "Anyone can read page content"
  on public.page_content for select
  using (true);

-- Content editors and admins can insert
create policy "Editors can insert page content"
  on public.page_content for insert
  with check (public.is_content_editor());

-- Content editors and admins can update
create policy "Editors can update page content"
  on public.page_content for update
  using (public.is_content_editor());

-- Only admins can delete pages
create policy "Admins can delete page content"
  on public.page_content for delete
  using (public.is_admin());

-- Add new site_settings keys
insert into public.site_settings (key, value) values
  ('site_name', ''),
  ('weekly_zoom_url', ''),
  ('zoom_meeting_time', ''),
  ('weekly_prayer_call_url', ''),
  ('weekly_prayer_call_time', '')
on conflict (key) do nothing;
