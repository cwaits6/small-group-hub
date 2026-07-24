import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { siteConfig } from "@/lib/config";
import type { Profile, FamilyUnit, FamilyMember } from "@/lib/types";
import { HouseholdClient } from "./HouseholdClient";

export const metadata = { title: `My Household | ${siteConfig.name}` };

export default async function HouseholdPage() {
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
  if (!profile.setup_completed) redirect("/profile/setup");
  if (!profile.family_id) redirect("/profile");

  const [
    { data: family },
    { data: familyMembers },
    { data: householdProfiles },
  ] = await Promise.all([
    supabase
      .from("family_units")
      .select("*")
      .eq("id", profile.family_id)
      .single<FamilyUnit>(),
    supabase
      .from("family_members")
      .select("*")
      .eq("family_id", profile.family_id)
      .order("relationship")
      .returns<FamilyMember[]>(),
    // Fetch other enrolled members in the household using the new RLS policy
    supabase
      .from("profiles")
      .select("id, first_name, last_name, preferred_name, relationship, role, avatar_url")
      .eq("family_id", profile.family_id)
      .neq("id", user.id)
      .returns<Pick<Profile, "id" | "first_name" | "last_name" | "preferred_name" | "relationship" | "role" | "avatar_url">[]>(),
  ]);

  if (!family) redirect("/profile");

  return (
    <PageContainer>
      <PageHeader
        title="My Household"
        subtitle="Manage your household's contact info and family members."
        backHref="/profile"
        backLabel="Back to my profile"
      />

      <HouseholdClient
        currentProfile={profile}
        family={family}
        initialFamilyMembers={familyMembers ?? []}
        householdProfiles={householdProfiles ?? []}
      />
    </PageContainer>
  );
}
