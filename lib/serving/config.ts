import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 'signed' — serving email links act without logging in (HMAC-verified).
 * 'login' — links send members through the normal login first.
 * The site_settings row wins; SERVING_LINK_MODE is the self-hoster default.
 */
export type ServingLinkMode = "signed" | "login";

export async function getServingLinkMode(
  supabase: SupabaseClient
): Promise<ServingLinkMode> {
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "serving_link_mode")
    .maybeSingle();

  const value = data?.value || process.env.SERVING_LINK_MODE || "signed";
  return value === "login" ? "login" : "signed";
}
