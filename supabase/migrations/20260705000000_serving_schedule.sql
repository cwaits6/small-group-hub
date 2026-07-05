-- Sunday serving signups for functional teams (prayer team, greeter team).
-- Replaces the reply-all email workflow: one signup covers a whole Sunday,
-- made by an individual or a couple. Slots are lazy — upcoming Sundays are
-- computed in app code and rows only exist for actual signups.

-- ==================
-- PROFILE_GROUPS: per-group leaders
-- ==================
-- A leader leads exactly the group on this membership row — no global role.
alter table public.profile_groups
  add column is_leader boolean not null default false;

-- Helper: is the current user a leader of the given group?
create or replace function public.is_group_leader(_group_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.profile_groups
    where profile_id = auth.uid()
      and group_id = _group_id
      and is_leader = true
  );
$$ language sql security definer;

-- Admins manage leader flags (profile_groups previously had no update policy)
create policy "Admins can update profile groups"
  on public.profile_groups for update
  using (public.is_admin());

-- ==================
-- SERVING_TEAM_SETTINGS: per-group feature config
-- ==================
create table public.serving_team_settings (
  group_id uuid primary key references public.member_groups(id) on delete cascade,
  enabled boolean not null default false,
  -- Days of week to send reminders (0=Sunday .. 6=Saturday); default Thursday + Friday
  reminder_days int[] not null default '{4,5}'
    check (reminder_days <@ array[0, 1, 2, 3, 4, 5, 6]),
  -- 'email' via Resend today; column reserved for 'sms' later
  reminder_method text not null default 'email'
    check (reminder_method in ('email')),
  -- How many upcoming Sundays to show / email about
  window_weeks int not null default 8 check (window_weeks between 1 and 26),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.serving_team_settings enable row level security;

create policy "Members can view serving settings"
  on public.serving_team_settings for select
  using (public.is_member());

create policy "Leaders and admins can insert serving settings"
  on public.serving_team_settings for insert
  with check (public.is_admin() or public.is_group_leader(group_id));

create policy "Leaders and admins can update serving settings"
  on public.serving_team_settings for update
  using (public.is_admin() or public.is_group_leader(group_id));

create policy "Admins can delete serving settings"
  on public.serving_team_settings for delete
  using (public.is_admin());

-- ==================
-- SERVING_SIGNUPS: one row = one covered Sunday for one group
-- ==================
create table public.serving_signups (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.member_groups(id) on delete cascade,
  service_date date not null,
  -- Household covering the Sunday (for "The Hendersons" display); null for
  -- signups by members without a household
  family_id uuid references public.family_units(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, service_date)
);

alter table public.serving_signups enable row level security;

create index serving_signups_service_date_idx on public.serving_signups(service_date);

create policy "Members can view serving signups"
  on public.serving_signups for select
  using (public.is_member());

-- Members sign up themselves, for teams they belong to; leaders/admins can
-- create signups for any Sunday on their team
create policy "Members can create serving signups"
  on public.serving_signups for insert
  with check (
    created_by = auth.uid()
    and (
      public.is_admin()
      or public.is_group_leader(group_id)
      or exists (
        select 1 from public.profile_groups pg
        where pg.profile_id = auth.uid() and pg.group_id = serving_signups.group_id
      )
    )
  );

create policy "Members can delete own serving signups"
  on public.serving_signups for delete
  using (
    created_by = auth.uid()
    or public.is_admin()
    or public.is_group_leader(group_id)
  );

-- ==================
-- SERVING_SIGNUP_ATTENDEES: who is actually coming (just me / me & spouse)
-- ==================
create table public.serving_signup_attendees (
  signup_id uuid not null references public.serving_signups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (signup_id, profile_id)
);

alter table public.serving_signup_attendees enable row level security;

create index serving_signup_attendees_profile_idx
  on public.serving_signup_attendees(profile_id);

create policy "Members can view serving attendees"
  on public.serving_signup_attendees for select
  using (public.is_member());

create policy "Signup owners can add attendees"
  on public.serving_signup_attendees for insert
  with check (
    exists (
      select 1 from public.serving_signups s
      where s.id = signup_id
        and (
          s.created_by = auth.uid()
          or public.is_admin()
          or public.is_group_leader(s.group_id)
        )
    )
  );

create policy "Signup owners can remove attendees"
  on public.serving_signup_attendees for delete
  using (
    exists (
      select 1 from public.serving_signups s
      where s.id = signup_id
        and (
          s.created_by = auth.uid()
          or public.is_admin()
          or public.is_group_leader(s.group_id)
        )
    )
  );

-- ==================
-- SERVING_BROADCASTS: log of "Email the team" sends
-- ==================
create table public.serving_broadcasts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.member_groups(id) on delete cascade,
  sent_by uuid references public.profiles(id) on delete set null,
  subject text not null,
  -- The open Sundays listed in the email at send time
  open_dates date[] not null default '{}',
  recipient_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.serving_broadcasts enable row level security;

create policy "Leaders and admins can view serving broadcasts"
  on public.serving_broadcasts for select
  using (public.is_admin() or public.is_group_leader(group_id));

create policy "Leaders and admins can log serving broadcasts"
  on public.serving_broadcasts for insert
  with check (
    sent_by = auth.uid()
    and (public.is_admin() or public.is_group_leader(group_id))
  );

-- ==================
-- SITE SETTINGS: email link mode (signed HMAC links vs. login required)
-- ==================
-- 'signed' = email deep links act without login (default); 'login' = links
-- require signing in first. Env SERVING_LINK_MODE is the fallback default
-- for self-hosters; this row wins when present.
insert into public.site_settings (key, value)
values ('serving_link_mode', 'signed')
on conflict (key) do nothing;
