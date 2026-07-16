-- Settings page: notification preference + member feedback.

-- Per-member opt-out for announcement emails. Nothing in-app sends these
-- yet (announcements go out via Resend broadcasts); the audience sync
-- reads this flag so opted-out members are excluded.
alter table public.profiles
  add column email_announcements boolean not null default true;

-- Feedback submitted from Settings. Rows are the durable record; admins
-- also get an email copy on submit.
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('idea', 'problem')),
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "Members can submit their own feedback"
  on public.feedback for insert
  with check (
    (select auth.uid()) = profile_id
    and (select public.is_member())
  );

create policy "Admins can read feedback"
  on public.feedback for select
  using ((select public.is_admin()));
