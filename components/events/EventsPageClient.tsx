"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Rss, ChevronDown, SlidersHorizontal } from "lucide-react";
import { EventCalendarView } from "@/components/events/EventCalendarView";
import { EventListView } from "@/components/events/EventListView";
import { expandUpcomingEvents } from "@/lib/recurrence";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

  // For the list view, expand recurring events from the ±1-year window and
  // filter to upcoming occurrences (so "never-ending" series show future dates).
  const expandedUpcomingEvents = useMemo(
    () => expandUpcomingEvents(allEvents),
    [allEvents]
  );

  const hasUncategorized = useMemo(
    () => allEvents.some((event) => event.calendar_id === null),
    [allEvents]
  );
  const [visibleCalendarIds, setVisibleCalendarIds] = useState<Set<string | null>>(
    () => {
      const ids = new Set<string | null>(calendars.map((calendar) => calendar.id));
      ids.add(null);
      return ids;
    }
  );

  const toggleCalendar = (id: string | null) => {
    setVisibleCalendarIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const totalCalendarOptions = calendars.length + (hasUncategorized ? 1 : 0);
  const selectedCalendarCount = visibleCalendarIds.size;
  const calendarFilterSummary =
    totalCalendarOptions === 0 || selectedCalendarCount === totalCalendarOptions
      ? "All calendars"
      : `${selectedCalendarCount} selected`;

  return (
    <div>
      <div className="mb-6 rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-brand-primary">Calendar</h1>
              <p className="mt-2 text-lg text-muted-foreground">
                {isMember
                  ? "Browse the shared calendar for our group."
                  : "Browse the public calendar. Sign in to see all events and RSVP."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 md:shrink-0">
            {isAdmin && (
              <>
                <Button
                  variant="outline"
                  className="h-11 rounded-xl border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-sm hover:border-emerald-300 hover:bg-white hover:text-brand-primary"
                  nativeButton={false}
                  render={<Link href="/admin/events/new" />}
                >
                  Add Event
                </Button>
                <Button
                  variant="outline"
                  className="h-11 rounded-xl border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-sm hover:border-emerald-300 hover:bg-white hover:text-brand-primary"
                  nativeButton={false}
                  render={<Link href="/admin/calendars" />}
                >
                  Add Calendar
                </Button>
              </>
            )}

            <div className="relative">
              <Button
                onClick={() => setShowSubscribeMenu(!showSubscribeMenu)}
                variant="outline"
                className="h-11 gap-2 rounded-xl border-slate-200 bg-white px-5 text-sm font-medium text-slate-600 shadow-sm hover:border-emerald-300 hover:bg-white hover:text-brand-primary"
              >
                <Rss className="h-4 w-4" />
                Subscribe to Calendar
                <ChevronDown className="h-4 w-4" />
              </Button>

              {showSubscribeMenu && (
                <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                  <button
                    onClick={() => {
                      window.location.href = `webcal://${window.location.host}/api/calendar/feed.ics`;
                      setShowSubscribeMenu(false);
                    }}
                    className="w-full cursor-pointer border-b border-slate-100 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
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
                      className="flex w-full cursor-pointer items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 last:border-b-0"
                    >
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: cal.color ?? "#059669" }}
                      />
                      {cal.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-4 pt-1 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex w-fit items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <Button
              onClick={() => setView("calendar")}
              variant="ghost"
              className={`h-10 rounded-lg px-5 text-sm font-semibold ${
                view === "calendar"
                  ? "bg-brand-primary text-white shadow-sm hover:bg-brand-primary/90 hover:text-white"
                  : "text-slate-600 hover:bg-slate-50 hover:text-brand-primary"
              }`}
            >
              Calendar
            </Button>
            <Button
              onClick={() => setView("list")}
              variant="ghost"
              className={`h-10 rounded-lg px-5 text-sm font-semibold ${
                view === "list"
                  ? "bg-brand-primary text-white shadow-sm hover:bg-brand-primary/90 hover:text-white"
                  : "text-slate-600 hover:bg-slate-50 hover:text-brand-primary"
              }`}
            >
              List
            </Button>
          </div>

          {view === "calendar" && (calendars.length > 0 || hasUncategorized) && (
            <div className="flex flex-col gap-2 md:items-end">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Calendars
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button
                    variant="outline"
                    className="h-11 min-w-52 justify-between gap-3 rounded-xl border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-sm hover:border-emerald-300 hover:bg-white hover:text-brand-primary"
                  >
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4" />
                      {calendarFilterSummary}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                } />
                <DropdownMenuContent align="end" className="w-64 rounded-2xl">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Visible Calendars</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {calendars.map((cal) => (
                      <DropdownMenuCheckboxItem
                        key={cal.id}
                        checked={visibleCalendarIds.has(cal.id)}
                        onCheckedChange={() => toggleCalendar(cal.id)}
                        className="gap-2"
                      >
                        <span
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: cal.color ?? "#059669" }}
                        />
                        {cal.name}
                      </DropdownMenuCheckboxItem>
                    ))}
                    {hasUncategorized && (
                      <DropdownMenuCheckboxItem
                        checked={visibleCalendarIds.has(null)}
                        onCheckedChange={() => toggleCalendar(null)}
                        className="gap-2"
                      >
                        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-slate-400" />
                        Other
                      </DropdownMenuCheckboxItem>
                    )}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>

      {view === "calendar" ? (
        <EventCalendarView
          events={allEvents}
          visibleCalendarIds={visibleCalendarIds}
          isAdmin={isAdmin}
        />
      ) : (
        <EventListView
          events={expandedUpcomingEvents}
          userRsvps={userRsvps}
          userId={userId}
          isMember={isMember}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
