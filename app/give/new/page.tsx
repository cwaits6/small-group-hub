import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { siteConfig } from "@/lib/config";
import { FundForm } from "@/components/giving/FundForm";
import {
  givingStewardsCanManage,
  loadFundFormData,
} from "@/lib/giving/server";

export const metadata = { title: `New Giving Link | ${siteConfig.name}` };

export default async function NewFundPage() {
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
  if (!profile || profile.role === "pending") redirect("/dashboard");
  const isAdmin = profile.role === "admin";

  const stewardsCanManage = await givingStewardsCanManage(supabase);
  if (!isAdmin && !stewardsCanManage) redirect("/give");

  const { members, handlesByProfile } = await loadFundFormData(supabase);

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <h1 className="text-3xl md:text-4xl font-bold text-brand-primary mb-2">
        Put up a new link
      </h1>
      <p className="text-lg text-muted-foreground mb-10 max-w-xl">
        For a one-off collection — flowers, a love offering, a retreat. Takes a
        minute, and you can retire it when it&apos;s done.
      </p>
      <FundForm
        fund={null}
        members={members}
        handlesByProfile={handlesByProfile}
        currentUserId={user.id}
        isAdmin={isAdmin}
        backHref="/give"
      />
    </div>
  );
}
