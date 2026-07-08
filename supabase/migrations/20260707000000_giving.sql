-- Giving: trust-first peer-to-peer payment links.
-- Model: FUNDS (each held by a named steward, optionally a couple) exposing
-- payment METHODS. No money moves through the app — Venmo/PayPal/Cash App
-- deep-link into the payer's own app; Zelle and Apple/Google Pay handles are
-- copy-to-clipboard. Handles live on the steward's profile and can be
-- overridden per fund (e.g. a dedicated retreat Venmo).

-- ==================
-- PAYMENT_HANDLES: a member's reusable payment usernames
-- ==================
create table public.payment_handles (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  method text not null
    check (method in ('venmo', 'paypal', 'cashapp', 'zelle', 'wallet')),
  handle text not null check (char_length(handle) between 1 and 120),
  updated_at timestamptz not null default now(),
  primary key (profile_id, method)
);

alter table public.payment_handles enable row level security;

create policy "Members can view payment handles"
  on public.payment_handles for select
  using (public.is_member());

create policy "Users can insert own payment handles"
  on public.payment_handles for insert
  with check (profile_id = auth.uid() or public.is_admin());

create policy "Users can update own payment handles"
  on public.payment_handles for update
  using (profile_id = auth.uid() or public.is_admin());

create policy "Users can delete own payment handles"
  on public.payment_handles for delete
  using (profile_id = auth.uid() or public.is_admin());

-- ==================
-- SITE SETTINGS: who may create/manage funds
-- ==================
-- 'stewards' (default) = members can put up a fund with themselves as the
-- steward and manage funds they steward; 'admins' = admins only.
insert into public.site_settings (key, value)
values ('giving_manage_mode', 'stewards')
on conflict (key) do nothing;

create or replace function public.giving_stewards_can_manage()
returns boolean as $$
  select coalesce(
    (select value from public.site_settings where key = 'giving_manage_mode'),
    'stewards'
  ) = 'stewards';
$$ language sql security definer;

-- ==================
-- GIVING_FUNDS: one row = one collection with a named steward
-- ==================
create table public.giving_funds (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  description text,
  -- Person whose payment handles receive the money
  steward_id uuid not null references public.profiles(id) on delete cascade,
  -- Displayed alongside the steward (couples: "Linda & Ray Park")
  co_steward_id uuid references public.profiles(id) on delete set null,
  -- Short trust label: "Class treasurers", "Hospitality", "Care team"
  steward_role text check (steward_role is null or char_length(steward_role) <= 60),
  -- Auto-retire: fund quietly disappears from the Give page after this date
  retire_on date,
  is_active boolean not null default true,
  display_order int not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.giving_funds enable row level security;

create policy "Members can view giving funds"
  on public.giving_funds for select
  using (public.is_member());

create policy "Admins and self-stewards can create funds"
  on public.giving_funds for insert
  with check (
    created_by = auth.uid()
    and (
      public.is_admin()
      or (
        public.giving_stewards_can_manage()
        and public.is_member()
        and steward_id = auth.uid()
      )
    )
  );

create policy "Admins and stewards can update funds"
  on public.giving_funds for update
  using (
    public.is_admin()
    or (public.giving_stewards_can_manage() and steward_id = auth.uid())
  );

create policy "Admins and stewards can delete funds"
  on public.giving_funds for delete
  using (
    public.is_admin()
    or (public.giving_stewards_can_manage() and steward_id = auth.uid())
  );

-- ==================
-- GIVING_FUND_METHODS: which methods a fund accepts
-- ==================
-- custom_handle null = resolve from the steward's payment_handles at render,
-- so a steward updating their profile handle updates every fund at once.
create table public.giving_fund_methods (
  fund_id uuid not null references public.giving_funds(id) on delete cascade,
  method text not null
    check (method in ('venmo', 'paypal', 'cashapp', 'zelle', 'wallet')),
  custom_handle text
    check (custom_handle is null or char_length(custom_handle) between 1 and 120),
  display_order int not null default 0,
  primary key (fund_id, method)
);

alter table public.giving_fund_methods enable row level security;

create or replace function public.giving_can_manage_fund(_fund_id uuid)
returns boolean as $$
  select public.is_admin() or (
    public.giving_stewards_can_manage() and exists (
      select 1 from public.giving_funds f
      where f.id = _fund_id and f.steward_id = auth.uid()
    )
  );
$$ language sql security definer;

create policy "Members can view fund methods"
  on public.giving_fund_methods for select
  using (public.is_member());

create policy "Fund managers can add methods"
  on public.giving_fund_methods for insert
  with check (public.giving_can_manage_fund(fund_id));

create policy "Fund managers can update methods"
  on public.giving_fund_methods for update
  using (public.giving_can_manage_fund(fund_id));

create policy "Fund managers can remove methods"
  on public.giving_fund_methods for delete
  using (public.giving_can_manage_fund(fund_id));
