import { createClient } from "@/lib/supabase/client";
import type { MemberGroup } from "@/lib/types";

/** Map a functional role to its denormalized boolean column on profiles */
const ROLE_COLUMNS: Record<
  NonNullable<MemberGroup["functional_role"]>,
  "is_prayer_team" | "is_greeter_team" | "is_prayer_warrior"
> = {
  prayer_team: "is_prayer_team",
  greeter_team: "is_greeter_team",
  prayer_warriors: "is_prayer_warrior",
};

/**
 * Add or remove a member from a group, keeping the functional-role boolean
 * on profiles in sync when the group has one.
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

  if (group.functional_role) {
    const column = ROLE_COLUMNS[group.functional_role];
    const { error } = await supabase
      .from("profiles")
      .update({ [column]: member })
      .eq("id", profileId);
    if (error) {
      // Roll back the membership change so the roster and the denormalized
      // role flag never disagree.
      if (member) {
        await supabase
          .from("profile_groups")
          .delete()
          .eq("profile_id", profileId)
          .eq("group_id", group.id);
      } else {
        await supabase
          .from("profile_groups")
          .insert({ profile_id: profileId, group_id: group.id });
      }
      return member
        ? `Failed to add to ${group.name}.`
        : `Failed to remove from ${group.name}.`;
    }
  }

  return null;
}
