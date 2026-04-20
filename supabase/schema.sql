


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

  insert into public.profiles (id, first_name, last_name, email, role)
  values (new.id, _first, _last, new.email, _role);
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
    "is_private" boolean DEFAULT false NOT NULL,
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
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."family_units" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."families_directory" WITH ("security_invoker"='true') AS
 SELECT "id",
    "family_name",
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
    "created_at",
    "updated_at"
   FROM "public"."family_units" "f";


ALTER VIEW "public"."families_directory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lectures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "video_url" "text" NOT NULL,
    "thumbnail_url" "text",
    "lecture_date" "date",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lectures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."page_content" (
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" DEFAULT ''::"text" NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."page_content" OWNER TO "postgres";


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
    CONSTRAINT "profiles_birth_day_check" CHECK ((("birth_day" >= 1) AND ("birth_day" <= 31))),
    CONSTRAINT "profiles_birth_month_check" CHECK ((("birth_month" >= 1) AND ("birth_month" <= 12))),
    CONSTRAINT "profiles_birth_year_check" CHECK ((("birth_year" >= 1900) AND ("birth_year" <= 2100))),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['pending'::"text", 'member'::"text", 'content_editor'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."profiles_directory" WITH ("security_invoker"='true') AS
 SELECT "id",
    "first_name",
    "last_name",
    "preferred_name",
    "avatar_url",
    "role",
    "bio",
    "family_id",
    "created_at",
        CASE
            WHEN "hide_email" THEN NULL::"text"
            ELSE "email"
        END AS "email",
        CASE
            WHEN "hide_phone_mobile" THEN NULL::"text"
            ELSE "phone_mobile"
        END AS "phone_mobile",
        CASE
            WHEN "hide_phone_home" THEN NULL::"text"
            ELSE "phone_home"
        END AS "phone_home",
        CASE
            WHEN "hide_phone_work" THEN NULL::"text"
            ELSE "phone_work"
        END AS "phone_work",
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
            WHEN "hide_birthday" THEN NULL::smallint
            ELSE "birth_month"
        END AS "birth_month",
        CASE
            WHEN "hide_birthday" THEN NULL::smallint
            ELSE "birth_day"
        END AS "birth_day",
        CASE
            WHEN "hide_birthday" THEN NULL::smallint
            ELSE "birth_year"
        END AS "birth_year",
        CASE
            WHEN "hide_anniversary" THEN NULL::"date"
            ELSE "anniversary"
        END AS "anniversary",
        CASE
            WHEN "hide_occupation" THEN NULL::"text"
            ELSE "occupation"
        END AS "occupation",
        CASE
            WHEN "hide_occupation" THEN NULL::"text"
            ELSE "employer"
        END AS "employer"
   FROM "public"."profiles" "p";


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



ALTER TABLE ONLY "public"."event_calendars"
    ADD CONSTRAINT "event_calendars_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_units"
    ADD CONSTRAINT "family_units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lectures"
    ADD CONSTRAINT "lectures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."page_content"
    ADD CONSTRAINT "page_content_pkey" PRIMARY KEY ("slug");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rsvps"
    ADD CONSTRAINT "rsvps_event_id_user_id_key" UNIQUE ("event_id", "user_id");



ALTER TABLE ONLY "public"."rsvps"
    ADD CONSTRAINT "rsvps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_settings"
    ADD CONSTRAINT "site_settings_pkey" PRIMARY KEY ("key");



CREATE INDEX "profiles_family_id_idx" ON "public"."profiles" USING "btree" ("family_id");



CREATE INDEX "profiles_last_first_idx" ON "public"."profiles" USING "btree" ("last_name", "first_name");



CREATE OR REPLACE TRIGGER "family_units_touch_updated_at" BEFORE UPDATE ON "public"."family_units" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "profiles_touch_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



ALTER TABLE ONLY "public"."access_requests"
    ADD CONSTRAINT "access_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."event_calendars"
    ADD CONSTRAINT "event_calendars_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "public"."event_calendars"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lectures"
    ADD CONSTRAINT "lectures_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."page_content"
    ADD CONSTRAINT "page_content_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



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



ALTER TABLE ONLY "public"."site_settings"
    ADD CONSTRAINT "site_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



CREATE POLICY "Admins can delete announcements" ON "public"."announcements" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can delete event calendars" ON "public"."event_calendars" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can delete events" ON "public"."events" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can delete family units" ON "public"."family_units" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can delete lectures" ON "public"."lectures" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can delete page content" ON "public"."page_content" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can insert announcements" ON "public"."announcements" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can insert event calendars" ON "public"."event_calendars" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can insert events" ON "public"."events" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can insert family units" ON "public"."family_units" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can insert lectures" ON "public"."lectures" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can update access requests" ON "public"."access_requests" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Admins can update announcements" ON "public"."announcements" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Admins can update event calendars" ON "public"."event_calendars" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Admins can update events" ON "public"."events" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Admins can update family units" ON "public"."family_units" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Admins can update lectures" ON "public"."lectures" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Admins can update profiles" ON "public"."profiles" FOR UPDATE USING ("public"."is_admin"());



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



CREATE POLICY "Lectures visible to all" ON "public"."lectures" FOR SELECT USING (true);



CREATE POLICY "Members can delete own rsvp" ON "public"."rsvps" FOR DELETE USING ((("auth"."uid"() = "user_id") AND "public"."is_member"()));



CREATE POLICY "Members can insert own rsvp" ON "public"."rsvps" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND "public"."is_member"()));



CREATE POLICY "Members can update own rsvp" ON "public"."rsvps" FOR UPDATE USING ((("auth"."uid"() = "user_id") AND "public"."is_member"()));



CREATE POLICY "Members can view all announcements" ON "public"."announcements" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "Members can view all events" ON "public"."events" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "Members can view directory profiles" ON "public"."profiles" FOR SELECT USING (("public"."is_member"() AND ("is_unlisted" = false) AND ("role" = ANY (ARRAY['member'::"text", 'content_editor'::"text", 'admin'::"text"]))));



CREATE POLICY "Members can view family units" ON "public"."family_units" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "Members can view rsvps" ON "public"."rsvps" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "Public events visible to all" ON "public"."events" FOR SELECT USING (("is_private" = false));



CREATE POLICY "Published announcements visible to all" ON "public"."announcements" FOR SELECT USING (("is_published" = true));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."access_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."announcements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_calendars" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."family_units" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lectures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."page_content" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rsvps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_settings" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_content_editor"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_content_editor"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_content_editor"() TO "service_role";



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



GRANT ALL ON TABLE "public"."lectures" TO "anon";
GRANT ALL ON TABLE "public"."lectures" TO "authenticated";
GRANT ALL ON TABLE "public"."lectures" TO "service_role";



GRANT ALL ON TABLE "public"."page_content" TO "anon";
GRANT ALL ON TABLE "public"."page_content" TO "authenticated";
GRANT ALL ON TABLE "public"."page_content" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."profiles_directory" TO "anon";
GRANT ALL ON TABLE "public"."profiles_directory" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles_directory" TO "service_role";



GRANT ALL ON TABLE "public"."rsvps" TO "anon";
GRANT ALL ON TABLE "public"."rsvps" TO "authenticated";
GRANT ALL ON TABLE "public"."rsvps" TO "service_role";



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







