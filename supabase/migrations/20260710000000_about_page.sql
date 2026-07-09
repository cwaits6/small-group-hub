-- About Our Class page: a members-only class summary plus a roster of
-- teachers. Content lives here (not in page_content) because page_content
-- is publicly readable and teacher bios should stay behind login.

-- Singleton row holding the class summary (BlockNote JSON, same format as
-- page_content.body).
create table public.about_page (
  id boolean primary key default true check (id),
  body text not null default '',
  updated_by uuid references auth.users,
  updated_at timestamptz not null default now()
);

alter table public.about_page enable row level security;

create policy "Members can read about page"
  on public.about_page for select
  using (public.is_member());

create policy "Editors can insert about page"
  on public.about_page for insert
  with check (public.is_content_editor());

create policy "Editors can update about page"
  on public.about_page for update
  using (public.is_content_editor());

-- Teachers are members: each entry points at a profile and adds a
-- teacher-specific title and bio. Photo comes from the profile's avatar.
create table public.class_teachers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  title text not null default 'Teacher',
  bio text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.class_teachers enable row level security;

create policy "Members can read class teachers"
  on public.class_teachers for select
  using (public.is_member());

create policy "Editors can insert class teachers"
  on public.class_teachers for insert
  with check (public.is_content_editor());

create policy "Editors can update class teachers"
  on public.class_teachers for update
  using (public.is_content_editor());

create policy "Editors can delete class teachers"
  on public.class_teachers for delete
  using (public.is_content_editor());
