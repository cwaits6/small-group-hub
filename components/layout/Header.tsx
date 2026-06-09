"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { siteConfig } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";

interface HeaderProps {
  profile: Profile | null;
}

export function Header({ profile }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const isAdmin = profile?.role === "admin";
  const isMember = profile?.role === "member" || profile?.role === "content_editor" || isAdmin;

  const memberLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/events", label: "Calendar" },
    { href: "/announcements", label: "Announcements" },
    { href: "/lectures", label: "Lectures" },
  ];

  const links = isMember ? memberLinks : [];

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur shadow-sm border-b border-border"
          : "bg-white border-b border-transparent"
      }`}
    >
      {/* Top accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-brand-primary-light via-brand-primary to-brand-accent" />

      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link
          href={isMember ? "/dashboard" : "/"}
          className="flex items-center gap-2 group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-primary-light to-brand-primary flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
            <span className="text-white font-bold text-sm font-display">{siteConfig.logoMonogram}</span>
          </div>
          <span className="text-xl font-bold font-display text-brand-primary tracking-tight">
            {siteConfig.name}
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-4 py-2 text-base font-semibold text-slate-600 hover:text-brand-primary hover:bg-brand-bg-light rounded-lg transition-all duration-150"
            >
              {link.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              className="px-4 py-2 text-base font-semibold text-slate-600 hover:text-brand-primary hover:bg-brand-bg-light rounded-lg transition-all duration-150"
            >
              Admin
            </Link>
          )}
          <div className="ml-3 flex items-center gap-2">
            {profile ? (
              <Button
                variant="outline"
                size="lg"
                onClick={handleSignOut}
                className="text-base border-slate-200 hover:border-destructive/30 hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="mr-2 h-4 w-4" />
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
        </nav>

        {/* Mobile nav */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden text-slate-700" />}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            <span className="sr-only">Toggle menu</span>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] border-l border-border">
            <div className="flex items-center gap-2 mb-8 mt-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-primary-light to-brand-primary flex items-center justify-center">
                <span className="text-white font-bold text-sm font-display">{siteConfig.logoMonogram}</span>
              </div>
              <span className="text-xl font-bold font-display text-brand-primary">{siteConfig.name}</span>
            </div>
            <nav className="flex flex-col gap-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="text-lg font-semibold px-4 py-3 rounded-xl text-slate-700 hover:text-brand-primary hover:bg-brand-bg-light transition-all"
                >
                  {link.label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="text-lg font-semibold px-4 py-3 rounded-xl text-slate-700 hover:text-brand-primary hover:bg-brand-bg-light transition-all"
                >
                  Admin
                </Link>
              )}
              <div className="border-t border-border pt-4 mt-4 flex flex-col gap-3">
                {profile ? (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleSignOut}
                    className="w-full text-lg"
                  >
                    <LogOut className="mr-2 h-5 w-5" />
                    Sign Out
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full text-lg border-border text-brand-primary"
                    nativeButton={false}
                    render={<Link href="/login" onClick={() => setOpen(false)} />}
                  >
                    Sign In
                  </Button>
                )}
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
