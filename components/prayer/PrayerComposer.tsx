"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, HandHeart, Lock, Shield, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { displayName, initials } from "@/lib/names";
import { PRAYER_CATEGORIES, PRAYER_CATEGORY_KEYS } from "@/lib/prayer";
import type { PrayerCategory, PrayerWarrior } from "@/lib/types";
import type { Me } from "@/components/prayer/PrayerBoard";

function SwitchRow({
  on,
  onToggle,
  title,
  sub,
  icon,
}: {
  on: boolean;
  onToggle: () => void;
  title: string;
  sub: string;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
        on
          ? "border-brand-primary/40 bg-brand-warm"
          : "border-border bg-card hover:border-brand-primary/30"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          on
            ? "bg-brand-primary text-white"
            : "bg-background text-muted-foreground"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">
          {title}
        </span>
        <span className="block text-[13px] leading-snug text-muted-foreground">
          {sub}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={`h-[23px] w-10 shrink-0 rounded-full p-0.5 transition-colors ${
          on ? "bg-brand-primary" : "bg-muted"
        }`}
      >
        <span
          className={`block h-[19px] w-[19px] rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-[17px]" : ""
          }`}
        />
      </span>
    </button>
  );
}

/**
 * Expandable roster of the Prayer Warriors group, so a poster can see exactly
 * who will get a request they restrict to warriors. Only lists members the
 * viewer is allowed to see (unlisted profiles are hidden by RLS).
 */
function WarriorRoster({ warriors }: { warriors: PrayerWarrior[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
        {warriors.length === 0
          ? "No prayer warriors yet"
          : `See who's in the group (${warriors.length})`}
      </button>
      {open && warriors.length > 0 && (
        <ul className="flex flex-col gap-2 px-3 pb-3">
          {warriors.map((w) => (
            <li key={w.id} className="flex items-center gap-2.5">
              <Avatar size="sm" className="shrink-0">
                {w.avatar_url && <AvatarImage src={w.avatar_url} alt="" />}
                <AvatarFallback className="bg-brand-warm text-xs font-semibold text-brand-primary">
                  {initials(w)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-foreground">{displayName(w)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PrayerComposer({
  me,
  onPost,
  warriors,
}: {
  me: Me;
  onPost: (draft: {
    body: string;
    category: PrayerCategory;
    is_anonymous: boolean;
    visible_to_warriors: boolean;
  }) => Promise<boolean>;
  warriors: PrayerWarrior[];
}) {
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<PrayerCategory>("health");
  const [anonymous, setAnonymous] = useState(false);
  const [toWarriors, setToWarriors] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canPost = body.trim().length > 0 && !submitting;

  const submit = async () => {
    if (!canPost) return;
    setSubmitting(true);
    let ok = false;
    try {
      ok = await onPost({
        body: body.trim(),
        category,
        is_anonymous: anonymous,
        visible_to_warriors: toWarriors,
      });
    } finally {
      setSubmitting(false);
    }
    if (ok) {
      setBody("");
      setAnonymous(false);
      setToWarriors(false);
      setCategory("health");
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="p-5 pb-0">
        <div className="mb-3.5 flex items-center gap-2.5">
          <Avatar
            size="lg"
            className={`shrink-0 transition-opacity ${anonymous ? "opacity-25" : ""}`}
          >
            {me.avatarUrl && <AvatarImage src={me.avatarUrl} alt="" />}
            <AvatarFallback className="bg-brand-bg-light font-bold text-foreground">
              {me.initials}
            </AvatarFallback>
          </Avatar>
          <h2 className="font-serif text-xl text-foreground">
            Share a request
          </h2>
        </div>

        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What can we pray with you about?"
          rows={4}
          maxLength={2000}
          className="bg-background text-[15px]"
        />

        <div className="mt-4 mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Category
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRAYER_CATEGORY_KEYS.map((key) => {
            const meta = PRAYER_CATEGORIES[key];
            const active = key === category;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                aria-pressed={active}
                className="rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors"
                style={
                  active
                    ? { backgroundColor: meta.color, borderColor: meta.color, color: "var(--primary-foreground)" }
                    : undefined
                }
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 p-5">
        <SwitchRow
          on={anonymous}
          onToggle={() => setAnonymous((v) => !v)}
          title="Share anonymously"
          sub="Your name is hidden — only the request is shown."
          icon={<UserRound className="h-4 w-4" aria-hidden="true" />}
        />

        <div className="mt-2 mb-0.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Who can see this
        </div>
        <SwitchRow
          on={toWarriors}
          onToggle={() => setToWarriors((v) => !v)}
          title="Prayer warriors only"
          sub="Off — everyone in the class can see it."
          icon={<Shield className="h-4 w-4" aria-hidden="true" />}
        />
        <WarriorRoster warriors={warriors} />
        {toWarriors && warriors.length === 0 && (
          <p className="px-1 text-[13px] text-brand-primary">
            No one is in the Prayer Warriors group yet, so only you will see
            this request.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background px-5 py-3.5">
        <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          {toWarriors && (
            <Lock
              className="h-3.5 w-3.5 shrink-0 text-brand-primary"
              aria-hidden="true"
            />
          )}
          <span>
            Posting as{" "}
            <strong className="font-semibold text-foreground">
              {anonymous ? "Anonymous" : me.name}
            </strong>{" "}
            · visible to{" "}
            <strong className="font-semibold text-foreground">
              {toWarriors ? "prayer warriors" : "everyone"}
            </strong>
          </span>
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={!canPost}
          className="flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-40"
        >
          <HandHeart className="h-4 w-4" aria-hidden="true" />
          {submitting ? "Posting…" : "Post request"}
        </button>
      </div>
    </div>
  );
}
