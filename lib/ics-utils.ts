import { createEvents, type EventAttributes } from "ics";
import type { Event } from "@/lib/types";

function parseDateToArray(
  isoString: string
): [number, number, number, number, number] {
  const d = new Date(isoString);
  return [
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
  ];
}

export function eventToICSAttributes(event: Event): EventAttributes {
  const attrs: EventAttributes = {
    uid: event.id,
    title: event.title,
    start: parseDateToArray(event.start_time),
    startInputType: "utc",
    status: "CONFIRMED",
    ...(event.end_time
      ? { end: parseDateToArray(event.end_time), endInputType: "utc" }
      : { duration: { hours: 1 } }),
  };

  if (event.description) {
    attrs.description = event.description;
  }
  if (event.location) {
    attrs.location = event.location;
  }

  return attrs;
}

export function generateSingleEventICS(event: Event): string {
  const { error, value } = createEvents([eventToICSAttributes(event)]);
  if (error || !value) {
    throw new Error(`Failed to generate ICS: ${error?.message ?? "unknown error"}`);
  }
  return value;
}

export function generateMultiEventICS(events: Event[]): string {
  const { error, value } = createEvents(events.map(eventToICSAttributes));
  if (error || !value) {
    throw new Error(`Failed to generate ICS: ${error?.message ?? "unknown error"}`);
  }
  return value;
}
