import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { DirectoryPreview } from "@/components/profile/DirectoryPreview";
import { TextSizeControl } from "@/components/settings/TextSizeControl";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config";
import { Home } from "lucide-react";
import type { Profile, FamilyUnit } from "@/lib/types";

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

  // Members don't reassign their own family — but we still need the form
  // component to render the family tab disabled, so pass an empty list.
  const families: FamilyUnit[] = [];

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-3xl md:text-4xl font-bold text-brand-primary mb-2">
        My Profile
      </h1>
      <p className="text-base text-muted-foreground mb-4">
        Your contact info for the member directory. Privacy controls let you
        hide specific fields from other members.
      </p>

      <div className="mb-8">
        <DirectoryPreview />
      </div>

      <ProfileForm profile={profile} families={families} isAdmin={false} />

      <div className="mt-8 pt-6 border-t">
        <h2 className="text-lg font-semibold text-foreground mb-1">Text size</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Choose the text size that is easiest for you to read.
        </p>
        <TextSizeControl />
      </div>

      {profile.family_id && (
        <div className="mt-8 pt-6 border-t">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/household" />}
            className="w-full sm:w-auto"
          >
            <Home className="mr-2 h-4 w-4" />
            Manage Household
          </Button>
          <p className="text-sm text-muted-foreground mt-2">
            Update your household&apos;s address, home phone, and family members.
          </p>
        </div>
      )}
    </div>
  );
}
