import { createServiceClient } from "@/lib/supabase/server";
import { generateSingleEventICS } from "@/lib/ics-utils";
import type { Event } from "@/lib/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

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

  const { data: event, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !event) {
    return new Response("Event not found", { status: 404 });
  }

  const typedEvent = event as Event;

  let icsString: string;
  try {
    icsString = generateSingleEventICS(typedEvent);
  } catch (err) {
    console.error("ICS generation failed:", err);
    return new Response("Failed to generate calendar file", { status: 500 });
  }

  return new Response(icsString, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline",
      "Cache-Control": "public, max-age=300",
    },
  });
}
