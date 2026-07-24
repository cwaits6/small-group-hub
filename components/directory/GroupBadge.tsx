import { GroupIcon } from "@/components/directory/GroupIcon";
import type { GroupChip } from "@/lib/types";

interface GroupBadgeProps {
  group: GroupChip;
  size?: "xs" | "sm";
}

/** Colored group chip with the group's icon and name */
export function GroupBadge({ group, size = "sm" }: GroupBadgeProps) {
  const sizing =
    size === "xs"
      ? "px-1.5 py-px text-[10px] gap-0.5"
      : "px-2 py-0.5 text-xs gap-1";
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium text-white ${sizing}`}
      style={{ backgroundColor: group.color || "var(--color-brand-neutral)" }}
    >
      <GroupIcon name={group.icon} className={size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {group.name}
    </span>
  );
}
