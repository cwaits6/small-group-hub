import { GroupIcon } from "@/components/directory/GroupIcon";
import type { GroupChip } from "@/lib/types";

interface GroupBadgeProps {
  group: GroupChip;
}

/** Colored group chip with the group's icon and name */
export function GroupBadge({ group }: GroupBadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-medium text-white"
      style={{ backgroundColor: group.color || "var(--color-brand-neutral)" }}
    >
      <GroupIcon name={group.icon} className="h-3 w-3" />
      {group.name}
    </span>
  );
}
