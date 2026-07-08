import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { siteConfig } from "@/lib/config";
import { FundForm } from "@/components/giving/FundForm";
import {
  givingStewardsCanManage,
  loadFundFormData,
} from "@/lib/giving/server";
import type { GivingFund, GivingFundMethod } from "@/lib/types";

export const metadata = { title: `Edit Giving Link | ${siteConfig.name}` };

export default async function EditFundPage({
  params,
}: {
  params: Promise<{ fundId: string }>;
}) {
  const { fundId } = await params;
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

  const [{ data: fund }, { data: methodRows }, stewardsCanManage] =
    await Promise.all([
      supabase
        .from("giving_funds")
        .select("*")
        .eq("id", fundId)
        .maybeSingle<GivingFund>(),
      supabase.from("giving_fund_methods").select("*").eq("fund_id", fundId),
      givingStewardsCanManage(supabase),
    ]);

  if (!fund) notFound();
  const canManage =
    isAdmin || (stewardsCanManage && fund.steward_id === user.id);
  if (!canManage) redirect("/give");

  const { members, handlesByProfile } = await loadFundFormData(supabase);

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <h1 className="text-3xl md:text-4xl font-bold text-brand-primary mb-2">
        Edit giving link
      </h1>
      <p className="text-lg text-muted-foreground mb-10 max-w-xl">
        {fund.is_active
          ? "Changes show up on the Give page right away."
          : "This fund is retired — it's hidden from the Give page."}
      </p>
      <FundForm
        fund={{ ...fund, methods: (methodRows ?? []) as GivingFundMethod[] }}
        members={members}
        handlesByProfile={handlesByProfile}
        currentUserId={user.id}
        isAdmin={isAdmin}
        backHref={isAdmin ? "/admin/giving" : "/give"}
      />
    </div>
  );
}
