import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
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
      .select("id, first_name, last_name, preferred_name, relationship, role, avatar_url, email")
      .eq("family_id", profile.family_id)
      .neq("id", user.id)
      .returns<Pick<Profile, "id" | "first_name" | "last_name" | "preferred_name" | "relationship" | "role" | "avatar_url" | "email">[]>(),
  ]);

  if (!family) redirect("/profile");

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        render={<Link href="/profile" />}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to my profile
      </Button>
      <h1 className="text-3xl md:text-4xl font-bold text-brand-primary mb-2">
        My Household
      </h1>
      <p className="text-base text-muted-foreground mb-8">
        Manage your household&apos;s contact info and family members.
      </p>

      <HouseholdClient
        currentProfile={profile}
        family={family}
        initialFamilyMembers={familyMembers ?? []}
        householdProfiles={householdProfiles ?? []}
      />
    </div>
  );
}
