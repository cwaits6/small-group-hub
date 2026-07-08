-- The in-app Give page supersedes the legacy external giving pointers.
delete from public.site_settings where key in ('donation_url', 'venmo_url');

-- Dashboard "Give" tile visibility — admin toggle on /admin/giving.
-- 'on' = show the tile whenever there are live funds; 'off' = never.
insert into public.site_settings (key, value)
values ('giving_dashboard_tile', 'on')
on conflict (key) do nothing;
