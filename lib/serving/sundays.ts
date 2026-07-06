/**
 * Sunday date helpers for serving signups. Slots are lazy — upcoming Sundays
 * are computed here and signup rows only exist for covered dates.
 */

/** Format a Date as YYYY-MM-DD in local time (matches Postgres `date`). */
export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * The next `weeks` Sunday dates as YYYY-MM-DD strings, starting with today
 * when today is a Sunday.
 */
export function upcomingSundays(weeks: number, from: Date = new Date()): string[] {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));

  const sundays: string[] = [];
  for (let i = 0; i < weeks; i++) {
    sundays.push(toDateString(d));
    d.setDate(d.getDate() + 7);
  }
  return sundays;
}

/** "Sunday, July 12" — for buttons, emails, and confirmations. */
export function formatServiceDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** "Sunday, July 12, 2026" — when the year matters (emails, ICS text). */
export function formatServiceDateWithYear(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** True when the string is a well-formed YYYY-MM-DD for a Sunday not in the past. */
export function isValidServiceDate(dateStr: string, from: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime()) || d.getDay() !== 0) return false;
  const today = new Date(from);
  today.setHours(0, 0, 0, 0);
  return dateStr >= toDateString(today);
}

/** Days from today (local midnight) until the given service date. */
export function daysUntilService(dateStr: string, from: Date = new Date()): number {
  const today = new Date(from);
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

/**
 * All past Sundays from `from` (inclusive) up to but not including today,
 * returned newest-first. Returns empty array if `from` is today or in the future.
 */
export function pastSundaysUntil(from: string, until: Date = new Date()): string[] {
  const end = new Date(until);
  end.setHours(0, 0, 0, 0);
  // Roll back to last Sunday (exclusive of today if today is Sunday)
  const dow = end.getDay();
  end.setDate(end.getDate() - (dow === 0 ? 7 : dow));

  const start = new Date(from + "T00:00:00");
  if (end < start) return [];

  const result: string[] = [];
  const d = new Date(end);
  while (d >= start) {
    result.push(toDateString(d));
    d.setDate(d.getDate() - 7);
  }
  return result;
}
