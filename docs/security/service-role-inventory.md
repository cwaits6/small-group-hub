# Service-Role Client Inventory

Every place the app bypasses RLS via `createServiceClient()` (defined in
`lib/supabase/server.ts`) or the service key directly (Edge Functions). Part of
CWA-7 Phase 0 (#209): once multi-tenancy lands, a service-role client will NOT
be constrained by per-org RLS policies, so every site below is a potential
cross-tenant leak vector and must be re-audited when `org_id` is added to the
tables it touches.

**Adding a new `createServiceClient()` call site? Add a row here in the same
PR, with the justification and the tenancy risk.**

## Phase 3 status (CWA-10 / #212)

`org_id` is now the database-enforced boundary for anon/authenticated roles
(see [`tenancy-model.md`](tenancy-model.md)) — but service-role clients
carry `BYPASSRLS`, so every site below needed its own per-site mitigation.
With this pass both tables are closed; storage is still open.

Every app-code site below now derives `org_id` from an anchor it has already
validated — the calendar subscription-token row, the HMAC-signed link's
group row, the family-invite row, the caller's own RLS-scoped profile, or
`app_request_org_id()` resolved through the cookie-bound request client —
and filters every subsequent service-role query on that value. The interim
default-org UUID constant is deleted from `lib/org.ts`.

`app_request_org_id()` is the anchor for the two anonymous entry points, the
join form and `app/join/family/[token]/page.tsx`. It returns a signed-in
caller's own org and ignores `x-two42-org`; only a genuinely anonymous
request resolves the header's slug, and only to a real `organizations` row.
It is the same value the `access_requests` RLS `WITH CHECK` evaluates, so
the two cannot drift. Both sites fail closed on both failure modes — an RPC
error and a NULL result (a slug matching no organization row) are each
logged, then the family-invite page redirects to `/join` and the join form
renders a "Join requests unavailable" notice instead of a form whose every
submission would die on a bare `42501`. Neither falls back to an org.
Since Phase 4b (CWA-48 / #314) that fail-closed resolution is the single
`resolveRequestOrgId()` in `lib/org.ts` — the RPC call, the NULL narrowing,
and the dual fail-closed logging live in one place. The public per-org route
`app/[orgSlug]/join` uses the same helper (with the URL slug overriding the
`x-two42-org` header on both the request and browser clients) and adds
**no** service-role client, so it needs no row in the tables below.

One lookup is deliberately unscoped: the initial `signup_token` read in
`app/api/auth/consume-token/route.ts` and `app/api/auth/verify-token/route.ts`,
where the token row is what resolves the org. Both fail closed if it yields
no row or a NULL `org_id`, and every subsequent operation is scoped to the
resolved row's `org_id`.

Two deliberate behaviour changes shipped with this pass:

- `feed.ics` gained the owner role re-check `events/[id]/ics` already had —
  a token whose owning profile is `pending` or deleted now returns `401`
  instead of a full event list.
- `family-invites/claim`: the scoped `profiles` update returning zero rows
  is now a real `500 Failed to link profile to family` instead of a silent
  success.

The two Edge Function sites were closed by the parallel edge-function
stream (Phase 3, #212 — see the table below).

What earlier phases already closed on this surface:

- `getServingLinkMode()` (`lib/serving/config.ts`) requires an `orgId` and
  filters `site_settings` on it (Phase 2) — the key-only read errored
  outright at two orgs. All four call sites derive the org from the
  validated group row. The last copy of the bug class, `resolveCanSign` in
  `supabase/functions/send-serving-reminders/index.ts`, was closed in
  Phase 3 (#212): it now takes an `orgId`, filters `site_settings` on it,
  and throws on query error instead of silently degrading links to unsigned.
- `app/api/serving/link-action/route.ts` derives `org_id` for its inserts
  from the HMAC-validated group row instead of the hardcoded default-org
  constant; the composite `(group_id, org_id)` FK enforces the pairing.
- The DB-layer analogue, `giving_stewards_can_manage()`, is org-scoped in
  the schema itself.

## App routes and pages (13 sites)

| File | Why service-role is used | Org derived from | Scoped queries |
|------|--------------------------|------------------|----------------|
| `app/serving/go/page.tsx` | Unauthenticated, HMAC-signed serving link; no session exists to satisfy RLS | HMAC-validated `member_groups` row; link rejected when `profiles.org_id` disagrees | `serving_team_settings`, `profile_groups`, `serving_signups`, `profiles` (spouse), `family_units` (label) |
| `app/serving/[groupId]/page.tsx` | Surfaces pending (never-logged-in) spouse profiles that RLS hides from the caller | Caller's own RLS-scoped profile | `profiles` (spouse lookup) |
| `app/join/family/[token]/page.tsx` | Signed family-invite link resolved before login; no session | `app_request_org_id()` via the cookie-bound request client (`x-two42-org` header for anonymous visitors, own org for signed-in ones); invite lookup filtered on it | `family_invites` |
| `app/api/serving/signups/route.ts` | Post-delete notification email lookups for affected members | The deleted signup row's own `org_id` (authorised by the RLS-checked delete) | `profile_groups` (leaders), `family_units` (label) |
| `app/api/serving/link-action/route.ts` | Same HMAC signed-link pattern as `serving/go`; no session | HMAC-validated `member_groups` row; link rejected when `profiles.org_id` disagrees | `serving_team_settings`, `profile_groups`, `serving_signups` (read/insert/delete), `serving_signup_attendees` (insert), `profiles` (spouse), `family_units` (label) |
| `app/api/serving/broadcast/route.ts` | Fans out email to all group members regardless of caller's RLS visibility | RLS-scoped `member_groups` row | `profile_groups` (recipients) |
| `app/api/calendar/feed.ics/route.ts` | Bearer-token calendar subscription; no session | `calendar_subscription_tokens` row (`org_id` stamped at issuance); owner role re-checked | `events`, `serving_signups`, `profiles` (owner), token expiry update |
| `app/api/auth/consume-token/route.ts` | Pre-login token flow; no session yet | The resolved `access_requests` row (`signup_token` is globally UNIQUE today — scoping is correctness-under-change) | `access_requests` update on `(id, org_id)` |
| `app/api/auth/verify-token/route.ts` | Pre-login token flow; no session yet | The `access_requests` token row itself (`org_id` selected and required non-null) | Token row is the anchor; `handle_new_user()` reads the same row |
| `app/api/feedback/route.ts` | Rate-limit count and admin email fan-out (RLS exposes feedback only to admins) | Caller's own RLS-scoped profile | `feedback` (count), `profiles` (admin recipients — was a latent cross-tenant email leak; a correctness-under-change risk, not a live one at single-org scale) |
| `app/api/household/link-member/route.ts` | Household manager updating another profile's `family_id` (RLS blocks cross-profile writes) | Caller's own RLS-scoped profile; target's org asserted equal | `profiles` update on `(id, org_id, family_id IS NULL)` |
| `app/api/events/[id]/ics/route.ts` | Bearer-token calendar subscription; no session | `calendar_subscription_tokens` row (`org_id` stamped at issuance) | `events` (404 on cross-org id), `profiles` (owner), token expiry update |
| `app/api/family-invites/claim/route.ts` | New user claiming an invite while their role is still `pending` | The `family_invites` row; caller's profile org must match (403 otherwise) | `profiles`, `family_members`, `family_invites` updates all on the invite's `org_id` |

## Lib helpers (1 site)

Unlike the rows above — inherited from Phase 2 with their mitigations still
outstanding — this site was introduced *during* Phase 3 with its mitigation
already shipped. The "once org_id lands" framing does not apply; the risk
column below describes what a regression would cost, not a pending work item.

| File | Why service-role is used | Tenancy risk | Mitigation |
|------|--------------------------|--------------|------------|
| `lib/email/identity.ts` | `resolveEmailBranding(orgId)` reads `organizations.branding` for callers that hold an explicit org id but no request-scoped session (e.g. `lib/serving/server.ts`, invoked from HMAC-signed link flows) | A missing filter would read another org's branding into its email | The `.eq("id", orgId)` filter is the only tenant boundary and is mandatory; the `orgId` is always derived from an already-authorized row (e.g. the validated group). Without an `orgId` the function uses the request-scoped client instead, so RLS applies — but note that resolves to the *request* org, which is host-independent until Phase 5, so any caller holding an authorized `org_id` must pass it. |

## Edge Functions (2 sites)

Both are cron-triggered with no session context and resolve the service key
from configured environment variables: a manual `SUPABASE_SECRET_KEY` override
(local/self-host only — the hosted platform reserves the prefix), then the
platform-injected `SUPABASE_SECRET_KEYS` map, then the legacy
`SUPABASE_SERVICE_ROLE_KEY` (see `resolveServiceKey()` in
`supabase/functions/_shared/service-key.ts`, shared by both), not
`createServiceClient()`.

| File | Why service-role is used | Historical tenancy risk | Mitigation |
|------|--------------------------|-------------------------|------------|
| `supabase/functions/send-event-reminders/index.ts` | Cron job; reads events/RSVPs and emails attendees with no user session | Reminder fan-out iterates all rows across orgs | **Implemented (Phase 3, #212):** iterates active orgs via `_shared/orgs.ts`, every query filtered on `org_id`, per-org failures isolated so one org cannot suppress another's send. **Branding (CWA-56, #322):** `organizations.branding` rides along on the already-org-anchored `listActiveOrgs()` select — no new service-role call site, no new unscoped query — and is validated by `_shared/branding.ts` (a mirror of `lib/branding.ts` + `lib/email/identity.ts`) before reaching any CSS or RFC 5322 sink |
| `supabase/functions/send-serving-reminders/index.ts` | Cron job; reads serving signups and emails assignees with no user session | Same as `send-event-reminders` | **Implemented (Phase 3, #212):** same per-org iteration and `org_id` filters; `resolveCanSign` org-scoped; `serving_broadcasts` audit rows stamped with the processed row's org, not a constant. **Branding (CWA-56, #322):** same `listActiveOrgs()` ride-along, validated by `_shared/branding.ts`. **Per-team isolation (CWA-50, #316):** a failing team is recorded in the run summary's `failedItems[]` keyed by `group_id` — ids, never org-defined team names, in operator diagnostics |
