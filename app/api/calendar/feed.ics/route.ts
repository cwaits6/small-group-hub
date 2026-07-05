import { createServiceClient } from "@/lib/supabase/server";
import { generateCombinedICS, type ServingICSInput } from "@/lib/ics-utils";
import type { Event } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const calendarId = searchParams.get("calendar");

  // Require a valid subscription token
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!token || !uuidRegex.test(token)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = await createServiceClient();

  const { data: sub } = await supabase
    .from("calendar_subscription_tokens")
    .select("id, user_id")
    .eq("token", token)
    .single();

  if (!sub) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Validate calendarId if provided
  if (calendarId && !uuidRegex.test(calendarId)) {
    return new Response("Invalid calendar ID", { status: 400 });
  }

  // Bound results to a reasonable time window
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from("events")
    .select("*")
    .gte("start_time", thirtyDaysAgo)
    .order("start_time", { ascending: true })
    .limit(500);

  if (calendarId) {
    query = query.eq("calendar_id", calendarId);
  }

  const [{ data: events, error: eventsError }, { data: myServings }] =
    await Promise.all([
      query,
      // Serving signups where this user is an attendee (inner join filters results)
      supabase
        .from("serving_signups")
        .select("id, service_date, member_groups(name), serving_signup_attendees!inner(profile_id)")
        .eq("serving_signup_attendees.profile_id", sub.user_id)
        .gte("service_date", thirtyDaysAgo.slice(0, 10))
        .order("service_date", { ascending: true }),
    ]);

  if (eventsError) {
    console.error("Failed to fetch events for calendar feed:", eventsError);
    return new Response("Failed to fetch events", { status: 500 });
  }

  const typedEvents = (events ?? []) as Event[];

  const servingSignups: ServingICSInput[] = (myServings ?? []).map((s) => {
    const mg = s.member_groups as unknown as { name: string } | Array<{ name: string }> | null;
    const teamName = (Array.isArray(mg) ? mg[0]?.name : mg?.name) ?? "Serving";
    return { signupId: s.id as string, serviceDate: s.service_date as string, teamName };
  });

  let icsString: string;
  try {
    icsString = generateCombinedICS(typedEvents, servingSignups);
  } catch (err) {
    console.error("ICS generation failed:", err);
    return new Response("Failed to generate calendar feed", { status: 500 });
  }

  return new Response(icsString, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
