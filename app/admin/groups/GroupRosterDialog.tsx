"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { setGroupMembership } from "@/lib/memberGroups";
import { displayName, initials } from "@/lib/names";
import type { MemberGroup, Profile } from "@/lib/types";

type RosterProfile = Pick<
  Profile,
  "id" | "first_name" | "last_name" | "preferred_name" | "avatar_url"
>;

interface GroupRosterDialogProps {
  group: MemberGroup | null;
  onClose: () => void;
  /** Called with the new member count whenever the roster changes */
  onCountChange: (groupId: string, count: number) => void;
}

/**
 * Manage a group's roster in one place: every member of the class with a
 * switch to add/remove them from the group. Functional-role booleans are
 * kept in sync via setGroupMembership.
 */
export function GroupRosterDialog({
  group,
  onClose,
  onCountChange,
}: GroupRosterDialogProps) {
  const [profiles, setProfiles] = useState<RosterProfile[]>([]);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!group) return;
    let cancelled = false;

    async function load(groupId: string) {
      setLoading(true);
      setQuery("");
      const [{ data: members, error: mErr }, { data: rows, error: rErr }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, first_name, last_name, preferred_name, avatar_url")
            .in("role", ["member", "content_editor", "admin"])
            .order("last_name", { ascending: true })
            .order("first_name", { ascending: true }),
          supabase
            .from("profile_groups")
            .select("profile_id")
            .eq("group_id", groupId),
        ]);

      if (cancelled) return;
      if (mErr || rErr) {
        toast.error("Failed to load roster.");
        setLoading(false);
        return;
      }
      setProfiles((members || []) as RosterProfile[]);
      setAssigned(
        new Set((rows || []).map((r: { profile_id: string }) => r.profile_id)),
      );
      setLoading(false);
    }

    load(group.id);
    return () => {
      cancelled = true;
    };
  }, [group?.id]);

  const filtered = useMemo(() => {
    if (!query.trim()) return profiles;
    const q = query.trim().toLowerCase();
    return profiles.filter((p) =>
      [p.first_name, p.last_name, p.preferred_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [profiles, query]);

  async function handleToggle(profile: RosterProfile, checked: boolean) {
    if (!group) return;
    setToggling(profile.id);

    const errorMessage = await setGroupMembership(profile.id, group, checked);
    if (errorMessage) {
      toast.error(errorMessage);
      setToggling(null);
      return;
    }

    const next = new Set(assigned);
    if (checked) next.add(profile.id);
    else next.delete(profile.id);
    setAssigned(next);
    onCountChange(group.id, next.size);
    setToggling(null);
  }

  return (
    <Dialog open={!!group} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {group?.color && (
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: group.color }}
              />
            )}
            {group?.name} — {assigned.size} member{assigned.size !== 1 ? "s" : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search members..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Loading members...
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No members match your search.
            </p>
          ) : (
            <div className="divide-y">
              {filtered.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-2.5">
                  <Avatar className="h-8 w-8 shrink-0">
                    {p.avatar_url && (
                      <AvatarImage src={p.avatar_url} alt={displayName(p)} />
                    )}
                    <AvatarFallback className="bg-brand-primary text-white text-xs">
                      {initials(p)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 min-w-0 text-sm font-medium truncate">
                    {displayName(p)}
                  </span>
                  <Switch
                    checked={assigned.has(p.id)}
                    disabled={toggling === p.id}
                    onCheckedChange={(v) => handleToggle(p, v)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
