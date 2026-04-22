"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadImage } from "@/lib/uploadImage";
import {
  titleCaseName,
  titleCaseStreet,
  titleCaseCity,
  normalizePhone,
  normalizeState,
  normalizePostalCode,
  normalizeEmail,
  trimText,
  formatPhone,
  formatPhoneAsYouType,
} from "@/lib/sanitize";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import type { Profile, FamilyUnit } from "@/lib/types";

interface ProfileFormProps {
  profile: Profile;
  families: FamilyUnit[];
  /** Admin mode allows editing family assignment + ignores privacy enforcement on save */
  isAdmin?: boolean;
  /** Called after successful save so parent can refresh/redirect */
  onSaved?: () => void;
}

/** Form state — strings for all inputs (conversion happens on save) */
interface FormState {
  first_name: string;
  last_name: string;
  preferred_name: string;
  bio: string;
  email: string;
  phone_mobile: string;
  phone_home: string;
  phone_work: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  birth_month: string;
  birth_day: string;
  birth_year: string;
  anniversary: string;
  occupation: string;
  employer: string;
  family_id: string;
  is_unlisted: boolean;
  hide_phone_mobile: boolean;
  hide_phone_home: boolean;
  hide_phone_work: boolean;
  hide_email: boolean;
  hide_address: boolean;
  hide_birthday: boolean;
  hide_anniversary: boolean;
  hide_occupation: boolean;
}

function initialState(profile: Profile): FormState {
  return {
    first_name: profile.first_name || "",
    last_name: profile.last_name || "",
    preferred_name: profile.preferred_name || "",
    bio: profile.bio || "",
    email: profile.email || "",
    phone_mobile: formatPhone(profile.phone_mobile),
    phone_home: formatPhone(profile.phone_home),
    phone_work: formatPhone(profile.phone_work),
    address_line1: profile.address_line1 || "",
    address_line2: profile.address_line2 || "",
    city: profile.city || "",
    state: profile.state || "",
    postal_code: profile.postal_code || "",
    birth_month: profile.birth_month?.toString() || "",
    birth_day: profile.birth_day?.toString() || "",
    birth_year: profile.birth_year?.toString() || "",
    anniversary: profile.anniversary || "",
    occupation: profile.occupation || "",
    employer: profile.employer || "",
    family_id: profile.family_id || "",
    is_unlisted: profile.is_unlisted ?? false,
    hide_phone_mobile: profile.hide_phone_mobile ?? false,
    hide_phone_home: profile.hide_phone_home ?? false,
    hide_phone_work: profile.hide_phone_work ?? false,
    hide_email: profile.hide_email ?? false,
    hide_address: profile.hide_address ?? false,
    hide_birthday: profile.hide_birthday ?? false,
    hide_anniversary: profile.hide_anniversary ?? false,
    hide_occupation: profile.hide_occupation ?? false,
  };
}

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

