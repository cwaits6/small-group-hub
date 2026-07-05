"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronRight } from "lucide-react";
import { formatPhone } from "@/lib/sanitize";
import { displayName, initials } from "@/lib/names";
import { GroupIcon } from "@/components/directory/GroupIcon";
import type { DirectoryProfile } from "@/lib/types";
import type { DirectoryGroup } from "@/components/directory/types";

interface GroupSheetContentProps {
  group: DirectoryGroup;
  members: DirectoryProfile[];
  onOpenProfile: (profile: DirectoryProfile) => void;
}

/** Roster view for a member group inside the directory detail sheet */
export function GroupSheetContent({
  group,
  members,
  onOpenProfile,
}: GroupSheetContentProps) {
  return (
    <div className="px-4 pb-6 space-y-4 overflow-y-auto flex-1">
      {/* Group header */}
      <div className="flex items-center gap-3 pt-2">
        <div
          className="h-12 w-12 rounded-full flex items-center justify-center text-white shrink-0"
          style={{ backgroundColor: group.color || "#6b7280" }}
        >
          <GroupIcon name={group.icon} className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold leading-tight">{group.name}</p>
          <p className="text-sm text-muted-foreground">
            {members.length} member{members.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {group.description && (
        <p className="text-sm text-muted-foreground">{group.description}</p>
      )}

      {/* Roster */}
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No members in this group yet.
        </p>
      ) : (
        <div className="divide-y">
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onOpenProfile(m)}
              className="w-full text-left flex items-center gap-3 py-2.5 hover:bg-brand-bg-light/50 transition-colors rounded-lg -mx-2 px-2"
            >
              <Avatar className="h-9 w-9 shrink-0">
                {m.avatar_url && (
                  <AvatarImage src={m.avatar_url} alt={displayName(m)} />
                )}
                <AvatarFallback className="bg-brand-primary text-white text-sm">
                  {initials(m)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{displayName(m)}</p>
                {m.phone_mobile && (
                  <p className="text-xs text-muted-foreground">
                    {formatPhone(m.phone_mobile)}
                  </p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
