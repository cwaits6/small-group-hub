-- CWA-16 announcement opt-out: structural guard for the column contract.
--
-- The behavioral enforcement lives in application code
-- (app/api/serving/broadcast/route.ts filters p.email_announcements !== false,
-- and supabase/functions/send-serving-reminders skips === false), which pgTAP
-- cannot reach and the repo has no JS test runner. What pgTAP CAN pin is the
-- column contract those guards rely on: the column exists, is boolean, is
-- NOT NULL, and defaults to true — so "unset" can never read as opted out
-- and the !== false guards can never see a NULL.
--
-- Run locally through the shared stack's container (never `supabase test db`):
--
--   docker exec -i supabase_db_small-group-hub \
--     psql -U postgres -d postgres -f - < supabase/tests/email_announcements_optout.sql

begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

select has_column(
  'public', 'profiles', 'email_announcements',
  'profiles.email_announcements exists'
);

select col_type_is(
  'public', 'profiles', 'email_announcements', 'boolean',
  'profiles.email_announcements is boolean'
);

select col_not_null(
  'public', 'profiles', 'email_announcements',
  'profiles.email_announcements is NOT NULL'
);

select col_default_is(
  'public', 'profiles', 'email_announcements', 'true',
  'profiles.email_announcements defaults to true (opted in)'
);

select * from finish();
rollback;
