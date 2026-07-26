import type { Profile } from "@/lib/types";

/** Only the primary or spouse in a household can edit another enrolled member's profile. */
export function canEditSpouseProfiles(profile: Pick<Profile, "relationship">): boolean {
  return profile.relationship === "primary" || profile.relationship === "spouse";
}

/** Fields shown for household members the viewer can't open the edit sheet for. */
export type HouseholdSummary = Pick<
  Profile,
  "id" | "first_name" | "last_name" | "preferred_name" | "relationship" | "role" | "avatar_url"
>;
