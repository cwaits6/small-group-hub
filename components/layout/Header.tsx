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
  const isMember = profile?.role === "member" || isAdmin;

  const publicLinks = [
    { href: "/events", label: "Events" },
    { href: "/lectures", label: "Lectures" },
  ];

  const memberLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/events", label: "Events" },
    { href: "/announcements", label: "Announcements" },
    { href: "/lectures", label: "Lectures" },
  ];

  const links = isMember ? memberLinks : publicLinks;

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur shadow-sm border-b border-emerald-100"
          : "bg-white border-b border-transparent"
      }`}
    >
      {/* Top accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-emerald-600 via-teal-500 to-rose-500" />

      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link
          href={isMember ? "/dashboard" : "/"}
          className="flex items-center gap-2 group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
            <span className="text-white font-bold text-sm font-display">I</span>
          </div>
          <span className="text-xl font-bold font-display text-[#0d4f3c] tracking-tight">
            {siteConfig.name}
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-4 py-2 text-base font-semibold text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all duration-150"
            >
              {link.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              className="px-4 py-2 text-base font-semibold text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all duration-150"
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
                className="text-base border-slate-200 hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="lg"
                  className="text-base text-slate-600 hover:text-emerald-700"
                  nativeButton={false}
                  render={<Link href="/login" />}
                >
                  Sign In
                </Button>
                <Button
                  size="lg"
                  className="text-base bg-[#f43f5e] hover:bg-rose-600 text-white shadow-sm hover:shadow-md transition-all px-6"
                  nativeButton={false}
                  render={<Link href="/join" />}
                >
                  Join Us
                </Button>
              </>
            )}
          </div>
        </nav>

        {/* Mobile nav */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden text-slate-700" />}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            <span className="sr-only">Toggle menu</span>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] border-l border-emerald-100">
            <div className="flex items-center gap-2 mb-8 mt-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center">
                <span className="text-white font-bold text-sm font-display">I</span>
              </div>
              <span className="text-xl font-bold font-display text-[#0d4f3c]">{siteConfig.name}</span>
            </div>
            <nav className="flex flex-col gap-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="text-lg font-semibold px-4 py-3 rounded-xl text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 transition-all"
                >
                  {link.label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="text-lg font-semibold px-4 py-3 rounded-xl text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 transition-all"
                >
                  Admin
                </Link>
              )}
              <div className="border-t border-emerald-100 pt-4 mt-4 flex flex-col gap-3">
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
                  <>
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full text-lg border-emerald-200 text-emerald-700"
                      nativeButton={false}
                      render={<Link href="/login" onClick={() => setOpen(false)} />}
                    >
                      Sign In
                    </Button>
                    <Button
                      size="lg"
                      className="w-full text-lg bg-[#f43f5e] hover:bg-rose-600 text-white"
                      nativeButton={false}
                      render={<Link href="/join" onClick={() => setOpen(false)} />}
                    >
                      Join Us
                    </Button>
                  </>
                )}
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
