"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import type { Event, EventCalendar } from "@/lib/types";

interface EventCalendarViewProps {
  events: (Event & { calendar?: EventCalendar | null })[];
  calendars: EventCalendar[];
  isAdmin?: boolean;
}

export function EventCalendarView({ events, calendars, isAdmin }: EventCalendarViewProps) {
  const router = useRouter();
  const [visibleCalendarIds, setVisibleCalendarIds] = useState<Set<string | null>>(
    () => {
      const ids = new Set<string | null>(calendars.map((c) => c.id));
      ids.add(null); // uncategorized events
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

  const filteredEvents: EventInput[] = events
    .filter((e) => visibleCalendarIds.has(e.calendar_id))
    .map((e) => {
      const color = e.calendar?.color ?? "#059669";
      return {
        id: e.id,
        title: e.title,
        start: e.start_time,
        end: e.end_time ?? undefined,
        backgroundColor: color,
        borderColor: color,
        extendedProps: { event: e },
      };
    });

  const handleEventClick = (info: EventClickArg) => {
    router.push(`/events/${info.event.id}`);
  };

  const handleDateClick = (info: DateClickArg) => {
    if (!isAdmin) return;
    const date = info.dateStr; // YYYY-MM-DD or ISO string
    router.push(`/admin/events/new?date=${date}`);
  };

  // Determine whether "uncategorized" events exist to show the chip
  const hasUncategorized = events.some((e) => e.calendar_id === null);

  return (
    <div>
      {/* Calendar filter chips */}
      {(calendars.length > 0 || hasUncategorized) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {calendars.map((cal) => {
            const active = visibleCalendarIds.has(cal.id);
            return (
              <button
                key={cal.id}
                onClick={() => toggleCalendar(cal.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-all ${
                  active
                    ? "border-transparent text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-500"
                }`}
                style={active ? { backgroundColor: cal.color ?? "#059669" } : undefined}
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: cal.color ?? "#059669" }}
                />
                {cal.name}
              </button>
            );
          })}
          {hasUncategorized && (
            <button
              onClick={() => toggleCalendar(null)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-all ${
                visibleCalendarIds.has(null)
                  ? "bg-slate-600 border-transparent text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0 bg-slate-400" />
              Other
            </button>
          )}
        </div>
      )}

      {/* FullCalendar — [&_.fc-event]:cursor-pointer makes events show pointer */}
      <div className="bg-white rounded-2xl border-2 border-emerald-100 overflow-hidden p-4 [&_.fc-event]:cursor-pointer">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek",
          }}
          events={filteredEvents}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          selectable={isAdmin}
          height="auto"
          buttonText={{
            today: "Today",
            month: "Month",
            week: "Week",
          }}
        />
      </div>
    </div>
  );
}
