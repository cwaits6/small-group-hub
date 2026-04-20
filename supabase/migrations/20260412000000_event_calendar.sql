-- Event calendars (admin-defined categories)
create table public.event_calendars (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.event_calendars enable row level security;

-- Everyone can read calendars
create policy "Anyone can read event calendars"
  on public.event_calendars for select
  using (true);

-- Admins can manage calendars
create policy "Admins can insert event calendars"
  on public.event_calendars for insert
  with check (public.is_admin());

create policy "Admins can update event calendars"
  on public.event_calendars for update
  using (public.is_admin());

create policy "Admins can delete event calendars"
  on public.event_calendars for delete
  using (public.is_admin());

-- Add columns to events
alter table public.events
  add column calendar_id uuid references public.event_calendars(id),
  add column is_rsvp_enabled boolean not null default true;
