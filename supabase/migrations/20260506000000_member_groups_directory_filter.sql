-- Add show_in_directory_filter to member_groups
-- Admins control which groups appear as filter chips on the directory page.
-- Functional groups (prayer_team, greeter_team) are operational and should not
-- clutter the directory filter bar by default. Informational groups (men, women,
-- young families, etc.) default to visible so they're useful for browsing.

alter table public.member_groups
  add column show_in_directory_filter boolean not null default true;

-- Functional groups (prayer_team, greeter_team) default to hidden from directory filter
update public.member_groups
set show_in_directory_filter = false
where functional_role is not null;
