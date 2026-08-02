/**
 * Per-org branding (CWA-10 Phase 3, #212). The source of truth is
 * organizations.branding (jsonb); the NEXT_PUBLIC_* env values in
 * lib/config.ts survive only as last-resort fallback defaults so
 * self-hosters keep working with an empty branding row.
 */
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/config";

export type OrgBranding = {
  display_name: string;
  logo_url: string | null;
  accent: string;
  reply_to: string | null;
};

export const BRANDING_DEFAULTS: OrgBranding = {
  display_name: siteConfig.name,
  logo_url: null,
  accent: siteConfig.colors.primary,
  reply_to: null,
};

// accent is interpolated into a <style> block in app/layout.tsx; this strict
// hex shape is the CSS-injection guard. Do not relax it.
const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Merge a raw branding jsonb value onto the defaults. Falls back per-key —
 * an invalid accent must not discard a valid display_name. A non-object
 * (array, scalar, null) falls back entirely.
 */
export function resolveBranding(raw: unknown): OrgBranding {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return BRANDING_DEFAULTS;
  }
  const b = raw as Record<string, unknown>;
  return {
    display_name:
      typeof b.display_name === "string" && b.display_name.trim() !== ""
        ? b.display_name
        : BRANDING_DEFAULTS.display_name,
    logo_url: typeof b.logo_url === "string" ? b.logo_url : null,
    accent:
      typeof b.accent === "string" && HEX.test(b.accent)
        ? b.accent
        : BRANDING_DEFAULTS.accent,
    reply_to: typeof b.reply_to === "string" ? b.reply_to : null,
  };
}

/**
 * The request org's branding, memoized per request with React cache() so
 * generateMetadata and the layout body share one query (Supabase calls are
 * not fetch-memoized). RLS narrows organizations to the request org, so no
 * explicit org filter is needed — but only because this uses createClient();
 * a service-role client would bypass RLS and require one.
 *
 * Never throws: branding must not be able to 500 a page. Any error or
 * missing row degrades to BRANDING_DEFAULTS.
 */
export const getOrgBranding = cache(async (): Promise<OrgBranding> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("organizations")
      .select("branding")
      .maybeSingle();
    if (error) {
      console.error("Failed to load org branding, using defaults:", error);
      return BRANDING_DEFAULTS;
    }
    return resolveBranding(data?.branding);
  } catch (err) {
    console.error("Failed to load org branding, using defaults:", err);
    return BRANDING_DEFAULTS;
  }
});
