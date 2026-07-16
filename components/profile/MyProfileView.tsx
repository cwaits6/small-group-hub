"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Pencil, Phone } from "lucide-react";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { DirectoryPreview } from "@/components/profile/DirectoryPreview";
import { displayName, initials } from "@/lib/names";
import { formatPhone } from "@/lib/sanitize";
import type {
  FamilyMember,
  FamilyMemberRelationship,
  FamilyUnit,
  Profile,
} from "@/lib/types";

/** Privacy-masked household member row from the profiles_directory view */
export interface HouseholdEntry {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  avatar_url: string | null;
  relationship: FamilyMemberRelationship;
  email: string | null;
  phone_mobile: string | null;
}

interface MyProfileViewProps {
  profile: Profile;
  family: FamilyUnit | null;
  /** Other enrolled members of the household (privacy masking applied) */
  householdProfiles: HouseholdEntry[];
  /** Non-enrolled family members (children etc.) without accounts */
  familyMembers: FamilyMember[];
}

const eyebrow =
  "text-sm font-bold uppercase tracking-wider text-muted-foreground";

function MemberTile({
  name,
  suffix,
  detail,
  avatarUrl,
  avatarInitials,
  editHref,
  onEdit,
  editLabel = "Edit",
}: {
  name: string;
  suffix?: string;
  detail: string | null;
  avatarUrl: string | null;
  avatarInitials: string;
  editHref?: string;
  onEdit?: () => void;
  editLabel?: string;
}) {
  const editLink =
    "text-base font-semibold text-brand-primary underline underline-offset-4 hover:text-brand-primary/80";
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
      <Avatar className="h-11 w-11 shrink-0">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
        <AvatarFallback className="bg-brand-primary text-white">
          {avatarInitials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="font-bold">
          {name}
          {suffix && (
            <span className="font-medium text-muted-foreground"> · {suffix}</span>
          )}
        </p>
        {detail && (
          <p className="truncate text-base text-muted-foreground">{detail}</p>
        )}
      </div>
      {onEdit ? (
        <button type="button" onClick={onEdit} className={editLink}>
          {editLabel}
        </button>
      ) : editHref ? (
        <Link href={editHref} className={editLink}>
          {editLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function MyProfileView({
  profile,
  family,
  householdProfiles,
  familyMembers,
}: MyProfileViewProps) {
  const router = useRouter();
  // Without a family card there is no "Edit" row to open the editor from,
  // so it starts open.
  const [editing, setEditing] = useState(!family);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing && family) {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [editing, family]);

  const canManageFamily =
    profile.relationship === "primary" || profile.relationship === "spouse";

  // Summary line mirrors what the directory shows: hidden fields stay hidden.
  const visiblePhone = profile.hide_phone_mobile ? null : profile.phone_mobile;
  const visibleCity = !profile.hide_address && profile.city
    ? `${profile.city}${profile.state ? `, ${profile.state}` : ""}`
    : family && !family.hide_address && family.city
      ? `${family.city}${family.state ? `, ${family.state}` : ""}`
      : null;
  const summary = [visiblePhone && formatPhone(visiblePhone), visibleCity]
    .filter(Boolean)
    .join(" · ");

  const familyAddress =
    family &&
    [
      family.address_line1,
      family.address_line2,
      [
        family.city,
        [family.state, family.postal_code].filter(Boolean).join(" "),
      ]
        .filter(Boolean)
        .join(", "),
    ]
      .filter(Boolean)
      .join(", ");

  return (
    <div className="space-y-6">
      {/* How others see you */}
      <div className="rounded-xl border border-brand-primary/25 bg-brand-warm p-5 sm:px-6">
        <p className={`${eyebrow} mb-3`}>How others see you</p>
        <div className="flex items-center gap-4">
          <Avatar className="h-13 w-13 shrink-0">
            {profile.avatar_url && (
              <AvatarImage src={profile.avatar_url} alt={displayName(profile)} />
            )}
            <AvatarFallback className="bg-brand-accent-text text-white text-lg">
              {initials(profile)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-bold">{displayName(profile)}</p>
            <p className="text-base text-muted-foreground">
              {profile.is_unlisted
                ? "You're hidden from the directory."
                : summary || "No contact info shared yet."}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <DirectoryPreview />
        </div>
      </div>

      {/* Family photo */}
      {family?.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={family.photo_url}
          alt={`${family.family_name} family photo`}
          className="h-56 w-full rounded-xl object-cover sm:h-64"
        />
      )}

      {/* Family info */}
      {family && (
        <Card>
          <CardContent className="pt-6">
            <div className="mb-1 flex items-center justify-between gap-4">
              <h3>Family Info</h3>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/household" />}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </div>
            <p className="mb-4 text-base text-muted-foreground">
              Shared by your family — any family member can keep this up to
              date.
            </p>

            <div className="mb-6">
              {familyAddress && (
                <div className="flex items-center gap-3 py-1.5">
                  <MapPin
                    className="h-5 w-5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="text-base">{familyAddress}</span>
                </div>
              )}
              {family.phone_home && (
                <div className="flex items-center gap-3 py-1.5">
                  <Phone
                    className="h-5 w-5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="text-base">
                    {formatPhone(family.phone_home)}
                  </span>
                  <span className="text-sm text-muted-foreground">home</span>
                </div>
              )}
            </div>

            <p className={`${eyebrow} mb-3`}>Family members</p>
            <div className="space-y-3">
              <MemberTile
                name={displayName(profile)}
                suffix="you"
                detail={
                  [
                    profile.phone_mobile && formatPhone(profile.phone_mobile),
                    profile.email,
                  ]
                    .filter(Boolean)
                    .join(" · ") || null
                }
                avatarUrl={profile.avatar_url}
                avatarInitials={initials(profile)}
                onEdit={() => setEditing((v) => !v)}
                editLabel={editing ? "Close" : "Edit"}
              />
              {householdProfiles.map((m) => (
                <MemberTile
                  key={m.id}
                  name={displayName(m)}
                  detail={
                    [m.phone_mobile && formatPhone(m.phone_mobile), m.email]
                      .filter(Boolean)
                      .join(" · ") || null
                  }
                  avatarUrl={m.avatar_url}
                  avatarInitials={initials(m)}
                  editHref={
                    canManageFamily ? `/household/member/${m.id}` : undefined
                  }
                />
              ))}
              {familyMembers.map((fm) => (
                <MemberTile
                  key={fm.id}
                  name={displayName(fm)}
                  detail={null}
                  avatarUrl={fm.avatar_url}
                  avatarInitials={initials(fm)}
                  editHref={
                    canManageFamily
                      ? `/household/member/fm/${fm.id}`
                      : undefined
                  }
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Personal details editor */}
      {editing && (
        <div ref={editorRef} className="scroll-mt-24">
          <ProfileForm
            profile={profile}
            families={[]}
            family={family}
            isAdmin={false}
            onSaved={() => {
              if (family) setEditing(false);
              router.refresh();
            }}
          />
        </div>
      )}
    </div>
  );
}
