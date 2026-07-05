"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Users,
  Filter,
} from "lucide-react";
import type { MemberGroup } from "@/lib/types";
import { GroupRosterDialog } from "./GroupRosterDialog";
import { GroupIcon } from "@/components/directory/GroupIcon";

/** A curated set of lucide icon names available for group icons */
const ICON_OPTIONS = [
  { value: "heart", label: "Heart" },
  { value: "hand-helping", label: "Hand (Helping)" },
  { value: "users", label: "Users" },
  { value: "user", label: "User" },
  { value: "star", label: "Star" },
  { value: "cross", label: "Cross" },
  { value: "book-open", label: "Book" },
  { value: "music", label: "Music" },
  { value: "baby", label: "Baby" },
  { value: "shield", label: "Shield" },
  { value: "bell", label: "Bell" },
  { value: "flag", label: "Flag" },
];

// Labels include the rendered icon so both the trigger and the list preview it
const ICON_ITEMS = ICON_OPTIONS.map((opt) => ({
  value: opt.value,
  label: (
    <span className="flex items-center gap-2">
      <GroupIcon name={opt.value} className="h-4 w-4" />
      {opt.label}
    </span>
  ),
}));

const ROLE_ITEMS = [
  { value: "none", label: "None" },
  { value: "prayer_team", label: "Prayer Team" },
  { value: "greeter_team", label: "Greeter Team" },
];

interface GroupFormState {
  name: string;
  description: string;
  color: string;
  icon: string;
  functional_role: string;
  show_in_directory_filter: boolean;
}

const EMPTY_FORM: GroupFormState = {
  name: "",
  description: "",
  color: "#2F6BA8",
  icon: "users",
  functional_role: "none",
  show_in_directory_filter: true,
};

