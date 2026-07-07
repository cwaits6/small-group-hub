


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."current_family_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select family_id from public.profiles where id = auth.uid();
$$;


ALTER FUNCTION "public"."current_family_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_profile_email"("profile_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select email
  from public.profiles
  where id = profile_id
    and family_id = public.current_family_id();
$$;


ALTER FUNCTION "public"."get_profile_email"("profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_profile_role"("profile_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select role
  from public.profiles
  where id = profile_id
    and family_id = public.current_family_id();
$$;


ALTER FUNCTION "public"."get_profile_role"("profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  _role text := 'pending';
  _full_name text := new.raw_user_meta_data->>'full_name';
  _first text;
  _last text;
begin
  if exists (
    select 1 from public.access_requests
    where email = new.email
      and status = 'approved'
  ) then
    _role := 'member';
  end if;

  if _full_name is not null and btrim(_full_name) <> '' then
    if position(' ' in btrim(_full_name)) = 0 then
      _first := btrim(_full_name);
      _last := null;
    else
      _first := btrim(substring(btrim(_full_name) from 1 for (length(btrim(_full_name)) - position(' ' in reverse(btrim(_full_name))))));
      _last := btrim(substring(btrim(_full_name) from (length(btrim(_full_name)) - position(' ' in reverse(btrim(_full_name))) + 2)));
    end if;
  end if;

  insert into public.profiles (id, first_name, last_name, email, role, relationship)
  values (new.id, _first, _last, new.email, _role, 'primary');
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_content_editor"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('content_editor', 'admin')
  );
$$;


ALTER FUNCTION "public"."is_content_editor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_group_leader"("_group_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select exists (
    select 1 from public.profile_groups
    where profile_id = auth.uid()
      and group_id = _group_id
      and is_leader = true
  );
$$;


ALTER FUNCTION "public"."is_group_leader"("_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_member"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('member', 'content_editor', 'admin')
  );
$$;


ALTER FUNCTION "public"."is_member"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."access_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "message" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "signup_token" "text",
    "token_expires_at" timestamp with time zone,
    "invite_token" "uuid",
    CONSTRAINT "access_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'denied'::"text"])))
);


ALTER TABLE "public"."access_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."announcements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "is_published" boolean DEFAULT false NOT NULL,
    "author_id" "uuid",
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."announcements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calendar_subscription_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."calendar_subscription_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_calendars" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "color" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_calendars" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "location" "text",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "calendar_id" "uuid",
    "is_rsvp_enabled" boolean DEFAULT true NOT NULL,
    "recurrence_frequency" "text",
    "recurrence_interval" integer DEFAULT 1 NOT NULL,
    "recurrence_end_mode" "text",
    "recurrence_count" integer,
    "recurrence_until" timestamp with time zone,
    "series_id" "uuid",
    "series_occurrence_date" timestamp with time zone,
    CONSTRAINT "events_recurrence_end_mode_check" CHECK (("recurrence_end_mode" = ANY (ARRAY['never'::"text", 'count'::"text", 'until'::"text"]))),
    CONSTRAINT "events_recurrence_frequency_check" CHECK (("recurrence_frequency" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'monthly'::"text", 'yearly'::"text"])))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."family_units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "family_name" "text" NOT NULL,
    "address_line1" "text",
    "address_line2" "text",
    "city" "text",
    "state" "text",
    "postal_code" "text",
    "phone_home" "text",
    "hide_address" boolean DEFAULT false NOT NULL,
    "hide_phone_home" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "anniversary" "date",
    "photo_url" "text"
);


ALTER TABLE "public"."family_units" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."families_directory" WITH ("security_invoker"='true') AS
 SELECT "id",
    "family_name",
    "photo_url",
        CASE
            WHEN "hide_address" THEN NULL::"text"
            ELSE "address_line1"
        END AS "address_line1",
        CASE
            WHEN "hide_address" THEN NULL::"text"
            ELSE "address_line2"
        END AS "address_line2",
        CASE
            WHEN "hide_address" THEN NULL::"text"
            ELSE "city"
        END AS "city",
        CASE
            WHEN "hide_address" THEN NULL::"text"
            ELSE "state"
        END AS "state",
        CASE
            WHEN "hide_address" THEN NULL::"text"
            ELSE "postal_code"
        END AS "postal_code",
        CASE
            WHEN "hide_phone_home" THEN NULL::"text"
            ELSE "phone_home"
        END AS "phone_home",
    "anniversary",
    "created_at",
    "updated_at"
   FROM "public"."family_units" "f";


