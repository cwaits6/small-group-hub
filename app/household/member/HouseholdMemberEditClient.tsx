"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Profile, FamilyUnit, FamilyMemberRelationship } from "@/lib/types";

const RELATIONSHIPS: { value: FamilyMemberRelationship; label: string }[] = [
  { value: "primary", label: "Primary" },
  { value: "spouse", label: "Spouse" },
  { value: "child", label: "Child" },
  { value: "parent", label: "Parent" },
  { value: "sibling", label: "Sibling" },
  { value: "other", label: "Other" },
];

interface Props {
  profile: Profile;
}

export function HouseholdMemberEditClient({ profile }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [relationship, setRelationship] = useState<FamilyMemberRelationship>(profile.relationship);
  const [savingRelationship, setSavingRelationship] = useState(false);

  async function handleRelationshipChange(value: FamilyMemberRelationship) {
    setRelationship(value);
    setSavingRelationship(true);

    const { error } = await supabase
      .from("profiles")
      .update({ relationship: value })
      .eq("id", profile.id);

    setSavingRelationship(false);

    if (error) {
      toast.error("Failed to update relationship.");
      setRelationship(profile.relationship); // revert
    } else {
      toast.success("Relationship updated.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Relationship — editable separately since ProfileForm doesn't expose it */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Household Role</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="relationship" className="text-base">
              Relationship to household
            </Label>
            <Select
              items={RELATIONSHIPS}
              value={relationship}
              onValueChange={(v) => handleRelationshipChange(v as FamilyMemberRelationship)}
              disabled={savingRelationship}
            >
              <SelectTrigger id="relationship" className="text-base py-5">
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
            {savingRelationship && (
              <p className="text-xs text-muted-foreground">Saving...</p>
            )}
          </div>
        </CardContent>
      </Card>

      <ProfileForm
        profile={profile}
        families={[] as FamilyUnit[]}
        isAdmin={false}
        relaxValidation={true}
        onSaved={() => router.push("/household")}
      />
    </div>
  );
}
