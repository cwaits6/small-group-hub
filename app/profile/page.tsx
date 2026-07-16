import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MyProfileView, type HouseholdEntry } from "@/components/profile/MyProfileView";
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
  let householdProfiles: HouseholdEntry[] = [];
  let familyMembers: FamilyMember[] = [];

  if (profile.family_id) {
    const [familyRes, othersRes, fmsRes] = await Promise.all([
      supabase
        .from("family_units")
        .select("*")
        .eq("id", profile.family_id)
        .maybeSingle<FamilyUnit>(),
      // Other enrolled household members, with privacy masking applied so
      // the tiles show what the directory shows.
      supabase
        .from("profiles_directory")
        .select(
          "id, first_name, last_name, preferred_name, avatar_url, relationship, email, phone_mobile",
        )
        .eq("family_id", profile.family_id)
        .neq("id", user.id)
        .order("first_name")
        .returns<HouseholdEntry[]>(),
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
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold text-brand-primary md:text-4xl">
        My Profile
      </h1>

      <MyProfileView
        profile={profile}
        family={family}
        householdProfiles={householdProfiles}
        familyMembers={familyMembers}
      />
    </div>
  );
}
