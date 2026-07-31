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
