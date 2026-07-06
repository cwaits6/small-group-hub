"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Home,
  LayoutList,
  Printer,
  Search,
  Tags,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPhone } from "@/lib/sanitize";
import { displayName, initials } from "@/lib/names";
import { BirthdayWidget } from "@/components/directory/BirthdayWidget";
import { AvatarCluster } from "@/components/directory/AvatarCluster";
import { GroupBadge } from "@/components/directory/GroupBadge";
import { GroupIcon } from "@/components/directory/GroupIcon";
import { ProfileSheetContent } from "@/components/directory/ProfileSheetContent";
import { HouseholdSheetContent } from "@/components/directory/HouseholdSheetContent";
import { GroupSheetContent } from "@/components/directory/GroupSheetContent";
import { formatAnniversary, relLabel } from "@/components/directory/utils";
import type { DirectoryGroup } from "@/components/directory/types";
import type {
  DirectoryProfile,
  FamilyDirectoryFull,
  HouseholdFamilyMember,
  HouseholdMember,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Types for the detail sheet subject (stack-based so Back works)
// ---------------------------------------------------------------------------
type SheetSubject =
  | { kind: "profile"; profile: DirectoryProfile }
  | { kind: "household"; family: FamilyDirectoryFull }
  | { kind: "group"; group: DirectoryGroup };

type DirectoryView = "households" | "people" | "groups";

// ---------------------------------------------------------------------------
// Alphabet section header — sticks below the measured search block
// ---------------------------------------------------------------------------
function AlphaHeader({ letter, top }: { letter: string; top: number }) {
  return (
    <div
      className="sticky z-10 bg-background/95 backdrop-blur-sm px-1 py-1"
      style={{ top }}
    >
      <p className="text-xs font-bold uppercase text-brand-primary tracking-widest">
        {letter}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// A–Z jump rail
// ---------------------------------------------------------------------------
function AlphaRail({
  letters,
  onJump,
}: {
  letters: string[];
  onJump: (letter: string) => void;
}) {
  if (letters.length < 5) return null;
  return (
    <nav
      aria-label="Jump to letter"
      className="fixed right-0.5 sm:right-2 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center"
    >
      {letters.map((letter) => (
        <button
          key={letter}
          type="button"
          onClick={() => onJump(letter)}
          className="text-[10px] leading-[14px] font-semibold text-brand-primary/70 hover:text-brand-primary px-1.5"
        >
          {letter}
        </button>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Household row (for Households view)
// ---------------------------------------------------------------------------
interface HouseholdRowProps {
  family: FamilyDirectoryFull;
  onOpen: () => void;
}

function HouseholdRow({ family, onOpen }: HouseholdRowProps) {
  const hasSpouse =
    family.members.some((m) => m.relationship === "spouse") ||
    family.family_members_list.some((fm) => fm.relationship === "spouse");

  const primary = family.members.find((m) => m.relationship === "primary");
  const spouse =
    family.members.find((m) => m.relationship === "spouse") ||
    family.family_members_list.find((fm) => fm.relationship === "spouse");
  const children = [
    ...family.members.filter((m) => m.relationship === "child"),
    ...family.family_members_list.filter((fm) => fm.relationship === "child"),
  ];

  const avatarPeople = [primary, spouse]
    .filter(Boolean)
    .map((p) => {
      const m = p as HouseholdMember | HouseholdFamilyMember;
      return {
        avatarUrl: m.avatar_url,
        name: [m.first_name, m.last_name].filter(Boolean).join(" "),
        initials: (
          ((m.preferred_name || m.first_name || "?").charAt(0)) +
          (m.last_name || "").charAt(0)
        ).toUpperCase(),
      };
    });

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left flex items-start gap-4 p-3 rounded-lg hover:bg-brand-bg-light/50 transition-colors"
    >
      {/* Family photo, falling back to avatar cluster */}
      <div className="shrink-0 pt-0.5">
        {family.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={family.photo_url}
            alt={`${family.family_name} family photo`}
            className="h-12 w-16 rounded-md object-cover"
          />
        ) : (
          <AvatarCluster people={avatarPeople} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold">{family.family_name}</p>
        <div className="text-sm text-muted-foreground space-y-0.5 mt-0.5">
          {primary && (
            <p className="font-medium text-foreground">
              {[primary.preferred_name || primary.first_name, primary.last_name]
                .filter(Boolean)
                .join(" ")}
            </p>
          )}
          {spouse && (
            <p>
              {[
                (spouse as HouseholdMember).preferred_name ||
                  spouse.first_name,
                spouse.last_name,
              ]
                .filter(Boolean)
                .join(" ")}{" "}
              <span className="text-xs capitalize">
                · {relLabel(spouse.relationship)}
              </span>
            </p>
          )}
          {children.length > 0 && (
            <p className="text-xs">
              {children
                .map((c) =>
                  [
                    (c as HouseholdMember).preferred_name || c.first_name,
                    c.last_name,
                  ]
                    .filter(Boolean)
                    .join(", "),
                )
                .join(", ")}
            </p>
          )}
        </div>
        {/* Anniversary badge */}
        {family.anniversary && hasSpouse && (
          <p className="text-xs text-muted-foreground mt-1">
            💍 {formatAnniversary(family.anniversary)}
          </p>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// People row (for People view)
// ---------------------------------------------------------------------------
interface PeopleRowProps {
  member: DirectoryProfile;
  onOpen: () => void;
}

function PeopleRow({ member, onOpen }: PeopleRowProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-brand-bg-light/50 transition-colors"
    >
      <Avatar className="h-10 w-10 shrink-0">
        {member.avatar_url && <AvatarImage src={member.avatar_url} alt={displayName(member)} />}
        <AvatarFallback className="bg-brand-primary text-white text-sm">
          {initials(member)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{displayName(member)}</p>
        {member.phone_mobile ? (
          <p className="text-sm text-muted-foreground">
            {formatPhone(member.phone_mobile)}
          </p>
        ) : member.email ? (
          <p className="text-sm text-muted-foreground truncate">{member.email}</p>
        ) : null}
      </div>
      {member.groups && member.groups.length > 0 && (
        <div className="flex gap-1 shrink-0 max-w-[45%] flex-wrap justify-end">
          {member.groups.slice(0, 2).map((g) => (
            <GroupBadge key={g.id} group={g} size="xs" />
          ))}
          {member.groups.length > 2 && (
            <span className="text-[10px] text-muted-foreground self-center">
              +{member.groups.length - 2}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Group row (for Groups view)
// ---------------------------------------------------------------------------
interface GroupRowProps {
  group: DirectoryGroup;
  count: number;
  onOpen: () => void;
}

function GroupRow({ group, count, onOpen }: GroupRowProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left flex items-center gap-4 p-3 rounded-lg hover:bg-brand-bg-light/50 transition-colors"
    >
      <div
        className="h-10 w-10 rounded-full flex items-center justify-center text-white shrink-0"
        style={{ backgroundColor: group.color || "#6b7280" }}
      >
        <GroupIcon name={group.icon} className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold">{group.name}</p>
        {group.description && (
          <p className="text-sm text-muted-foreground truncate">
            {group.description}
          </p>
        )}
      </div>
      <span className="text-sm text-muted-foreground shrink-0">
        {count} member{count !== 1 ? "s" : ""}
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------
function DirectorySkeleton() {
  return (
    <div className="mt-6 space-y-3" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-40 rounded bg-muted animate-pulse" />
            <div className="h-3 w-28 rounded bg-muted animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function DirectoryPage() {
  const [members, setMembers] = useState<DirectoryProfile[]>([]);
  const [families, setFamilies] = useState<FamilyDirectoryFull[]>([]);
  const [allGroups, setAllGroups] = useState<DirectoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [view, setView] = useState<DirectoryView>("households");
  const [sheetStack, setSheetStack] = useState<SheetSubject[]>([]);

  // Measured height of the sticky search block so A–Z headers stick below it
  const stickyRef = useRef<HTMLDivElement>(null);
  const [stickyH, setStickyH] = useState(140);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function load() {
      const [{ data: m, error: mErr }, { data: f, error: fErr }, { data: g, error: gErr }] = await Promise.all([
        supabase
          .from("profiles_directory")
          .select("*")
          .order("last_name", { ascending: true }),
        supabase
          .from("families_directory_full")
          .select("*")
          .order("family_name", { ascending: true }),
        supabase
          .from("member_groups")
          .select("id, name, color, icon, description, show_in_directory_filter")
          .order("display_order"),
      ]);

      if (mErr || fErr || gErr) {
        const err = mErr ?? fErr ?? gErr;
        console.error("directory load error:", {
          source: mErr ? "profiles_directory" : fErr ? "families_directory_full" : "member_groups",
          message: err?.message,
          details: err?.details,
          hint: err?.hint,
          code: err?.code,
        });
        setLoading(false);
        return;
      }

      setMembers((m || []) as DirectoryProfile[]);
      setFamilies((f || []) as FamilyDirectoryFull[]);
      setAllGroups((g || []) as DirectoryGroup[]);
      setLoading(false);
    }
    load();
  }, [supabase]);

  useEffect(() => {
    const el = stickyRef.current;
    if (!el) return;
    const measure = () => setStickyH(el.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading]);

  // Sheet stack helpers
  const sheetSubject = sheetStack[sheetStack.length - 1] ?? null;
  const pushSheet = (subject: SheetSubject) =>
    setSheetStack((prev) => [...prev, subject]);
  const popSheet = () => setSheetStack((prev) => prev.slice(0, -1));
  const closeSheet = () => setSheetStack([]);

  // Groups shown as filter chips
  const filterGroups = useMemo(
    () => allGroups.filter((g) => g.show_in_directory_filter),
    [allGroups],
  );

  // Build a lookup map: profileId → DirectoryProfile
  const profileMap = useMemo(() => {
    const map: Record<string, DirectoryProfile> = {};
    members.forEach((m) => { map[m.id] = m; });
    return map;
  }, [members]);

  // Build a lookup map: familyId → FamilyDirectoryFull
  const familyMap = useMemo(() => {
    const map: Record<string, FamilyDirectoryFull> = {};
    families.forEach((f) => { map[f.id] = f; });
    return map;
  }, [families]);

  // Roster per group, derived from listed members' group chips
  const groupRosters = useMemo(() => {
    const map: Record<string, DirectoryProfile[]> = {};
    for (const m of members) {
      for (const g of m.groups || []) {
        (map[g.id] ??= []).push(m);
      }
    }
    return map;
  }, [members]);

  // Filter members by search + group
  const filteredMembers = useMemo(() => {
    let list = members;

    if (activeGroup) {
      list = list.filter((m) =>
        m.groups?.some((g) => g.id === activeGroup),
      );
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const qDigits = q.replace(/\D/g, "");
      list = list.filter((m) => {
        const familyName = m.family_id
          ? familyMap[m.family_id]?.family_name
          : null;
        const haystack = [
          m.first_name,
          m.last_name,
          m.preferred_name,
          m.email,
          m.occupation,
          m.employer,
          m.city,
          familyName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (haystack.includes(q)) return true;
        if (qDigits.length >= 3) {
          const phones = [m.phone_mobile, m.phone_home, m.phone_work]
            .filter(Boolean)
            .join("")
            .replace(/\D/g, "");
          if (phones.includes(qDigits)) return true;
        }
        return false;
      });
    }

    return list;
  }, [members, query, activeGroup, familyMap]);

  // Filter families for Households view — show a family if any of its members match
  const filteredFamilies = useMemo(() => {
    const memberIds = new Set(filteredMembers.map((m) => m.id));
    return families.filter((f) =>
      f.members.some((m) => memberIds.has(m.id)),
    );
  }, [families, filteredMembers]);

  // Solo members (no family_id)
  const soloMembers = useMemo(
    () => filteredMembers.filter((m) => !m.family_id),
    [filteredMembers],
  );

  // Build A-Z sections for Households view
  const householdSections = useMemo(() => {
    type Entry =
      | { kind: "family"; family: FamilyDirectoryFull }
      | { kind: "solo"; member: DirectoryProfile };

    const entries: Entry[] = [
      ...filteredFamilies.map((f) => ({ kind: "family" as const, family: f })),
      ...soloMembers.map((m) => ({ kind: "solo" as const, member: m })),
    ];

    // Sort by "sort key" (last name for solo, family_name for family)
    entries.sort((a, b) => {
      const keyA =
        a.kind === "family"
          ? a.family.family_name
          : a.member.last_name || a.member.first_name || "";
      const keyB =
        b.kind === "family"
          ? b.family.family_name
          : b.member.last_name || b.member.first_name || "";
      return keyA.localeCompare(keyB);
    });

    // Group by first letter
    const sections: Record<string, Entry[]> = {};
    for (const entry of entries) {
      const key =
        entry.kind === "family"
          ? entry.family.family_name.charAt(0).toUpperCase()
          : (
              entry.member.last_name ||
              entry.member.first_name ||
              "#"
            )
              .charAt(0)
              .toUpperCase();
      const letter = /[A-Z]/.test(key) ? key : "#";
      (sections[letter] ??= []).push(entry);
    }

    return sections;
  }, [filteredFamilies, soloMembers]);

  // Build A-Z sections for People view
  const peopleSections = useMemo(() => {
    const sections: Record<string, DirectoryProfile[]> = {};
    for (const m of filteredMembers) {
      const key = (m.last_name || m.first_name || "#").charAt(0).toUpperCase();
      const letter = /[A-Z]/.test(key) ? key : "#";
      (sections[letter] ??= []).push(m);
    }
    return sections;
  }, [filteredMembers]);

  const sectionLetters = useMemo(() => {
    if (view === "households") return Object.keys(householdSections).sort();
    if (view === "people") return Object.keys(peopleSections).sort();
    return [];
  }, [view, householdSections, peopleSections]);

  function handleChipClick(groupId: string | null) {
    const next = groupId === activeGroup ? null : groupId;
    setActiveGroup(next);
    // A group filter is a person-level question — households would show
    // whole families where only one member matches, so switch to People.
    if (next && view === "households") setView("people");
  }

  function jumpToLetter(letter: string) {
    document
      .getElementById(`dir-section-${letter}`)
      ?.scrollIntoView({ behavior: "smooth" });
  }

  // Resolve the family for the profile detail sheet
  const sheetFamily =
    sheetSubject?.kind === "profile" && sheetSubject.profile.family_id
      ? (familyMap[sheetSubject.profile.family_id] ?? null)
      : null;

  const sheetTitle =
    sheetSubject?.kind === "profile"
      ? displayName(sheetSubject.profile)
      : sheetSubject?.kind === "household"
        ? sheetSubject.family.family_name
        : sheetSubject?.kind === "group"
          ? sheetSubject.group.name
          : "";

  const householdCount =
    Object.values(householdSections).reduce((n, s) => n + s.length, 0);

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-3xl md:text-4xl font-bold text-brand-primary mb-2">
        Member Directory
      </h1>
      <p className="text-base text-muted-foreground mb-6">
        Browse and connect with other members in your class.
      </p>

      {loading ? (
        <DirectorySkeleton />
      ) : (
        <>
          {/* Birthday / Anniversary Widget */}
          <BirthdayWidget members={members} families={families} />

          {/* Sticky search + filter area */}
          <div
            ref={stickyRef}
            className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm pb-3 pt-1"
          >
            {/* Search bar */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search name, phone, city, occupation..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10 text-base py-5"
              />
            </div>

            {/* Group filter chips (not shown in Groups view) */}
            {filterGroups.length > 0 && view !== "groups" && (
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => handleChipClick(null)}
                  className={`shrink-0 px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                    activeGroup === null
                      ? "bg-brand-primary text-white border-brand-primary"
                      : "border-border text-muted-foreground hover:border-brand-primary"
                  }`}
                >
                  All
                </button>
                {filterGroups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleChipClick(g.id)}
                    className={`shrink-0 px-3 py-1 rounded-full text-sm font-medium border transition-colors inline-flex items-center gap-1 ${
                      activeGroup === g.id
                        ? "text-white border-transparent"
                        : "border-border text-muted-foreground hover:border-current"
                    }`}
                    style={
                      activeGroup === g.id
                        ? { backgroundColor: g.color || "#6b7280" }
                        : {}
                    }
                  >
                    <GroupIcon name={g.icon} className="h-3.5 w-3.5" />
                    {g.name}
                  </button>
                ))}
              </div>
            )}

            {/* View toggle */}
            <div className="flex gap-2 mt-3">
              <Button
                variant={view === "households" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("households")}
                className={
                  view === "households"
                    ? "bg-brand-primary text-white hover:bg-brand-primary/90"
                    : ""
                }
              >
                <Home className="mr-1 h-4 w-4" />
                Households ({householdCount})
              </Button>
              <Button
                variant={view === "people" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("people")}
                className={
                  view === "people"
                    ? "bg-brand-primary text-white hover:bg-brand-primary/90"
                    : ""
                }
              >
                <LayoutList className="mr-1 h-4 w-4" />
                People ({filteredMembers.length})
              </Button>
              <Button
                variant={view === "groups" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("groups")}
                className={
                  view === "groups"
                    ? "bg-brand-primary text-white hover:bg-brand-primary/90"
                    : ""
                }
              >
                <Tags className="mr-1 h-4 w-4" />
                Groups ({allGroups.length})
              </Button>
              <Link
                href="/directory/print"
                aria-label="Printable directory"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon-sm" }),
                  "ml-auto text-muted-foreground",
                )}
              >
                <Printer className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* A–Z jump rail */}
          {view !== "groups" && (
            <AlphaRail letters={sectionLetters} onJump={jumpToLetter} />
          )}

          {/* ============================================================
              HOUSEHOLDS VIEW
              ============================================================ */}
          {view === "households" && (
            <div className="mt-4">
              {Object.keys(householdSections).length === 0 ? (
                <p className="text-base text-muted-foreground text-center py-8">
                  No members match your search.
                </p>
              ) : (
                Object.keys(householdSections)
                  .sort()
                  .map((letter) => (
                    <div
                      key={letter}
                      id={`dir-section-${letter}`}
                      style={{ scrollMarginTop: stickyH + 8 }}
                    >
                      <AlphaHeader letter={letter} top={stickyH} />
                      <div className="divide-y">
                        {householdSections[letter].map((entry) => {
                          if (entry.kind === "family") {
                            return (
                              <HouseholdRow
                                key={`fam-${entry.family.id}`}
                                family={entry.family}
                                onOpen={() =>
                                  pushSheet({
                                    kind: "household",
                                    family: entry.family,
                                  })
                                }
                              />
                            );
                          } else {
                            return (
                              <div
                                key={`solo-${entry.member.id}`}
                                className="py-0.5"
                              >
                                <PeopleRow
                                  member={entry.member}
                                  onOpen={() =>
                                    pushSheet({
                                      kind: "profile",
                                      profile: entry.member,
                                    })
                                  }
                                />
                              </div>
                            );
                          }
                        })}
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}

          {/* ============================================================
              PEOPLE VIEW
              ============================================================ */}
          {view === "people" && (
            <div className="mt-4">
              {Object.keys(peopleSections).length === 0 ? (
                <p className="text-base text-muted-foreground text-center py-8">
                  No members match your search.
                </p>
              ) : (
                Object.keys(peopleSections)
                  .sort()
                  .map((letter) => (
                    <div
                      key={letter}
                      id={`dir-section-${letter}`}
                      style={{ scrollMarginTop: stickyH + 8 }}
                    >
                      <AlphaHeader letter={letter} top={stickyH} />
                      <div className="divide-y">
                        {peopleSections[letter].map((m) => (
                          <PeopleRow
                            key={m.id}
                            member={m}
                            onOpen={() =>
                              pushSheet({ kind: "profile", profile: m })
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}

          {/* ============================================================
              GROUPS VIEW
              ============================================================ */}
          {view === "groups" && (
            <div className="mt-4">
              {allGroups.length === 0 ? (
                <p className="text-base text-muted-foreground text-center py-8">
                  No groups have been created yet.
                </p>
              ) : (
                <div className="divide-y">
                  {allGroups.map((g) => (
                    <GroupRow
                      key={g.id}
                      group={g}
                      count={(groupRosters[g.id] || []).length}
                      onOpen={() => pushSheet({ kind: "group", group: g })}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ============================================================
          DETAIL SHEET (stack-based: household → member, group → member)
          ============================================================ */}
      <Sheet open={!!sheetSubject} onOpenChange={(o) => !o && closeSheet()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md flex flex-col overflow-hidden p-0"
        >
          <SheetHeader className="px-4 pt-4 pb-3 border-b shrink-0">
            <div className="flex items-center gap-2">
              {sheetStack.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={popSheet}
                  aria-label="Back"
                  className="-ml-2 shrink-0"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              )}
              <SheetTitle className="truncate">{sheetTitle}</SheetTitle>
            </div>
          </SheetHeader>

          {sheetSubject?.kind === "profile" && (
            <ProfileSheetContent
              profile={sheetSubject.profile}
              family={sheetFamily}
            />
          )}
          {sheetSubject?.kind === "household" && (
            <HouseholdSheetContent
              family={sheetSubject.family}
              profileMap={profileMap}
              onOpenProfile={(p) => pushSheet({ kind: "profile", profile: p })}
            />
          )}
          {sheetSubject?.kind === "group" && (
            <GroupSheetContent
              group={sheetSubject.group}
              members={groupRosters[sheetSubject.group.id] || []}
              onOpenProfile={(p) => pushSheet({ kind: "profile", profile: p })}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
