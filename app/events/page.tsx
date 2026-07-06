import { createClient } from "@/lib/supabase/server";
import { EventsPageClient } from "@/components/events/EventsPageClient";
import { siteConfig } from "@/lib/config";
import type { Event, EventCalendar, Rsvp } from "@/lib/types";

export const metadata = { title: `Calendar | ${siteConfig.name}` };

export default async function EventsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  const isAdmin = profile?.role === "admin";
  const isMember =
    profile?.role === "member" ||
    profile?.role === "content_editor" ||
    isAdmin;

  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const oneYearAhead = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const nowISO = now.toISOString();

  // Fetch events within a bounded window for calendar view.
  // Include non-recurring events whose start_time falls in the window, AND
  // recurring anchors whose series overlaps the window (start_time <= windowEnd
  // and the series hasn't ended before the window start).
  const allEventsQuery = supabase
    .from("events")
    .select("*, calendar:event_calendars(*)")
    .lte("start_time", oneYearAhead)
    .or(
      `start_time.gte.${oneYearAgo},` +
      `and(recurrence_frequency.not.is.null,or(recurrence_until.is.null,recurrence_until.gte.${oneYearAgo}))`
    )
    .order("start_time", { ascending: true })
    .limit(500);

  // Fetch upcoming events for list view.
  // Include non-recurring events starting from now, AND recurring anchors whose
  // series hasn't ended yet (recurrence_until IS NULL or >= now).
  const upcomingEventsQuery = supabase
    .from("events")
    .select("*, calendar:event_calendars(*)")
    .or(
      `start_time.gte.${nowISO},` +
      `and(recurrence_frequency.not.is.null,or(recurrence_until.is.null,recurrence_until.gte.${nowISO}))`
    )
    .order("start_time", { ascending: true })
    .limit(1000);

  const { data: allEventsRaw, error: allEventsError } = await allEventsQuery;
  if (allEventsError) {
    console.error("Failed to fetch events:", allEventsError);
  }

  const { data: upcomingEventsRaw, error: upcomingEventsError } = await upcomingEventsQuery;
  if (upcomingEventsError) {
    console.error("Failed to fetch upcoming events:", upcomingEventsError);
  }

  // Fetch event calendars
  const { data: calendarsRaw, error: calendarsError } = await supabase
    .from("event_calendars")
    .select("*")
    .order("name", { ascending: true });
  if (calendarsError) {
    console.error("Failed to fetch event calendars:", calendarsError);
  }

  // Fetch or create the user's calendar subscription token
  let subscriptionToken: string | null = null;
  if (user && isMember) {
    const { data: existingToken } = await supabase
      .from("calendar_subscription_tokens")
      .select("token")
      .eq("user_id", user.id)
      .single();

    if (existingToken) {
      subscriptionToken = existingToken.token;
    } else {
      const { data: newToken } = await supabase
        .from("calendar_subscription_tokens")
        .insert({ user_id: user.id })
        .select("token")
        .single();
      subscriptionToken = newToken?.token ?? null;
    }
  }

  // Fetch user's RSVPs if logged in
  let userRsvps: Record<string, Rsvp> = {};
  if (user && isMember) {
    const { data: rsvps } = await supabase
      .from("rsvps")
      .select("*")
      .eq("user_id", user.id);
    if (rsvps) {
      userRsvps = Object.fromEntries(rsvps.map((r) => [r.event_id, r]));
    }
  }

  const allEvents = (allEventsRaw ?? []) as (Event & {
    calendar?: EventCalendar | null;
  })[];
  const upcomingEvents = (upcomingEventsRaw ?? []) as (Event & {
    calendar?: EventCalendar | null;
  })[];
  const calendars = (calendarsRaw ?? []) as EventCalendar[];

  return (
    <div className="container mx-auto px-4 py-12">
      <EventsPageClient
        allEvents={allEvents}
        upcomingEvents={upcomingEvents}
        calendars={calendars}
        userRsvps={userRsvps}
        userId={user?.id ?? null}
        isMember={isMember}
        isAdmin={isAdmin}
        subscriptionToken={subscriptionToken}
      />
    </div>
  );
}
