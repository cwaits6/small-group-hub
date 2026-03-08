import Link from "next/link";
import { siteConfig } from "@/lib/config";
import { Heart } from "lucide-react";

export function Footer() {
  return (
    <footer style={{ background: "#0d4f3c" }}>
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-10 mb-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <span className="text-white font-bold text-base font-display">I</span>
              </div>
              <span className="text-2xl font-bold font-display text-white">{siteConfig.name}</span>
            </div>
            <p className="text-emerald-200 text-base leading-relaxed">
              {siteConfig.description}
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-white font-bold text-lg mb-4 font-display">Quick Links</h4>
            <ul className="space-y-2">
              {[
                { href: "/events", label: "Upcoming Events" },
                { href: "/lectures", label: "Lecture Library" },
                { href: "/join", label: "Join Our Group" },
                { href: "/login", label: "Member Sign In" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-emerald-300 hover:text-white transition-colors text-base"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Tagline / verse */}
          <div>
            <h4 className="text-white font-bold text-lg mb-4 font-display">Our Mission</h4>
            <p className="text-emerald-200 text-base leading-relaxed italic">
              &ldquo;{siteConfig.tagline}&rdquo;
            </p>
            <p className="text-emerald-400 text-sm mt-2">Hebrews 3:13</p>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-emerald-300 text-base">
            &copy; {new Date().getFullYear()} {siteConfig.name} · First Redeemer Church
          </p>
          <p className="text-emerald-400 text-sm flex items-center gap-1">
            Made with <Heart className="h-3.5 w-3.5 text-rose-400 fill-rose-400" /> for our community
          </p>
        </div>
      </div>
    </footer>
  );
}
