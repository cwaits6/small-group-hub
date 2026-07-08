"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  CalendarDays,
  Megaphone,
  BookOpen,
  FileText,
  Settings,
  Users,
  UserCircle,
  Home,
  MailPlus,
  HandHelping,
  BarChart2,
} from "lucide-react";
import { useState, useEffect, type ComponentType } from "react";
import type { PageContent, Profile } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

type PageLink = Pick<PageContent, "slug" | "title">;

interface SidebarNavProps {
  profile: Profile;
  hasServingAccess: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}

const memberNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/events", label: "Calendar", icon: Calendar },
  { href: "/announcements", label: "Announcements", icon: Megaphone },
  { href: "/lectures", label: "Lectures", icon: BookOpen },
  { href: "/directory", label: "Directory", icon: Users },
  { href: "/serving", label: "Serving", icon: HandHelping },
  { href: "/profile", label: "My Profile", icon: UserCircle },
];

const adminNav = [
  { href: "/admin", label: "Admin", icon: Settings, exact: true },
  { href: "/admin/members", label: "Members", icon: Users },
  { href: "/admin/families", label: "Families", icon: Home },
  { href: "/admin/groups", label: "Groups", icon: Users },
  { href: "/admin/invite", label: "Bulk Invite", icon: MailPlus },
  { href: "/admin/calendars", label: "Calendars", icon: CalendarDays },
  { href: "/admin/serving", label: "Serving Stats", icon: BarChart2 },
  { href: "/admin/pages", label: "Manage Pages", icon: FileText },
];

export function SidebarNav({
  profile,
  hasServingAccess,
  collapsed = false,
  onNavigate,
}: SidebarNavProps) {
  const pathname = usePathname();
  const [pages, setPages] = useState<PageLink[]>([]);
  const isAdmin = profile.role === "admin";
  const isEditor = profile.role === "content_editor" || isAdmin;

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("page_content")
      .select("slug, title")
      .order("title")
      .then(({ data, error }) => {
        if (error) {
          console.error("Failed to load pages for navigation:", error.message);
          return;
        }
        if (data) setPages(data);
      });
  }, [pathname]);

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      active
        ? "bg-brand-bg-light text-brand-primary"
        : "text-slate-600 hover:text-brand-primary hover:bg-brand-bg-light/50"
    }`;

  const renderLink = (
    item: { href: string; label: string; icon: ComponentType<{ className?: string }>; exact?: boolean },
  ) => {
    const active = isActive(item.href, item.exact);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={linkClass(active)}
        aria-current={active ? "page" : undefined}
        title={collapsed ? item.label : undefined}
        onClick={onNavigate}
      >
        <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );
  };

  return (
    <>
      {memberNav
        .filter((item) => item.href !== "/serving" || hasServingAccess)
        .map(renderLink)}

      {pages.length > 0 && (
        <>
          {!collapsed && (
            <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase text-slate-400 tracking-wider">
              Pages
            </p>
          )}
          {collapsed && <div className="border-t border-border my-2" role="separator" />}
          {pages.map((page) => {
            const href = `/pages/${page.slug}`;
            const active = isActive(href);
            return (
              <Link
                key={page.slug}
                href={href}
                className={linkClass(active)}
                aria-current={active ? "page" : undefined}
                title={collapsed ? page.title : undefined}
                onClick={onNavigate}
              >
                <FileText className="h-5 w-5 shrink-0" aria-hidden="true" />
                {!collapsed && <span className="truncate">{page.title}</span>}
              </Link>
            );
          })}
        </>
      )}

      {isEditor && (
        <>
          {!collapsed && (
            <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase text-slate-400 tracking-wider">
              Admin
            </p>
          )}
          {collapsed && <div className="border-t border-border my-2" role="separator" />}
          {adminNav
            .filter((item) => isAdmin || item.href === "/admin/pages")
            .map(renderLink)}
        </>
      )}
    </>
  );
}
