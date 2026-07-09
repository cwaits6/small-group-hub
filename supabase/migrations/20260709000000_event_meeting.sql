-- Meeting / video-call link on events.
-- Lives on the event row itself: a recurring series is a single anchor row
-- (expanded at render time), so setting the link once covers every occurrence.
-- Events are members-only via RLS (see 20260421000000_remove_is_private), and
-- ICS export builds its attributes explicitly, so the link and passcode are
-- never exposed to the public calendar, .ics export, or email.

alter table public.events
  add column meeting_url text,
  add column meeting_id text,
  add column meeting_passcode text,
  add column meeting_show_on_dashboard boolean not null default true,
  add column meeting_lead_minutes integer not null default 15
    check (meeting_lead_minutes between 0 and 1440);
