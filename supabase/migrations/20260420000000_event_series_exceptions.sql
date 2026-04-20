-- Support per-occurrence exceptions for recurring event series.
-- When a user edits "this event only", a new exception row is created with:
--   series_id               → the anchor recurring event's id
--   series_occurrence_date  → the original occurrence's start_time (so the
--                             expansion engine knows to skip that date)
-- The anchor event itself is left unchanged; the client skips series_occurrence_date
-- when expanding the series, and the exception row fills the gap.

alter table public.events
  add column series_id uuid references public.events(id) on delete cascade,
  add column series_occurrence_date timestamptz;
