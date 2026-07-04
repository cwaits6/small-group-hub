import type { DirectoryProfile, FamilyDirectoryFull } from "@/lib/types";

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatBirthdayShort(month: number, day: number): string {
  return `${MONTH_NAMES[month - 1]} ${day}`;
}

export function formatAnniversary(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function relLabel(rel: string): string {
  switch (rel) {
    case "primary": return "Primary";
    case "spouse": return "Spouse";
    case "child": return "Child";
    case "parent": return "Parent";
    case "sibling": return "Sibling";
    default: return "Other";
  }
}

/** Resolve the best address to show in the detail sheet */
export function resolveAddress(
  member: DirectoryProfile,
  family: FamilyDirectoryFull | null,
) {
  const line1 = member.address_line1 ?? family?.address_line1 ?? null;
  const line2 = member.address_line2 ?? family?.address_line2 ?? null;
  const city = member.city ?? family?.city ?? null;
  const state = member.state ?? family?.state ?? null;
  const postal = member.postal_code ?? family?.postal_code ?? null;
  if (!line1 && !city) return null;
  return { line1, line2, city, state, postal };
}

export function downloadVCard(profileId: string) {
  window.location.href = `/api/members/${profileId}/vcard`;
}
