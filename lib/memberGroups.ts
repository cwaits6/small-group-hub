import { createClient } from "@/lib/supabase/client";
import type { MemberGroup } from "@/lib/types";

/**
 * Add or remove a member from a group. Denormalized role flags on profiles
 * (is_prayer_warrior) are kept in sync by database triggers.
 *
 * @returns an error message to show the user, or null on success
 */
export async function setGroupMembership(
  profileId: string,
  group: MemberGroup,
  member: boolean,
): Promise<string | null> {
  const supabase = createClient();

  if (member) {
    const { error } = await supabase.from("profile_groups").insert({
      profile_id: profileId,
      group_id: group.id,
    });
    if (error) return `Failed to add to ${group.name}.`;
  } else {
    const { error } = await supabase
      .from("profile_groups")
      .delete()
      .eq("profile_id", profileId)
      .eq("group_id", group.id);
    if (error) return `Failed to remove from ${group.name}.`;
  }

  return null;
}
