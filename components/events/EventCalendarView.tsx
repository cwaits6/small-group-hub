"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DatesSetArg, EventClickArg, EventInput } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import type { Event, EventCalendar } from "@/lib/types";

interface EventCalendarViewProps {
  events: (Event & { calendar?: EventCalendar | null })[];
  visibleCalendarIds: Set<string | null>;
  isAdmin?: boolean;
}

export function EventCalendarView({ events, visibleCalendarIds, isAdmin }: EventCalendarViewProps) {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar>(null);
  const [currentView, setCurrentView] = useState("dayGridMonth");

  const filteredEvents: EventInput[] = useMemo(() => events
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
    }), [events, visibleCalendarIds]);

  const handleEventClick = (info: EventClickArg) => {
    router.push(`/events/${info.event.id}`);
  };

  const handleDateClick = (info: DateClickArg) => {
    if (!isAdmin) return;
    const date = info.dateStr.split("T")[0]; // normalize to YYYY-MM-DD
    router.push(`/admin/events/new?date=${date}`);
  };

  const handleDatesSet = (arg: DatesSetArg) => {
    setCurrentView(arg.view.type);
  };

  useEffect(() => {
    if (currentView !== "timeGridWeek") return;

    const timeoutId = window.setTimeout(() => {
      calendarRef.current?.getApi().scrollToTime("08:00:00");
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [currentView]);

  return (
    <div className="bg-white rounded-[2rem] border-2 border-emerald-100 overflow-hidden p-5 shadow-sm [&_.fc-event]:cursor-pointer">
      <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-4 md:p-5">
        {/* Custom navigation buttons */}
        <div className="mb-3 flex items-center gap-1.5">
          <button
            onClick={() => calendarRef.current?.getApi().prev()}
            className="cursor-pointer rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:border-emerald-300 hover:text-brand-primary"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => calendarRef.current?.getApi().next()}
            className="cursor-pointer rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:border-emerald-300 hover:text-brand-primary"
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "today",
            center: "title",
            right: "dayGridMonth,timeGridWeek",
          }}
          events={filteredEvents}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          datesSet={handleDatesSet}
          selectable={isAdmin}
          height={currentView === "timeGridWeek" ? 760 : "auto"}
          scrollTime="08:00:00"
          buttonText={{
            today: "Today",
            month: "Month",
            week: "Week",
          }}
          views={{
            timeGridWeek: {
              slotMinTime: "00:00:00",
              slotMaxTime: "24:00:00",
            },
          }}
        />
      </div>
    </div>
  );
}
