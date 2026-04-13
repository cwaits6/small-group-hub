import { createEvents, type EventAttributes } from "ics";
import type { Event } from "@/lib/types";

function parseDateToArray(
  isoString: string
): [number, number, number, number, number] {
  const d = new Date(isoString);
  return [
    d.getFullYear(),
    d.getMonth() + 1,
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
  ];
}

export function eventToICSAttributes(event: Event): EventAttributes {
  const attrs: EventAttributes = {
    uid: event.id,
    title: event.title,
    start: parseDateToArray(event.start_time),
    startInputType: "local",
    status: "CONFIRMED",
    ...(event.end_time
      ? { end: parseDateToArray(event.end_time), endInputType: "local" }
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
