-- Simplify lecture_series: remove season, display_order, is_active.
-- Current vs past is inferred from lecture dates, not a manual toggle.
alter table public.lecture_series drop column if exists season;
alter table public.lecture_series drop column if exists display_order;
alter table public.lecture_series drop column if exists is_active;
