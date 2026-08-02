# Service-Role Client Inventory

Every place the app bypasses RLS via `createServiceClient()` (defined in
`lib/supabase/server.ts`) or the service key directly (Edge Functions). Part of
CWA-7 Phase 0 (#209): once multi-tenancy lands, a service-role client will NOT
be constrained by per-org RLS policies, so every site below is a potential
cross-tenant leak vector and must be re-audited when `org_id` is added to the
tables it touches.

**Adding a new `createServiceClient()` call site? Add a row here in the same
PR, with the justification and the tenancy risk.**

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

Both are cron-triggered with no session context and resolve the service key
from configured environment variables: a manual `SUPABASE_SECRET_KEY` override
(local/self-host only — the hosted platform reserves the prefix), then the
platform-injected `SUPABASE_SECRET_KEYS` map, then the legacy
`SUPABASE_SERVICE_ROLE_KEY` (see `resolveServiceKey()` in each function), not
`createServiceClient()`.

| File | Why service-role is used | Tenancy risk once org_id lands | Mitigation |
|------|--------------------------|--------------------------------|------------|
| `supabase/functions/send-event-reminders/index.ts` | Cron job; reads events/RSVPs and emails attendees with no user session | Reminder fan-out iterates all rows across orgs | Iterate per-org (group reminder queries by `org_id`) so content never crosses orgs |
| `supabase/functions/send-serving-reminders/index.ts` | Cron job; reads serving signups and emails assignees with no user session | Same as `send-event-reminders` | Same as `send-event-reminders` |
