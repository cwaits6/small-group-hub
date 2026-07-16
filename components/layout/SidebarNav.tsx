"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  CalendarDays,
  ChevronDown,
  Megaphone,
  BookOpen,
  FileText,
  Settings,
  Users,
  UserCircle,
  Home,
  MailPlus,
  HandHelping,
  HandCoins,
  HeartHandshake,
  BarChart2,
  Info,
} from "lucide-react";
import { Fragment, useState, useEffect, type ComponentType } from "react";
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
  { href: "/prayer", label: "Prayer", icon: HeartHandshake },
  { href: "/give", label: "Give", icon: HandCoins },
  { href: "/about", label: "About", icon: Info },
  { href: "/profile", label: "My Profile", icon: UserCircle },
  { href: "/settings", label: "Settings", icon: Settings },
];

const directorySubNav = [
  { href: "/directory/families", label: "Families" },
  { href: "/directory/groups", label: "Groups" },
  { href: "/directory/birthdays", label: "Birthdays" },
  { href: "/directory/anniversaries", label: "Anniversaries" },
];

const adminNav = [
  { href: "/admin", label: "Admin", icon: Settings, exact: true },
  { href: "/admin/members", label: "Members", icon: Users },
  { href: "/admin/families", label: "Families", icon: Home },
  { href: "/admin/groups", label: "Groups", icon: Users },
  { href: "/admin/invite", label: "Bulk Invite", icon: MailPlus },
  { href: "/admin/calendars", label: "Calendars", icon: CalendarDays },
  { href: "/admin/serving", label: "Serving Stats", icon: BarChart2 },
  { href: "/admin/giving", label: "Giving", icon: HandCoins },
  { href: "/admin/pages", label: "Manage Pages", icon: FileText },
  { href: "/admin/about", label: "About Page", icon: Info },
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

  // Directory sub-menu: auto-opens while browsing the section, manually collapsible
  const inDirectory = pathname === "/directory" || pathname.startsWith("/directory/");
  const [directoryOpen, setDirectoryOpen] = useState(inDirectory);
  useEffect(() => {
    setDirectoryOpen(inDirectory);
  }, [inDirectory]);

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

  // Soft-blue active state with a primary left bar, per the design system
  const linkClass = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm border-l-4 transition-colors ${
      active
        ? "bg-brand-warm text-brand-primary font-bold border-brand-primary"
        : "border-transparent font-medium text-slate-600 hover:text-brand-primary hover:bg-brand-warm/50"
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

  // Directory item with a chevron that expands/collapses its sub-menu
  const renderDirectoryItem = () => {
    const active = isActive("/directory");
    return (
      <div
        className={`flex items-center rounded-lg border-l-4 transition-colors ${
          active
            ? "bg-brand-warm border-brand-primary"
            : "border-transparent hover:bg-brand-warm/50"
        }`}
      >
        <Link
          href="/directory"
          className={`flex flex-1 min-w-0 items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
            active
              ? "text-brand-primary font-bold"
              : "font-medium text-slate-600 hover:text-brand-primary"
          }`}
          aria-current={active ? "page" : undefined}
          onClick={onNavigate}
        >
          <Users className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>Directory</span>
        </Link>
        <button
          type="button"
          onClick={() => setDirectoryOpen((open) => !open)}
          aria-label={directoryOpen ? "Collapse directory menu" : "Expand directory menu"}
          aria-expanded={directoryOpen}
          className={`self-stretch px-2.5 transition-colors ${
            active ? "text-brand-primary" : "text-slate-600 hover:text-brand-primary"
          }`}
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${directoryOpen ? "" : "-rotate-90"}`}
            aria-hidden="true"
          />
        </button>
      </div>
    );
  };

  const renderDirectorySubNav = () => {
    if (collapsed || !directoryOpen) return null;
    return directorySubNav.map((item) => {
      const active = isActive(item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          className={`flex items-center pl-11 pr-3 py-2 rounded-lg text-sm border-l-4 transition-colors ${
            active
              ? "bg-brand-warm text-brand-primary font-bold border-brand-primary"
              : "border-transparent font-medium text-slate-600 hover:text-brand-primary hover:bg-brand-warm/50"
          }`}
          aria-current={active ? "page" : undefined}
          onClick={onNavigate}
        >
          {item.label}
        </Link>
      );
    });
  };

  return (
    <>
      {memberNav
        .filter((item) => item.href !== "/serving" || hasServingAccess)
        .map((item) => (
          <Fragment key={item.href}>
            {item.href === "/directory" && !collapsed ? renderDirectoryItem() : renderLink(item)}
            {item.href === "/directory" && renderDirectorySubNav()}
          </Fragment>
        ))}

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
            .filter(
              (item) =>
                isAdmin ||
                item.href === "/admin/pages" ||
                item.href === "/admin/about",
            )
            .map(renderLink)}
        </>
      )}
    </>
  );
}
