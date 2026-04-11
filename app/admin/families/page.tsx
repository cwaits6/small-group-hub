"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import type { FamilyUnit, Profile } from "@/lib/types";
import {
  titleCaseName,
  titleCaseStreet,
  titleCaseCity,
  normalizePhone,
  normalizeState,
  normalizePostalCode,
  formatPhone,
  formatPhoneAsYouType,
} from "@/lib/sanitize";
import { displayName } from "@/lib/names";

interface FamilyWithMembers extends FamilyUnit {
  members: Pick<Profile, "id" | "first_name" | "last_name" | "preferred_name">[];
}

interface FamilyFormState {
  family_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  phone_home: string;
  hide_address: boolean;
  hide_phone_home: boolean;
}

const EMPTY_FORM: FamilyFormState = {
  family_name: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  phone_home: "",
  hide_address: false,
  hide_phone_home: false,
};

function fromFamily(f: FamilyUnit): FamilyFormState {
  return {
    family_name: f.family_name,
    address_line1: f.address_line1 || "",
    address_line2: f.address_line2 || "",
    city: f.city || "",
    state: f.state || "",
    postal_code: f.postal_code || "",
    phone_home: formatPhone(f.phone_home),
    hide_address: f.hide_address,
    hide_phone_home: f.hide_phone_home,
  };
}

