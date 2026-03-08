import { createClient } from "@/lib/supabase/server";
import { EventCard } from "@/components/events/EventCard";
import { RsvpButton } from "@/components/events/RsvpButton";
import type { Rsvp } from "@/lib/types";

export const metadata = { title: "Events | Incouragers" };

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

  const isMember = profile?.role === "member" || profile?.role === "admin";

  // If member, show all events; otherwise, only public
  let query = supabase
    .from("events")
    .select("*")
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true });

  if (!isMember) {
    query = query.eq("is_private", false);
  }

  const { data: events } = await query;

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

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl md:text-4xl font-bold text-amber-900 mb-2">
        Upcoming Events
      </h1>
      <p className="text-lg text-muted-foreground mb-10">
        {isMember
          ? "All upcoming events for our group."
          : "Public events open to everyone. Sign in to see all events and RSVP."}
      </p>

      {events && events.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
          {events.map((event) => (
            <EventCard key={event.id} event={event}>
              {isMember && user && (
                <RsvpButton
                  eventId={event.id}
                  userId={user.id}
                  currentStatus={userRsvps[event.id]?.status ?? null}
                />
              )}
            </EventCard>
          ))}
        </div>
      ) : (
        <p className="text-xl text-muted-foreground">No upcoming events right now. Check back soon!</p>
      )}
    </div>
  );
}
