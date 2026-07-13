"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { siteConfig } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import { usePathname, useRouter } from "next/navigation";
import { SidebarNav } from "./SidebarNav";
import { SIDEBAR_ROUTES } from "./AppShell";
import { useSidebar } from "./SidebarContext";
import type { Profile } from "@/lib/types";

interface HeaderProps {
  profile: Profile | null;
  hasServingAccess: boolean;
}

export function Header({ profile, hasServingAccess }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { collapsed, setCollapsed } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Safety net: close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    setOpen(false);
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Sign out failed — please try again.");
      return;
    }
    router.push("/");
    router.refresh();
  };

  const isAdmin = profile?.role === "admin";
  const isMember =
    profile?.role === "member" || profile?.role === "content_editor" || isAdmin;

  // The desktop sidebar pane is only rendered on these routes; elsewhere
  // (e.g. /household) the menu button stays available at all breakpoints.
  const hasDesktopSidebar =
    isMember && SIDEBAR_ROUTES.some((r) => pathname.startsWith(r));

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b border-border transition-all duration-300 ${
        scrolled ? "bg-white/95 backdrop-blur shadow-sm" : "bg-white"
      }`}
    >
      <div className="flex h-[72px] w-full items-center justify-between px-4">
        <div className="flex items-center gap-1">
          {/* Desktop: menu button collapses/expands the sidebar pane */}
          {hasDesktopSidebar && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              className="hidden md:inline-flex text-slate-700"
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </Button>
          )}
          {/* Mobile (or no sidebar): menu button opens the nav drawer */}
          {profile && isMember && (
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={open ? "Close navigation menu" : "Open navigation menu"}
                    aria-expanded={open}
                    className={`text-slate-700 ${hasDesktopSidebar ? "md:hidden" : ""}`}
                  />
                }
              >
                {open ? (
                  <X className="h-6 w-6" aria-hidden="true" />
                ) : (
                  <Menu className="h-6 w-6" aria-hidden="true" />
                )}
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[300px] border-r border-border overflow-y-auto"
              >
                <SheetTitle className="sr-only">Navigation menu</SheetTitle>
                <div className="flex flex-col h-full p-4">
                  <div className="flex items-center gap-2 mb-6 mt-1">
                    <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-brand-primary-light to-brand-primary flex items-center justify-center">
                      <span className="text-white font-bold text-[24px] font-display">
                        {siteConfig.logoMonogram}
                      </span>
                    </div>
                    <span className="text-[26px] font-bold font-display text-brand-primary">
                      {siteConfig.name}
                    </span>
                  </div>
                  <nav
                    aria-label="Main navigation"
                    className="flex-1 space-y-1"
                  >
                    <SidebarNav
                      profile={profile}
                      hasServingAccess={hasServingAccess}
                      onNavigate={() => setOpen(false)}
                    />
                  </nav>
                  <div className="border-t border-border pt-4 mt-4">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={handleSignOut}
                      className="w-full"
                    >
                      <LogOut className="mr-2 h-5 w-5" aria-hidden="true" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          )}

          <Link
            href={isMember ? "/dashboard" : "/"}
            className="flex items-center gap-2 group"
          >
            <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-brand-primary-light to-brand-primary flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <span className="text-white font-bold text-[24px] font-display">
                {siteConfig.logoMonogram}
              </span>
            </div>
            <span className="text-[26px] font-bold font-display text-brand-primary tracking-tight">
              {siteConfig.name}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {profile ? (
            <Button
              variant="outline"
              size="lg"
              onClick={handleSignOut}
              className={`text-base border-slate-200 hover:border-destructive/30 hover:text-destructive hover:bg-destructive/10 ${
                isMember ? "hidden md:inline-flex" : ""
              }`}
            >
              <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
              Sign Out
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="lg"
              className="text-base text-slate-600 hover:text-brand-primary"
              nativeButton={false}
              render={<Link href="/login" />}
            >
              Sign In
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
