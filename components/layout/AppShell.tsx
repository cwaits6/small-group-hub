"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import type { Profile } from "@/lib/types";

interface AppShellProps {
  profile: Profile | null;
  children: React.ReactNode;
}

const SIDEBAR_ROUTES = [
  "/dashboard",
  "/events",
  "/announcements",
  "/lectures",
  "/pages",
  "/admin",
  "/directory",
  "/profile",
];

export function AppShell({ profile, children }: AppShellProps) {
  const pathname = usePathname();
  const isMember =
    profile && ["member", "content_editor", "admin"].includes(profile.role);
  const showSidebar =
    isMember && SIDEBAR_ROUTES.some((r) => pathname.startsWith(r));

  if (!showSidebar) {
    return <main className="flex-1">{children}</main>;
  }

  return (
    <div className="flex flex-1">
      <Sidebar profile={profile!} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
