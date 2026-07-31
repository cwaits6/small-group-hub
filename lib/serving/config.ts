import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 'signed' — serving email links act without logging in (HMAC-verified).
 * 'login' — links send members through the normal login first.
 * The site_settings row wins; SERVING_LINK_MODE is the self-hoster default.
 */
export type ServingLinkMode = "signed" | "login";

export async function getServingLinkMode(
  supabase: SupabaseClient,
  orgId: string
): Promise<ServingLinkMode> {
  // org_id filter is required (Phase 2, CWA-9): on a service-role client a
  // key-only read matches every org's row the moment a second org exists,
  // making maybeSingle() error and silently fall back to the env default.
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("org_id", orgId)
    .eq("key", "serving_link_mode")
    .maybeSingle();
  if (error) {
    console.debug("Failed to load serving link mode from site_settings:", error);
  }

  const value = data?.value || process.env.SERVING_LINK_MODE || "signed";
  return value === "login" ? "login" : "signed";
}
