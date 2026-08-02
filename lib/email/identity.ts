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

// Names of only these characters are emitted unquoted. Deliberately narrower
// than RFC 5322 permits — and note `.` is NOT atext (RFC 5322 §3.2.3 lists it
// under specials; an unquoted "Dr. Smith" is legal only via the obsolete
// obs-phrase production, which every mainstream MTA still accepts).
// Everything outside this set takes the quoted-string branch below, which is
// always safe. Widening this set is never necessary; do not.
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
      // The self-resolving path: branding comes from whatever org the request
      // resolves to, NOT from the row the caller is acting on. Correct only
      // while resolveOrgSlug() is host-independent (lib/org.ts) — Phase 5
      // custom domains make this the wrong org for any caller that had an
      // org_id in scope and did not pass it. This is the diagnostic to grep
      // for when that lands.
      console.debug("resolveEmailBranding: no orgId, resolving branding from the request org");
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
    if (!data) {
      // Zero rows comes back as { data: null, error: null }, so it never
      // reaches the branch above. A service-role read that finds no row means
      // the orgId itself is stale or wrong-tenant — worth a signal, since the
      // defaults are indistinguishable from org #1's real branding.
      console.warn("No organizations row for org %s; using email branding defaults", orgId);
      return toEmailBranding(BRANDING_DEFAULTS);
    }
    return toEmailBranding(resolveBranding(data.branding));
  } catch (err) {
    console.error("Failed to load email branding, using defaults:", err);
    return toEmailBranding(BRANDING_DEFAULTS);
  }
}
