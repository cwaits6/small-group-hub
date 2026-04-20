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

  // Fetch events within a bounded window for calendar view
  let allEventsQuery = supabase
    .from("events")
    .select("*, calendar:event_calendars(*)")
    .gte("start_time", oneYearAgo)
    .lte("start_time", oneYearAhead)
    .order("start_time", { ascending: true })
    .limit(500);

  if (!isMember) {
    allEventsQuery = allEventsQuery.eq("is_private", false);
  }

  // Fetch upcoming events for list view (unbounded future)
  let upcomingEventsQuery = supabase
    .from("events")
    .select("*, calendar:event_calendars(*)")
    .gte("start_time", nowISO)
    .order("start_time", { ascending: true })
    .limit(1000);

  if (!isMember) {
    upcomingEventsQuery = upcomingEventsQuery.eq("is_private", false);
  }

  const { data: allEventsRaw, error: allEventsError } = await allEventsQuery;
  if (allEventsError) {
    console.error("Failed to fetch events:", allEventsError);
  }

  const { data: upcomingEventsRaw, error: upcomingEventsError } = await upcomingEventsQuery;
  if (upcomingEventsError) {
    console.error("Failed to fetch upcoming events:", upcomingEventsError);
  }

  // Fetch event calendars — for non-members, only include calendars with public events
  const { data: calendarsRaw, error: calendarsError } = isMember
    ? await supabase.from("event_calendars").select("*").order("name", { ascending: true })
    : await supabase
        .from("event_calendars")
        .select("*, events!inner(id)")
        .eq("events.is_private", false)
        .gte("events.start_time", oneYearAgo)
        .lte("events.start_time", oneYearAhead)
        .order("name", { ascending: true });
  if (calendarsError) {
    console.error("Failed to fetch event calendars:", calendarsError);
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
      <h1 className="text-3xl md:text-4xl font-bold text-brand-primary mb-2">
        Calendar
      </h1>
      <p className="text-lg text-muted-foreground mb-8">
        {isMember
          ? "Browse the shared calendar for our group."
          : "Browse the public calendar. Sign in to see all events and RSVP."}
      </p>

      <EventsPageClient
        allEvents={allEvents}
        upcomingEvents={upcomingEvents}
        calendars={calendars}
        userRsvps={userRsvps}
        userId={user?.id ?? null}
        isMember={isMember}
        isAdmin={isAdmin}
      />
    </div>
  );
}
