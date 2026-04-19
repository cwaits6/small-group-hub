"use client";

import { useState } from "react";
import { Rss } from "lucide-react";
import { EventCalendarView } from "@/components/events/EventCalendarView";
import { EventListView } from "@/components/events/EventListView";
import type { Event, EventCalendar, Rsvp } from "@/lib/types";

type View = "calendar" | "list";

interface EventsPageClientProps {
  allEvents: (Event & { calendar?: EventCalendar | null })[];
  upcomingEvents: (Event & { calendar?: EventCalendar | null })[];
  calendars: EventCalendar[];
  userRsvps: Record<string, Rsvp>;
  userId: string | null;
  isMember: boolean;
  isAdmin: boolean;
}

export function EventsPageClient({
  allEvents,
  upcomingEvents,
  calendars,
  userRsvps,
  userId,
  isMember,
  isAdmin,
}: EventsPageClientProps) {
  const [view, setView] = useState<View>("calendar");

  return (
    <div>
      {/* View toggle and subscribe button */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setView("calendar")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            view === "calendar"
              ? "bg-brand-primary text-white shadow-sm"
              : "bg-white border border-slate-200 text-slate-600 hover:border-emerald-300"
          }`}
        >
          Calendar
        </button>
        <button
          onClick={() => setView("list")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            view === "list"
              ? "bg-brand-primary text-white shadow-sm"
              : "bg-white border border-slate-200 text-slate-600 hover:border-emerald-300"
          }`}
        >
          List
        </button>
        <button
          onClick={() => {
            window.location.href = `webcal://${window.location.host}/api/calendar/feed.ics`;
          }}
          className="ml-auto inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-brand-primary transition-all bg-white"
        >
          <Rss className="h-4 w-4" />
          Subscribe
        </button>
      </div>

      {view === "calendar" ? (
        <EventCalendarView events={allEvents} calendars={calendars} isAdmin={isAdmin} />
      ) : (
        <EventListView
          events={upcomingEvents}
          userRsvps={userRsvps}
          userId={userId}
          isMember={isMember}
        />
      )}
    </div>
  );
}
