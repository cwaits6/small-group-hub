"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPhone } from "@/lib/sanitize";
import { displayName } from "@/lib/names";
import { siteConfig } from "@/lib/config";
import { MONTH_NAMES, relLabel } from "@/components/directory/utils";
import type {
  DirectoryProfile,
  FamilyDirectoryFull,
} from "@/lib/types";

type Entry =
  | { kind: "family"; family: FamilyDirectoryFull }
  | { kind: "solo"; member: DirectoryProfile };

function entrySortKey(entry: Entry): string {
  return entry.kind === "family"
    ? entry.family.family_name
    : entry.member.last_name || entry.member.first_name || "";
}

function formatAddress(a: {
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
}): string | null {
  if (!a.address_line1 && !a.city) return null;
  const cityState = [a.city, a.state].filter(Boolean).join(", ");
  const line = [
    a.address_line1,
    a.address_line2,
    [cityState, a.postal_code].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  return line || null;
}

function MemberLine({ profile }: { profile: DirectoryProfile }) {
  const contact = [
    profile.phone_mobile && `${formatPhone(profile.phone_mobile)} (m)`,
    profile.phone_work && `${formatPhone(profile.phone_work)} (w)`,
    profile.email,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <p className="text-sm leading-snug">
      <span className="font-medium">{displayName(profile)}</span>
      {profile.relationship !== "primary" && (
        <span className="text-neutral-500"> · {relLabel(profile.relationship)}</span>
      )}
      {profile.birth_month && profile.birth_day && (
        <span className="text-neutral-500">
          {" "}· 🎂 {MONTH_NAMES[profile.birth_month - 1].slice(0, 3)}{" "}
          {profile.birth_day}
        </span>
      )}
      {contact && <span className="text-neutral-600"> — {contact}</span>}
    </p>
  );
}

export default function DirectoryPrintPage() {
  const [members, setMembers] = useState<DirectoryProfile[]>([]);
  const [families, setFamilies] = useState<FamilyDirectoryFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const [
        { data: m, error: mErr },
        { data: f, error: fErr },
      ] = await Promise.all([
        supabase
          .from("profiles_directory")
          .select("*")
          .order("last_name", { ascending: true }),
        supabase
          .from("families_directory_full")
          .select("*")
          .order("family_name", { ascending: true }),
      ]);
      if (mErr || fErr) {
        console.error("Failed to load directory:", mErr || fErr);
        setLoadError(true);
        setLoading(false);
        return;
      }
      setMembers((m || []) as DirectoryProfile[]);
      setFamilies((f || []) as FamilyDirectoryFull[]);
      setLoading(false);
    }
    load();
  }, []);

  const profileMap = useMemo(() => {
    const map: Record<string, DirectoryProfile> = {};
    members.forEach((m) => { map[m.id] = m; });
    return map;
  }, [members]);

  const entries = useMemo<Entry[]>(() => {
    const solos = members.filter((m) => !m.family_id);
    const list: Entry[] = [
      ...families
        .filter((f) => f.members.length > 0 || f.family_members_list.length > 0)
        .map((f) => ({ kind: "family" as const, family: f })),
      ...solos.map((m) => ({ kind: "solo" as const, member: m })),
    ];
    list.sort((a, b) => entrySortKey(a).localeCompare(entrySortKey(b)));
    return list;
  }, [members, families]);

  // Birthdays by month appendix
  const birthdaysByMonth = useMemo(() => {
    const byMonth: Record<number, { name: string; day: number }[]> = {};
    for (const m of members) {
      if (!m.birth_month || !m.birth_day) continue;
      (byMonth[m.birth_month] ??= []).push({
        name: displayName(m),
        day: m.birth_day,
      });
    }
    for (const family of families) {
      for (const fm of family.family_members_list) {
        if (!fm.birth_month || !fm.birth_day) continue;
        (byMonth[fm.birth_month] ??= []).push({
          name: [fm.first_name, fm.last_name].filter(Boolean).join(" "),
          day: fm.birth_day,
        });
      }
    }
    Object.values(byMonth).forEach((list) => list.sort((a, b) => a.day - b.day));
    return byMonth;
  }, [members, families]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <p className="text-xl text-muted-foreground">Preparing directory...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="container mx-auto px-4 py-12 space-y-4">
        <p className="text-xl text-muted-foreground">
          Couldn&apos;t load the directory. Please try again.
        </p>
        <Link
          href="/directory"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to directory
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-3xl bg-white text-black">
      {/* Toolbar — hidden when printing */}
      <div className="flex items-center justify-between mb-8 print:hidden">
        <Link
          href="/directory"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to directory
        </Link>
        <Button
          onClick={() => window.print()}
          className="bg-brand-primary hover:bg-brand-primary/90 text-white"
        >
          <Printer className="mr-2 h-4 w-4" />
          Print / Save as PDF
        </Button>
      </div>

      {/* Title page header */}
      <div className="text-center mb-8 border-b pb-6">
        <h1 className="text-3xl font-bold">{siteConfig.name}</h1>
        <p className="text-lg mt-1">Member Directory</p>
        <p className="text-sm text-neutral-500 mt-1">
          {new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Household / member listing */}
      <div className="space-y-5">
        {entries.map((entry) => {
          if (entry.kind === "family") {
            const f = entry.family;
            const address = formatAddress(f);
            return (
              <div
                key={`fam-${f.id}`}
                className="break-inside-avoid border-b border-neutral-200 pb-4 flex gap-4"
              >
                {f.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={f.photo_url}
                    alt={`${f.family_name} family photo`}
                    className="h-24 w-32 object-cover rounded shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-lg font-bold">{f.family_name}</p>
                  {address && (
                    <p className="text-sm text-neutral-600">{address}</p>
                  )}
                  {f.phone_home && (
                    <p className="text-sm text-neutral-600">
                      {formatPhone(f.phone_home)} (home)
                    </p>
                  )}
                  <div className="mt-1.5 space-y-0.5">
                    {f.members.map((m) => {
                      const full = profileMap[m.id];
                      if (full) return <MemberLine key={m.id} profile={full} />;
                      return (
                        <p key={m.id} className="text-sm">
                          {[m.preferred_name || m.first_name, m.last_name]
                            .filter(Boolean)
                            .join(" ")}
                        </p>
                      );
                    })}
                    {f.family_members_list.map((fm) => (
                      <p key={fm.id} className="text-sm leading-snug">
                        <span className="font-medium">
                          {[fm.first_name, fm.last_name].filter(Boolean).join(" ")}
                        </span>
                        <span className="text-neutral-500">
                          {" "}· {relLabel(fm.relationship)}
                        </span>
                        {fm.birth_month && fm.birth_day && (
                          <span className="text-neutral-500">
                            {" "}· 🎂 {MONTH_NAMES[fm.birth_month - 1].slice(0, 3)}{" "}
                            {fm.birth_day}
                          </span>
                        )}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          const m = entry.member;
          const address = formatAddress(m);
          return (
            <div
              key={`solo-${m.id}`}
              className="break-inside-avoid border-b border-neutral-200 pb-4"
            >
              <MemberLine profile={m} />
              {address && (
                <p className="text-sm text-neutral-600">{address}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Birthdays by month */}
      <div className="mt-10 break-before-page">
        <h2 className="text-xl font-bold mb-4">Birthdays by Month</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          {MONTH_NAMES.map((monthName, i) => {
            const list = birthdaysByMonth[i + 1] || [];
            if (list.length === 0) return null;
            return (
              <div key={monthName} className="break-inside-avoid">
                <p className="font-semibold text-sm mb-1">{monthName}</p>
                {list.map((b, j) => (
                  <p key={j} className="text-xs leading-snug">
                    {b.day} — {b.name}
                  </p>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
