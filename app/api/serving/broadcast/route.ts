import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/config";
import { displayName } from "@/lib/names";
import { getServingLinkMode } from "@/lib/serving/config";
import { createServingToken } from "@/lib/serving/links";
import { upcomingSundays } from "@/lib/serving/sundays";
import { sendServingBroadcastEmail } from "@/lib/email/serving";

/**
 * Leader "Email the team" broadcast: emails every team member the Sundays
 * that still need someone, each with its own one-tap action link.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const groupId: string | undefined = body?.groupId;
  const message: string | undefined =
    typeof body?.message === "string" ? body.message.trim().slice(0, 1000) : undefined;

  if (!groupId) {
    return NextResponse.json({ error: "Missing groupId" }, { status: 400 });
  }

  const [{ data: profile }, { data: membership }, { data: group }, { data: settings }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, first_name, last_name, preferred_name, role")
        .eq("id", user.id)
        .single(),
      supabase
        .from("profile_groups")
        .select("is_leader")
        .eq("profile_id", user.id)
        .eq("group_id", groupId)
        .maybeSingle(),
      supabase.from("member_groups").select("id, name").eq("id", groupId).single(),
      supabase
        .from("serving_team_settings")
        .select("enabled, window_weeks")
        .eq("group_id", groupId)
        .maybeSingle(),
    ]);

  const isLeader = membership?.is_leader === true;
  const isAdmin = profile?.role === "admin";
  if (!profile || (!isLeader && !isAdmin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!group || !settings?.enabled) {
    return NextResponse.json(
      { error: "Serving signups are not enabled for this team" },
      { status: 404 }
    );
  }

  // Open Sundays are recomputed here — the email must reflect the truth at
  // send time, not what the leader's page showed when it loaded
  const sundays = upcomingSundays(settings.window_weeks);
  const { data: signups } = await supabase
    .from("serving_signups")
    .select("service_date")
    .eq("group_id", groupId)
    .gte("service_date", sundays[0])
    .lte("service_date", sundays[sundays.length - 1]);

  const covered = new Set((signups ?? []).map((s) => s.service_date));
  const openDates = sundays.filter((d) => !covered.has(d));

  if (openDates.length === 0) {
    return NextResponse.json(
      { error: "Every upcoming Sunday is covered — nothing to ask for!" },
      { status: 400 }
    );
  }

  const service = await createServiceClient();
  const linkMode = await getServingLinkMode(supabase);

  const { data: memberRows } = await service
    .from("profile_groups")
    .select("profiles(id, first_name, last_name, preferred_name, email, role)")
    .eq("group_id", groupId);

  const members = (memberRows ?? [])
    .map(
      (r) =>
        r.profiles as unknown as {
          id: string;
          first_name: string | null;
          last_name: string | null;
          preferred_name: string | null;
          email: string | null;
          role: string;
        } | null
    )
    .filter((p): p is NonNullable<typeof p> => !!p?.email && p.role !== "pending");

  if (members.length === 0) {
    return NextResponse.json(
      { error: "No team members with email addresses to send to" },
      { status: 400 }
    );
  }

  const fromName = displayName(profile);
  let sent = 0;
  for (const member of members) {
    const dates = openDates.map((date) => ({
      date,
      url:
        linkMode === "signed"
          ? `${siteConfig.url}/serving/go?token=${createServingToken({
              a: "signup",
              g: groupId,
              d: date,
              p: member.id,
            })}`
          : `${siteConfig.url}/serving/${groupId}`,
    }));

    try {
      await sendServingBroadcastEmail({
        to: member.email!,
        name: member.preferred_name || member.first_name || "Friend",
        teamName: group.name,
        fromName,
        message,
        openDates: dates,
      });
      sent++;
    } catch (err) {
      console.error(`Serving broadcast to ${member.id} failed:`, err);
    }
  }

  const { error: logError } = await supabase.from("serving_broadcasts").insert({
    group_id: groupId,
    sent_by: user.id,
    subject: `${group.name}: Sundays that still need someone`,
    open_dates: openDates,
    recipient_count: sent,
  });
  if (logError) {
    console.error("Failed to log serving broadcast:", logError);
  }

  return NextResponse.json({ sent, openDates });
}
