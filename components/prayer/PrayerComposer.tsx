"use client";

import { useState, type ReactNode } from "react";
import { HandHeart, Lock, Phone, Shield, UserCog, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  audienceSummary,
  isRestricted,
  PRAYER_CATEGORIES,
  PRAYER_CATEGORY_KEYS,
  type PrayerAudience,
} from "@/lib/prayer";
import type { PrayerCategory } from "@/lib/types";
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

const NO_AUDIENCE: PrayerAudience = {
  visible_to_warriors: false,
  visible_to_leaders: false,
  visible_to_admins: false,
};

export function PrayerComposer({
  me,
  onPost,
}: {
  me: Me;
  onPost: (draft: {
    body: string;
    category: PrayerCategory;
    is_anonymous: boolean;
  } & PrayerAudience) => Promise<boolean>;
}) {
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<PrayerCategory>("health");
  const [anonymous, setAnonymous] = useState(false);
  const [audience, setAudience] = useState<PrayerAudience>(NO_AUDIENCE);
  const [submitting, setSubmitting] = useState(false);

  const restricted = isRestricted(audience);
  const canPost = body.trim().length > 0 && !submitting;

  const toggleAudience = (key: keyof PrayerAudience) =>
    setAudience((a) => ({ ...a, [key]: !a[key] }));

  const submit = async () => {
    if (!canPost) return;
    setSubmitting(true);
    const ok = await onPost({
      body: body.trim(),
      category,
      is_anonymous: anonymous,
      ...audience,
    });
    setSubmitting(false);
    if (ok) {
      setBody("");
      setAnonymous(false);
      setAudience(NO_AUDIENCE);
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
                    ? { backgroundColor: meta.color, borderColor: meta.color, color: "#fff" }
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
          on={audience.visible_to_warriors}
          onToggle={() => toggleAudience("visible_to_warriors")}
          title="Prayer warriors"
          sub="Members in the Prayer Warriors group."
          icon={<Shield className="h-4 w-4" aria-hidden="true" />}
        />
        <SwitchRow
          on={audience.visible_to_leaders}
          onToggle={() => toggleAudience("visible_to_leaders")}
          title="Prayer call leaders"
          sub="Members who lead a prayer call."
          icon={<Phone className="h-4 w-4" aria-hidden="true" />}
        />
        <SwitchRow
          on={audience.visible_to_admins}
          onToggle={() => toggleAudience("visible_to_admins")}
          title="Admins"
          sub="Group admins."
          icon={<UserCog className="h-4 w-4" aria-hidden="true" />}
        />
        {!restricted && (
          <p className="px-1 text-[13px] text-muted-foreground">
            All off — everyone in the group can see it.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background px-5 py-3.5">
        <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          {restricted && (
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
              {audienceSummary(audience)}
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
