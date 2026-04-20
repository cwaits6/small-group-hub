import type { Event, EventCalendar } from "@/lib/types";

const MAX_OCCURRENCES = 500;

export function addRecurrenceInterval(
  isoString: string,
  frequency: string,
  steps: number
): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;

  if (frequency === "daily") d.setDate(d.getDate() + steps);
  else if (frequency === "weekly") d.setDate(d.getDate() + steps * 7);
  else if (frequency === "monthly") d.setMonth(d.getMonth() + steps);
  else d.setFullYear(d.getFullYear() + steps);

  return d.toISOString();
}

/**
 * Build a map of { series_id → Set<occurrence_date_ms> } from exception events.
 * Pass this to expandOccurrences so it can skip dates covered by exceptions.
 */
export function buildExceptionMap(
  events: (Event & { calendar?: EventCalendar | null })[]
): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>();
  for (const e of events) {
    if (e.series_id && e.series_occurrence_date) {
      if (!map.has(e.series_id)) map.set(e.series_id, new Set());
      map.get(e.series_id)!.add(new Date(e.series_occurrence_date).getTime());
    }
  }
  return map;
}

/**
 * Expand a recurring series anchor into its individual occurrences.
 * Occurrences whose date (ms) appears in excludedTimestamps are skipped —
 * those dates are covered by per-occurrence exception rows.
 */
export function expandOccurrences(
  event: Event & { calendar?: EventCalendar | null },
  excludedTimestamps?: Set<number>,
  windowEnd?: Date
): (Event & { calendar?: EventCalendar | null })[] {
  if (event.series_id) return [event];
  const { recurrence_frequency: freq, recurrence_end_mode: endMode } = event;
  if (!freq) return [event];

  const end = windowEnd ?? new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000);
  const interval = event.recurrence_interval ?? 1;
  const untilDate =
    endMode === "until" && event.recurrence_until
      ? new Date(event.recurrence_until)
      : null;
  const maxCount =
    endMode === "count" ? (event.recurrence_count ?? 1) : MAX_OCCURRENCES;

  const results: (Event & { calendar?: EventCalendar | null })[] = [];

  for (let i = 0; i < maxCount; i++) {
    const occStart =
      i === 0
        ? event.start_time
        : addRecurrenceInterval(event.start_time, freq, interval * i);
    const occStartDate = new Date(occStart);

    if (occStartDate > end) break;
    if (untilDate && occStartDate > untilDate) break;
    if (excludedTimestamps?.has(occStartDate.getTime())) continue;

    const occEnd =
      event.end_time
        ? i === 0
          ? event.end_time
          : addRecurrenceInterval(event.end_time, freq, interval * i)
        : null;

    // Spread keeps the original `id` — all occurrences of a series navigate
    // to the same event detail page, distinguished only by ?occurrence= param.
    results.push({ ...event, start_time: occStart, end_time: occEnd });
  }

  return results;
}

/**
 * Given a list of all events (anchor rows + exception rows), return expanded
 * upcoming occurrences suitable for a list view, sorted by start_time.
 */
export function expandUpcomingEvents(
  allEvents: (Event & { calendar?: EventCalendar | null })[],
  now: Date = new Date(),
  windowEnd?: Date
): (Event & { calendar?: EventCalendar | null })[] {
  const exceptions = buildExceptionMap(allEvents);
  const results: (Event & { calendar?: EventCalendar | null })[] = [];

  for (const e of allEvents) {
    if (e.series_id) {
      // It's an exception — include directly if upcoming
      if (new Date(e.start_time) >= now) results.push(e);
    } else if (e.recurrence_frequency) {
      // Expand series; keep only upcoming occurrences
      const occurrences = expandOccurrences(e, exceptions.get(e.id), windowEnd);
      for (const occ of occurrences) {
        if (new Date(occ.start_time) >= now) results.push(occ);
      }
    } else {
      // Regular one-off event — include if upcoming
      if (new Date(e.start_time) >= now) results.push(e);
    }
  }

  return results.sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
}
