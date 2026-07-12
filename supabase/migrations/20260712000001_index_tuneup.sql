-- Index tune-up.
--
-- events is the most-queried table (dashboard, events page, ICS feed,
-- reminder function all filter/sort on start_time) but only had its
-- primary key index. The remaining adds cover foreign keys that Postgres
-- does not index automatically, so cascaded deletes from profiles and
-- per-user lookups stop requiring sequential scans.

create index events_start_time_idx on public.events(start_time);
create index events_series_id_idx on public.events(series_id) where series_id is not null;
create index events_calendar_id_idx on public.events(calendar_id);

create index lectures_series_id_idx on public.lectures(series_id);
create index rsvps_user_id_idx on public.rsvps(user_id);
create index prayer_requests_author_id_idx on public.prayer_requests(author_id);
create index prayer_responses_profile_id_idx on public.prayer_responses(profile_id);

-- family_invites_token_idx duplicates the family_invites_token_key unique
-- constraint index; the other two are single-digit-cardinality columns on
-- tiny tables the planner never picks, so they only add write overhead.
drop index if exists public.family_invites_token_idx;
drop index if exists public.profiles_relationship_idx;
drop index if exists public.member_groups_display_order_idx;
