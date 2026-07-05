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

export interface ServingICSInput {
  signupId: string;
  /** YYYY-MM-DD */
  serviceDate: string;
  teamName: string;
  description?: string;
}

/** All-day calendar entry for a serving Sunday (3-element dates → VALUE=DATE). */
export function servingToICSAttributes(input: ServingICSInput): EventAttributes {
  const [y, m, d] = input.serviceDate.split("-").map(Number);
  const next = new Date(y, m - 1, d + 1);
  return {
    uid: `serving-${input.signupId}`,
    title: `Serving: ${input.teamName}`,
    start: [y, m, d],
    end: [next.getFullYear(), next.getMonth() + 1, next.getDate()],
    status: "CONFIRMED",
    ...(input.description ? { description: input.description } : {}),
  };
}

export function generateServingICS(input: ServingICSInput): string {
  const { error, value } = createEvents([servingToICSAttributes(input)]);
  if (error || !value) {
    throw new Error(`Failed to generate ICS: ${error?.message ?? "unknown error"}`);
  }
  return value;
}
