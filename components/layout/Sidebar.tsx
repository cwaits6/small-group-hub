"use client";

import type { Profile } from "@/lib/types";
import { SidebarNav } from "./SidebarNav";
import { useSidebar } from "./SidebarContext";

interface SidebarProps {
  profile: Profile;
  hasServingAccess: boolean;
}

export function Sidebar({ profile, hasServingAccess }: SidebarProps) {
  const { collapsed } = useSidebar();

  return (
    <aside
      className={`hidden md:flex flex-col border-r border-border bg-white shrink-0 transition-all duration-200 ${
        collapsed ? "w-16" : "w-[236px]"
      }`}
    >
      <nav
        aria-label="Main navigation"
        className="flex-1 overflow-y-auto py-4 px-2 space-y-1"
      >
        <SidebarNav
          profile={profile}
          hasServingAccess={hasServingAccess}
          collapsed={collapsed}
        />
      </nav>
    </aside>
  );
}
