// Sunday-date helpers for the serving reminder flows. All dates are handled
// as local-time YYYY-MM-DD strings — the serving schedule is keyed on the
// service date, not an instant, so no timezone math belongs here.

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The next Sunday on or after `from` (a Sunday returns itself). */
export function nextSunday(from: Date = new Date()): string {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return toDateStr(d);
}

/** The next `weeks` Sundays starting from nextSunday(from). */
export function upcomingSundays(weeks: number, from: Date = new Date()): string[] {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  const result: string[] = [];
  for (let i = 0; i < weeks; i++) {
    result.push(toDateStr(d));
    d.setDate(d.getDate() + 7);
  }
  return result;
}
