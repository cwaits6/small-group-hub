"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  Calendar,
  Download,
  Home,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
} from "lucide-react";
import { formatPhone } from "@/lib/sanitize";
import { displayName, initials } from "@/lib/names";
import { GroupBadge } from "@/components/directory/GroupBadge";
import {
  downloadVCard,
  formatBirthdayShort,
  relLabel,
  resolveAddress,
} from "@/components/directory/utils";
import type { DirectoryProfile, FamilyDirectoryFull } from "@/lib/types";

interface ProfileSheetContentProps {
  profile: DirectoryProfile;
  family: FamilyDirectoryFull | null;
}

export function ProfileSheetContent({
  profile,
  family,
}: ProfileSheetContentProps) {
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
          <a
            href={`sms:${profile.phone_mobile}`}
            className="ml-auto text-brand-primary hover:text-brand-primary/80"
            aria-label={`Text ${displayName(profile)}`}
          >
            <MessageSquare className="h-4 w-4" />
          </a>
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
            🎂 {formatBirthdayShort(profile.birth_month!, profile.birth_day!)}
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

      {/* Save to Contacts */}
      <div className="pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadVCard(profile.id)}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Save to Contacts
        </Button>
      </div>
    </div>
  );
}
