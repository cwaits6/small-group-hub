import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { siteConfig } from "@/lib/config";
import { SignInSecurityCard } from "./SignInSecurityCard";

export const metadata = { title: `Settings | ${siteConfig.name}` };

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["member", "content_editor", "admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold text-brand-primary md:text-4xl">
        Settings
      </h1>

      <SignInSecurityCard currentEmail={user.email ?? ""} />
    </div>
  );
}
