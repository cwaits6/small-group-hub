"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Plus, Search, X } from "lucide-react";
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
 * Group roster management, Okta-style: the default view shows only who is
 * currently in the group (with remove), and an explicit "Add members" mode
 * searches the rest of the class. Functional-role booleans stay in sync via
 * setGroupMembership.
 */
export function GroupRosterDialog({
  group,
  onClose,
  onCountChange,
}: GroupRosterDialogProps) {
  const [profiles, setProfiles] = useState<RosterProfile[]>([]);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"roster" | "add">("roster");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!group) return;
    let cancelled = false;

    async function load(groupId: string) {
      setLoading(true);
      setMode("roster");
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

  const roster = useMemo(
    () => profiles.filter((p) => assigned.has(p.id)),
    [profiles, assigned],
  );
  const candidates = useMemo(
    () => profiles.filter((p) => !assigned.has(p.id)),
    [profiles, assigned],
  );

  const visible = useMemo(() => {
    const source = mode === "roster" ? roster : candidates;
    if (!query.trim()) return source;
    const q = query.trim().toLowerCase();
    return source.filter((p) =>
      [p.first_name, p.last_name, p.preferred_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [mode, roster, candidates, query]);

  async function handleChange(profile: RosterProfile, member: boolean) {
    if (!group) return;
    setBusy(profile.id);

    const errorMessage = await setGroupMembership(profile.id, group, member);
    if (errorMessage) {
      toast.error(errorMessage);
      setBusy(null);
      return;
    }

    const next = new Set(assigned);
    if (member) next.add(profile.id);
    else next.delete(profile.id);
    setAssigned(next);
    onCountChange(group.id, next.size);
    setBusy(null);
  }

  function switchMode(next: "roster" | "add") {
    setMode(next);
    setQuery("");
  }

  return (
    <Dialog open={!!group} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "add" && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => switchMode("roster")}
                aria-label="Back to members"
                className="-ml-2 shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {group?.color && (
              <span
                className="inline-block w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: group.color }}
              />
            )}
            {mode === "add"
              ? `Add to ${group?.name}`
              : `${group?.name} — ${assigned.size} member${assigned.size !== 1 ? "s" : ""}`}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={
                mode === "roster" ? "Search members..." : "Search people to add..."
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {mode === "roster" && (
            <Button
              size="sm"
              onClick={() => switchMode("add")}
              className="bg-brand-primary hover:bg-brand-primary/90 text-white shrink-0"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add members
            </Button>
          )}
        </div>

        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Loading members...
            </p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {query.trim()
                ? "No one matches your search."
                : mode === "roster"
                  ? "No members in this group yet. Use “Add members” to build the roster."
                  : "Everyone is already in this group."}
            </p>
          ) : (
            <div className="divide-y">
              {visible.map((p) => (
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
                  {mode === "roster" ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={busy === p.id}
                      onClick={() => handleChange(p, false)}
                      aria-label={`Remove ${displayName(p)} from ${group?.name}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy === p.id}
                      onClick={() => handleChange(p, true)}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
