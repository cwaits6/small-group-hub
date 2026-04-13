import { EventCard } from "@/components/events/EventCard";
import { RsvpButton } from "@/components/events/RsvpButton";
import type { Event, Rsvp } from "@/lib/types";

interface EventListViewProps {
  events: Event[];
  userRsvps: Record<string, Rsvp>;
  userId: string | null;
  isMember: boolean;
}

export function EventListView({ events, userRsvps, userId, isMember }: EventListViewProps) {
  if (events.length === 0) {
    return (
      <p className="text-xl text-muted-foreground">
        No upcoming events right now. Check back soon!
      </p>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
      {events.map((event) => (
        <EventCard key={event.id} event={event}>
          {isMember && userId && event.is_rsvp_enabled && (
            <RsvpButton
              eventId={event.id}
              userId={userId}
              currentStatus={userRsvps[event.id]?.status ?? null}
            />
          )}
        </EventCard>
      ))}
    </div>
  );
}
