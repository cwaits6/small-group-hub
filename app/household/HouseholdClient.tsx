"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, User, X } from "lucide-react";
import {
  formatPhone,
  formatPhoneAsYouType,
  titleCaseName,
  titleCaseStreet,
  titleCaseCity,
} from "@/lib/sanitize";
import { displayName, initials } from "@/lib/names";
import type { Profile, FamilyUnit, FamilyMember, FamilyMemberRelationship } from "@/lib/types";

const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const RELATIONSHIPS: { value: FamilyMemberRelationship; label: string }[] = [
  { value: "child", label: "Child" },
  { value: "spouse", label: "Spouse" },
  { value: "parent", label: "Parent" },
  { value: "sibling", label: "Sibling" },
  { value: "other", label: "Other" },
];

interface HouseholdInfo {
  family_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  phone_home: string;
  anniversary: string;
  hide_address: boolean;
  hide_phone_home: boolean;
}

interface MemberFormState {
  first_name: string;
  last_name: string;
  relationship: FamilyMemberRelationship;
  birth_month: string;
  birth_day: string;
  birth_year: string;
}

const EMPTY_MEMBER_FORM: MemberFormState = {
  first_name: "",
  last_name: "",
  relationship: "child",
  birth_month: "",
  birth_day: "",
  birth_year: "",
};

interface HouseholdClientProps {
  currentProfile: Profile;
  family: FamilyUnit;
  initialFamilyMembers: FamilyMember[];
  householdProfiles: Pick<Profile, "id" | "first_name" | "last_name" | "preferred_name" | "relationship" | "role" | "avatar_url" | "email">[];
}

function fromFamily(f: FamilyUnit): HouseholdInfo {
  return {
    family_name: f.family_name,
    address_line1: f.address_line1 ?? "",
    address_line2: f.address_line2 ?? "",
    city: f.city ?? "",
    state: f.state ?? "",
    postal_code: f.postal_code ?? "",
    phone_home: formatPhone(f.phone_home) ?? "",
    anniversary: f.anniversary ?? "",
    hide_address: f.hide_address,
    hide_phone_home: f.hide_phone_home,
  };
}

