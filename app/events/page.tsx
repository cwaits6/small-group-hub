import { createClient } from "@/lib/supabase/server";
import { EventsPageClient } from "@/components/events/EventsPageClient";
import { siteConfig } from "@/lib/config";
import type { Event, EventCalendar, Rsvp } from "@/lib/types";

export const metadata = { title: `Events | ${siteConfig.name}` };

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

  // Fetch ALL events for calendar view (past + future)
  let allEventsQuery = supabase
    .from("events")
    .select("*, calendar:event_calendars(*)")
    .order("start_time", { ascending: true });

  if (!isMember) {
    allEventsQuery = allEventsQuery.eq("is_private", false);
  }

  const { data: allEventsRaw } = await allEventsQuery;

  // Upcoming-only events for list view
  const now = new Date().toISOString();
  const upcomingEvents = (allEventsRaw ?? []).filter(
    (e) => e.start_time >= now
  );

  // Fetch event calendars
  const { data: calendarsRaw } = await supabase
    .from("event_calendars")
    .select("*")
    .order("name", { ascending: true });

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
  const calendars = (calendarsRaw ?? []) as EventCalendar[];

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl md:text-4xl font-bold text-brand-primary mb-2">
        Events
      </h1>
      <p className="text-lg text-muted-foreground mb-8">
        {isMember
          ? "All events for our group."
          : "Public events open to everyone. Sign in to see all events and RSVP."}
      </p>

      <EventsPageClient
        allEvents={allEvents}
        upcomingEvents={upcomingEvents as (Event & { calendar?: EventCalendar | null })[]}
        calendars={calendars}
        userRsvps={userRsvps}
        userId={user?.id ?? null}
        isMember={isMember}
        isAdmin={isAdmin}
      />
    </div>
  );
}
