-- Family invites: allow household primary members or admins to invite
-- non-auth family member records (family_members) to create their own account

-- ==================
-- FAMILY_INVITES TABLE
-- ==================
create table public.family_invites (
  id               uuid primary key default gen_random_uuid(),
  family_member_id uuid not null references public.family_members(id) on delete cascade,
  family_id        uuid not null references public.family_units(id) on delete cascade,
  invite_email     text not null,
  token            uuid not null default gen_random_uuid() unique,
  sent_at          timestamptz,
  accepted_at      timestamptz,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);

alter table public.family_invites enable row level security;

create index family_invites_token_idx on public.family_invites(token);
create index family_invites_family_id_idx on public.family_invites(family_id);
create index family_invites_family_member_id_idx on public.family_invites(family_member_id);

-- Members can read invites (needed so the UI can show invite status)
create policy "Members can view family invites"
  on public.family_invites for select
  using (public.is_member());

-- Admins can insert
create policy "Admins can insert family invites"
  on public.family_invites for insert
  with check (public.is_admin());

-- Admins can update (mark accepted, etc.)
create policy "Admins can update family invites"
  on public.family_invites for update
  using (public.is_admin());

-- Household primary member can insert invites for their own family
create policy "Household primary can insert family invites"
  on public.family_invites for insert
  with check (
    public.is_member()
    and family_id in (
      select family_id from public.profiles
      where id = auth.uid()
        and family_id is not null
    )
  );

-- Household primary member can update invites for their own family
create policy "Household primary can update family invites"
  on public.family_invites for update
  using (
    public.is_member()
    and family_id in (
      select family_id from public.profiles
      where id = auth.uid()
        and family_id is not null
    )
  );
