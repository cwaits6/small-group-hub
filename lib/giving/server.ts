import type { SupabaseClient } from "@supabase/supabase-js";
import { displayName, initials } from "@/lib/names";
import type { MemberOption } from "@/components/giving/FundForm";
import type { PaymentHandle, PaymentMethodKey } from "@/lib/types";

/** Whether members may put up and manage their own giving links */
export async function givingStewardsCanManage(
  supabase: SupabaseClient
): Promise<boolean> {
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "giving_manage_mode")
    .maybeSingle();
  return (data?.value ?? "stewards") === "stewards";
}

/** Both giving settings in one query, for the admin page */
export async function getGivingSettings(supabase: SupabaseClient): Promise<{
  stewardsCanManage: boolean;
  dashboardTile: boolean;
}> {
  const { data } = await supabase
    .from("site_settings")
    .select("key, value")
    .in("key", ["giving_manage_mode", "giving_dashboard_tile"]);
  const map = new Map((data ?? []).map((s) => [s.key, s.value]));
  return {
    stewardsCanManage: (map.get("giving_manage_mode") ?? "stewards") === "stewards",
    dashboardTile: (map.get("giving_dashboard_tile") ?? "on") === "on",
  };
}

/** Member picker options + everyone's payment handles, for the fund form */
export async function loadFundFormData(supabase: SupabaseClient): Promise<{
  members: MemberOption[];
  handlesByProfile: Record<string, Partial<Record<PaymentMethodKey, string>>>;
}> {
  const [{ data: memberRows }, { data: handleRows }] = await Promise.all([
    supabase
      .from("profiles_directory")
      .select("id, first_name, last_name, preferred_name, avatar_url")
      .order("last_name")
      .order("first_name"),
    supabase.from("payment_handles").select("*"),
  ]);

  const members: MemberOption[] = (memberRows ?? []).map((p) => ({
    id: p.id,
    name: displayName(p),
    initials: initials(p),
    avatarUrl: p.avatar_url,
  }));

  const handlesByProfile: Record<
    string,
    Partial<Record<PaymentMethodKey, string>>
  > = {};
  for (const h of (handleRows ?? []) as PaymentHandle[]) {
    (handlesByProfile[h.profile_id] ??= {})[h.method] = h.handle;
  }

  return { members, handlesByProfile };
}
