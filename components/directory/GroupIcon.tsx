import {
  Baby,
  Bell,
  BookOpen,
  Cross,
  Flag,
  HandHelping,
  Heart,
  Music,
  Shield,
  Star,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Icon names offered in the admin group editor, mapped to components */
const ICONS: Record<string, LucideIcon> = {
  heart: Heart,
  "hand-helping": HandHelping,
  users: Users,
  user: User,
  star: Star,
  cross: Cross,
  "book-open": BookOpen,
  music: Music,
  baby: Baby,
  shield: Shield,
  bell: Bell,
  flag: Flag,
};

interface GroupIconProps {
  name: string | null | undefined;
  className?: string;
}

/** Renders the lucide icon an admin picked for a group, or nothing */
export function GroupIcon({ name, className }: GroupIconProps) {
  const Icon = name ? ICONS[name] : undefined;
  if (!Icon) return null;
  return <Icon className={className} />;
}
