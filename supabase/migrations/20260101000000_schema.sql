-- Profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  role text not null default 'pending' check (role in ('pending', 'member', 'admin')),
  phone text,
  bio text,
  approved_at timestamptz,
  approved_by uuid references auth.users,
  created_at timestamptz not null default now()
);

-- Access requests (for join form)
create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  reviewed_by uuid references auth.users,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Events
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  start_time timestamptz not null,
  end_time timestamptz,
  is_private boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- RSVPs
create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  status text not null check (status in ('yes', 'no', 'maybe')),
  created_at timestamptz not null default now(),
  unique(event_id, user_id)
);

-- Announcements
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  is_published boolean not null default false,
  author_id uuid references public.profiles(id),
  published_at timestamptz,
  created_at timestamptz not null default now()
);

-- Lectures
create table public.lectures (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  video_url text not null,
  thumbnail_url text,
  lecture_date date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Site settings (key-value store for configurable links/text)
create table public.site_settings (
  key text primary key,
  value text,
  updated_by uuid references auth.users,
  updated_at timestamptz
);

-- Seed default site settings
insert into public.site_settings (key, value) values
  ('donation_url', ''),
  ('venmo_url', ''),
  ('directory_app_url', '');

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'pending');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
