import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { siteConfig } from "@/lib/config";
import { signupDisplayName } from "@/lib/serving/display";
import { upcomingSundays } from "@/lib/serving/sundays";
import {
  ServingSchedule,
  type ScheduleEntry,
} from "@/components/serving/ServingSchedule";
import { EmailTeamButton } from "@/components/serving/EmailTeamButton";

export const metadata = { title: `Serving | ${siteConfig.name}` };

interface AttendeeProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
}

export default async function ServingSchedulePage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: group }, { data: settings }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, role, family_id, first_name, last_name, preferred_name")
        .eq("id", user.id)
        .single(),
      supabase
        .from("member_groups")
        .select("id, name, description, color")
        .eq("id", groupId)
        .maybeSingle(),
      supabase
        .from("serving_team_settings")
        .select("*")
        .eq("group_id", groupId)
        .maybeSingle(),
    ]);

  if (!profile || profile.role === "pending") redirect("/dashboard");
  if (!group) notFound();

  const isAdmin = profile.role === "admin";
  if (!settings?.enabled && !isAdmin) redirect("/serving");

  const { data: membership } = await supabase
    .from("profile_groups")
    .select("is_leader")
    .eq("profile_id", user.id)
    .eq("group_id", groupId)
    .maybeSingle();

  const isMember = !!membership;
  const isLeader = membership?.is_leader === true;

  const { count: memberCount } = await supabase
    .from("profile_groups")
    .select("profile_id", { count: "exact", head: true })
    .eq("group_id", groupId);

  const sundays = upcomingSundays(settings?.window_weeks ?? 8);

  const { data: signups } = await supabase
    .from("serving_signups")
    .select(
      "id, service_date, created_by, family_id, serving_signup_attendees(profiles(id, first_name, last_name, preferred_name))"
    )
    .eq("group_id", groupId)
    .gte("service_date", sundays[0])
    .lte("service_date", sundays[sundays.length - 1]);

  // Household names for couple signups
  const familyIds = [
    ...new Set(
      (signups ?? [])
        .filter((s) => (s.serving_signup_attendees?.length ?? 0) > 1 && s.family_id)
        .map((s) => s.family_id as string)
    ),
  ];
  const familyNames = new Map<string, string>();
  if (familyIds.length > 0) {
    const { data: families } = await supabase
      .from("family_units")
      .select("id, family_name")
      .in("id", familyIds);
    for (const f of families ?? []) familyNames.set(f.id, f.family_name);
  }

  const entries: Record<string, ScheduleEntry> = {};
  for (const s of signups ?? []) {
    const attendees = (s.serving_signup_attendees ?? [])
      .map((a) => a.profiles as unknown as AttendeeProfile)
      .filter(Boolean);
    entries[s.service_date] = {
      id: s.id,
      date: s.service_date,
      createdBy: s.created_by,
      attendeeIds: attendees.map((a) => a.id),
      label: signupDisplayName(
        attendees,
        s.family_id ? (familyNames.get(s.family_id) ?? null) : null
      ),
    };
  }

  // Spouse option for the attendee picker ("just me" / "me & spouse")
  let spouse: { id: string; name: string } | null = null;
  if (profile.family_id) {
    const { data: spouseRow } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, preferred_name")
      .eq("family_id", profile.family_id)
      .in("relationship", ["primary", "spouse"])
      .neq("id", user.id)
      .limit(1)
      .maybeSingle();
    if (spouseRow) {
      spouse = {
        id: spouseRow.id,
        name: spouseRow.preferred_name || spouseRow.first_name || "spouse",
      };
    }
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <Link
        href="/serving"
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        All serving teams
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <span
          className="inline-block w-4 h-4 rounded-full shrink-0"
          style={{ backgroundColor: group.color ?? "#2F6BA8" }}
        />
        <h1 className="text-3xl md:text-4xl font-bold text-brand-primary">
          {group.name}
        </h1>
      </div>
      <p className="text-lg text-muted-foreground mb-8">
        {group.description ||
          "Pick a Sunday below — one signup covers the whole morning."}
      </p>

      {!settings?.enabled && isAdmin && (
        <p className="text-sm text-brand-accent mb-6">
          Serving signups are not enabled for this team yet — enable them from
          the Serving page.
        </p>
      )}

      {(isLeader || isAdmin) && settings?.enabled && (
        <div className="flex items-center gap-2 mb-6">
          <EmailTeamButton
            groupId={groupId}
            teamName={group.name}
            openDates={sundays.filter((d) => !entries[d])}
            memberCount={memberCount ?? 0}
          />
        </div>
      )}

      <ServingSchedule
        groupId={groupId}
        teamName={group.name}
        sundays={sundays}
        entries={entries}
        userId={user.id}
        spouse={spouse}
        canSignUp={isMember || isLeader || isAdmin}
        canManage={isLeader || isAdmin}
      />
    </div>
  );
}
