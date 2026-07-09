-- Prayer wall: members post requests with two independent privacy controls —
-- is_anonymous hides the author's name from everyone; visible_to_warriors
-- limits the whole request to prayer warriors. Off = visible to every member.
-- The author is always recorded (RLS + "My requests" need it); anonymity is
-- applied at read time by the prayer_wall view, mirroring how
-- profiles_directory applies field-level privacy.
--
-- Prayer warriors are a profile-level role (distinct from the serving-page
-- prayer team) managed through the member-groups system; the Prayer page lists
-- who's in the group so posters know who they're sharing a restricted request
-- with. Prayer call leaders (leader_id on a session) get no special read access.

-- ==================
-- ROLE: prayer warriors (profile flag + seeded member group)
-- ==================
alter table public.profiles
  add column is_prayer_warrior boolean not null default false;

alter table public.member_groups
  drop constraint member_groups_functional_role_check;
alter table public.member_groups
  add constraint member_groups_functional_role_check
  check (functional_role in ('prayer_team', 'greeter_team', 'prayer_warriors'));

insert into public.member_groups (name, description, color, icon, display_order, functional_role)
select
  'Prayer Warriors',
  'Sees prayer requests shared with prayer warriors',
  '#8A6BB5',
  'shield',
  coalesce((select max(display_order) + 1 from public.member_groups), 0),
  'prayer_warriors'
where not exists (
  select 1 from public.member_groups where functional_role = 'prayer_warriors'
);

-- ==================
-- PRAYER_CALL_SESSIONS: the weekly prayer call card (supports multiple sessions)
-- ==================
-- Structured schedule (weekday 0 = Sunday, times in the group's local time)
-- so each session can sync to a real weekly recurring event on the calendar.
-- event_id points at that synced event; app code keeps the two in step.
create table public.prayer_call_sessions (
  id uuid primary key default gen_random_uuid(),
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time,
  leader_id uuid references public.profiles(id) on delete set null,
  dial_in text check (dial_in is null or char_length(dial_in) <= 40),
  pin text check (pin is null or char_length(pin) <= 20),
  join_url text check (join_url is null or char_length(join_url) <= 500),
  event_id uuid references public.events(id) on delete set null,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger prayer_call_sessions_touch_updated_at
  before update on public.prayer_call_sessions
  for each row execute function public.touch_updated_at();

alter table public.prayer_call_sessions enable row level security;

create policy "Members can view prayer call sessions"
  on public.prayer_call_sessions for select
  using ((select public.is_member()));

create policy "Admins can insert prayer call sessions"
  on public.prayer_call_sessions for insert
  with check ((select public.is_admin()));

create policy "Admins can update prayer call sessions"
  on public.prayer_call_sessions for update
  using ((select public.is_admin()));

create policy "Admins can delete prayer call sessions"
  on public.prayer_call_sessions for delete
  using ((select public.is_admin()));

-- ==================
-- AUDIENCE HELPERS
-- ==================
create or replace function public.is_prayer_warrior()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_prayer_warrior
  );
$$ language sql security definer stable set search_path = '';

-- ==================
-- PRAYER_REQUESTS
-- ==================
create table public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  category text not null check (
    category in ('health', 'family', 'thanksgiving', 'prodigal', 'guidance', 'grief')
  ),
  is_anonymous boolean not null default false,
  visible_to_warriors boolean not null default false,
  is_answered boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index prayer_requests_created_at_idx on public.prayer_requests(created_at desc);

create trigger prayer_requests_touch_updated_at
  before update on public.prayer_requests
  for each row execute function public.touch_updated_at();

alter table public.prayer_requests enable row level security;

-- Helper calls are wrapped in scalar subqueries so the planner evaluates them
-- once per statement (initPlan) instead of per row.
create policy "Members can view visible prayer requests"
  on public.prayer_requests for select
  using (
    (select public.is_member())
    and (
      author_id = auth.uid()
      or not visible_to_warriors
      or (visible_to_warriors and (select public.is_prayer_warrior()))
    )
  );

create policy "Members can post own prayer requests"
  on public.prayer_requests for insert
  with check ((select public.is_member()) and author_id = auth.uid());

create policy "Posters and admins can update prayer requests"
  on public.prayer_requests for update
  using (author_id = auth.uid() or (select public.is_admin()));

create policy "Posters and admins can delete prayer requests"
  on public.prayer_requests for delete
  using (author_id = auth.uid() or (select public.is_admin()));

-- ==================
-- PRAYER_RESPONSES: one row = one member praying for one request
-- ==================
create table public.prayer_responses (
  request_id uuid not null references public.prayer_requests(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, profile_id)
);

alter table public.prayer_responses enable row level security;

-- The exists() runs under the caller's RLS on prayer_requests, so responses
-- to a restricted request are only visible to members who can see the
-- request itself — otherwise the rows would leak who is praying for it.
create policy "Members can view prayer responses"
  on public.prayer_responses for select
  using (
    (select public.is_member())
    and exists (select 1 from public.prayer_requests r where r.id = request_id)
  );

-- Same guard on insert: nobody can respond to a restricted request they
-- can't see.
create policy "Members can pray for visible requests"
  on public.prayer_responses for insert
  with check (
    (select public.is_member())
    and profile_id = auth.uid()
    and exists (select 1 from public.prayer_requests r where r.id = request_id)
  );

create policy "Members can withdraw own prayer responses"
  on public.prayer_responses for delete
  using (profile_id = auth.uid());

-- ==================
-- VIEW: prayer_wall — nulls the author for anonymous posts
-- ==================
-- security_invoker=true keeps the base-table RLS in force (restricted rows
-- stay hidden). Author fields are nulled on anonymous rows for everyone but
-- the poster; `mine` lets the poster find their own anonymous requests. The
-- left join means an unlisted author's name simply comes back null (the
-- profiles RLS hides their row from other members) — the request still shows.
create view public.prayer_wall
with (security_invoker = true) as
select
  r.id,
  r.body,
  r.category,
  r.is_anonymous,
  r.visible_to_warriors,
  r.is_answered,
  r.created_at,
  (r.author_id = auth.uid()) as mine,
  case when r.is_anonymous and r.author_id <> auth.uid() then null else p.first_name end as first_name,
  case when r.is_anonymous and r.author_id <> auth.uid() then null else p.last_name end as last_name,
  case when r.is_anonymous and r.author_id <> auth.uid() then null else p.preferred_name end as preferred_name,
  case when r.is_anonymous and r.author_id <> auth.uid() then null else p.avatar_url end as avatar_url,
  (select count(*)::int from public.prayer_responses pr where pr.request_id = r.id) as praying_count,
  exists (
    select 1 from public.prayer_responses pr
    where pr.request_id = r.id and pr.profile_id = auth.uid()
  ) as i_am_praying
from public.prayer_requests r
left join public.profiles p on p.id = r.author_id;

grant select on public.prayer_wall to authenticated;

-- ==================
-- CALENDAR: designated Prayer calendar for synced call events
-- ==================
-- The calendar's id is stored in site_settings so app code finds it without
-- matching on a rename-able name.
do $$
declare
  _cal_id uuid;
begin
  insert into public.event_calendars (name, color)
  values ('Prayer', '#2F6BA8')
  returning id into _cal_id;

  insert into public.site_settings (key, value)
  values ('prayer_calendar_id', _cal_id::text)
  on conflict (key) do update set value = excluded.value;
end $$;
