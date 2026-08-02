/**
 * Phase 1 interim (org spine, #210): the fixed UUID of the default
 * organization all existing rows were backfilled to.
 *
 * The schema's fail-closed `org_id DEFAULT app_current_org_id()` resolves
 * through auth.uid(), so write paths with no authenticated user — the anon
 * join form and token-authenticated service-role flows — must pass this
 * explicitly or their inserts violate NOT NULL. Phase 3 replaces these call
 * sites with real org derivation from the validated token/row; this
 * constant is deleted then.
 */
export const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

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
 * override MUST be the slug of the organization whose id is `DEFAULT_ORG_ID`
 * above — the pair is one configuration, not two. Nothing enforces it at
 * runtime (an env slug can't be validated against a DB UUID without a
 * query): the anon join form inserts `org_id = DEFAULT_ORG_ID` while the RLS
 * policy that must accept it resolves the org from *this* slug, so pointing
 * `NEXT_PUBLIC_ORG_SLUG` at any other organization rejects every join
 * submission with a bare 42501. Renaming the seeded org's slug and updating
 * this env var together is fine — the UUID doesn't change. Phase 3 removes
 * the coupling by defaulting `access_requests.org_id` to
 * `app_request_org_id()`; until then, treat the slug and the UUID as a
 * single validated pair.
 *
 * `_host` is unused in the single-tenant interim — it is already in the
 * signature because Phase 5 (custom domains, #214) resolves host → org here.
 */
export function resolveOrgSlug(_host?: string | null): string {
  return process.env.NEXT_PUBLIC_ORG_SLUG || DEFAULT_ORG_SLUG;
}
