-- Phase 0 tenancy test harness scaffold (CWA-7 / #209).
-- Minimal organizations/organization_members tables + a stub
-- provision_organization() — just enough to seed two fixture orgs for the
-- pgTAP leak-suite. NOT production tenant provisioning: no caller
-- authorization, no default-data seeding, not called from any app route.
-- Later CWA-7 phases will harden this and add org_id to real tables.

create extension if not exists pgtap with schema extensions;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.organization_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (org_id, profile_id)
);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

create or replace function public.is_org_member(_org_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members
    where org_id = _org_id and profile_id = auth.uid()
  );
$$;

create policy "org members can view their orgs" on public.organizations
  for select using (public.is_org_member(id));

create policy "members can view their own org memberships" on public.organization_members
  for select using (profile_id = auth.uid());

-- Stub only: no INSERT policies exist on either table by design — direct
-- self-service org creation is out of scope for Phase 0, so this security
-- definer function is the sole write path, called from test/seed SQL only.
create or replace function public.provision_organization(_name text, _owner_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  _org_id uuid;
begin
  insert into public.organizations (name) values (_name) returning id into _org_id;
  insert into public.organization_members (org_id, profile_id) values (_org_id, _owner_id);
  return _org_id;
end;
$$;
