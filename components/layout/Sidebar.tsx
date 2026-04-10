"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Megaphone,
  BookOpen,
  FileText,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect } from "react";
import type { Profile } from "@/lib/types";
import type { PageContent } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

interface SidebarProps {
  profile: Profile;
}

const memberNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/announcements", label: "Announcements", icon: Megaphone },
  { href: "/lectures", label: "Lectures", icon: BookOpen },
];

const adminNav = [
  { href: "/admin", label: "Admin", icon: Settings },
  { href: "/admin/members", label: "Members", icon: Users },
  { href: "/admin/pages", label: "Manage Pages", icon: FileText },
];

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [pages, setPages] = useState<PageContent[]>([]);
  const isAdmin = profile.role === "admin";
  const isEditor = profile.role === "content_editor" || isAdmin;

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("page_content")
      .select("slug, title")
      .order("title")
      .then(({ data }) => {
        if (data) setPages(data as PageContent[]);
      });
  }, [pathname]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const linkClass = (href: string) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive(href)
        ? "bg-brand-bg-light text-brand-primary"
        : "text-slate-600 hover:text-brand-primary hover:bg-brand-bg-light/50"
    }`;

  return (
    <aside
      className={`hidden md:flex flex-col border-r border-emerald-100 bg-white shrink-0 transition-all duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {memberNav.map((item) => (
          <Link key={item.href} href={item.href} className={linkClass(item.href)}>
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}

        {pages.length > 0 && (
          <>
            {!collapsed && (
              <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase text-slate-400 tracking-wider">
                Pages
              </p>
            )}
            {collapsed && <div className="border-t border-emerald-100 my-2" />}
            {pages.map((page) => (
              <Link
                key={page.slug}
                href={`/pages/${page.slug}`}
                className={linkClass(`/pages/${page.slug}`)}
              >
                <FileText className="h-5 w-5 shrink-0" />
                {!collapsed && <span className="truncate">{page.title}</span>}
              </Link>
            ))}
          </>
        )}

        {isEditor && (
          <>
            {!collapsed && (
              <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase text-slate-400 tracking-wider">
                Admin
              </p>
            )}
            {collapsed && <div className="border-t border-emerald-100 my-2" />}
            {adminNav
              .filter((item) => isAdmin || item.href === "/admin/pages")
              .map((item) => (
                <Link key={item.href} href={item.href} className={linkClass(item.href)}>
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              ))}
          </>
        )}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center py-3 border-t border-emerald-100 text-slate-400 hover:text-brand-primary transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>
    </aside>
  );
}