ALTER VIEW "public"."families_directory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."family_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "family_id" "uuid" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text",
    "preferred_name" "text",
    "birth_month" smallint,
    "birth_day" smallint,
    "birth_year" smallint,
    "relationship" "text" NOT NULL,
    "avatar_url" "text",
    "is_class_member" boolean DEFAULT false NOT NULL,
    "claimed_profile_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "family_members_birth_day_check" CHECK ((("birth_day" >= 1) AND ("birth_day" <= 31))),
    CONSTRAINT "family_members_birth_month_check" CHECK ((("birth_month" >= 1) AND ("birth_month" <= 12))),
    CONSTRAINT "family_members_birth_year_check" CHECK ((("birth_year" >= 1900) AND ("birth_year" <= 2100))),
    CONSTRAINT "family_members_relationship_check" CHECK (("relationship" = ANY (ARRAY['primary'::"text", 'spouse'::"text", 'child'::"text", 'parent'::"text", 'sibling'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."family_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'pending'::"text" NOT NULL,
    "phone" "text",
    "bio" "text",
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "preferred_name" "text",
    "avatar_url" "text",
    "email" "text",
    "phone_mobile" "text",
    "phone_home" "text",
    "phone_work" "text",
    "address_line1" "text",
    "address_line2" "text",
    "city" "text",
    "state" "text",
    "postal_code" "text",
    "birth_month" smallint,
    "birth_day" smallint,
    "birth_year" smallint,
    "anniversary" "date",
    "occupation" "text",
    "employer" "text",
    "family_id" "uuid",
    "is_unlisted" boolean DEFAULT false NOT NULL,
    "hide_phone_mobile" boolean DEFAULT false NOT NULL,
    "hide_phone_home" boolean DEFAULT false NOT NULL,
    "hide_phone_work" boolean DEFAULT false NOT NULL,
    "hide_email" boolean DEFAULT false NOT NULL,
    "hide_address" boolean DEFAULT false NOT NULL,
    "hide_birthday" boolean DEFAULT false NOT NULL,
    "hide_anniversary" boolean DEFAULT false NOT NULL,
    "hide_occupation" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "relationship" "text" DEFAULT 'primary'::"text" NOT NULL,
    "hide_birth_year" boolean DEFAULT false NOT NULL,
    "setup_completed" boolean DEFAULT false NOT NULL,
    "is_prayer_team" boolean DEFAULT false NOT NULL,
    "is_greeter_team" boolean DEFAULT false NOT NULL,
    CONSTRAINT "profiles_birth_day_check" CHECK ((("birth_day" >= 1) AND ("birth_day" <= 31))),
    CONSTRAINT "profiles_birth_month_check" CHECK ((("birth_month" >= 1) AND ("birth_month" <= 12))),
    CONSTRAINT "profiles_birth_year_check" CHECK ((("birth_year" >= 1900) AND ("birth_year" <= 2100))),
    CONSTRAINT "profiles_relationship_check" CHECK (("relationship" = ANY (ARRAY['primary'::"text", 'spouse'::"text", 'child'::"text", 'parent'::"text", 'sibling'::"text", 'other'::"text"]))),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['pending'::"text", 'member'::"text", 'content_editor'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."families_directory_full" WITH ("security_invoker"='true') AS
 SELECT "id",
    "family_name",
    "photo_url",
        CASE
            WHEN "hide_address" THEN NULL::"text"
            ELSE "address_line1"
        END AS "address_line1",
        CASE
            WHEN "hide_address" THEN NULL::"text"
            ELSE "address_line2"
        END AS "address_line2",
        CASE
            WHEN "hide_address" THEN NULL::"text"
            ELSE "city"
        END AS "city",
        CASE
            WHEN "hide_address" THEN NULL::"text"
            ELSE "state"
        END AS "state",
        CASE
            WHEN "hide_address" THEN NULL::"text"
            ELSE "postal_code"
        END AS "postal_code",
        CASE
            WHEN "hide_phone_home" THEN NULL::"text"
            ELSE "phone_home"
        END AS "phone_home",
    "anniversary",
    "created_at",
    "updated_at",
    COALESCE(( SELECT "jsonb_agg"("jsonb_build_object"('id', "p"."id", 'first_name', "p"."first_name", 'last_name', "p"."last_name", 'preferred_name', "p"."preferred_name", 'avatar_url', "p"."avatar_url", 'relationship', "p"."relationship", 'is_class_member', true, 'phone_mobile',
                CASE
                    WHEN "p"."hide_phone_mobile" THEN NULL::"text"
                    ELSE "p"."phone_mobile"
                END, 'birth_month',
                CASE
                    WHEN "p"."hide_birthday" THEN NULL::smallint
                    ELSE "p"."birth_month"
                END, 'birth_day',
                CASE
                    WHEN "p"."hide_birthday" THEN NULL::smallint
                    ELSE "p"."birth_day"
                END, 'birth_year',
                CASE
                    WHEN ("p"."hide_birthday" OR "p"."hide_birth_year") THEN NULL::smallint
                    ELSE "p"."birth_year"
                END) ORDER BY "p"."relationship") AS "jsonb_agg"
           FROM "public"."profiles" "p"
          WHERE (("p"."family_id" = "f"."id") AND ("p"."is_unlisted" = false) AND ("p"."role" = ANY (ARRAY['member'::"text", 'content_editor'::"text", 'admin'::"text"])))), '[]'::"jsonb") AS "members",
    COALESCE(( SELECT "jsonb_agg"("jsonb_build_object"('id', "fm"."id", 'first_name', "fm"."first_name", 'last_name', "fm"."last_name", 'preferred_name', "fm"."preferred_name", 'avatar_url', "fm"."avatar_url", 'relationship', "fm"."relationship", 'is_class_member', "fm"."is_class_member", 'birth_month', "fm"."birth_month", 'birth_day', "fm"."birth_day", 'birth_year', "fm"."birth_year", 'claimed_profile_id', "fm"."claimed_profile_id") ORDER BY "fm"."relationship") AS "jsonb_agg"
           FROM "public"."family_members" "fm"
          WHERE ("fm"."family_id" = "f"."id")), '[]'::"jsonb") AS "family_members_list"
   FROM "public"."family_units" "f";


ALTER VIEW "public"."families_directory_full" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."family_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "family_member_id" "uuid" NOT NULL,
    "family_id" "uuid" NOT NULL,
    "invite_email" "text" NOT NULL,
    "token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sent_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."family_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lecture_series" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "teacher" "text",
    "is_archived" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lecture_series" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lectures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "video_url" "text" NOT NULL,
    "thumbnail_url" "text",
    "lecture_date" "date",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "series_id" "uuid",
    "week_number" integer,
    "scripture_reference" "text",
    "summary" "text"
);


ALTER TABLE "public"."lectures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."member_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "color" "text",
    "icon" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "functional_role" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "show_in_directory_filter" boolean DEFAULT true NOT NULL,
    CONSTRAINT "member_groups_functional_role_check" CHECK (("functional_role" = ANY (ARRAY['prayer_team'::"text", 'greeter_team'::"text"])))
);


ALTER TABLE "public"."member_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."page_content" (
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" DEFAULT ''::"text" NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."page_content" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_groups" (
    "profile_id" "uuid" NOT NULL,
    "group_id" "uuid" NOT NULL,
    "assigned_by" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_leader" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."profile_groups" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."profiles_directory" AS
SELECT
    NULL::"uuid" AS "id",
    NULL::"text" AS "first_name",
    NULL::"text" AS "last_name",
    NULL::"text" AS "preferred_name",
    NULL::"text" AS "avatar_url",
    NULL::"text" AS "role",
    NULL::"text" AS "relationship",
    NULL::"text" AS "bio",
    NULL::"uuid" AS "family_id",
    NULL::timestamp with time zone AS "created_at",
    NULL::"text" AS "email",
    NULL::"text" AS "phone_mobile",
    NULL::"text" AS "phone_home",
    NULL::"text" AS "phone_work",
    NULL::"text" AS "address_line1",
    NULL::"text" AS "address_line2",
    NULL::"text" AS "city",
    NULL::"text" AS "state",
    NULL::"text" AS "postal_code",
    NULL::smallint AS "birth_month",
    NULL::smallint AS "birth_day",
    NULL::smallint AS "birth_year",
    NULL::"date" AS "anniversary",
    NULL::"text" AS "occupation",
    NULL::"text" AS "employer",
    NULL::"jsonb" AS "groups";


ALTER VIEW "public"."profiles_directory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rsvps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rsvps_status_check" CHECK (("status" = ANY (ARRAY['yes'::"text", 'no'::"text", 'maybe'::"text"])))
);


ALTER TABLE "public"."rsvps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."serving_broadcasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "sent_by" "uuid",
    "subject" "text" NOT NULL,
    "open_dates" "date"[] DEFAULT '{}'::"date"[] NOT NULL,
    "recipient_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."serving_broadcasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."serving_signup_attendees" (
    "signup_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL
);


ALTER TABLE "public"."serving_signup_attendees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."serving_signups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "service_date" "date" NOT NULL,
    "family_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."serving_signups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."serving_team_settings" (
    "group_id" "uuid" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "reminder_days" integer[] DEFAULT '{4,5}'::integer[] NOT NULL,
    "reminder_method" "text" DEFAULT 'email'::"text" NOT NULL,
    "window_weeks" integer DEFAULT 8 NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "serving_team_settings_reminder_days_check" CHECK (("reminder_days" <@ ARRAY[0, 1, 2, 3, 4, 5, 6])),
    CONSTRAINT "serving_team_settings_reminder_method_check" CHECK (("reminder_method" = 'email'::"text")),
    CONSTRAINT "serving_team_settings_window_weeks_check" CHECK ((("window_weeks" >= 1) AND ("window_weeks" <= 26)))
);


ALTER TABLE "public"."serving_team_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_settings" (
    "key" "text" NOT NULL,
    "value" "text",
    "updated_by" "uuid",
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."site_settings" OWNER TO "postgres";


ALTER TABLE ONLY "public"."access_requests"
    ADD CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."access_requests"
    ADD CONSTRAINT "access_requests_signup_token_key" UNIQUE ("signup_token");



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_subscription_tokens"
    ADD CONSTRAINT "calendar_subscription_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_subscription_tokens"
    ADD CONSTRAINT "calendar_subscription_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."calendar_subscription_tokens"
    ADD CONSTRAINT "calendar_subscription_tokens_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."event_calendars"
    ADD CONSTRAINT "event_calendars_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_invites"
    ADD CONSTRAINT "family_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_invites"
    ADD CONSTRAINT "family_invites_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_units"
    ADD CONSTRAINT "family_units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lecture_series"
    ADD CONSTRAINT "lecture_series_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lectures"
    ADD CONSTRAINT "lectures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member_groups"
    ADD CONSTRAINT "member_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."page_content"
    ADD CONSTRAINT "page_content_pkey" PRIMARY KEY ("slug");



ALTER TABLE ONLY "public"."profile_groups"
    ADD CONSTRAINT "profile_groups_pkey" PRIMARY KEY ("profile_id", "group_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rsvps"
    ADD CONSTRAINT "rsvps_event_id_user_id_key" UNIQUE ("event_id", "user_id");



ALTER TABLE ONLY "public"."rsvps"
    ADD CONSTRAINT "rsvps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."serving_broadcasts"
    ADD CONSTRAINT "serving_broadcasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."serving_signup_attendees"
    ADD CONSTRAINT "serving_signup_attendees_pkey" PRIMARY KEY ("signup_id", "profile_id");



ALTER TABLE ONLY "public"."serving_signups"
    ADD CONSTRAINT "serving_signups_group_id_service_date_key" UNIQUE ("group_id", "service_date");



ALTER TABLE ONLY "public"."serving_signups"
    ADD CONSTRAINT "serving_signups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."serving_team_settings"
    ADD CONSTRAINT "serving_team_settings_pkey" PRIMARY KEY ("group_id");



ALTER TABLE ONLY "public"."site_settings"
    ADD CONSTRAINT "site_settings_pkey" PRIMARY KEY ("key");



CREATE INDEX "access_requests_invite_token_idx" ON "public"."access_requests" USING "btree" ("invite_token");



CREATE INDEX "family_invites_family_id_idx" ON "public"."family_invites" USING "btree" ("family_id");



CREATE INDEX "family_invites_family_member_id_idx" ON "public"."family_invites" USING "btree" ("family_member_id");



CREATE INDEX "family_invites_token_idx" ON "public"."family_invites" USING "btree" ("token");



CREATE INDEX "family_members_claimed_profile_idx" ON "public"."family_members" USING "btree" ("claimed_profile_id");



CREATE INDEX "family_members_family_id_idx" ON "public"."family_members" USING "btree" ("family_id");



CREATE INDEX "member_groups_display_order_idx" ON "public"."member_groups" USING "btree" ("display_order");



CREATE INDEX "member_groups_functional_role_idx" ON "public"."member_groups" USING "btree" ("functional_role");



CREATE INDEX "profile_groups_group_id_idx" ON "public"."profile_groups" USING "btree" ("group_id");



CREATE INDEX "profiles_family_id_idx" ON "public"."profiles" USING "btree" ("family_id");



CREATE INDEX "profiles_last_first_idx" ON "public"."profiles" USING "btree" ("last_name", "first_name");



CREATE INDEX "profiles_relationship_idx" ON "public"."profiles" USING "btree" ("relationship");



CREATE INDEX "serving_signup_attendees_profile_idx" ON "public"."serving_signup_attendees" USING "btree" ("profile_id");



CREATE INDEX "serving_signups_service_date_idx" ON "public"."serving_signups" USING "btree" ("service_date");



CREATE OR REPLACE VIEW "public"."profiles_directory" WITH ("security_invoker"='true') AS
 SELECT "p"."id",
    "p"."first_name",
    "p"."last_name",
    "p"."preferred_name",
    "p"."avatar_url",
    "p"."role",
    "p"."relationship",
    "p"."bio",
    "p"."family_id",
    "p"."created_at",
        CASE
            WHEN "p"."hide_email" THEN NULL::"text"
            ELSE "p"."email"
        END AS "email",
        CASE
            WHEN "p"."hide_phone_mobile" THEN NULL::"text"
            ELSE "p"."phone_mobile"
        END AS "phone_mobile",
        CASE
            WHEN "p"."hide_phone_home" THEN NULL::"text"
            ELSE "p"."phone_home"
        END AS "phone_home",
        CASE
            WHEN "p"."hide_phone_work" THEN NULL::"text"
            ELSE "p"."phone_work"
        END AS "phone_work",
        CASE
            WHEN "p"."hide_address" THEN NULL::"text"
            ELSE "p"."address_line1"
        END AS "address_line1",
        CASE
            WHEN "p"."hide_address" THEN NULL::"text"
            ELSE "p"."address_line2"
        END AS "address_line2",
        CASE
            WHEN "p"."hide_address" THEN NULL::"text"
            ELSE "p"."city"
        END AS "city",
        CASE
            WHEN "p"."hide_address" THEN NULL::"text"
            ELSE "p"."state"
        END AS "state",
        CASE
            WHEN "p"."hide_address" THEN NULL::"text"
            ELSE "p"."postal_code"
        END AS "postal_code",
        CASE
            WHEN "p"."hide_birthday" THEN NULL::smallint
            ELSE "p"."birth_month"
        END AS "birth_month",
        CASE
            WHEN "p"."hide_birthday" THEN NULL::smallint
            ELSE "p"."birth_day"
        END AS "birth_day",
        CASE
            WHEN ("p"."hide_birthday" OR "p"."hide_birth_year") THEN NULL::smallint
            ELSE "p"."birth_year"
        END AS "birth_year",
        CASE
            WHEN "p"."hide_anniversary" THEN NULL::"date"
            ELSE "p"."anniversary"
        END AS "anniversary",
        CASE
            WHEN "p"."hide_occupation" THEN NULL::"text"
            ELSE "p"."occupation"
        END AS "occupation",
        CASE
            WHEN "p"."hide_occupation" THEN NULL::"text"
            ELSE "p"."employer"
        END AS "employer",
    COALESCE("jsonb_agg"("jsonb_build_object"('id', "mg"."id", 'name', "mg"."name", 'color', "mg"."color", 'icon', "mg"."icon") ORDER BY "mg"."display_order") FILTER (WHERE ("mg"."id" IS NOT NULL)), '[]'::"jsonb") AS "groups"
   FROM (("public"."profiles" "p"
     LEFT JOIN "public"."profile_groups" "pg" ON (("p"."id" = "pg"."profile_id")))
     LEFT JOIN "public"."member_groups" "mg" ON (("pg"."group_id" = "mg"."id")))
  WHERE (("p"."is_unlisted" = false) AND ("p"."role" = ANY (ARRAY['member'::"text", 'content_editor'::"text", 'admin'::"text"])))
  GROUP BY "p"."id";



CREATE OR REPLACE TRIGGER "family_members_touch_updated_at" BEFORE UPDATE ON "public"."family_members" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "family_units_touch_updated_at" BEFORE UPDATE ON "public"."family_units" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "member_groups_touch_updated_at" BEFORE UPDATE ON "public"."member_groups" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "profiles_touch_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



ALTER TABLE ONLY "public"."access_requests"
    ADD CONSTRAINT "access_requests_invite_token_fkey" FOREIGN KEY ("invite_token") REFERENCES "public"."family_invites"("token") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."access_requests"
    ADD CONSTRAINT "access_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."calendar_subscription_tokens"
    ADD CONSTRAINT "calendar_subscription_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_calendars"
    ADD CONSTRAINT "event_calendars_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "public"."event_calendars"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."family_invites"
    ADD CONSTRAINT "family_invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."family_invites"
    ADD CONSTRAINT "family_invites_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "public"."family_units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."family_invites"
    ADD CONSTRAINT "family_invites_family_member_id_fkey" FOREIGN KEY ("family_member_id") REFERENCES "public"."family_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_claimed_profile_id_fkey" FOREIGN KEY ("claimed_profile_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "public"."family_units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lectures"
    ADD CONSTRAINT "lectures_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."lectures"
    ADD CONSTRAINT "lectures_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "public"."lecture_series"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."member_groups"
    ADD CONSTRAINT "member_groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."page_content"
    ADD CONSTRAINT "page_content_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."profile_groups"
    ADD CONSTRAINT "profile_groups_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profile_groups"
    ADD CONSTRAINT "profile_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."member_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_groups"
    ADD CONSTRAINT "profile_groups_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "public"."family_units"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rsvps"
    ADD CONSTRAINT "rsvps_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rsvps"
    ADD CONSTRAINT "rsvps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."serving_broadcasts"
    ADD CONSTRAINT "serving_broadcasts_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."member_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."serving_broadcasts"
    ADD CONSTRAINT "serving_broadcasts_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."serving_signup_attendees"
    ADD CONSTRAINT "serving_signup_attendees_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."serving_signup_attendees"
    ADD CONSTRAINT "serving_signup_attendees_signup_id_fkey" FOREIGN KEY ("signup_id") REFERENCES "public"."serving_signups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."serving_signups"
    ADD CONSTRAINT "serving_signups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."serving_signups"
    ADD CONSTRAINT "serving_signups_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "public"."family_units"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."serving_signups"
    ADD CONSTRAINT "serving_signups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."member_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."serving_team_settings"
    ADD CONSTRAINT "serving_team_settings_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."member_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."serving_team_settings"
    ADD CONSTRAINT "serving_team_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."site_settings"
    ADD CONSTRAINT "site_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



CREATE POLICY "Admins can delete announcements" ON "public"."announcements" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can delete event calendars" ON "public"."event_calendars" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can delete events" ON "public"."events" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can delete family members" ON "public"."family_members" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can delete family units" ON "public"."family_units" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can delete lectures" ON "public"."lectures" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can delete member groups" ON "public"."member_groups" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can delete page content" ON "public"."page_content" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can delete profile groups" ON "public"."profile_groups" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can delete series" ON "public"."lecture_series" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can delete serving settings" ON "public"."serving_team_settings" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can insert announcements" ON "public"."announcements" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can insert event calendars" ON "public"."event_calendars" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can insert events" ON "public"."events" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can insert family invites" ON "public"."family_invites" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can insert family members" ON "public"."family_members" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can insert family units" ON "public"."family_units" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can insert lectures" ON "public"."lectures" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can insert member groups" ON "public"."member_groups" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can insert profile groups" ON "public"."profile_groups" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can insert series" ON "public"."lecture_series" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can update access requests" ON "public"."access_requests" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Admins can update announcements" ON "public"."announcements" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Admins can update event calendars" ON "public"."event_calendars" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Admins can update events" ON "public"."events" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Admins can update family invites" ON "public"."family_invites" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Admins can update family members" ON "public"."family_members" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Admins can update family units" ON "public"."family_units" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Admins can update lectures" ON "public"."lectures" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Admins can update member groups" ON "public"."member_groups" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Admins can update profile groups" ON "public"."profile_groups" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Admins can update profiles" ON "public"."profiles" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Admins can update series" ON "public"."lecture_series" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Admins can update settings" ON "public"."site_settings" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Admins can view access requests" ON "public"."access_requests" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admins can view all profiles" ON "public"."profiles" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admins full access rsvps" ON "public"."rsvps" USING ("public"."is_admin"());



CREATE POLICY "Anyone can read event calendars" ON "public"."event_calendars" FOR SELECT USING (true);



CREATE POLICY "Anyone can read page content" ON "public"."page_content" FOR SELECT USING (true);



CREATE POLICY "Anyone can read settings" ON "public"."site_settings" FOR SELECT USING (true);



CREATE POLICY "Anyone can submit access request" ON "public"."access_requests" FOR INSERT WITH CHECK (true);



CREATE POLICY "Editors can insert page content" ON "public"."page_content" FOR INSERT WITH CHECK ("public"."is_content_editor"());



CREATE POLICY "Editors can update page content" ON "public"."page_content" FOR UPDATE USING ("public"."is_content_editor"());



CREATE POLICY "Household leaders can delete own household family members" ON "public"."family_members" FOR DELETE USING ((("family_id" = "public"."current_family_id"()) AND "public"."is_member"() AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "self"
  WHERE (("self"."id" = "auth"."uid"()) AND ("self"."relationship" = ANY (ARRAY['primary'::"text", 'spouse'::"text"])))))));



CREATE POLICY "Household leaders can insert own household family members" ON "public"."family_members" FOR INSERT WITH CHECK ((("family_id" = "public"."current_family_id"()) AND "public"."is_member"() AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "self"
  WHERE (("self"."id" = "auth"."uid"()) AND ("self"."relationship" = ANY (ARRAY['primary'::"text", 'spouse'::"text"])))))));



CREATE POLICY "Household leaders can update household member profiles" ON "public"."profiles" FOR UPDATE USING ((("auth"."uid"() <> "id") AND ("family_id" IS NOT NULL) AND ("family_id" = "public"."current_family_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "self"
  WHERE (("self"."id" = "auth"."uid"()) AND ("self"."relationship" = ANY (ARRAY['primary'::"text", 'spouse'::"text"])) AND ("self"."role" = ANY (ARRAY['member'::"text", 'content_editor'::"text", 'admin'::"text"]))))))) WITH CHECK ((("family_id" = "public"."current_family_id"()) AND ("role" = "public"."get_profile_role"("id")) AND (NOT ("email" IS DISTINCT FROM "public"."get_profile_email"("id")))));



CREATE POLICY "Household leaders can update own household family members" ON "public"."family_members" FOR UPDATE USING ((("family_id" = "public"."current_family_id"()) AND "public"."is_member"() AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "self"
  WHERE (("self"."id" = "auth"."uid"()) AND ("self"."relationship" = ANY (ARRAY['primary'::"text", 'spouse'::"text"])))))));



