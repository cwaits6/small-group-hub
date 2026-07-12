-- Fix foreign keys that block account deletion.
--
-- These constraints had no ON DELETE action, so deleting a member's
-- auth.users row (which cascades to profiles) fails as soon as they have
-- an RSVP or authored/reviewed anything. RSVPs are personal responses and
-- go with the profile; the rest are nullable audit/authorship columns
-- where the record should outlive the account.

alter table public.rsvps
  drop constraint rsvps_user_id_fkey,
  add constraint rsvps_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.announcements
  drop constraint announcements_author_id_fkey,
  add constraint announcements_author_id_fkey
    foreign key (author_id) references public.profiles(id) on delete set null;

alter table public.events
  drop constraint events_created_by_fkey,
  add constraint events_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.event_calendars
  drop constraint event_calendars_created_by_fkey,
  add constraint event_calendars_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.lectures
  drop constraint lectures_created_by_fkey,
  add constraint lectures_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.about_page
  drop constraint about_page_updated_by_fkey,
  add constraint about_page_updated_by_fkey
    foreign key (updated_by) references auth.users(id) on delete set null;

alter table public.access_requests
  drop constraint access_requests_reviewed_by_fkey,
  add constraint access_requests_reviewed_by_fkey
    foreign key (reviewed_by) references auth.users(id) on delete set null;

alter table public.page_content
  drop constraint page_content_updated_by_fkey,
  add constraint page_content_updated_by_fkey
    foreign key (updated_by) references auth.users(id) on delete set null;

alter table public.profiles
  drop constraint profiles_approved_by_fkey,
  add constraint profiles_approved_by_fkey
    foreign key (approved_by) references auth.users(id) on delete set null;

alter table public.site_settings
  drop constraint site_settings_updated_by_fkey,
  add constraint site_settings_updated_by_fkey
    foreign key (updated_by) references auth.users(id) on delete set null;
