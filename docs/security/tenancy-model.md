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
`org_id`. `organizations` (the tenant root, no `org_id`) is pinned by
primary key instead.

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
relations; the pgTAP FK suite proves this for the seven capability/entity
ones. The remaining eight are attribution columns whose parent is
`profiles` (`author_id`, `created_by`, `profile_id`, `leader_id`,
`sent_by`) — they use the same form, but no test exercises them and the
schema lint asserts compositeness rather than the SET NULL column list, so
dropping the column list on one of those would pass CI. FKs referencing
`auth.users` cannot
be composite (no `org_id` there) and `organization_members.profile_id` is
deliberately single-column (the membership org is independent of the
profile's pinned org — the Phase 4 platform-admin seam).

## Signup and provisioning contracts

`handle_new_user()` resolves a signup's org **only** from server-owned
rows: approved `access_requests` and unclaimed `family_invites` matching
the email. Zero matches → the signup raises (`TN001`); matches in more than
one org → raises (`TN002`). Server-set `raw_app_meta_data ->> 'org_id'` may
disambiguate within the matched set, never widen it; client-supplied
`raw_user_meta_data` is never consulted for org selection.

`provision_organization(name, slug, owner_email)` builds a complete org in
one transaction: the org row, the three functional groups
(`prayer_warriors` / `serving_team` / `leaders`), the prayer calendar plus
its `prayer_calendar_id` setting, the settings defaults, an empty about
page, and an **approved access request for the owner** — so self-serve
onboarding is org-first: provision, then create the auth user, and the
fail-closed trigger needs no special case. Phase 4 must NOT solve
onboarding by adding a fallback branch to `handle_new_user()`. An invalid
slug raises `TN003`.

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
not add a GRANT without a caller check.

## Enforcement in CI

`supabase/tests/schema_tenancy_lint.sql` asserts, each with a negative
probe:

1. every org-owned table has exactly one restrictive isolation policy
   referencing `org_id`;
2. no policy on an org-owned table has a bare `true` predicate;
3. every FK into an org-owned parent is composite on `org_id`;
4. every `SECURITY DEFINER` function reading an org-owned table references
   `org_id`;

plus the Phase 0/1 checks (RLS enabled, `org_id` present, NOT NULL, the
exact `app_current_org_id()` default). The only remaining allowlist is for
local-stack stray tables that exist in no migration; the two by-design
exemptions (`organizations`, `platform_admins`) are structural, not data.

## Known limits (accepted, tracked)

- An authenticated member of org A visiting org B's public page resolves to
  org A and sees nothing (fail-closed, not wrong-tenant). Revisited in
  Phase 5 (#214).
- Storage-bucket policies, signed tokens, and the service-role call sites:
  Phase 3 (#212). Group-level scoping of member-facing surfaces: split out
  ahead of Phase 4.