export default function FamiliesPage() {
  const [families, setFamilies] = useState<FamilyWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FamilyUnit | null>(null);
  const [form, setForm] = useState<FamilyFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadFamilies();
  }, []);

  async function loadFamilies() {
    setLoading(true);
    const { data: familyData, error: familyErr } = await supabase
      .from("family_units")
      .select("*")
      .order("family_name");

    if (familyErr) {
      toast.error("Failed to load families.");
      setLoading(false);
      return;
    }

    const { data: memberData } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, preferred_name, family_id")
      .not("family_id", "is", null);

    const byFamily: Record<string, FamilyWithMembers["members"]> = {};
    (memberData || []).forEach((m) => {
      if (!m.family_id) return;
      (byFamily[m.family_id] ??= []).push({
        id: m.id,
        first_name: m.first_name,
        last_name: m.last_name,
        preferred_name: m.preferred_name,
      });
    });

    setFamilies(
      (familyData || []).map((f) => ({
        ...f,
        members: byFamily[f.id] || [],
      })),
    );
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(family: FamilyUnit) {
    setEditing(family);
    setForm(fromFamily(family));
    setDialogOpen(true);
  }

  async function handleSave() {
    const familyName = titleCaseName(form.family_name);
    if (!familyName) {
      toast.error("Family name is required.");
      return;
    }

    const stateCode = form.state ? normalizeState(form.state) : null;
    if (form.state && !stateCode) {
      toast.error("Invalid state.");
      return;
    }
    const postal = form.postal_code
      ? normalizePostalCode(form.postal_code)
      : null;
    if (form.postal_code && !postal) {
      toast.error("Invalid ZIP code.");
      return;
    }
    const phone = form.phone_home ? normalizePhone(form.phone_home) : null;
    if (form.phone_home && !phone) {
      toast.error("Invalid home phone.");
      return;
    }

    const payload = {
      family_name: familyName,
      address_line1: titleCaseStreet(form.address_line1),
      address_line2: titleCaseStreet(form.address_line2),
      city: titleCaseCity(form.city),
      state: stateCode,
      postal_code: postal,
      phone_home: phone,
      hide_address: form.hide_address,
      hide_phone_home: form.hide_phone_home,
    };

    setSaving(true);
    const { error } = editing
      ? await supabase
          .from("family_units")
          .update(payload)
          .eq("id", editing.id)
      : await supabase.from("family_units").insert(payload);
    setSaving(false);

    if (error) {
      console.error(error);
      toast.error("Failed to save family.");
      return;
    }

    toast.success(editing ? "Family updated." : "Family created.");
    setDialogOpen(false);
    loadFamilies();
  }

  async function handleDelete(family: FamilyWithMembers) {
    if (family.members.length > 0) {
      if (
        !confirm(
          `${family.family_name} has ${family.members.length} member(s). Deleting will unassign them. Continue?`,
        )
      ) {
        return;
      }
    } else if (!confirm(`Delete ${family.family_name}?`)) {
      return;
    }

    const { error } = await supabase
      .from("family_units")
      .delete()
      .eq("id", family.id);
    if (error) {
      toast.error("Failed to delete family.");
      return;
    }
    toast.success("Family deleted.");
    setDialogOpen(false);
    loadFamilies();
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <p className="text-xl text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-brand-primary">
            Families
          </h1>
          <p className="text-base text-muted-foreground mt-1">
            Group members into households with shared address and home phone.
          </p>
        </div>
        <Button
          size="lg"
          onClick={openCreate}
          className="bg-brand-primary hover:bg-brand-primary/90 text-white"
        >
          <Plus className="mr-2 h-5 w-5" />
          New Family
        </Button>
      </div>

      {families.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-base text-muted-foreground">
              No families yet. Create one to group members with a shared
              address.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {families.map((family) => (
            <Card key={family.id}>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-xl font-semibold">{family.family_name}</p>
                    {family.address_line1 && (
                      <p className="text-base text-muted-foreground mt-1">
                        {family.address_line1}
                        {family.address_line2 && `, ${family.address_line2}`}
                        {family.city && `, ${family.city}`}
                        {family.state && `, ${family.state}`}
                        {family.postal_code && ` ${family.postal_code}`}
                      </p>
                    )}
                    {family.phone_home && (
                      <p className="text-base text-muted-foreground">
                        {formatPhone(family.phone_home)}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>
                        {family.members.length}{" "}
                        {family.members.length === 1 ? "member" : "members"}
                      </span>
                    </div>
                    {family.members.length > 0 && (
                      <ul className="mt-2 text-sm space-y-0.5">
                        {family.members.map((m) => (
                          <li key={m.id}>
                            <Link
                              href={`/admin/members/${m.id}`}
                              className="text-brand-primary hover:underline"
                            >
                              {displayName(m)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(family)}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit family" : "New family"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="family_name">Family name</Label>
              <Input
                id="family_name"
                value={form.family_name}
                onChange={(e) =>
                  setForm({ ...form, family_name: e.target.value })
                }
                placeholder="e.g. The Smiths"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="f_address1">Street address</Label>
              <Input
                id="f_address1"
                value={form.address_line1}
                onChange={(e) =>
                  setForm({ ...form, address_line1: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="f_address2">Apt / unit</Label>
              <Input
                id="f_address2"
                value={form.address_line2}
                onChange={(e) =>
                  setForm({ ...form, address_line2: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-6 gap-2">
              <div className="col-span-3 space-y-2">
                <Label htmlFor="f_city">City</Label>
                <Input
                  id="f_city"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div className="col-span-1 space-y-2">
                <Label htmlFor="f_state">State</Label>
                <Input
                  id="f_state"
                  value={form.state}
                  onChange={(e) =>
                    setForm({ ...form, state: e.target.value.toUpperCase() })
                  }
                  maxLength={2}
                  className="uppercase"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="f_zip">ZIP</Label>
                <Input
                  id="f_zip"
                  value={form.postal_code}
                  onChange={(e) =>
                    setForm({ ...form, postal_code: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="f_phone">Home phone</Label>
              <Input
                id="f_phone"
                type="tel"
                value={form.phone_home}
                onChange={(e) =>
                  setForm({
                    ...form,
                    phone_home: formatPhoneAsYouType(e.target.value),
                  })
                }
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-semibold">Family-level privacy</p>
              <div className="flex items-center justify-between">
                <Label htmlFor="f_hide_addr">Hide address</Label>
                <Switch
                  id="f_hide_addr"
                  checked={form.hide_address}
                  onCheckedChange={(v) =>
                    setForm({ ...form, hide_address: v })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="f_hide_phone">Hide home phone</Label>
                <Switch
                  id="f_hide_phone"
                  checked={form.hide_phone_home}
                  onCheckedChange={(v) =>
                    setForm({ ...form, hide_phone_home: v })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex sm:justify-between">
            {editing && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() =>
                  handleDelete(
                    families.find((f) => f.id === editing.id)!,
                  )
                }
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
