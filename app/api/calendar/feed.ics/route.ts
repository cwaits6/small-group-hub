import { createServiceClient } from "@/lib/supabase/server";
import { generateMultiEventICS } from "@/lib/ics-utils";
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
    .select("id")
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

  const { data: events, error } = await query;

  if (error) {
    console.error("Failed to fetch events for calendar feed:", error);
    return new Response("Failed to fetch events", { status: 500 });
  }

  const typedEvents = (events ?? []) as Event[];

  let icsString: string;
  try {
    icsString = generateMultiEventICS(typedEvents);
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
