# Service-Role Client Inventory

Every place the app bypasses RLS via `createServiceClient()` (defined in
`lib/supabase/server.ts`) or the service key directly (Edge Functions). Part of
CWA-7 Phase 0 (#209): once multi-tenancy lands, a service-role client will NOT
be constrained by per-org RLS policies, so every site below is a potential
cross-tenant leak vector and must be re-audited when `org_id` is added to the
tables it touches.

**Adding a new `createServiceClient()` call site? Add a row here in the same
PR, with the justification and the tenancy risk.**

## Phase 2 status (CWA-9 / #211)

`org_id` is now the database-enforced boundary for anon/authenticated roles
(see [`tenancy-model.md`](tenancy-model.md)) — but service-role clients
carry `BYPASSRLS`, so **every site below remains a Phase 3 (#212) work
item**. What Phase 2 already closed on this surface:

- `getServingLinkMode()` (`lib/serving/config.ts`) now requires an `orgId`
  and filters `site_settings` on it — the key-only read errored outright at
  two orgs. All four call sites derive the org from the validated group row.
- `app/api/serving/link-action/route.ts` derives `org_id` for its inserts
  from the HMAC-validated group row instead of the hardcoded default-org
  constant; the composite `(group_id, org_id)` FK enforces the pairing.
- The DB-layer analogue, `giving_stewards_can_manage()`, is org-scoped in
  the schema itself.

Nothing else in the tables below changed; the per-site mitigations are the
Phase 3 checklist.

## App routes and pages (13 sites)

| File | Why service-role is used | Tenancy risk once org_id lands | Mitigation |
|------|--------------------------|--------------------------------|------------|
| `app/serving/go/page.tsx` | Unauthenticated, HMAC-signed serving link; no session exists to satisfy RLS | Token payload has no org context; queries would span orgs | Carry `org_id` in the signed token payload and filter every query on it |
| `app/serving/[groupId]/page.tsx` | Surfaces pending (never-logged-in) spouse profiles that RLS hides from the caller | Cross-org profile exposure if group/profile lookups aren't org-scoped | Add explicit `org_id` filter to profile/group queries |
| `app/join/family/[token]/page.tsx` | Signed family-invite link resolved before login; no session | Invite token could resolve into another org's family | Bind invites to `org_id` and validate it on resolution |
| `app/api/serving/signups/route.ts` | Post-delete notification email lookups for affected members | Email fan-out could address members of other orgs | Scope member lookups by the signup's `org_id` |
| `app/api/serving/link-action/route.ts` | Same HMAC signed-link pattern as `serving/go`; no session | Same as `serving/go` | Same as `serving/go` |
| `app/api/serving/broadcast/route.ts` | Fans out email to all group members regardless of caller's RLS visibility | Broadcast recipient list could cross org boundaries | Constrain recipient query to the group's `org_id` |
| `app/api/calendar/feed.ics/route.ts` | Bearer-token calendar subscription; no session | Feed could aggregate events across orgs | Bind subscription tokens to `org_id`; filter events on it |
| `app/api/auth/consume-token/route.ts` | Pre-login token flow; no session yet | Token consumption could touch another org's rows | Bind tokens to `org_id` at issuance; validate on consumption |
| `app/api/auth/verify-token/route.ts` | Pre-login token flow; no session yet | Same as `consume-token` | Same as `consume-token` |
| `app/api/feedback/route.ts` | Authenticated user reading their own submission count (RLS exposes feedback only to admins) | Low — count is filtered to the caller's own id | Keep the explicit `profile_id` filter; add `org_id` filter for defense in depth |
| `app/api/household/link-member/route.ts` | Household manager updating another profile's `family_id` (RLS blocks cross-profile writes) | Could link a profile from another org into the caller's household | Assert both profiles share the caller's `org_id` before writing |
| `app/api/events/[id]/ics/route.ts` | Bearer-token calendar subscription; no session | Event lookup by id could serve another org's event | Validate the token's `org_id` matches the event's |
| `app/api/family-invites/claim/route.ts` | New user claiming an invite while their role is still `pending` | Claim could attach the user to another org's family | Bind invites to `org_id`; stamp the claimer's membership accordingly |

## Edge Functions (2 sites)

Both are cron-triggered with no session context and use the `SUPABASE_SECRET_KEY`
env var directly (Deno pattern), not `createServiceClient()`.

| File | Why service-role is used | Tenancy risk once org_id lands | Mitigation |
|------|--------------------------|--------------------------------|------------|
| `supabase/functions/send-event-reminders/index.ts` | Cron job; reads events/RSVPs and emails attendees with no user session | Reminder fan-out iterates all rows across orgs | Iterate per-org (group reminder queries by `org_id`) so content never crosses orgs |
| `supabase/functions/send-serving-reminders/index.ts` | Cron job; reads serving signups and emails assignees with no user session | Same as `send-event-reminders` | Same as `send-event-reminders` |
