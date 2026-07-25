"use client";

import { Check, HandHeart, Lock, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { displayName, initials } from "@/lib/names";
import { PRAYER_CATEGORIES, timeAgo } from "@/lib/prayer";
import type { PrayerWallRow } from "@/lib/types";

const ANSWERED = "var(--color-brand-success)";

export function PrayerCard({
  row,
  prayPending,
  onPray,
  onToggleAnswered,
}: {
  row: PrayerWallRow;
  prayPending: boolean;
  onPray: () => void;
  onToggleAnswered: () => void;
}) {
  const meta = PRAYER_CATEGORIES[row.category];
  const anonToOthers = row.is_anonymous;
  const hasName = row.first_name || row.last_name || row.preferred_name;
  // Anonymous rows show no name to anyone; the poster still sees the "You"
  // badge. A null name on a non-anonymous row means the author is unlisted.
  const authorName = anonToOthers
    ? "Anonymous"
    : hasName
      ? displayName(row)
      : "A member";
  const restricted = row.visible_to_warriors;
  const barColor = row.is_answered ? ANSWERED : restricted ? "var(--color-brand-accent)" : null;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-card p-5 ${
        row.is_answered
          ? "border-brand-success/40"
          : restricted
            ? "border-brand-accent/50"
            : "border-border"
      }`}
    >
      {barColor && (
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-1"
          style={{ backgroundColor: barColor }}
        />
      )}

      <div className="flex items-center gap-3">
        {anonToOthers || !hasName ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 bg-background text-muted-foreground">
            <UserRound className="h-5 w-5" aria-hidden="true" />
          </div>
        ) : (
          <Avatar size="lg" className="shrink-0">
            {row.avatar_url && <AvatarImage src={row.avatar_url} alt="" />}
            <AvatarFallback className="bg-brand-warm font-semibold text-brand-primary">
              {initials(row)}
            </AvatarFallback>
          </Avatar>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-serif text-lg text-foreground">
              {authorName}
            </span>
            {row.mine && (
              <span className="rounded-full bg-brand-warm px-2 py-0.5 text-[11px] font-bold text-brand-primary">
                You
              </span>
            )}
            {restricted && (
              <span className="flex items-center gap-1 rounded-full bg-brand-bg-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-accent-text">
                <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                Prayer warriors
              </span>
            )}
            {row.is_answered && (
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{ backgroundColor: `${ANSWERED}1A`, color: ANSWERED }}
              >
                <Check className="h-2.5 w-2.5" aria-hidden="true" />
                Answered
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {timeAgo(row.created_at)}
          </div>
        </div>

        <span
          className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold"
          style={{ backgroundColor: `${meta.color}18`, color: meta.color }}
        >
          {meta.label}
        </span>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/80">
        {row.body}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPray}
            disabled={prayPending}
            aria-pressed={row.i_am_praying}
            className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
              row.i_am_praying
                ? "bg-brand-primary text-white"
                : "bg-brand-warm text-brand-primary hover:bg-brand-primary/15"
            }`}
          >
            <HandHeart className="h-4 w-4" aria-hidden="true" />
            {row.i_am_praying ? "You're praying" : "I'm praying"}
          </button>

          {row.mine && (
            <button
              type="button"
              onClick={onToggleAnswered}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                row.is_answered
                  ? "border-brand-success bg-brand-success text-white"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              {row.is_answered ? "Answered" : "Mark answered"}
            </button>
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          <strong className="font-semibold text-foreground/80">
            {row.praying_count}
          </strong>{" "}
          praying
        </span>
      </div>
    </div>
  );
}