export function ProfileForm({
  profile,
  families,
  isAdmin = false,
  onSaved,
}: ProfileFormProps) {
  const [state, setState] = useState<FormState>(initialState(profile));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const handleAvatarUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const url = await uploadImage(file, "avatar", `${profile.id}/avatar`);
      // Cache-bust so the new image shows immediately.
      const bustedUrl = `${url}?t=${Date.now()}`;
      setAvatarUrl(bustedUrl);

      // Persist on the profile so a refresh keeps the change even if the
      // user doesn't save the rest of the form.
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", profile.id);
      if (error) throw error;
      toast.success("Photo updated.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload photo.");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    // Sanitize + normalize everything before writing.
    const firstName = titleCaseName(state.first_name);
    const lastName = titleCaseName(state.last_name);
    const preferredName = titleCaseName(state.preferred_name);
    const city = titleCaseCity(state.city);
    const stateCode = normalizeState(state.state);
    const postal = state.postal_code
      ? normalizePostalCode(state.postal_code)
      : null;

    // Validate required fields.
    if (!firstName) {
      toast.error("First name is required.");
      setSaving(false);
      return;
    }
    if (!lastName) {
      toast.error("Last name is required.");
      setSaving(false);
      return;
    }
    if (!state.birth_month || !state.birth_day) {
      toast.error("Birthday month and day are required.");
      setSaving(false);
      return;
    }
    // At least one phone or a visible email is required so members can be reached.
    const hasPhone = !!(state.phone_mobile || state.phone_home || state.phone_work);
    const hasVisibleEmail = !!state.email && !state.hide_email;
    if (!hasPhone && !hasVisibleEmail) {
      toast.error(
        "Please provide at least one phone number, or keep your email visible so others can reach you.",
      );
      setSaving(false);
      return;
    }

    // Validate required shapes — state/zip return null on malformed input.
    if (state.state && !stateCode) {
      toast.error("State must be a valid 2-letter code or full state name.");
      setSaving(false);
      return;
    }
    if (state.postal_code && !postal) {
      toast.error("ZIP code must be 5 digits or ZIP+4 format.");
      setSaving(false);
      return;
    }

    const phoneMobile = state.phone_mobile
      ? normalizePhone(state.phone_mobile)
      : null;
    const phoneHome = state.phone_home
      ? normalizePhone(state.phone_home)
      : null;
    const phoneWork = state.phone_work
      ? normalizePhone(state.phone_work)
      : null;

    if (state.phone_mobile && !phoneMobile) {
      toast.error("Mobile phone number isn't valid.");
      setSaving(false);
      return;
    }
    if (state.phone_home && !phoneHome) {
      toast.error("Home phone number isn't valid.");
      setSaving(false);
      return;
    }
    if (state.phone_work && !phoneWork) {
      toast.error("Work phone number isn't valid.");
      setSaving(false);
      return;
    }

    const birthMonth = state.birth_month ? Number(state.birth_month) : null;
    const birthDay = state.birth_day ? Number(state.birth_day) : null;
    const birthYear = state.birth_year ? Number(state.birth_year) : null;

    const updates = {
      first_name: firstName,
      last_name: lastName,
      preferred_name: preferredName,
      bio: trimText(state.bio),
      email: normalizeEmail(state.email),
      phone_mobile: phoneMobile,
      phone_home: phoneHome,
      phone_work: phoneWork,
      address_line1: titleCaseStreet(state.address_line1),
      address_line2: titleCaseStreet(state.address_line2),
      city,
      state: stateCode,
      postal_code: postal,
      birth_month: birthMonth,
      birth_day: birthDay,
      birth_year: birthYear,
      anniversary: state.anniversary || null,
      occupation: trimText(state.occupation),
      employer: trimText(state.employer),
      ...(isAdmin
        ? { family_id: state.family_id || null }
        : {}),
      is_unlisted: state.is_unlisted,
      hide_phone_mobile: state.hide_phone_mobile,
      hide_phone_home: state.hide_phone_home,
      hide_phone_work: state.hide_phone_work,
      hide_email: state.hide_email,
      hide_address: state.hide_address,
      hide_birthday: state.hide_birthday,
      hide_anniversary: state.hide_anniversary,
      hide_occupation: state.hide_occupation,
    };

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", profile.id);

    setSaving(false);

    if (error) {
      console.error(error);
      toast.error("Failed to save profile.");
      return;
    }

    toast.success("Profile saved.");
    onSaved?.();
  };

  const initials =
    `${state.first_name.charAt(0)}${state.last_name.charAt(0)}`.toUpperCase() ||
    "??";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Avatar — always visible, not in a tab */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="Profile photo" />}
                <AvatarFallback className="text-2xl bg-brand-primary text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-full p-2 shadow-md transition-colors disabled:opacity-50"
                aria-label="Upload photo"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            <div className="flex-1">
              <p className="text-lg font-semibold">
                {state.preferred_name || state.first_name || "Your profile"}{" "}
                {state.last_name}
              </p>
              <p className="text-sm text-muted-foreground">
                {uploadingAvatar
                  ? "Uploading photo..."
                  : "Click the camera icon to update your photo."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="personal">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="address">Address</TabsTrigger>
          {isAdmin && <TabsTrigger value="family">Family</TabsTrigger>}
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
          {!isAdmin && <div />}
        </TabsList>

        {/* =========================================================
            PERSONAL
            ========================================================= */}
        <TabsContent value="personal">
          <Card>
            <CardContent className="pt-6 space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name" className="text-base">
                    First name{" "}
                    <span className="text-destructive" aria-hidden>*</span>
                  </Label>
                  <Input
                    id="first_name"
                    value={state.first_name}
                    onChange={(e) => update("first_name", e.target.value)}
                    onBlur={(e) =>
                      update("first_name", titleCaseName(e.target.value) || "")
                    }
                    required
                    className="text-base py-5"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name" className="text-base">
                    Last name{" "}
                    <span className="text-destructive" aria-hidden>*</span>
                  </Label>
                  <Input
                    id="last_name"
                    value={state.last_name}
                    onChange={(e) => update("last_name", e.target.value)}
                    onBlur={(e) =>
                      update("last_name", titleCaseName(e.target.value) || "")
                    }
                    required
                    className="text-base py-5"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferred_name" className="text-base">
                  Preferred name / nickname{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="preferred_name"
                  value={state.preferred_name}
                  onChange={(e) => update("preferred_name", e.target.value)}
                  onBlur={(e) =>
                    update(
                      "preferred_name",
                      titleCaseName(e.target.value) || "",
                    )
                  }
                  className="text-base py-5"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio" className="text-base">
                  About me{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  id="bio"
                  value={state.bio}
                  onChange={(e) => update("bio", e.target.value)}
                  rows={3}
                  className="text-base"
                  placeholder="A sentence or two about yourself"
                />
              </div>

              <Separator />

              <div>
                <Label className="text-base">
                  Birthday{" "}
                  <span className="text-destructive" aria-hidden>*</span>
                </Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Month and day are required. Year is optional.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <Select
                    value={state.birth_month}
                    onValueChange={(v) => update("birth_month", v ?? "")}
                  >
                    <SelectTrigger className="text-base py-5">
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
                    value={state.birth_day}
                    onChange={(e) => update("birth_day", e.target.value)}
                    className="text-base py-5"
                  />
                  <Input
                    type="number"
                    min="1900"
                    max="2100"
                    placeholder="Year (optional)"
                    value={state.birth_year}
                    onChange={(e) => update("birth_year", e.target.value)}
                    className="text-base py-5"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="anniversary" className="text-base">
                  Anniversary{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="anniversary"
                  type="date"
                  value={state.anniversary}
                  onChange={(e) => update("anniversary", e.target.value)}
                  className="text-base py-5"
                />
              </div>

              <Separator />

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="occupation" className="text-base">
                    Occupation{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="occupation"
                    value={state.occupation}
                    onChange={(e) => update("occupation", e.target.value)}
                    placeholder="e.g. Plumber, Teacher"
                    className="text-base py-5"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employer" className="text-base">
                    Employer{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="employer"
                    value={state.employer}
                    onChange={(e) => update("employer", e.target.value)}
                    placeholder="Company / organization"
                    className="text-base py-5"
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Sharing what you do helps others in the class find help from
                someone they know.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================
            CONTACT
            ========================================================= */}
        <TabsContent value="contact">
          <Card>
            <CardContent className="pt-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={state.email}
                  onChange={(e) => update("email", e.target.value)}
                  disabled={!isAdmin}
                  className="text-base py-5"
                />
                {!isAdmin && (
                  <p className="text-xs text-muted-foreground">
                    Contact an admin to change your login email.
                  </p>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="phone_mobile" className="text-base">
                  Mobile phone
                </Label>
                <Input
                  id="phone_mobile"
                  type="tel"
                  inputMode="tel"
                  value={state.phone_mobile}
                  onChange={(e) =>
                    update("phone_mobile", formatPhoneAsYouType(e.target.value))
                  }
                  placeholder="(555) 123-4567"
                  className="text-base py-5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone_home" className="text-base">
                  Home phone
                </Label>
                <Input
                  id="phone_home"
                  type="tel"
                  inputMode="tel"
                  value={state.phone_home}
                  onChange={(e) =>
                    update("phone_home", formatPhoneAsYouType(e.target.value))
                  }
                  placeholder="(555) 123-4567"
                  className="text-base py-5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone_work" className="text-base">
                  Work phone{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="phone_work"
                  type="tel"
                  inputMode="tel"
                  value={state.phone_work}
                  onChange={(e) =>
                    update("phone_work", formatPhoneAsYouType(e.target.value))
                  }
                  placeholder="(555) 123-4567"
                  className="text-base py-5"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================
            ADDRESS
            ========================================================= */}
        <TabsContent value="address">
          <Card>
            <CardContent className="pt-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="address_line1" className="text-base">
                  Street address
                </Label>
                <Input
                  id="address_line1"
                  value={state.address_line1}
                  onChange={(e) => update("address_line1", e.target.value)}
                  onBlur={(e) =>
                    update(
                      "address_line1",
                      titleCaseStreet(e.target.value) || "",
                    )
                  }
                  placeholder="123 Main St"
                  className="text-base py-5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_line2" className="text-base">
                  Apt / unit{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="address_line2"
                  value={state.address_line2}
                  onChange={(e) => update("address_line2", e.target.value)}
                  onBlur={(e) =>
                    update(
                      "address_line2",
                      titleCaseStreet(e.target.value) || "",
                    )
                  }
                  placeholder="Apt 4B"
                  className="text-base py-5"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                <div className="sm:col-span-3 space-y-2">
                  <Label htmlFor="city" className="text-base">
                    City
                  </Label>
                  <Input
                    id="city"
                    value={state.city}
                    onChange={(e) => update("city", e.target.value)}
                    onBlur={(e) =>
                      update("city", titleCaseCity(e.target.value) || "")
                    }
                    className="text-base py-5"
                  />
                </div>
                <div className="sm:col-span-1 space-y-2">
                  <Label htmlFor="state" className="text-base">
                    State
                  </Label>
                  <Input
                    id="state"
                    value={state.state}
                    onChange={(e) =>
                      update("state", e.target.value.toUpperCase())
                    }
                    maxLength={2}
                    placeholder="TX"
                    className="text-base py-5 uppercase"
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="postal_code" className="text-base">
                    ZIP
                  </Label>
                  <Input
                    id="postal_code"
                    value={state.postal_code}
                    onChange={(e) => update("postal_code", e.target.value)}
                    placeholder="12345"
                    className="text-base py-5"
                  />
                </div>
              </div>
              {profile.family_id && (
                <p className="text-sm text-muted-foreground">
                  Leave blank to use your family&apos;s shared address.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================
            FAMILY (admin only)
            ========================================================= */}
        {isAdmin && (
          <TabsContent value="family">
            <Card>
              <CardContent className="pt-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="family_id" className="text-base">
                    Family
                  </Label>
                  <Select
                    value={state.family_id || "none"}
                    onValueChange={(v) =>
                      update("family_id", !v || v === "none" ? "" : v)
                    }
                  >
                    <SelectTrigger className="text-base py-5">
                      <SelectValue placeholder="No family assigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— No family —</SelectItem>
                      {families.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.family_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Manage families on the{" "}
                    <a
                      href="/admin/families"
                      className="text-brand-primary underline"
                    >
                      Families page
                    </a>
                    .
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* =========================================================
            PRIVACY
            ========================================================= */}
        <TabsContent value="privacy">
          <Card>
            <CardContent className="pt-6 space-y-5">
              <div className="flex items-start justify-between gap-4 pb-4 border-b">
                <div>
                  <Label className="text-base">Hide from directory</Label>
                  <p className="text-sm text-muted-foreground">
                    Your profile will not appear in the member directory at all.
                  </p>
                </div>
                <Switch
                  checked={state.is_unlisted}
                  onCheckedChange={(v) => update("is_unlisted", v)}
                />
              </div>

              <p className="text-sm text-muted-foreground">
                Hide specific fields while still appearing in the directory.
                Admins can always see all fields.
              </p>

              {[
                { key: "hide_email" as const, label: "Hide email" },
                { key: "hide_phone_mobile" as const, label: "Hide mobile phone" },
                { key: "hide_phone_home" as const, label: "Hide home phone" },
                { key: "hide_phone_work" as const, label: "Hide work phone" },
                { key: "hide_address" as const, label: "Hide address" },
                { key: "hide_birthday" as const, label: "Hide birthday" },
                { key: "hide_anniversary" as const, label: "Hide anniversary" },
                { key: "hide_occupation" as const, label: "Hide occupation / employer" },
              ].map(({ key, label }) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-4"
                >
                  <Label htmlFor={key} className="text-base cursor-pointer">
                    {label}
                  </Label>
                  <Switch
                    id={key}
                    checked={state[key]}
                    onCheckedChange={(v) => update(key, v)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3">
        <Button
          type="submit"
          size="lg"
          disabled={saving}
          className="text-base bg-brand-primary hover:bg-brand-primary/90 text-white"
        >
          {saving ? "Saving..." : "Save Profile"}
        </Button>
      </div>
    </form>
  );
}
