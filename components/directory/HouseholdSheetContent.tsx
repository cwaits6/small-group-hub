"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, Download, Home, MapPin } from "lucide-react";
import { formatPhone } from "@/lib/sanitize";
import { GroupBadge } from "@/components/directory/GroupBadge";
import {
  MONTH_NAMES,
  downloadVCard,
  formatAnniversary,
  relLabel,
} from "@/components/directory/utils";
import type {
  DirectoryProfile,
  FamilyDirectoryFull,
  HouseholdFamilyMember,
  HouseholdMember,
} from "@/lib/types";

interface HouseholdSheetContentProps {
  family: FamilyDirectoryFull;
  profileMap: Record<string, DirectoryProfile>;
  /** Open a member's profile detail (enrolled members only) */
  onOpenProfile?: (profile: DirectoryProfile) => void;
}

export function HouseholdSheetContent({
  family,
  profileMap,
  onOpenProfile,
}: HouseholdSheetContentProps) {
  const hasSpouse =
    family.members.some((m) => m.relationship === "spouse") ||
    family.family_members_list.some((fm) => fm.relationship === "spouse");

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
    const canOpen = !!fullProfile && !!onOpenProfile;

    const inner = (
      <>
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
        <div className="flex-1 min-w-0 text-left">
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
          {fullProfile?.phone_mobile && (
            <p className="text-xs text-muted-foreground">
              {formatPhone(fullProfile.phone_mobile)}
            </p>
          )}
        </div>
        {fullProfile?.groups && fullProfile.groups.length > 0 && (
          <div className="hidden sm:flex gap-1 shrink-0">
            {fullProfile.groups.slice(0, 2).map((g) => (
              <GroupBadge key={g.id} group={g} size="xs" />
            ))}
          </div>
        )}
        {canOpen && (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </>
    );

    if (canOpen) {
      return (
        <button
          key={m.id}
          type="button"
          onClick={() => onOpenProfile!(fullProfile)}
          className="w-full flex items-center gap-3 rounded-lg -mx-2 px-2 py-1.5 hover:bg-brand-bg-light/50 transition-colors"
        >
          {inner}
        </button>
      );
    }
    return (
      <div key={m.id} className="flex items-center gap-3 px-0 py-1.5">
        {inner}
      </div>
    );
  }

  function renderFamilyMember(fm: HouseholdFamilyMember) {
    const name = [fm.first_name, fm.last_name].filter(Boolean).join(" ");
    return (
      <div key={fm.id} className="flex items-center gap-3 py-1.5">
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
        {family.photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={family.photo_url}
            alt={`${family.family_name} family photo`}
            className="w-full aspect-[4/3] object-cover rounded-lg mb-3"
          />
        )}
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
      <div className="space-y-1">
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

      {/* Save to Contacts — primary member of the household */}
      {(() => {
        const primary = family.members.find((m) => m.relationship === "primary");
        if (!primary) return null;
        return (
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadVCard(primary.id)}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Save to Contacts
            </Button>
          </div>
        );
      })()}
    </div>
  );
}
