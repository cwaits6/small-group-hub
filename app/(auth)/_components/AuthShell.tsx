import React from "react";
import Link from "next/link";
import { siteConfig } from "@/lib/config";

// Paper-grain texture URI (matches app/page.tsx)
const PAPER_TEXTURE_URI =
  "url(\"data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='3'/%3E%3CfeColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")";

// Linen texture: subtle white diagonal stripes for the brand panel
const LINEN_TEXTURE_URI =
  "repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 8px)";

export interface AuthShellProps {
  eyebrow: string;
  title: string;
  /** Italic brand-primary emphasis word that follows the title */
  em: string;
  kicker: string;
  altPrompt?: string;
  altLabel?: string;
  altHref?: string;
  children: React.ReactNode;
}

/**
 * Full-bleed two-column auth layout shell.
 *
 * Left column: brand panel (morning blue, devotional quote).
 * Right column: form area (warm cream background, paper texture).
 *
 * Mobile: stacks to single column with a short brand banner on top.
 */
export function AuthShell({
  eyebrow,
  title,
  em,
  kicker,
  altPrompt,
  altLabel,
  altHref,
  children,
}: AuthShellProps) {
  const monogramLetter = siteConfig.logoMonogram || siteConfig.name.charAt(0);

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* ── LEFT — brand panel ── */}
      <div
        className="relative bg-brand-primary text-white flex flex-col justify-between px-8 py-12 md:px-14 md:py-14 overflow-hidden"
        // On mobile: cap height so it reads as a banner, not a half-page
      >
        {/* Linen texture overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: LINEN_TEXTURE_URI, opacity: 1 }}
          aria-hidden
        />

        {/* Top: monogram + group name */}
        <div className="relative flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-md border-2 border-white/80 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-base font-display leading-none">
              {monogramLetter}
            </span>
          </div>
          <div>
            <div className="font-serif text-[1.25rem] font-semibold leading-tight tracking-[-0.01em]">
              {siteConfig.name}
            </div>
            <div className="font-sans text-[0.65rem] font-medium tracking-[0.18em] uppercase text-white/70 mt-0.5">
              {siteConfig.brandLine}
            </div>
          </div>
        </div>

        {/* Middle: devotional quote — hidden on mobile to keep banner compact */}
        <div className="relative hidden md:block max-w-[460px]">
          <div
            className="font-serif text-[5rem] leading-none text-brand-accent font-semibold"
            style={{ marginBottom: "0.35rem" }}
            aria-hidden
          >
            &ldquo;
          </div>
          <p className="font-serif italic text-[2rem] leading-[1.25] tracking-[-0.025em] text-white">
            Encourage one another and build each other up.
          </p>
          <p className="font-sans text-[0.7rem] font-bold tracking-[0.2em] uppercase text-brand-accent mt-4">
            1 Thessalonians 5:11
          </p>
        </div>

        {/* Bottom: micro-tagline — hidden on mobile */}
        <div className="relative hidden md:block font-sans text-xs text-white/70 leading-relaxed">
          A Sunday class for every season of life — come as you are.
        </div>
      </div>

      {/* ── RIGHT — form panel ── */}
      <div className="relative bg-background flex flex-col justify-center px-6 py-12 md:px-16 md:py-14">
        {/* Paper-grain texture overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.025]"
          style={{ backgroundImage: PAPER_TEXTURE_URI }}
          aria-hidden
        />

        <div className="relative w-full max-w-[420px] mx-auto md:mx-0">
          {/* Eyebrow */}
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-5 h-px bg-brand-accent" aria-hidden />
            <span className="font-sans text-[0.65rem] font-bold tracking-[0.2em] uppercase text-brand-accent">
              {eyebrow}
            </span>
          </div>

          {/* Title */}
          <h1 className="font-serif text-4xl md:text-5xl font-medium text-foreground tracking-tight leading-[1.05] mb-0">
            {title}{" "}
            <em className="not-italic italic text-brand-primary">{em}</em>.
          </h1>

          {/* Kicker */}
          <p className="font-sans text-base text-muted-foreground leading-[1.6] mt-3.5 mb-0">
            {kicker}
          </p>

          {/* Form / children */}
          <div className="mt-8">{children}</div>

          {/* Alt link (optional) */}
          {altPrompt && altLabel && altHref && (
            <div className="mt-8 pt-6 border-t border-border">
              <p className="font-sans text-sm text-muted-foreground">
                {altPrompt}{" "}
                <Link
                  href={altHref}
                  className="text-brand-primary font-semibold hover:underline"
                >
                  {altLabel}
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
