"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Profile } from "@/lib/types";
import { SidebarNav } from "./SidebarNav";

interface SidebarProps {
  profile: Profile;
  hasServingAccess: boolean;
}

export function Sidebar({ profile, hasServingAccess }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`hidden md:flex flex-col border-r border-border bg-white shrink-0 transition-all duration-200 ${
        collapsed ? "w-16" : "w-60"
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

      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="flex items-center justify-center py-3 border-t border-border text-slate-400 hover:text-brand-primary transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </aside>
  );
}
