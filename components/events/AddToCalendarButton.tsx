"use client";

import { CalendarPlus } from "lucide-react";

interface AddToCalendarButtonProps {
  eventId: string;
  eventTitle: string;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
  description?: string | null;
  compact?: boolean;
}

function buildGoogleCalendarUrl(props: AddToCalendarButtonProps): string {
  const start = new Date(props.startTime);
  const end = props.endTime
    ? new Date(props.endTime)
    : new Date(start.getTime() + 60 * 60 * 1000); // default 1 hour

  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: props.eventTitle,
    dates: `${fmt(start)}/${fmt(end)}`,
  });

  if (props.location) params.set("location", props.location);
  if (props.description) params.set("details", props.description);

  return `https://calendar.google.com/calendar/render?${params}`;
}

export function AddToCalendarButton(props: AddToCalendarButtonProps) {
  const handleClick = () => {
    const isSafari =
      /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    if (isSafari) {
      // Safari handles text/calendar inline — opens Calendar.app directly
      window.location.href = `/api/events/${props.eventId}/ics`;
    } else {
      // Chrome/Firefox/Edge: use Google Calendar web UI (no download needed)
      window.open(buildGoogleCalendarUrl(props), "_blank");
    }
  };

  return (
    <button
      onClick={handleClick}
      className={
        props.compact
          ? "inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand-primary transition-colors"
          : "inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:border-emerald-300 hover:text-brand-primary transition-all bg-white"
      }
    >
      <CalendarPlus className={props.compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      Add to Calendar
    </button>
  );
}