export function HouseholdClient({
  currentProfile,
  family,
  initialFamilyMembers,
  householdProfiles,
}: HouseholdClientProps) {
  const [info, setInfo] = useState<HouseholdInfo>(fromFamily(family));
  const [savingInfo, setSavingInfo] = useState(false);

  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(initialFamilyMembers);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [memberForm, setMemberForm] = useState<MemberFormState>(EMPTY_MEMBER_FORM);
  const [savingMember, setSavingMember] = useState(false);

  // ---- Household info ----
  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    setSavingInfo(true);

    const res = await fetch("/api/household", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        family_name: info.family_name,
        address_line1: info.address_line1,
        address_line2: info.address_line2,
        city: info.city,
        state: info.state,
        postal_code: info.postal_code,
        phone_home: info.phone_home,
        anniversary: info.anniversary || null,
        hide_address: info.hide_address,
        hide_phone_home: info.hide_phone_home,
      }),
    });

    setSavingInfo(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Failed to save household info.");
      return;
    }

    toast.success("Household info updated.");
  }

  // ---- Family members ----
  const loadMembers = useCallback(async () => {
    const res = await fetch("/api/household/members");
    if (!res.ok) return;
    const body = await res.json();
    setFamilyMembers(body.data ?? []);
  }, []);

  function startAddMember() {
    setEditingMember(null);
    setMemberForm(EMPTY_MEMBER_FORM);
    setShowMemberForm(true);
  }

  function startEditMember(fm: FamilyMember) {
    setEditingMember(fm);
    setMemberForm({
      first_name: fm.first_name,
      last_name: fm.last_name ?? "",
      relationship: fm.relationship,
      birth_month: fm.birth_month?.toString() ?? "",
      birth_day: fm.birth_day?.toString() ?? "",
      birth_year: fm.birth_year?.toString() ?? "",
    });
    setShowMemberForm(true);
  }

  function cancelMemberForm() {
    setShowMemberForm(false);
    setEditingMember(null);
    setMemberForm(EMPTY_MEMBER_FORM);
  }

  async function handleSaveMember() {
    const firstName = titleCaseName(memberForm.first_name);
    if (!firstName) {
      toast.error("First name is required.");
      return;
    }

    setSavingMember(true);

    const payload = {
      first_name: firstName,
      last_name: titleCaseName(memberForm.last_name) || null,
      relationship: memberForm.relationship,
      birth_month: memberForm.birth_month ? Number(memberForm.birth_month) : null,
      birth_day: memberForm.birth_day ? Number(memberForm.birth_day) : null,
      birth_year: memberForm.birth_year ? Number(memberForm.birth_year) : null,
    };

    const url = editingMember
      ? `/api/household/members/${editingMember.id}`
      : "/api/household/members";
    const method = editingMember ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSavingMember(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Failed to save family member.");
      return;
    }

    toast.success(editingMember ? "Family member updated." : "Family member added.");
    cancelMemberForm();
    loadMembers();
  }

  async function handleDeleteMember(fm: FamilyMember) {
    if (!confirm(`Remove ${fm.first_name} from this household?`)) return;

    const res = await fetch(`/api/household/members/${fm.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to remove family member.");
      return;
    }
    toast.success("Family member removed.");
    loadMembers();
  }

  const canEditSpouseProfiles =
    currentProfile.relationship === "primary" ||
    currentProfile.relationship === "spouse";

  return (
    <div className="space-y-8">
      {/* ---- Household Info ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Household Info</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveInfo} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="family_name" className="text-base">
                Family name <span className="text-destructive" aria-hidden>*</span>
              </Label>
              <Input
                id="family_name"
                value={info.family_name}
                onChange={(e) => setInfo({ ...info, family_name: e.target.value })}
                onBlur={(e) =>
                  setInfo({ ...info, family_name: titleCaseName(e.target.value) || "" })
                }
                required
                className="text-base py-5"
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="address_line1" className="text-base">Street address</Label>
              <Input
                id="address_line1"
                value={info.address_line1}
                onChange={(e) => setInfo({ ...info, address_line1: e.target.value })}
                onBlur={(e) =>
                  setInfo({ ...info, address_line1: titleCaseStreet(e.target.value) || "" })
                }
                placeholder="123 Main St"
                className="text-base py-5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_line2" className="text-base">
                Apt / unit{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="address_line2"
                value={info.address_line2}
                onChange={(e) => setInfo({ ...info, address_line2: e.target.value })}
                onBlur={(e) =>
                  setInfo({ ...info, address_line2: titleCaseStreet(e.target.value) || "" })
                }
                placeholder="Apt 4B"
                className="text-base py-5"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
              <div className="sm:col-span-3 space-y-2">
                <Label htmlFor="city" className="text-base">City</Label>
                <Input
                  id="city"
                  value={info.city}
                  onChange={(e) => setInfo({ ...info, city: e.target.value })}
                  onBlur={(e) =>
                    setInfo({ ...info, city: titleCaseCity(e.target.value) || "" })
                  }
                  className="text-base py-5"
                />
              </div>
              <div className="sm:col-span-1 space-y-2">
                <Label htmlFor="state" className="text-base">State</Label>
                <Input
                  id="state"
                  value={info.state}
                  onChange={(e) => setInfo({ ...info, state: e.target.value.toUpperCase() })}
                  maxLength={2}
                  placeholder="TX"
                  className="text-base py-5 uppercase"
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="postal_code" className="text-base">ZIP</Label>
                <Input
                  id="postal_code"
                  value={info.postal_code}
                  onChange={(e) => setInfo({ ...info, postal_code: e.target.value })}
                  placeholder="12345"
                  className="text-base py-5"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="phone_home" className="text-base">
                Home phone{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="phone_home"
                type="tel"
                inputMode="tel"
                value={info.phone_home}
                onChange={(e) =>
                  setInfo({ ...info, phone_home: formatPhoneAsYouType(e.target.value) })
                }
                placeholder="(555) 123-4567"
                className="text-base py-5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="anniversary" className="text-base">
                Anniversary{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="anniversary"
                type="date"
                value={info.anniversary}
                onChange={(e) => setInfo({ ...info, anniversary: e.target.value })}
                className="text-base py-5"
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-semibold">Privacy</p>
              <div className="flex items-center justify-between">
                <Label htmlFor="hide_address" className="text-base cursor-pointer">
                  Hide address from directory
                </Label>
                <Switch
                  id="hide_address"
                  checked={info.hide_address}
                  onCheckedChange={(v) => setInfo({ ...info, hide_address: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="hide_phone_home" className="text-base cursor-pointer">
                  Hide home phone from directory
                </Label>
                <Switch
                  id="hide_phone_home"
                  checked={info.hide_phone_home}
                  onCheckedChange={(v) => setInfo({ ...info, hide_phone_home: v })}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={savingInfo}
                className="bg-brand-primary hover:bg-brand-primary/90 text-white"
              >
                {savingInfo ? "Saving..." : "Save Household Info"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ---- Enrolled Members ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Enrolled Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Current user */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                {currentProfile.avatar_url && (
                  <AvatarImage src={currentProfile.avatar_url} alt={displayName(currentProfile)} />
                )}
                <AvatarFallback className="bg-brand-primary text-white text-sm">
                  {initials(currentProfile)}
                </AvatarFallback>
              </Avatar>
              <div>
                <span className="text-sm font-medium">{displayName(currentProfile)}</span>
                <Badge variant="outline" className="ml-2 text-xs capitalize">
                  {currentProfile.relationship}
                </Badge>
                <Badge variant="secondary" className="ml-1 text-xs">
                  You
                </Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/profile" />}>
              <Pencil className="mr-1 h-4 w-4" />
              Edit
            </Button>
          </div>

          {householdProfiles.map((p) => (
            <div key={p.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  {p.avatar_url && (
                    <AvatarImage src={p.avatar_url} alt={displayName(p)} />
                  )}
                  <AvatarFallback className="bg-brand-primary text-white text-sm">
                    {initials(p)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <span className="text-sm font-medium">{displayName(p)}</span>
                  <Badge variant="outline" className="ml-2 text-xs capitalize">
                    {p.relationship}
                  </Badge>
                </div>
              </div>
              {canEditSpouseProfiles ? (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/household/member/${p.id}`} />}
                >
                  <Pencil className="mr-1 h-4 w-4" />
                  Edit
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Contact admin to edit</span>
              )}
            </div>
          ))}

          {householdProfiles.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No other enrolled members in this household.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ---- Non-auth Family Members ---- */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Family Members</CardTitle>
            {!showMemberForm && (
              <Button variant="outline" size="sm" onClick={startAddMember}>
                <Plus className="mr-1 h-4 w-4" />
                Add member
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Children, parents, and other household members who don&apos;t have their own account.
          </p>

          {familyMembers.map((fm) => (
            <div
              key={fm.id}
              className="flex items-center justify-between bg-muted/40 rounded-md px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <span className="text-sm font-medium">
                    {fm.first_name}
                    {fm.last_name && ` ${fm.last_name}`}
                  </span>
                  <Badge variant="outline" className="ml-2 text-xs capitalize">
                    {fm.relationship}
                  </Badge>
                  {fm.birth_month && fm.birth_day && (
                    <span className="text-xs text-muted-foreground ml-2">
                      · {MONTHS[fm.birth_month - 1]?.label} {fm.birth_day}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => startEditMember(fm)}
                >
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">Edit</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDeleteMember(fm)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                  <span className="sr-only">Remove</span>
                </Button>
              </div>
            </div>
          ))}

          {familyMembers.length === 0 && !showMemberForm && (
            <p className="text-sm text-muted-foreground">No additional family members yet.</p>
          )}

          {/* Add / Edit member inline form */}
          {showMemberForm && (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {editingMember ? "Edit family member" : "Add family member"}
                </p>
                <Button variant="ghost" size="icon-sm" onClick={cancelMemberForm}>
                  <X className="h-4 w-4" />
                  <span className="sr-only">Cancel</span>
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="fm_first" className="text-sm">First name</Label>
                  <Input
                    id="fm_first"
                    value={memberForm.first_name}
                    onChange={(e) => setMemberForm({ ...memberForm, first_name: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fm_last" className="text-sm">Last name</Label>
                  <Input
                    id="fm_last"
                    value={memberForm.last_name}
                    onChange={(e) => setMemberForm({ ...memberForm, last_name: e.target.value })}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="fm_rel" className="text-sm">Relationship</Label>
                <Select
                  value={memberForm.relationship}
                  onValueChange={(v) =>
                    setMemberForm({ ...memberForm, relationship: v as FamilyMemberRelationship })
                  }
                >
                  <SelectTrigger id="fm_rel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIPS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm">Birthday (optional)</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <Select
                    value={memberForm.birth_month}
                    onValueChange={(v) =>
                      setMemberForm({ ...memberForm, birth_month: v ?? "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="Day"
                    value={memberForm.birth_day}
                    onChange={(e) => setMemberForm({ ...memberForm, birth_day: e.target.value })}
                  />
                  <Input
                    type="number"
                    min="1900"
                    max="2100"
                    placeholder="Year"
                    value={memberForm.birth_year}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, birth_year: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={cancelMemberForm}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={savingMember}
                  onClick={handleSaveMember}
                  className="bg-brand-primary hover:bg-brand-primary/90 text-white"
                >
                  {savingMember ? "Saving..." : editingMember ? "Update" : "Add"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
