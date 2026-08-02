// Per-org email branding for the cron Edge Functions (CWA-56).
//
// A DELIBERATE MIRROR of lib/branding.ts + lib/email/identity.ts. Edge
// functions cannot import from lib/ (Next.js "@/" path aliases, react's
// cache(), npm module resolution), so the validation logic is duplicated
// here. The regexes below are an injection boundary, not style choices:
// organizations.branding is admin-supplied free text that lands in inline
// CSS and RFC 5322 headers. Any change to this logic must be made on both
// sides — grep for this filename when touching lib/branding.ts or
// lib/email/identity.ts, and vice versa.
//
// Differences from the app version (all deliberate):
//   - No logo_url and no accentLight — cron mail renders neither.
//   - Defaults are passed in by the caller (the env-derived APP_NAME /
//     BRAND_COLOR, the non-prefixed twins of NEXT_PUBLIC_APP_NAME /
//     NEXT_PUBLIC_COLOR_PRIMARY with the same "two42" / "#B85C38"
//     fallbacks) rather than imported from siteConfig.
//   - No DB read here — `raw` arrives from the listActiveOrgs row, so this
//     module stays supabase-js-free and offline-testable, matching the
//     stated design of _shared/orgs.ts.

/** What the reminder mail builders need from an org's branding row. */
export interface EmailBranding {
  orgName: string;
  replyTo: string | null;
  accent: string;
}

/** Env-derived fallbacks, resolved once by the entry point. */
export interface BrandingDefaults {
  displayName: string; // APP_NAME env
  accent: string; // BRAND_COLOR env
}

// accent is interpolated into the inline style="" attributes of both
// reminder emails with no per-sink escaping. This strict hex shape is the
// CSS-injection guard for all of them. Do not relax it.
const HEX = /^#[0-9a-fA-F]{6}$/;

// display_name reaches RFC 5322 headers (From:) via formatFromHeader below;
// strip C0/C1 control characters at this boundary so no sink has to.
// formatFromHeader() keeps its own CR/LF strip as defence-in-depth.
const CONTROL = /[\u0000-\u001F\u007F-\u009F]/g;

// reply_to becomes an RFC 5322 Reply-To header via the Resend API, which
// rejects malformed addresses. Deliberately conservative: over-rejecting
// yields no Reply-To header, which is the pre-branding behavior and
// strictly better than a failed send.
const EMAIL = /^[^\s@<>,;:"\\]+@[^\s@<>,;:"\\]+\.[^\s@<>,;:"\\]+$/;

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

/**
 * Merge a raw branding jsonb value onto the env defaults. Falls back
 * per-key — an invalid accent must not discard a valid display_name. A
 * non-object (array, scalar, null) falls back entirely.
 *
 * Total by contract: this must never throw, so a malformed branding row
 * degrades to the platform defaults instead of becoming an org-level
 * failure (mirroring lib/email/identity.ts's fail-soft contract).
 */
export function resolveEmailBranding(
  raw: unknown,
  defaults: BrandingDefaults,
  orgSlug?: string,
): EmailBranding {
  const fallback: EmailBranding = {
    orgName: defaults.displayName,
    replyTo: null,
    accent: defaults.accent,
  };
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return fallback;
  }
  const b = raw as Record<string, unknown>;
  const name =
    typeof b.display_name === "string" ? b.display_name.replace(CONTROL, "").trim() : "";
  const replyTo = typeof b.reply_to === "string" ? b.reply_to.trim() : null;
  const replyToValid = replyTo !== null && replyTo.length <= 254 && EMAIL.test(replyTo);
  if (replyTo !== null && replyTo !== "" && !replyToValid) {
    // The one silent fallback worth a signal: a dropped Reply-To is far more
    // surprising than a dropped color, and the cause (a branding column) is
    // nowhere near the symptom (mail replying to noreply@).
    console.warn(
      "[org %s] Ignoring malformed branding.reply_to; sending without a Reply-To header",
      orgSlug ?? "unknown",
    );
  }
  return {
    orgName: name !== "" ? name : defaults.displayName,
    replyTo: replyToValid ? replyTo : null,
    accent:
      typeof b.accent === "string" && HEX.test(b.accent) ? b.accent : defaults.accent,
  };
}
