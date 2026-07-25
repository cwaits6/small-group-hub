import type { ComponentType } from "react";
import {
  Settings,
  Users,
  Home,
  MailPlus,
  CalendarDays,
  BarChart2,
  HandCoins,
  FileText,
  Info,
  BookOpen,
} from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
}

/**
 * Single source of truth for admin destinations. Consumed by the sidebar
 * (client) and importable from server components — keep this file free of
 * "use client" and hooks.
 */
export const adminNav: AdminNavItem[] = [
  { href: "/admin", label: "Admin", icon: Settings, exact: true },
  { href: "/admin/members", label: "Members", icon: Users },
  { href: "/admin/families", label: "Families", icon: Home },
  { href: "/admin/groups", label: "Groups", icon: Users },
  { href: "/admin/invite", label: "Bulk Invite", icon: MailPlus },
  { href: "/admin/calendars", label: "Calendars", icon: CalendarDays },
  { href: "/admin/serving", label: "Serving Stats", icon: BarChart2 },
  { href: "/admin/giving", label: "Giving", icon: HandCoins },
  { href: "/admin/lectures", label: "Manage Lectures", icon: BookOpen },
  { href: "/admin/pages", label: "Manage Pages", icon: FileText },
  { href: "/admin/about", label: "About Page", icon: Info },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];
