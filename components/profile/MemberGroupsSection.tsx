"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { MemberGroup } from "@/lib/types";

interface MemberGroupsSectionProps {
  profileId: string;
}

/**
 * Admin-only section within the member edit page.
 * Displays all member groups as checkboxes — toggling a group
 * assigns or removes the member from that group.
 * When a group has a functional_role, the corresponding boolean on
 * profiles (is_prayer_team / is_greeter_team) is also synced.
 */
export function MemberGroupsSection({ profileId }: MemberGroupsSectionProps) {
  const [groups, setGroups] = useState<MemberGroup[]>([]);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const [{ data: allGroups, error: groupsErr }, { data: profileGroups, error: pgErr }] = await Promise.all([
        supabase
          .from("member_groups")
          .select("*")
          .order("display_order"),
        supabase
          .from("profile_groups")
          .select("group_id")
          .eq("profile_id", profileId),
      ]);

      if (groupsErr || pgErr) {
        toast.error("Failed to load groups.");
        setLoading(false);
        return;
      }

      setGroups((allGroups || []) as MemberGroup[]);
      setAssigned(
        new Set((profileGroups || []).map((pg: { group_id: string }) => pg.group_id)),
      );
      setLoading(false);
    }
    load();
  }, [profileId]);

  async function handleToggle(group: MemberGroup, checked: boolean) {
    setToggling(group.id);

    if (checked) {
      // Assign member to group
      const { error } = await supabase.from("profile_groups").insert({
        profile_id: profileId,
        group_id: group.id,
      });
      if (error) {
        toast.error(`Failed to add to ${group.name}.`);
        setToggling(null);
        return;
      }

      // Sync functional role boolean if applicable
      if (group.functional_role === "prayer_team") {
        const { error: roleErr } = await supabase
          .from("profiles")
          .update({ is_prayer_team: true })
          .eq("id", profileId);
        if (roleErr) {
          toast.error(`Added to ${group.name} but failed to sync role.`);
          setToggling(null);
          return;
        }
      } else if (group.functional_role === "greeter_team") {
        const { error: roleErr } = await supabase
          .from("profiles")
          .update({ is_greeter_team: true })
          .eq("id", profileId);
        if (roleErr) {
          toast.error(`Added to ${group.name} but failed to sync role.`);
          setToggling(null);
          return;
        }
      }

      setAssigned((prev) => new Set([...prev, group.id]));
      toast.success(`Added to ${group.name}.`);
    } else {
      // Remove member from group
      const { error } = await supabase
        .from("profile_groups")
        .delete()
        .eq("profile_id", profileId)
        .eq("group_id", group.id);
      if (error) {
        toast.error(`Failed to remove from ${group.name}.`);
        setToggling(null);
        return;
      }

      // Sync functional role boolean if applicable
      if (group.functional_role === "prayer_team") {
        const { error: roleErr } = await supabase
          .from("profiles")
          .update({ is_prayer_team: false })
          .eq("id", profileId);
        if (roleErr) {
          toast.error(`Removed from ${group.name} but failed to sync role.`);
          setToggling(null);
          return;
        }
      } else if (group.functional_role === "greeter_team") {
        const { error: roleErr } = await supabase
          .from("profiles")
          .update({ is_greeter_team: false })
          .eq("id", profileId);
        if (roleErr) {
          toast.error(`Removed from ${group.name} but failed to sync role.`);
          setToggling(null);
          return;
        }
      }

      setAssigned((prev) => {
        const next = new Set(prev);
        next.delete(group.id);
        return next;
      });
      toast.success(`Removed from ${group.name}.`);
    }

    setToggling(null);
  }

  if (loading) return null;
  if (groups.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold mb-3">Groups</h2>
      <Card>
        <CardContent className="pt-5 space-y-4">
          {groups.map((group) => (
            <div key={group.id} className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                {group.color && (
                  <div
                    className="w-3 h-3 rounded-full shrink-0 mt-0.5"
                    style={{ backgroundColor: group.color }}
                  />
                )}
                <div>
                  <Label
                    htmlFor={`group-${group.id}`}
                    className="text-base cursor-pointer"
                  >
                    {group.name}
                  </Label>
                  {group.description && (
                    <p className="text-sm text-muted-foreground">
                      {group.description}
                    </p>
                  )}
                </div>
              </div>
              <Switch
                id={`group-${group.id}`}
                checked={assigned.has(group.id)}
                disabled={toggling === group.id}
                onCheckedChange={(v) => handleToggle(group, v)}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
