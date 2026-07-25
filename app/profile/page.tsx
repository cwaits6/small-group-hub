import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileHouseholdTabs } from "@/components/profile/ProfileHouseholdTabs";
import { siteConfig } from "@/lib/config";
import type { Profile, FamilyUnit, FamilyMember } from "@/lib/types";

export const metadata = { title: `My Profile | ${siteConfig.name}` };

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) redirect("/dashboard");
  if (!["member", "content_editor", "admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

  // New members must complete the setup wizard before editing their profile
  if (!profile.setup_completed) {
    redirect("/profile/setup");
  }

  let family: FamilyUnit | null = null;
  let householdProfiles: Profile[] = [];
  let familyMembers: FamilyMember[] = [];

  if (profile.family_id) {
    const [familyRes, othersRes, fmsRes] = await Promise.all([
      supabase
        .from("family_units")
        .select("*")
        .eq("id", profile.family_id)
        .maybeSingle<FamilyUnit>(),
      // Other enrolled household members. Full rows (not the masked directory
      // view) so the Household tab's edit sheet can populate the form without
      // a second fetch — the list itself only ever shows name/avatar/relationship.
      supabase
        .from("profiles")
        .select("*")
        .eq("family_id", profile.family_id)
        .neq("id", user.id)
        .order("first_name")
        .returns<Profile[]>(),
      // Family members without accounts (children etc.)
      supabase
        .from("family_members")
        .select("*")
        .eq("family_id", profile.family_id)
        .is("claimed_profile_id", null)
        .order("relationship")
        .returns<FamilyMember[]>(),
    ]);
    // Fail loudly rather than rendering an empty household over a query error.
    const queryError = familyRes.error ?? othersRes.error ?? fmsRes.error;
    if (queryError) {
      console.error("Failed to load household data:", queryError);
      throw new Error("Failed to load your household information.");
    }
    family = familyRes.data ?? null;
    householdProfiles = othersRes.data ?? [];
    familyMembers = fmsRes.data ?? [];
  }

  return (
    <PageContainer>
      <PageHeader
        title="My Profile"
        subtitle="Manage your info and your household."
      />

      <ProfileHouseholdTabs
        profile={profile}
        family={family}
        householdProfiles={householdProfiles}
        familyMembers={familyMembers}
      />
    </PageContainer>
  );
}
