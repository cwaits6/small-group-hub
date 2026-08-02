/**
 * Org-branded email identity (CWA-10 Phase 3, #212). The From: address keeps
 * the platform domain (deliverability: SPF/DKIM are configured for it); only
 * the display name and Reply-To vary per org.
 */
import { siteConfig } from "@/lib/config";
import { createServiceClient } from "@/lib/supabase/server";
import { BRANDING_DEFAULTS, getOrgBranding, resolveBranding } from "@/lib/branding";
import type { OrgBranding } from "@/lib/branding";

export type EmailBranding = {
  fromName: string;
  replyTo: string | null;
  accent: string;
  accentLight: string;
};

// Display names of only these characters need no quoting (RFC 5322 atext
// subset plus space).
const PLAIN_NAME = /^[A-Za-z0-9 ._-]+$/;

/**
 * RFC 5322 §3.4 From: header. Org display names are admin-supplied free
 * text: names outside the plain subset become a quoted-string with `\` and
 * `"` escaped, and CR/LF is stripped unconditionally (header injection).
 */
export function formatFromHeader(displayName: string, address: string): string {
  const name = displayName.replace(/[\r\n]/g, "").trim();
  if (name === "") return address;
  if (PLAIN_NAME.test(name)) return `${name} <${address}>`;
  return `"${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}" <${address}>`;
}

/** The bare address out of `two42 <noreply@example.org>` (or a bare addr). */
export function parseAddress(from: string): string {
  const match = from.match(/<([^<>]+)>\s*$/);
  return (match ? match[1] : from).trim();
}

/** The platform sending address — the domain never varies per org. */
export const PLATFORM_ADDRESS = parseAddress(siteConfig.email.from);

function toEmailBranding(b: OrgBranding): EmailBranding {
  return {
    fromName: b.display_name,
    replyTo: b.reply_to,
    accent: b.accent,
    // The branding contract has one color; the light variant stays the
    // platform constant rather than inventing a color-derivation scheme.
    accentLight: siteConfig.colors.primaryLight,
  };
}

/**
 * Branding for outbound email. With an orgId (callers that already hold one,
 * e.g. lib/serving/server.ts) this reads via the service-role client — RLS
 * is bypassed there, so the explicit .eq("id", orgId) is the ONLY tenant
 * boundary; without one it falls back to the request-scoped getOrgBranding().
 *
 * Fail-soft by contract: a branding lookup must never block an email, so any
 * failure logs and returns the platform defaults.
 */
export async function resolveEmailBranding(orgId?: string): Promise<EmailBranding> {
  try {
    if (!orgId) {
      return toEmailBranding(await getOrgBranding());
    }
    const service = await createServiceClient();
    const { data, error } = await service
      .from("organizations")
      .select("branding")
      .eq("id", orgId)
      .maybeSingle();
    if (error) {
      console.error("Failed to load email branding for org %s, using defaults:", orgId, error);
      return toEmailBranding(BRANDING_DEFAULTS);
    }
    return toEmailBranding(resolveBranding(data?.branding));
  } catch (err) {
    console.error("Failed to load email branding, using defaults:", err);
    return toEmailBranding(BRANDING_DEFAULTS);
  }
}
