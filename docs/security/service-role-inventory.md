# Service-Role Client Inventory

Every place the app bypasses RLS via `createServiceClient()` (defined in
`lib/supabase/server.ts`) or the service key directly (Edge Functions). Part of
CWA-7 Phase 0 (#209): once multi-tenancy lands, a service-role client will NOT
be constrained by per-org RLS policies, so every site below is a potential
cross-tenant leak vector and must be re-audited when `org_id` is added to the
tables it touches.

**Adding a new `createServiceClient()` call site? Add a row here in the same
PR, with the justification and the tenancy risk.**

## Phase 3 status (CWA-10 / #212) — app code

Every app-code site below now derives `org_id` from a row or token it has
already validated — the calendar subscription-token row, the HMAC-signed
link's group row, the family-invite row, or the caller's own RLS-scoped
profile — and filters every subsequent service-role query on that value.
The interim default-org UUID constant is deleted from `lib/org.ts`; the
anon join form resolves its org server-side through the same
`app_request_org_id()` the `access_requests` RLS `WITH CHECK` evaluates,
so the two values can no longer drift.

Two deliberate behaviour changes shipped with this pass:

- `feed.ics` gained the owner role re-check `events/[id]/ics` already had —
  a token whose owning profile is `pending` or deleted now returns `401`
  instead of a full event list.
- `family-invites/claim`: the scoped `profiles` update returning zero rows
  is now a real `500 Failed to link profile to family` instead of a silent
  success.

The **Edge Functions rows below remain open** and are owned by the parallel
edge-function stream, including the duplicate default-org constant and the
key-only `resolveCanSign` read in
`supabase/functions/send-serving-reminders/index.ts`.

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
