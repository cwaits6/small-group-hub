"use client";

import { DynamicIcon, type IconName } from "lucide-react/dynamic";

interface GroupIconProps {
  name: string | null | undefined;
  className?: string;
}

/**
 * Renders the lucide icon an admin picked for a group, or nothing.
 * Icons are lazy-loaded by name, so any of the ~1,950 lucide icons work;
 * unknown names render nothing (DynamicIcon logs and returns null).
 */
export function GroupIcon({ name, className }: GroupIconProps) {
  if (!name) return null;
  return <DynamicIcon name={name as IconName} className={className} />;
}
