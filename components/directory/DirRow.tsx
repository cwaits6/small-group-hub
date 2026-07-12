"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface DirRowProps {
  /** Renders a Link when set; otherwise a button when onClick is set, else a plain div */
  href?: string;
  onClick?: () => void;
  avatar: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Pill or other content between the text and the chevron */
  trailing?: ReactNode;
  /** Soft-blue emphasis for the selected item in a two-pane list */
  selected?: boolean;
  /** Soft-blue emphasis for upcoming birthdays / anniversaries */
  highlight?: boolean;
}

/**
 * Large tappable directory row: avatar, bold title, muted subtitle, chevron.
 * Shared by every directory sub-page list.
 */
export function DirRow({
  href,
  onClick,
  avatar,
  title,
  subtitle,
  trailing,
  selected,
  highlight,
}: DirRowProps) {
  const interactive = !!href || !!onClick;
  const className = cn(
    "w-full flex items-center gap-4 min-h-16 px-4 py-3 rounded-xl border bg-card text-left transition-colors",
    selected || highlight ? "bg-brand-warm border-brand-primary/40" : "border-border",
    interactive && "hover:border-brand-primary/60",
  );

  const inner = (
    <>
      <span className="shrink-0">{avatar}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-foreground">{title}</span>
        {subtitle && (
          <span className="block text-sm text-muted-foreground">{subtitle}</span>
        )}
      </span>
      {trailing}
      {interactive && (
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} aria-current={selected ? "true" : undefined}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={className}
        aria-current={selected ? "true" : undefined}
      >
        {inner}
      </button>
    );
  }
  return <div className={className}>{inner}</div>;
}

/** Muted section label used above groups of rows (A–Z letters, month names) */
export function DirSectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mt-6 mb-2.5 first:mt-0 text-sm font-bold tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}
