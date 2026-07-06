import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { siteConfig } from "@/lib/config";
import { displayName } from "@/lib/names";
import type { Profile } from "@/lib/types";
import { HouseholdMemberEditClient } from "../HouseholdMemberEditClient";

export const metadata = { title: `Edit Household Member | ${siteConfig.name}` };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function HouseholdMemberEditPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role, family_id, setup_completed, relationship")
    .eq("id", user.id)
    .single();

  if (
    !currentProfile ||
    !["member", "content_editor", "admin"].includes(currentProfile.role) ||
    !currentProfile.setup_completed ||
    !currentProfile.family_id
  ) {
    redirect("/dashboard");
  }

  // Only primary and spouse can edit other enrolled household members
  if (!["primary", "spouse"].includes(currentProfile.relationship ?? "")) {
    redirect("/household");
  }

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single<Profile>();

  if (!targetProfile) notFound();

  // Ensure the target is in the same household
  if (targetProfile.family_id !== currentProfile.family_id) {
    redirect("/household");
  }

  // Don't let them edit themselves here — that's /profile
  if (targetProfile.id === user.id) redirect("/profile");

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        render={<Link href="/household" />}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to household
      </Button>
      <h1 className="text-3xl md:text-4xl font-bold text-brand-primary mb-2">
        Edit Member
      </h1>
      <p className="text-base text-muted-foreground mb-8">
        Editing profile for <strong>{displayName(targetProfile)}</strong>.
      </p>

      <HouseholdMemberEditClient profile={targetProfile} />
    </div>
  );
}
