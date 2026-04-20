-- Replace row-expansion recurrence with metadata-on-event model.
-- A recurring event is stored as a single row; occurrences are expanded at
-- render time (Apple/ICS style). The old approach generated one row per
-- occurrence — this migration adds the metadata columns so the new model works.

alter table public.events
  add column recurrence_frequency text
    check (recurrence_frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  add column recurrence_interval integer not null default 1,
  add column recurrence_end_mode text
    check (recurrence_end_mode in ('never', 'count', 'until')),
  add column recurrence_count integer,
  add column recurrence_until timestamptz;
