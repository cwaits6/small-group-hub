-- New table: lecture_series
create table public.lecture_series (
  id uuid default gen_random_uuid() not null primary key,
  name text not null,
  teacher text,
  is_archived boolean not null default false,
  created_at timestamptz default now() not null
);

alter table public.lecture_series enable row level security;

create policy "Series visible to all" on public.lecture_series for select using (true);
create policy "Admins can insert series" on public.lecture_series for insert with check (public.is_admin());
create policy "Admins can update series" on public.lecture_series for update using (public.is_admin());
create policy "Admins can delete series" on public.lecture_series for delete using (public.is_admin());

-- Add columns to lectures
alter table public.lectures add column series_id uuid references public.lecture_series(id) on delete set null;
alter table public.lectures add column week_number integer;
alter table public.lectures add column scripture_reference text;
alter table public.lectures add column summary text;
