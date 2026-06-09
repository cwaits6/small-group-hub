-- Replace manual active toggle with an archive flag.
-- All series are shown as current by default; admins explicitly archive
-- a series when it's truly complete, moving it to the past section.
alter table public.lecture_series add column if not exists is_archived boolean not null default false;
