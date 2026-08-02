/**
 * Phase 2 (CWA-9 / #211): slug sent as the `x-two42-org` header on every
 * Supabase client, so anonymous requests resolve an org via
 * app_request_org_id() (authenticated principals always win over the
 * header — it only ever selects among already-public content).
 *
 * Single-tenant interim: every host maps to the one deployed org. Phase 5
 * (custom domains, #214) replaces this with real host → org resolution,
 * which is why the host is already part of the signature.
 */
export const DEFAULT_ORG_SLUG = "default";

/**
 * Slug for the org this request is about, sent as `x-two42-org`.
 *
 * The mapping is NOT hardcoded: `NEXT_PUBLIC_ORG_SLUG` overrides it, and the
 * override must be the slug of a real organization row — anonymous flows
 * (the join form, public content) resolve their org from this slug via
 * app_request_org_id(), so a slug that matches nothing makes those flows
 * fail closed rather than fall back to another org.
 *
 * `_host` is unused in the single-tenant interim — it is already in the
 * signature because Phase 5 (custom domains, #214) resolves host → org here.
 */
export function resolveOrgSlug(_host?: string | null): string {
  return process.env.NEXT_PUBLIC_ORG_SLUG || DEFAULT_ORG_SLUG;
}
