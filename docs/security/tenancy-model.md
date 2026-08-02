# Tenancy Model

Phase 2 of the multi-tenancy rearchitecture (CWA-9 /
[#211](https://github.com/cwaits6/two42/issues/211), epic #209–#214) made
`org_id` the **database-enforced** tenant boundary. This document describes
the invariant, the pieces that enforce it, and the contracts later phases
must not break.

## The invariant

> A member of org A cannot read, write, reference, or infer any row
> belonging to org B — through a table, a view, a `SECURITY DEFINER`
> helper, a foreign key, or a signup.

Isolation is a property of the schema, not of application discipline. It is
proven continuously by `supabase/tests/tenancy_leak_suite.sql` against two
fully-seeded orgs, with per-table fixture-completeness assertions so a green
run can never be vacuous.

## Org resolution — the two helpers

| Helper | Resolves | From |
|---|---|---|
| `app_current_org_id()` | the calling principal's org | the caller's own `profiles.org_id` — server-owned state only |
| `app_request_org_id()` | the org a request is *about* | the principal's org first; for anonymous callers only, the org whose `slug` matches the `x-two42-org` request header |

Rules that make these safe:

- Both are `STABLE`, `SECURITY DEFINER`, `set search_path = ''`. Every call
  site wraps them as `(select public.app_…())` so the planner evaluates
  them once per statement (InitPlan), not per row.
- **Fail-closed by construction.** No principal and no resolvable header ⇒
  NULL ⇒ `org_id = NULL` is not TRUE ⇒ rows filtered on read, rejected on
  write. There is no "no org means everything" branch anywhere.
- **A logged-in user can never widen their scope with the header** — the
  principal's org always wins. The header only ever selects among orgs'
  already-public content for anonymous visitors.
- **Deliberately no GUC override.** Any role can `set_config()` an
  arbitrary GUC; a trusted service-role override, if ever needed, belongs
  to Phase 3 and must be gated on `auth.role() = 'service_role'`.
- Every app Supabase client (server, browser, middleware) sends
  `x-two42-org` from `resolveOrgSlug()` in `lib/org.ts` — a trivial
  host-independent mapping until Phase 5 custom domains.

Also, `org_id` on every org-owned table is `NOT NULL DEFAULT
app_current_org_id()`: a write with no session and no explicit org violates
NOT NULL instead of landing in the wrong tenant.

## The restrictive isolation floor

Every org-owned table carries exactly one policy:

```sql
create policy "org isolation" on public.<table>
  as restrictive for all to anon, authenticated
  using      (org_id = (select public.app_request_org_id()))
  with check (org_id = (select public.app_request_org_id()));
```

Postgres ANDs restrictive policies with the OR-combined permissive ones, so
isolation holds even if a permissive policy — today's or a future one —
forgets its org predicate. `WITH CHECK` also blocks re-tagging a row's
`org_id`. `organizations` (the tenant root, no `org_id`) carries the same
restrictive floor with row visibility restricted by
`id = (select public.app_request_org_id())` — its own row *is* the org, so
the primary key stands in for `org_id`. Since Phase 3
(`20260801000002_org_branding_backfill.sql`) it also carries a permissive
SELECT policy, `"Org readable within request org"`, granted to `anon` and
`authenticated` and repeating the same predicate rather than a bare `true`.
Postgres RLS grants nothing without a permissive policy, so before that
migration the table was readable by no PostgREST caller in the seeded org at
all and the app silently served env-var branding. The older `"org members can
view their orgs"` policy is gated on `organization_members`, which
`handle_new_user()` has populated only since `20260731000014` and which was
never backfilled — it grants nothing to profiles predating that migration and
is retained as the hook for the Phase 4 membership model.

The permissive policies are additionally rewritten as
`ORG AND (role arms)` — org predicate factored out front exactly once — for
readability and per-org semantics. No `USING (true)` remains on any
org-owned table; the former blanket-public reads (page content, lectures,
series, calendars) are org-resolved anon reads now.

**There is deliberately no platform-admin escape hatch** in the restrictive
predicate. Platform admins get their cross-org path in Phase 4, with its
own tests. Service-role and `postgres` bypass RLS entirely (`BYPASSRLS`);
that surface is inventoried in
[`service-role-inventory.md`](service-role-inventory.md) and owned by
Phase 3.

## Composite foreign keys

Every FK whose parent is an org-owned table is composite:
`(fk_col, org_id) references parent (id, org_id)` — a child row can never
reference a parent in another org, structurally. `ON DELETE SET NULL`
relations use PG ≥ 15's column-list form `set null (<col>)` so `org_id`
(NOT NULL) survives the parent's deletion. There are fifteen such
relations; the pgTAP FK suite proves the runtime behavior for the seven
capability/entity ones, and the schema lint structurally asserts — for
every FK, current and future — that a `SET NULL` action on an
`org_id`-carrying FK names a column list excluding `org_id`, so dropping
the column list on any of them fails CI. FKs referencing `auth.users`
cannot be composite (no `org_id` there). `organization_members.profile_id`
is deliberately single-column, and is the composite-FK check's one named
exemption (`organization_members_profile_id_fkey` in
`schema_tenancy_lint.sql`): the membership org is intentionally independent
of the profile's pinned org — the seam the Phase 4 platform-admin
authorization contract builds on.

## Signup and provisioning contracts

`handle_new_user()` resolves a signup's org **only** from server-owned
rows: approved `access_requests` and unclaimed `family_invites` matching
the email. Zero matches → the signup raises (`TN001`); matches in more than
one org → raises (`TN002`). Server-set `raw_app_meta_data ->> 'org_id'` may
disambiguate within the matched set, never widen it; client-supplied
`raw_user_meta_data` is never consulted for org selection.

`provision_organization(name, slug, owner_email)` builds a complete org in
one transaction: the org row — its `branding` jsonb seeded with the full
tenant-overridable contract (`display_name`, `logo_url`, `accent`,
`reply_to`; see [`DESIGN.md`](../design/DESIGN.md)) — the prayer calendar plus its
`prayer_calendar_id` setting, the settings defaults, an empty about page,
and an **approved access request for the owner** — so self-serve
onboarding is org-first: provision, then create the auth user, and the
fail-closed trigger needs no special case. Phase 4 must NOT solve
onboarding by adding a fallback branch to `handle_new_user()`. An invalid
slug raises `TN003`.

Provisioning seeds **no groups**. Groups are org-defined: admins create
them in `/admin/groups` and designate capabilities per group
(`is_serving_role`) and leadership per membership
(`profile_groups.is_leader`). Nothing in the schema or app requires a group
to exist, so there is no platform-defined group name for a policy or
surface to depend on (`member_groups.functional_role` is dropped in
`20260801000000`).

Provisioning **never moves an existing profile between orgs**. If a profile
with the owner's email already belongs to a different org, the call raises
`TN004` and the whole transaction rolls back. An unscoped
`update profiles set org_id = … where email = …` would be a cross-tenant
write: once Phase 4 exposes a caller, passing a competing org's admin email
would re-pin that admin into the caller's org, taking over the account. A
"who may provision" authorization guard does not address that, so the
primitive itself is closed here.

EXECUTE is revoked from `public`/`anon`/`authenticated`; `SECURITY DEFINER`
+ `search_path = ''` + that REVOKE is the entire authorization story — do
not add a GRANT to any client-reachable role without a caller check. The one
explicit GRANT is to `service_role` (`20260801000002`), which restates a
Supabase default so the Phase 4 server-side caller does not depend on it;
`service_role` is never reachable from a client, so it does not re-open
PostgREST RPC.

## Enforcement in CI

`supabase/tests/schema_tenancy_lint.sql` asserts, each with a negative
probe:

1. every org-owned table has exactly one restrictive isolation policy
   referencing `org_id`;
2. no policy on an org-owned table has a bare `true` predicate;
3. every FK into an org-owned parent is composite on `org_id`;
4. every `ON DELETE SET NULL` on an `org_id`-carrying FK names a column
   list that excludes `org_id`;
5. every `SECURITY DEFINER` function reading an org-owned table references
   `org_id`;

plus the Phase 0/1 checks (RLS enabled, `org_id` present, NOT NULL, the
exact `app_current_org_id()` default). The only remaining allowlist is for
local-stack stray tables that exist in no migration; the two by-design
table exemptions (`organizations`, `platform_admins`) are structural, not
data, and the composite-FK check carries the one named FK exemption
documented above (`organization_members_profile_id_fkey` — the Phase 4
platform seam).

## Known limits (accepted, tracked)

- An authenticated member of org A visiting org B's public page resolves to
  org A and sees nothing (fail-closed, not wrong-tenant). Revisited in
  Phase 5 (#214).
- Storage-bucket policies, signed tokens, and the service-role call sites:
  Phase 3 (#212). Group-level scoping of member-facing surfaces: split out
  ahead of Phase 4.
- The permissive `organizations` SELECT policy is written whole-row, but the
  column privileges beneath it are not: `20260801000002` revokes the
  table-level grant and re-grants `select (id, name, slug, branding)` to `anon`
  and `authenticated`. Neither role can select `status`, `created_at`, or any
  column a later phase adds — `ADD COLUMN` grants nothing, so a new column is
  unreadable until someone lists it there on purpose. An anonymous caller who
  resolves the org via `x-two42-org` reads exactly those four columns.
  Remaining gap: `branding` is a single jsonb value, so `reply_to` rides along
  with the three keys the app shell needs; column privileges cannot reach
  inside jsonb, and excluding it needs a SECURITY DEFINER projection.
  Accepted: the slug is already public by construction (it *is* the header
  value), and `reply_to` is an address the org publishes on every outbound
  email.
