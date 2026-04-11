import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { siteConfig } from "@/lib/config";
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

  // Members don't reassign their own family — but we still need the form
  // component to render the family tab disabled, so pass an empty list.
  const families: FamilyUnit[] = [];

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-3xl md:text-4xl font-bold text-brand-primary mb-2">
        My Profile
      </h1>
      <p className="text-base text-muted-foreground mb-8">
        Your contact info for the member directory. Privacy controls let you
        hide specific fields from other members.
      </p>

      <ProfileForm profile={profile} families={families} isAdmin={false} />
    </div>
  );
}
