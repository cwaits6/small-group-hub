import type { PrayerCategory, PrayerCallSession } from "@/lib/types";

/** Display metadata for each prayer category (the "prayer type") */
export const PRAYER_CATEGORIES: Record<
  PrayerCategory,
  { label: string; color: string }
> = {
  health: { label: "Health", color: "#2F6BA8" },
  family: { label: "Family", color: "#C4704A" },
  thanksgiving: { label: "Thanksgiving", color: "#B8821F" },
  prodigal: { label: "Prodigal", color: "#5F8A6E" },
  guidance: { label: "Guidance", color: "#8A6BB5" },
  grief: { label: "Grief", color: "#6E7E94" },
};

export const PRAYER_CATEGORY_KEYS = Object.keys(
  PRAYER_CATEGORIES
) as PrayerCategory[];

/** Audience toggles on a request; all false = visible to every member */
export interface PrayerAudience {
  visible_to_warriors: boolean;
  visible_to_leaders: boolean;
  visible_to_admins: boolean;
}

export const PRAYER_AUDIENCES: {
  key: keyof PrayerAudience;
  label: string;
}[] = [
  { key: "visible_to_warriors", label: "prayer warriors" },
  { key: "visible_to_leaders", label: "call leaders" },
  { key: "visible_to_admins", label: "admins" },
];

export function isRestricted(a: PrayerAudience): boolean {
  return a.visible_to_warriors || a.visible_to_leaders || a.visible_to_admins;
}

/** "everyone", "prayer warriors", "prayer warriors + admins", … */
export function audienceSummary(a: PrayerAudience): string {
  const on = PRAYER_AUDIENCES.filter(({ key }) => a[key]).map((x) => x.label);
  return on.length === 0 ? "everyone" : on.join(" + ");
}

/** Plural weekday names, indexed by PrayerCallSession.weekday (0 = Sunday) */
export const WEEKDAY_LABELS = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
] as const;

/** "20:00:00" → "8:00 PM" (drop the meridiem when told to share it) */
function formatTime(time: string, withMeridiem = true): string {
  const [h, m] = time.split(":").map(Number);
  const meridiem = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const base = `${hour12}:${String(m).padStart(2, "0")}`;
  return withMeridiem ? `${base} ${meridiem}` : base;
}

/** "Wednesdays · 8:00 – 8:30 PM" */
export function sessionLabel(s: Pick<PrayerCallSession, "weekday" | "start_time" | "end_time">): string {
  const day = WEEKDAY_LABELS[s.weekday] ?? "";
  if (!s.end_time) return `${day} · ${formatTime(s.start_time)}`;
  const sameMeridiem =
    (Number(s.start_time.split(":")[0]) < 12) ===
    (Number(s.end_time.split(":")[0]) < 12);
  return `${day} · ${formatTime(s.start_time, !sameMeridiem)} – ${formatTime(s.end_time)}`;
}

/**
 * tel: link that dials in and enters the PIN after two DTMF pauses,
 * e.g. "tel:+17705550170,,4412#". Formatting characters are stripped so the
 * link is reliable regardless of how the admin typed the number.
 */
export function telHref(dialIn: string, pin: string | null): string {
  const digits = dialIn.replace(/[^\d+]/g, "");
  const pinDigits = pin ? pin.replace(/[^\d#*]/g, "") : "";
  return pinDigits ? `tel:${digits},,${pinDigits}` : `tel:${digits}`;
}

/**
 * The next occurrence of a weekly session (today counts if the start time is
 * still ahead), in the browser's timezone — the same site-wide-local
 * assumption the events pages already make.
 */
export function nextOccurrence(
  weekday: number,
  time: string,
  from: Date = new Date()
): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(from);
  d.setHours(h, m, 0, 0);
  let daysAhead = (weekday - d.getDay() + 7) % 7;
  if (daysAhead === 0 && d <= from) daysAhead = 7;
  d.setDate(d.getDate() + daysAhead);
  return d;
}

/** "Just now", "2 hours ago", "Yesterday", then a plain date */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== new Date().getFullYear()
      ? { year: "numeric" }
      : {}),
  });
}
