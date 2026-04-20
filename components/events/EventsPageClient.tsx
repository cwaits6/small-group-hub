"use client";

import { useState } from "react";
import { Rss, ChevronDown } from "lucide-react";
import { EventCalendarView } from "@/components/events/EventCalendarView";
import { EventListView } from "@/components/events/EventListView";
import { Button } from "@/components/ui/button";
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
  const [showSubscribeMenu, setShowSubscribeMenu] = useState(false);

  return (
    <div>
      {/* View toggle and subscribe dropdown */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Button
          onClick={() => setView("calendar")}
          variant={view === "calendar" ? "default" : "outline"}
          className={`text-sm font-semibold ${
            view === "calendar"
              ? "bg-brand-primary text-white shadow-sm hover:bg-brand-primary/90"
              : "text-slate-600 hover:border-emerald-300"
          }`}
        >
          Calendar
        </Button>
        <Button
          onClick={() => setView("list")}
          variant={view === "list" ? "default" : "outline"}
          className={`text-sm font-semibold ${
            view === "list"
              ? "bg-brand-primary text-white shadow-sm hover:bg-brand-primary/90"
              : "text-slate-600 hover:border-emerald-300"
          }`}
        >
          List
        </Button>

        {/* Subscribe dropdown */}
        <div className="ml-auto relative">
          <Button
            onClick={() => setShowSubscribeMenu(!showSubscribeMenu)}
            variant="outline"
            className="gap-2 text-sm font-medium text-slate-600 hover:border-emerald-300 hover:text-brand-primary"
          >
            <Rss className="h-4 w-4" />
            Subscribe to Calendar
            <ChevronDown className="h-4 w-4" />
          </Button>

          {showSubscribeMenu && (
            <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-20">
              <button
                onClick={() => {
                  window.location.href = `webcal://${window.location.host}/api/calendar/feed.ics`;
                  setShowSubscribeMenu(false);
                }}
                className="w-full cursor-pointer text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 first:rounded-t-lg border-b border-slate-100"
              >
                All Calendars
              </button>
              {calendars.map((cal) => (
                <button
                  key={cal.id}
                  onClick={() => {
                    window.location.href = `webcal://${window.location.host}/api/calendar/feed.ics?calendar=${cal.id}`;
                    setShowSubscribeMenu(false);
                  }}
                  className="w-full cursor-pointer text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 last:rounded-b-lg border-b border-slate-100 last:border-b-0 flex items-center gap-2"
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: cal.color ?? "#059669" }}
                  />
                  {cal.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {view === "calendar" ? (
        <EventCalendarView events={allEvents} calendars={calendars} isAdmin={isAdmin} />
      ) : (
        <EventListView
          events={upcomingEvents}
          userRsvps={userRsvps}
          userId={userId}
          isMember={isMember}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
