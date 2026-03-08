-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.access_requests enable row level security;
alter table public.events enable row level security;
alter table public.rsvps enable row level security;
alter table public.announcements enable row level security;
alter table public.lectures enable row level security;
alter table public.site_settings enable row level security;

-- Helper: check if user is admin
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer;

-- Helper: check if user is member or admin
create or replace function public.is_member()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('member', 'admin')
  );
$$ language sql security definer;

-- ==================
-- PROFILES
-- ==================
-- Members can read their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Admins can view all profiles
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

-- Admins can update any profile
create policy "Admins can update profiles"
  on public.profiles for update
  using (public.is_admin());

-- Users can update their own profile (name, phone, bio)
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ==================
-- ACCESS REQUESTS
-- ==================
-- Anyone can insert (join form)
create policy "Anyone can submit access request"
  on public.access_requests for insert
  with check (true);

-- Admins can view all
create policy "Admins can view access requests"
  on public.access_requests for select
  using (public.is_admin());

-- Admins can update (approve/deny)
create policy "Admins can update access requests"
  on public.access_requests for update
  using (public.is_admin());

-- ==================
-- EVENTS
-- ==================
-- Public events visible to everyone
create policy "Public events visible to all"
  on public.events for select
  using (is_private = false);

-- Members can see all events (public + private)
create policy "Members can view all events"
  on public.events for select
  using (public.is_member());

-- Admins can create/update/delete events
create policy "Admins can insert events"
  on public.events for insert
  with check (public.is_admin());

create policy "Admins can update events"
  on public.events for update
  using (public.is_admin());

create policy "Admins can delete events"
  on public.events for delete
  using (public.is_admin());

-- ==================
-- RSVPS
-- ==================
-- Members can view RSVPs for events they can see
create policy "Members can view rsvps"
  on public.rsvps for select
  using (public.is_member());

-- Members can insert their own RSVP
create policy "Members can insert own rsvp"
  on public.rsvps for insert
  with check (auth.uid() = user_id and public.is_member());

-- Members can update their own RSVP
create policy "Members can update own rsvp"
  on public.rsvps for update
  using (auth.uid() = user_id and public.is_member());

-- Members can delete their own RSVP
create policy "Members can delete own rsvp"
  on public.rsvps for delete
  using (auth.uid() = user_id and public.is_member());

-- Admins full access to RSVPs
create policy "Admins full access rsvps"
  on public.rsvps for all
  using (public.is_admin());

-- ==================
-- ANNOUNCEMENTS
-- ==================
-- Published announcements visible to everyone
create policy "Published announcements visible to all"
  on public.announcements for select
  using (is_published = true);

-- Members can view all announcements
create policy "Members can view all announcements"
  on public.announcements for select
  using (public.is_member());

-- Admins can create/update/delete
create policy "Admins can insert announcements"
  on public.announcements for insert
  with check (public.is_admin());

create policy "Admins can update announcements"
  on public.announcements for update
  using (public.is_admin());

create policy "Admins can delete announcements"
  on public.announcements for delete
  using (public.is_admin());

-- ==================
-- LECTURES
-- ==================
-- Everyone can view lectures
create policy "Lectures visible to all"
  on public.lectures for select
  using (true);

-- Admins can create/update/delete
create policy "Admins can insert lectures"
  on public.lectures for insert
  with check (public.is_admin());

create policy "Admins can update lectures"
  on public.lectures for update
  using (public.is_admin());

create policy "Admins can delete lectures"
  on public.lectures for delete
  using (public.is_admin());

-- ==================
-- SITE SETTINGS
-- ==================
-- Everyone can read settings
create policy "Anyone can read settings"
  on public.site_settings for select
  using (true);

-- Admins can update settings
create policy "Admins can update settings"
  on public.site_settings for update
  using (public.is_admin());
