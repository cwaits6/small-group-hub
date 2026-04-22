"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Search,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Briefcase,
  Home,
  LayoutList,
  Users,
} from "lucide-react";
import { formatPhone } from "@/lib/sanitize";
import { displayName, initials } from "@/lib/names";
import { BirthdayWidget } from "@/components/directory/BirthdayWidget";
import type {
  DirectoryProfile,
  FamilyDirectoryFull,
  GroupChip,
  HouseholdMember,
  HouseholdFamilyMember,
} from "@/lib/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatBirthdayShort(month: number, day: number): string {
  return `${MONTH_NAMES[month - 1]} ${day}`;
}

function formatAnniversary(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Resolve the best address to show in the detail sheet */
function resolveAddress(
  member: DirectoryProfile,
  family: FamilyDirectoryFull | null,
) {
  const line1 = member.address_line1 ?? family?.address_line1 ?? null;
  const line2 = member.address_line2 ?? family?.address_line2 ?? null;
  const city = member.city ?? family?.city ?? null;
  const state = member.state ?? family?.state ?? null;
  const postal = member.postal_code ?? family?.postal_code ?? null;
  if (!line1 && !city) return null;
  return { line1, line2, city, state, postal };
}

// ---------------------------------------------------------------------------
// Types for the detail sheet subject
// ---------------------------------------------------------------------------
type SheetSubject =
  | { kind: "profile"; profile: DirectoryProfile }
  | { kind: "household"; family: FamilyDirectoryFull };

// ---------------------------------------------------------------------------
// Relationship label helper
// ---------------------------------------------------------------------------
function relLabel(rel: string): string {
  switch (rel) {
    case "primary": return "Primary";
    case "spouse": return "Spouse";
    case "child": return "Child";
    case "parent": return "Parent";
    case "sibling": return "Sibling";
    default: return "Other";
  }
}

// ---------------------------------------------------------------------------
// Alphabet section header
// ---------------------------------------------------------------------------
function AlphaHeader({ letter }: { letter: string }) {
  return (
    <div className="sticky top-[88px] z-10 bg-background/95 backdrop-blur-sm px-1 py-1">
      <p className="text-xs font-bold uppercase text-brand-primary tracking-widest">
        {letter}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avatar cluster — up to 3 faces
// ---------------------------------------------------------------------------
interface AvatarClusterProps {
  people: Array<{ avatarUrl: string | null; name: string; initials: string }>;
}

function AvatarCluster({ people }: AvatarClusterProps) {
  const displayed = people.slice(0, 3);
  return (
    <div className="flex -space-x-2">
      {displayed.map((p, i) => (
        <Avatar
          key={i}
          className="h-10 w-10 border-2 border-background"
        >
          {p.avatarUrl && (
            <AvatarImage src={p.avatarUrl} alt={p.name} />
          )}
          <AvatarFallback className="bg-brand-primary text-white text-sm">
            {p.initials}
          </AvatarFallback>
        </Avatar>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group chip
// ---------------------------------------------------------------------------
function GroupBadge({ group }: { group: GroupChip }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: group.color || "#6b7280" }}
    >
      {group.name}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Profile detail sheet content
// ---------------------------------------------------------------------------
interface ProfileSheetProps {
  profile: DirectoryProfile;
  family: FamilyDirectoryFull | null;
}

function ProfileSheetContent({ profile, family }: ProfileSheetProps) {
  const address = resolveAddress(profile, family);
  const hasBirthday = profile.birth_month && profile.birth_day;

  return (
    <div className="px-4 pb-6 space-y-3 overflow-y-auto flex-1">
      {/* Header */}
      <div className="flex items-center gap-4 pt-2">
        <Avatar className="h-20 w-20 shrink-0">
          {profile.avatar_url && (
            <AvatarImage src={profile.avatar_url} alt={displayName(profile)} />
          )}
          <AvatarFallback className="bg-brand-primary text-white text-2xl">
            {initials(profile)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-xl font-bold leading-tight">{displayName(profile)}</p>
          {profile.preferred_name &&
            profile.first_name &&
            profile.preferred_name !== profile.first_name && (
              <p className="text-sm text-muted-foreground">
                ({profile.first_name} {profile.last_name})
              </p>
            )}
          {profile.relationship && profile.relationship !== "primary" && (
            <Badge variant="outline" className="text-xs mt-1 capitalize">
              {relLabel(profile.relationship)}
            </Badge>
          )}
        </div>
      </div>

      {/* Groups */}
      {profile.groups && profile.groups.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {profile.groups.map((g) => (
            <GroupBadge key={g.id} group={g} />
          ))}
        </div>
      )}

      {/* Bio */}
      {profile.bio && (
        <p className="text-sm italic text-muted-foreground">{profile.bio}</p>
      )}

      {/* Phones */}
      {profile.phone_mobile && (
        <div className="flex items-center gap-3">
          <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
          <a
            href={`tel:${profile.phone_mobile}`}
            className="text-base text-brand-primary hover:underline"
          >
            {formatPhone(profile.phone_mobile)}
          </a>
          <span className="text-xs text-muted-foreground">mobile</span>
        </div>
      )}
      {profile.phone_home && (
        <div className="flex items-center gap-3">
          <Home className="h-4 w-4 text-muted-foreground shrink-0" />
          <a
            href={`tel:${profile.phone_home}`}
            className="text-base text-brand-primary hover:underline"
          >
            {formatPhone(profile.phone_home)}
          </a>
          <span className="text-xs text-muted-foreground">home</span>
        </div>
      )}
      {!profile.phone_home && family?.phone_home && (
        <div className="flex items-center gap-3">
          <Home className="h-4 w-4 text-muted-foreground shrink-0" />
          <a
            href={`tel:${family.phone_home}`}
            className="text-base text-brand-primary hover:underline"
          >
            {formatPhone(family.phone_home)}
          </a>
          <span className="text-xs text-muted-foreground">family home</span>
        </div>
      )}
      {profile.phone_work && (
        <div className="flex items-center gap-3">
          <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
          <a
            href={`tel:${profile.phone_work}`}
            className="text-base text-brand-primary hover:underline"
          >
            {formatPhone(profile.phone_work)}
          </a>
          <span className="text-xs text-muted-foreground">work</span>
        </div>
      )}

      {/* Email */}
      {profile.email && (
        <div className="flex items-center gap-3">
          <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
          <a
            href={`mailto:${profile.email}`}
            className="text-base text-brand-primary hover:underline break-all"
          >
            {profile.email}
          </a>
        </div>
      )}

      {/* Address */}
      {address && (
        <div className="flex items-start gap-3">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
          <div className="text-base">
            <p>{address.line1}</p>
            {address.line2 && <p>{address.line2}</p>}
            <p>
              {address.city}
              {address.state && `, ${address.state}`}
              {address.postal && ` ${address.postal}`}
            </p>
          </div>
        </div>
      )}

      {/* Birthday */}
      {hasBirthday && (
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-base">
            🎂{" "}
            {formatBirthdayShort(profile.birth_month!, profile.birth_day!)}
            {profile.birth_year ? `, ${profile.birth_year}` : ""}
          </span>
        </div>
      )}

      {/* Occupation */}
      {(profile.occupation || profile.employer) && (
        <div className="flex items-start gap-3">
          <Briefcase className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
          <div className="text-base">
            {profile.occupation && <p>{profile.occupation}</p>}
            {profile.employer && (
              <p className="text-sm text-muted-foreground">{profile.employer}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Household detail sheet content
// ---------------------------------------------------------------------------
interface HouseholdSheetProps {
  family: FamilyDirectoryFull;
  profileMap: Record<string, DirectoryProfile>;
}

function HouseholdSheetContent({ family, profileMap }: HouseholdSheetProps) {
  const hasSpouse =
    family.members.some((m) => m.relationship === "spouse") ||
    family.family_members_list.some((fm) => fm.relationship === "spouse");

  // Collect birthdays this month for family members
  const today = new Date();
  const currentMonth = today.getMonth() + 1;

  const birthdaysThisMonth = [
    ...family.members
      .filter((m) => m.birth_month === currentMonth && m.birth_day)
      .map((m) => ({
        name: [m.first_name, m.last_name].filter(Boolean).join(" ") || "(unnamed)",
        day: m.birth_day!,
      })),
    ...family.family_members_list
      .filter((fm) => fm.birth_month === currentMonth && fm.birth_day)
      .map((fm) => ({
        name: [fm.first_name, fm.last_name].filter(Boolean).join(" "),
        day: fm.birth_day!,
      })),
  ].sort((a, b) => a.day - b.day);

  function renderMember(m: HouseholdMember) {
    const fullProfile = profileMap[m.id];
    const name =
      [m.preferred_name || m.first_name, m.last_name]
        .filter(Boolean)
        .join(" ") || "(unnamed)";
    return (
      <div key={m.id} className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          {m.avatar_url && (
            <AvatarImage
              src={m.avatar_url}
              alt={[m.first_name, m.last_name].filter(Boolean).join(" ")}
            />
          )}
          <AvatarFallback className="bg-brand-primary text-white text-sm">
            {((m.preferred_name || m.first_name || "?").charAt(0) +
              (m.last_name || "").charAt(0)
            ).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{name}</span>
          {m.relationship !== "primary" && (
            <Badge variant="outline" className="ml-2 text-xs capitalize">
              {relLabel(m.relationship)}
            </Badge>
          )}
          {!m.is_class_member && (
            <Badge variant="secondary" className="ml-1 text-xs">
              not enrolled
            </Badge>
          )}
        </div>
        {fullProfile?.groups && fullProfile.groups.length > 0 && (
          <div className="flex gap-1">
            {fullProfile.groups.slice(0, 2).map((g) => (
              <span
                key={g.id}
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: g.color || "#6b7280" }}
                title={g.name}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderFamilyMember(fm: HouseholdFamilyMember) {
    const name = [fm.first_name, fm.last_name].filter(Boolean).join(" ");
    return (
      <div key={fm.id} className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          {fm.avatar_url && (
            <AvatarImage
              src={fm.avatar_url}
              alt={[fm.first_name, fm.last_name].filter(Boolean).join(" ")}
            />
          )}
          <AvatarFallback className="bg-muted text-muted-foreground text-sm">
            {((fm.first_name || "?").charAt(0) + (fm.last_name || "").charAt(0)).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{name}</span>
          <Badge variant="outline" className="ml-2 text-xs capitalize">
            {relLabel(fm.relationship)}
          </Badge>
          {!fm.is_class_member && (
            <Badge variant="secondary" className="ml-1 text-xs">
              not enrolled
            </Badge>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 space-y-4 overflow-y-auto flex-1">
      {/* Family name header */}
      <div className="pt-2">
        <p className="text-xl font-bold">{family.family_name}</p>
        {family.address_line1 && (
          <p className="text-sm text-muted-foreground">
            {family.address_line1}
            {family.city && `, ${family.city}`}
            {family.state && `, ${family.state}`}
          </p>
        )}
      </div>

      {/* Members */}
      <div className="space-y-2">
        {family.members.map((m) => renderMember(m))}
        {family.family_members_list.map((fm) => renderFamilyMember(fm))}
      </div>

      {/* Family address */}
      {family.address_line1 && (
        <div className="flex items-start gap-3">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
          <div className="text-sm">
            <p>{family.address_line1}</p>
            {family.address_line2 && <p>{family.address_line2}</p>}
            <p>
              {family.city}
              {family.state && `, ${family.state}`}
              {family.postal_code && ` ${family.postal_code}`}
            </p>
          </div>
        </div>
      )}

      {/* Family home phone */}
      {family.phone_home && (
        <div className="flex items-center gap-3">
          <Home className="h-4 w-4 text-muted-foreground shrink-0" />
          <a
            href={`tel:${family.phone_home}`}
            className="text-sm text-brand-primary hover:underline"
          >
            {formatPhone(family.phone_home)}
          </a>
          <span className="text-xs text-muted-foreground">home</span>
        </div>
      )}

      {/* Birthdays this month */}
      {birthdaysThisMonth.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Birthdays this month
          </p>
          <div className="space-y-0.5">
            {birthdaysThisMonth.map((b, i) => (
              <p key={i} className="text-sm">
                🎂 {b.name} ({MONTH_NAMES[currentMonth - 1]} {b.day})
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Anniversary — only if spouse exists */}
      {family.anniversary && hasSpouse && (
        <div className="flex items-center gap-2">
          <span className="text-sm">
            💍 Anniversary: {formatAnniversary(family.anniversary)}
          </span>
        </div>
      )}
    </div>
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
      {/* Avatar cluster */}
      <div className="shrink-0 pt-0.5">
        <AvatarCluster people={avatarPeople} />
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
                    .join(" "),
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
        {member.avatar_url && <AvatarFallback className="hidden" />}
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
        <div className="flex gap-1 shrink-0">
          {member.groups.slice(0, 3).map((g) => (
            <span
              key={g.id}
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: g.color || "#6b7280" }}
              title={g.name}
            />
          ))}
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function DirectoryPage() {
  const [members, setMembers] = useState<DirectoryProfile[]>([]);
  const [families, setFamilies] = useState<FamilyDirectoryFull[]>([]);
  const [allGroups, setAllGroups] = useState<GroupChip[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [view, setView] = useState<"households" | "people">("households");
  const [sheetSubject, setSheetSubject] = useState<SheetSubject | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const [{ data: m }, { data: f }, { data: g }] = await Promise.all([
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
          .select("id, name, color, icon")
          .order("display_order"),
      ]);

      setMembers((m || []) as DirectoryProfile[]);
      setFamilies((f || []) as FamilyDirectoryFull[]);
      setAllGroups((g || []) as GroupChip[]);
      setLoading(false);
    }
    load();
  }, []);

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
      list = list.filter((m) => {
        const haystack = [m.first_name, m.last_name, m.preferred_name, m.email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    return list;
  }, [members, query, activeGroup]);

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

  // Resolve the family for the detail sheet
  const sheetFamily =
    sheetSubject?.kind === "profile" && sheetSubject.profile.family_id
      ? (familyMap[sheetSubject.profile.family_id] ?? null)
      : sheetSubject?.kind === "household"
        ? sheetSubject.family
        : null;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <p className="text-xl text-muted-foreground">Loading directory...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-3xl md:text-4xl font-bold text-brand-primary mb-2">
        Member Directory
      </h1>
      <p className="text-base text-muted-foreground mb-6">
        Browse and connect with other members in your class.
      </p>

      {/* Birthday / Anniversary Widget */}
      <BirthdayWidget members={members} families={families} />

      {/* Sticky search + filter area */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm pb-3 pt-1">
        {/* Search bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by name or email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 text-base py-5"
          />
        </div>

        {/* Group filter chips */}
        {allGroups.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveGroup(null)}
              className={`shrink-0 px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                activeGroup === null
                  ? "bg-brand-primary text-white border-brand-primary"
                  : "border-border text-muted-foreground hover:border-brand-primary"
              }`}
            >
              All
            </button>
            {allGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() =>
                  setActiveGroup(activeGroup === g.id ? null : g.id)
                }
                className={`shrink-0 px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
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
            Households
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
        </div>
      </div>

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
                <div key={letter}>
                  <AlphaHeader letter={letter} />
                  <div className="divide-y">
                    {householdSections[letter].map((entry) => {
                      if (entry.kind === "family") {
                        return (
                          <HouseholdRow
                            key={`fam-${entry.family.id}`}
                            family={entry.family}
                            onOpen={() =>
                              setSheetSubject({
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
                                setSheetSubject({
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
                <div key={letter}>
                  <AlphaHeader letter={letter} />
                  <div className="divide-y">
                    {peopleSections[letter].map((m) => (
                      <PeopleRow
                        key={m.id}
                        member={m}
                        onOpen={() =>
                          setSheetSubject({ kind: "profile", profile: m })
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
          DETAIL SHEET
          ============================================================ */}
      <Sheet
        open={!!sheetSubject}
        onOpenChange={(o) => !o && setSheetSubject(null)}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-md flex flex-col overflow-hidden p-0"
        >
          <SheetHeader className="px-4 pt-4 pb-3 border-b shrink-0">
            <SheetTitle>
              {sheetSubject?.kind === "profile"
                ? displayName(sheetSubject.profile)
                : sheetSubject?.kind === "household"
                  ? sheetSubject.family.family_name
                  : ""}
            </SheetTitle>
          </SheetHeader>

          {sheetSubject?.kind === "profile" && (
            <ProfileSheetContent
              profile={sheetSubject.profile}
              family={sheetFamily as FamilyDirectoryFull | null}
            />
          )}
          {sheetSubject?.kind === "household" && (
            <HouseholdSheetContent
              family={sheetSubject.family}
              profileMap={profileMap}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
