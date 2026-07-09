-- Serving roles: mark which member groups appear on the Serve page as standing
-- roles/teams (vs. plain directory tags like "Young Adults"). A serving role
-- shows a public roster to every member; if the group also has
-- serving_team_settings.enabled, its members can additionally claim Sunday
-- slots. Membership is always admin-assigned — this flag only controls where a
-- group surfaces, never how someone joins it.
--
-- The Serve page lists a group when it's a serving role OR it has signups
-- enabled (enabling signups implies it's a serving team). is_serving_role is
-- what surfaces roster-only roles like Prayer Warriors.

alter table public.member_groups
  add column is_serving_role boolean not null default false;

-- Seed the functional-role groups the app ships with — prayer team, greeters,
-- and prayer warriors are all standing serving roles.
update public.member_groups
  set is_serving_role = true
  where functional_role in ('prayer_team', 'greeter_team', 'prayer_warriors');
