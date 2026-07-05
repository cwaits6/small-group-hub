import { displayName } from "@/lib/names";

interface AttendeeNameParts {
  first_name: string | null;
  last_name: string | null;
  preferred_name?: string | null;
}

/**
 * Display name for a serving signup. A couple serving together shows as
 * their household ("The Smiths"); a single attendee shows individually
 * ("Danny Smith"). Falls back to joined names when a couple has no
 * household name on file.
 */
export function signupDisplayName(
  attendees: AttendeeNameParts[],
  familyName: string | null
): string {
  if (attendees.length === 0) return "(unnamed)";
  if (attendees.length === 1) return displayName(attendees[0]);
  if (familyName) return familyName;
  return attendees.map((a) => displayName(a)).join(" & ");
}
