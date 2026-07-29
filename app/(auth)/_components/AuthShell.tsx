import React from "react";
import Link from "next/link";
import { siteConfig } from "@/lib/config";

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
 * Left column: brand panel (espresso ground, wordmark + devotional quote).
 * Right column: form area (warm paper background).
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
  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* ── LEFT — brand panel ── */}
      <div
        className="relative bg-brand-navy text-white flex flex-col justify-between px-8 py-12 md:px-14 md:py-14 overflow-hidden"
        // On mobile: cap height so it reads as a banner, not a half-page
      >
        {/* Top: wordmark */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/two42-wordmark-dark.svg"
          alt={siteConfig.name}
          className="relative h-8 w-auto"
        />

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
          <p className="font-sans text-base font-bold tracking-[0.2em] uppercase text-brand-accent mt-4">
            1 Thessalonians 5:11
          </p>
        </div>

        {/* Bottom: micro-tagline — hidden on mobile */}
        <div className="relative hidden md:block font-sans text-base text-white/70 leading-relaxed">
          A Sunday class for every season of life — come as you are.
        </div>
      </div>

      {/* ── RIGHT — form panel ── */}
      <div className="relative bg-background flex flex-col justify-center px-6 py-12 md:px-16 md:py-14">
        <div className="relative w-full max-w-[420px] mx-auto md:mx-0">
          {/* Eyebrow */}
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-5 h-px bg-brand-accent" aria-hidden />
            <span className="font-sans text-base font-bold tracking-[0.2em] uppercase text-brand-accent">
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
              <p className="font-sans text-lg text-muted-foreground">
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
