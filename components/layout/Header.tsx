"use client";

import Link from "next/link";
import { useState } from "react";
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
  const router = useRouter();
  const supabase = createClient();

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
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href={isMember ? "/dashboard" : "/"} className="flex items-center gap-2">
          <span className="text-xl font-bold text-amber-800">{siteConfig.name}</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-lg font-medium text-muted-foreground hover:text-amber-800 transition-colors"
            >
              {link.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              className="text-lg font-medium text-muted-foreground hover:text-amber-800 transition-colors"
            >
              Admin
            </Link>
          )}
          {profile ? (
            <Button variant="outline" size="lg" onClick={handleSignOut} className="text-base">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              <Button variant="outline" size="lg" className="text-base" nativeButton={false} render={<Link href="/login" />}>
                Sign In
              </Button>
              <Button size="lg" className="text-base bg-amber-700 hover:bg-amber-800" nativeButton={false} render={<Link href="/join" />}>
                Join Us
              </Button>
            </div>
          )}
        </nav>

        {/* Mobile nav */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            <span className="sr-only">Toggle menu</span>
          </SheetTrigger>
          <SheetContent side="right" className="w-[280px]">
            <nav className="flex flex-col gap-4 mt-8">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="text-xl font-medium py-2 text-foreground hover:text-amber-800 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="text-xl font-medium py-2 text-foreground hover:text-amber-800 transition-colors"
                >
                  Admin
                </Link>
              )}
              <div className="border-t pt-4 mt-4">
                {profile ? (
                  <Button variant="outline" size="lg" onClick={handleSignOut} className="w-full text-lg">
                    <LogOut className="mr-2 h-5 w-5" />
                    Sign Out
                  </Button>
                ) : (
                  <div className="flex flex-col gap-3">
                    <Button variant="outline" size="lg" className="w-full text-lg" nativeButton={false} render={<Link href="/login" onClick={() => setOpen(false)} />}>
                      Sign In
                    </Button>
                    <Button size="lg" className="w-full text-lg bg-amber-700 hover:bg-amber-800" nativeButton={false} render={<Link href="/join" onClick={() => setOpen(false)} />}>
                      Join Us
                    </Button>
                  </div>
                )}
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
