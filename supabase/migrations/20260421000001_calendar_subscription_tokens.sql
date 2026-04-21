-- Subscription tokens for authenticated calendar (ICS) feeds.
-- Each member gets one unguessable token; external calendar apps
-- include it in the webcal URL so the ICS endpoint can verify access.

create table public.calendar_subscription_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  constraint calendar_subscription_tokens_user_id_key unique (user_id),
  constraint calendar_subscription_tokens_token_key unique (token)
);

alter table public.calendar_subscription_tokens enable row level security;

-- Members can read their own token
create policy "Members can view own subscription token"
  on public.calendar_subscription_tokens for select
  using (auth.uid() = user_id);

-- Members can insert their own token
create policy "Members can create own subscription token"
  on public.calendar_subscription_tokens for insert
  with check (auth.uid() = user_id);
