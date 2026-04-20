-- Change events.calendar_id FK to SET NULL on delete so deleting a calendar
-- nullifies calendar_id on dependent events instead of blocking the delete.

alter table public.events
  drop constraint events_calendar_id_fkey;

alter table public.events
  add constraint events_calendar_id_fkey
    foreign key (calendar_id) references public.event_calendars(id)
    on delete set null;