function fromGroup(g: MemberGroup): GroupFormState {
  return {
    name: g.name,
    description: g.description || "",
    color: g.color || "#2F6BA8",
    icon: g.icon || "users",
    functional_role: g.functional_role || "none",
    show_in_directory_filter: g.show_in_directory_filter ?? true,
  };
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<MemberGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MemberGroup | null>(null);
  const [rosterGroup, setRosterGroup] = useState<MemberGroup | null>(null);
  const [form, setForm] = useState<GroupFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  // member counts per group for delete warning
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

  const supabase = createClient();

  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    setLoading(true);
    const { data, error } = await supabase
      .from("member_groups")
      .select("*")
      .order("display_order");

    if (error) {
      toast.error("Failed to load groups.");
      setLoading(false);
      return;
    }

    setGroups((data || []) as MemberGroup[]);

    // Fetch member counts for each group
    const { data: counts } = await supabase
      .from("profile_groups")
      .select("group_id");

    const countMap: Record<string, number> = {};
    (counts || []).forEach((row: { group_id: string }) => {
      countMap[row.group_id] = (countMap[row.group_id] || 0) + 1;
    });
    setMemberCounts(countMap);

    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(group: MemberGroup) {
    setEditing(group);
    setForm(fromGroup(group));
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Group name is required.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      color: form.color || null,
      icon: form.icon || null,
      functional_role:
        form.functional_role === "none" ? null : form.functional_role,
      show_in_directory_filter: form.show_in_directory_filter,
    };

    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from("member_groups")
        .update(payload)
        .eq("id", editing.id);
      setSaving(false);
      if (error) {
        toast.error("Failed to update group.");
        return;
      }
      toast.success("Group updated.");
    } else {
      // Append at end
      const nextOrder =
        groups.length > 0
          ? Math.max(...groups.map((g) => g.display_order)) + 1
          : 0;
      const { error } = await supabase
        .from("member_groups")
        .insert({ ...payload, display_order: nextOrder });
      setSaving(false);
      if (error) {
        toast.error("Failed to create group.");
        return;
      }
      toast.success("Group created.");
    }

    setDialogOpen(false);
    loadGroups();
  }

  async function handleDelete(group: MemberGroup) {
    const count = memberCounts[group.id] || 0;
    const warning =
      count > 0
        ? `"${group.name}" has ${count} member(s) assigned. They will be removed from this group. `
        : "";
    if (!confirm(`${warning}Delete "${group.name}"?`)) return;

    const { error } = await supabase
      .from("member_groups")
      .delete()
      .eq("id", group.id);

    if (error) {
      toast.error("Failed to delete group.");
      return;
    }
    toast.success("Group deleted.");
    setDialogOpen(false);
    loadGroups();
  }

  async function moveGroup(group: MemberGroup, direction: "up" | "down") {
    const idx = groups.findIndex((g) => g.id === group.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= groups.length) return;

    const swapGroup = groups[swapIdx];
    const newOrder = group.display_order;
    const swapOrder = swapGroup.display_order;

    // Swap display_order values
    const [r1, r2] = await Promise.all([
      supabase
        .from("member_groups")
        .update({ display_order: swapOrder })
        .eq("id", group.id),
      supabase
        .from("member_groups")
        .update({ display_order: newOrder })
        .eq("id", swapGroup.id),
    ]);

    if (r1.error || r2.error) {
      toast.error("Failed to reorder.");
      return;
    }
    loadGroups();
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <p className="text-xl text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-brand-primary">
            Member Groups
          </h1>
          <p className="text-base text-muted-foreground mt-1">
            Create and manage groups. Control which groups appear as filter
            chips in the member directory.
          </p>
        </div>
        <Button
          size="lg"
          onClick={openCreate}
          className="bg-brand-primary hover:bg-brand-primary/90 text-white"
        >
          <Plus className="mr-2 h-5 w-5" />
          New Group
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-base text-muted-foreground">
              No groups yet. Create one to start organizing members.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((group, idx) => (
            <Card key={group.id}>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-4">
                  {/* Color swatch */}
                  <div
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: group.color || "#6b7280" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{group.name}</p>
                      {group.functional_role && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {group.functional_role.replace("_", " ")}
                        </Badge>
                      )}
                      {group.show_in_directory_filter && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Filter className="h-3 w-3" />
                          Directory filter
                        </Badge>
                      )}
                    </div>
                    {group.description && (
                      <p className="text-sm text-muted-foreground">
                        {group.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>
                        {memberCounts[group.id] || 0} member
                        {(memberCounts[group.id] || 0) !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={idx === 0}
                      onClick={() => moveGroup(group, "up")}
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={idx === groups.length - 1}
                      onClick={() => moveGroup(group, "down")}
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRosterGroup(group)}
                    >
                      <Users className="mr-1 h-4 w-4" />
                      Members
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(group)}
                    >
                      <Pencil className="mr-1 h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <GroupRosterDialog
        group={rosterGroup}
        onClose={() => setRosterGroup(null)}
        onCountChange={(groupId, count) =>
          setMemberCounts((prev) => ({ ...prev, [groupId]: count }))
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit group" : "New group"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="g_name">Group name</Label>
              <Input
                id="g_name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Prayer Team"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="g_desc">Description</Label>
              <Textarea
                id="g_desc"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={2}
                placeholder="Optional description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="g_color">Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="g_color"
                    type="color"
                    value={form.color}
                    onChange={(e) =>
                      setForm({ ...form, color: e.target.value })
                    }
                    className="h-9 w-9 cursor-pointer rounded border border-input"
                  />
                  <Input
                    value={form.color}
                    onChange={(e) =>
                      setForm({ ...form, color: e.target.value })
                    }
                    placeholder="#2F6BA8"
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="g_icon">Icon</Label>
                <Select
                  items={ICON_ITEMS}
                  value={form.icon}
                  onValueChange={(v) => setForm({ ...form, icon: v ?? "users" })}
                >
                  <SelectTrigger id="g_icon" className="w-full">
                    <SelectValue placeholder="Select icon" />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="g_role">Functional role</Label>
              <Select
                items={ROLE_ITEMS}
                value={form.functional_role}
                onValueChange={(v) =>
                  setForm({ ...form, functional_role: v ?? "none" })
                }
              >
                <SelectTrigger id="g_role">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Optional. Linking a role means people in this group can be
                picked when scheduling prayer or greeting for a Sunday.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="g_filter">Show as directory filter chip</Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, members can filter the directory by this group.
                </p>
              </div>
              <Switch
                id="g_filter"
                checked={form.show_in_directory_filter}
                onCheckedChange={(v) =>
                  setForm({ ...form, show_in_directory_filter: v })
                }
              />
            </div>
          </div>

          <DialogFooter className="flex sm:justify-between">
            {editing && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(editing)}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Delete
              </Button>
            )}
            <div className="flex gap-2 sm:ml-auto">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-brand-primary hover:bg-brand-primary/90 text-white"
              >
                {saving ? "Saving..." : editing ? "Save Changes" : "Create"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