CREATE POLICY "Household members can view each other's full profiles" ON "public"."profiles" FOR SELECT USING ((("family_id" IS NOT NULL) AND ("family_id" = "public"."current_family_id"()) AND ("auth"."uid"() <> "id") AND "public"."is_member"()));



CREATE POLICY "Household primary can insert family invites" ON "public"."family_invites" FOR INSERT WITH CHECK (("public"."is_member"() AND ("family_id" IN ( SELECT "profiles"."family_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."family_id" IS NOT NULL))))));



CREATE POLICY "Household primary can update family invites" ON "public"."family_invites" FOR UPDATE USING (("public"."is_member"() AND ("family_id" IN ( SELECT "profiles"."family_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."family_id" IS NOT NULL))))));



CREATE POLICY "Leaders and admins can insert serving settings" ON "public"."serving_team_settings" FOR INSERT WITH CHECK (("public"."is_admin"() OR "public"."is_group_leader"("group_id")));



CREATE POLICY "Leaders and admins can log serving broadcasts" ON "public"."serving_broadcasts" FOR INSERT WITH CHECK ((("sent_by" = "auth"."uid"()) AND ("public"."is_admin"() OR "public"."is_group_leader"("group_id"))));



CREATE POLICY "Leaders and admins can update serving settings" ON "public"."serving_team_settings" FOR UPDATE USING (("public"."is_admin"() OR "public"."is_group_leader"("group_id")));



CREATE POLICY "Leaders and admins can view serving broadcasts" ON "public"."serving_broadcasts" FOR SELECT USING (("public"."is_admin"() OR "public"."is_group_leader"("group_id")));



CREATE POLICY "Lectures visible to all" ON "public"."lectures" FOR SELECT USING (true);



CREATE POLICY "Members can create own subscription token" ON "public"."calendar_subscription_tokens" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Members can create serving signups" ON "public"."serving_signups" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) AND ("public"."is_admin"() OR "public"."is_group_leader"("group_id") OR (EXISTS ( SELECT 1
   FROM "public"."profile_groups" "pg"
  WHERE (("pg"."profile_id" = "auth"."uid"()) AND ("pg"."group_id" = "serving_signups"."group_id")))))));



CREATE POLICY "Members can delete own rsvp" ON "public"."rsvps" FOR DELETE USING ((("auth"."uid"() = "user_id") AND "public"."is_member"()));



CREATE POLICY "Members can delete own serving signups" ON "public"."serving_signups" FOR DELETE USING ((("created_by" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_group_leader"("group_id")));



CREATE POLICY "Members can insert own rsvp" ON "public"."rsvps" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND "public"."is_member"()));



CREATE POLICY "Members can update own family unit" ON "public"."family_units" FOR UPDATE USING ((("id" = "public"."current_family_id"()) AND "public"."is_member"()));



CREATE POLICY "Members can update own rsvp" ON "public"."rsvps" FOR UPDATE USING ((("auth"."uid"() = "user_id") AND "public"."is_member"()));



CREATE POLICY "Members can view all announcements" ON "public"."announcements" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "Members can view all events" ON "public"."events" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "Members can view directory profiles" ON "public"."profiles" FOR SELECT USING (("public"."is_member"() AND ("is_unlisted" = false) AND ("role" = ANY (ARRAY['member'::"text", 'content_editor'::"text", 'admin'::"text"]))));



CREATE POLICY "Members can view family invites" ON "public"."family_invites" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "Members can view family members" ON "public"."family_members" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "Members can view family units" ON "public"."family_units" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "Members can view member groups" ON "public"."member_groups" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "Members can view own subscription token" ON "public"."calendar_subscription_tokens" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Members can view profile groups" ON "public"."profile_groups" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "Members can view rsvps" ON "public"."rsvps" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "Members can view serving attendees" ON "public"."serving_signup_attendees" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "Members can view serving settings" ON "public"."serving_team_settings" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "Members can view serving signups" ON "public"."serving_signups" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "Published announcements visible to all" ON "public"."announcements" FOR SELECT USING (("is_published" = true));



CREATE POLICY "Series visible to all" ON "public"."lecture_series" FOR SELECT USING (true);



CREATE POLICY "Signup owners can add attendees" ON "public"."serving_signup_attendees" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."serving_signups" "s"
  WHERE (("s"."id" = "serving_signup_attendees"."signup_id") AND (("s"."created_by" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_group_leader"("s"."group_id"))))));



CREATE POLICY "Signup owners can remove attendees" ON "public"."serving_signup_attendees" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."serving_signups" "s"
  WHERE (("s"."id" = "serving_signup_attendees"."signup_id") AND (("s"."created_by" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_group_leader"("s"."group_id"))))));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."access_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."announcements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calendar_subscription_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_calendars" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."family_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."family_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."family_units" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lecture_series" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lectures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."member_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."page_content" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rsvps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."serving_broadcasts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."serving_signup_attendees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."serving_signups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."serving_team_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_settings" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."current_family_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_family_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_family_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_profile_email"("profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_profile_email"("profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_profile_email"("profile_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_profile_role"("profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_profile_role"("profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_profile_role"("profile_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_content_editor"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_content_editor"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_content_editor"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_group_leader"("_group_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_group_leader"("_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_group_leader"("_group_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_member"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_member"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_member"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."access_requests" TO "anon";
GRANT ALL ON TABLE "public"."access_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."access_requests" TO "service_role";



GRANT ALL ON TABLE "public"."announcements" TO "anon";
GRANT ALL ON TABLE "public"."announcements" TO "authenticated";
GRANT ALL ON TABLE "public"."announcements" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_subscription_tokens" TO "anon";
GRANT ALL ON TABLE "public"."calendar_subscription_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_subscription_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."event_calendars" TO "anon";
GRANT ALL ON TABLE "public"."event_calendars" TO "authenticated";
GRANT ALL ON TABLE "public"."event_calendars" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."family_units" TO "anon";
GRANT ALL ON TABLE "public"."family_units" TO "authenticated";
GRANT ALL ON TABLE "public"."family_units" TO "service_role";



GRANT ALL ON TABLE "public"."families_directory" TO "anon";
GRANT ALL ON TABLE "public"."families_directory" TO "authenticated";
GRANT ALL ON TABLE "public"."families_directory" TO "service_role";



GRANT ALL ON TABLE "public"."family_members" TO "anon";
GRANT ALL ON TABLE "public"."family_members" TO "authenticated";
GRANT ALL ON TABLE "public"."family_members" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."families_directory_full" TO "anon";
GRANT ALL ON TABLE "public"."families_directory_full" TO "authenticated";
GRANT ALL ON TABLE "public"."families_directory_full" TO "service_role";



GRANT ALL ON TABLE "public"."family_invites" TO "anon";
GRANT ALL ON TABLE "public"."family_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."family_invites" TO "service_role";



GRANT ALL ON TABLE "public"."lecture_series" TO "anon";
GRANT ALL ON TABLE "public"."lecture_series" TO "authenticated";
GRANT ALL ON TABLE "public"."lecture_series" TO "service_role";



GRANT ALL ON TABLE "public"."lectures" TO "anon";
GRANT ALL ON TABLE "public"."lectures" TO "authenticated";
GRANT ALL ON TABLE "public"."lectures" TO "service_role";



GRANT ALL ON TABLE "public"."member_groups" TO "anon";
GRANT ALL ON TABLE "public"."member_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."member_groups" TO "service_role";



GRANT ALL ON TABLE "public"."page_content" TO "anon";
GRANT ALL ON TABLE "public"."page_content" TO "authenticated";
GRANT ALL ON TABLE "public"."page_content" TO "service_role";



GRANT ALL ON TABLE "public"."profile_groups" TO "anon";
GRANT ALL ON TABLE "public"."profile_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_groups" TO "service_role";



GRANT ALL ON TABLE "public"."profiles_directory" TO "anon";
GRANT ALL ON TABLE "public"."profiles_directory" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles_directory" TO "service_role";



GRANT ALL ON TABLE "public"."rsvps" TO "anon";
GRANT ALL ON TABLE "public"."rsvps" TO "authenticated";
GRANT ALL ON TABLE "public"."rsvps" TO "service_role";



GRANT ALL ON TABLE "public"."serving_broadcasts" TO "anon";
GRANT ALL ON TABLE "public"."serving_broadcasts" TO "authenticated";
GRANT ALL ON TABLE "public"."serving_broadcasts" TO "service_role";



GRANT ALL ON TABLE "public"."serving_signup_attendees" TO "anon";
GRANT ALL ON TABLE "public"."serving_signup_attendees" TO "authenticated";
GRANT ALL ON TABLE "public"."serving_signup_attendees" TO "service_role";



GRANT ALL ON TABLE "public"."serving_signups" TO "anon";
GRANT ALL ON TABLE "public"."serving_signups" TO "authenticated";
GRANT ALL ON TABLE "public"."serving_signups" TO "service_role";



GRANT ALL ON TABLE "public"."serving_team_settings" TO "anon";
GRANT ALL ON TABLE "public"."serving_team_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."serving_team_settings" TO "service_role";



GRANT ALL ON TABLE "public"."site_settings" TO "anon";
GRANT ALL ON TABLE "public"."site_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."site_settings" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







