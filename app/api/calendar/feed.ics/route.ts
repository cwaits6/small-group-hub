import { createClient } from "@/lib/supabase/server";
import { generateMultiEventICS } from "@/lib/ics-utils";
import type { Event } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const calendarId = searchParams.get("calendar");

  const supabase = await createClient();

  let query = supabase
    .from("events")
    .select("*")
    .eq("is_private", false)
    .order("start_time", { ascending: true });

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
