-- Remove is_private column from events table
-- All events are now members-only (enforced by middleware + RLS)

-- Drop the public events policy (no longer needed)
drop policy if exists "Public events visible to all" on public.events;

-- Drop the is_private column
alter table public.events drop column if exists is_private;
