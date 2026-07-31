# Phase 2 — RLS rewrite, org-aware helpers, composite FKs, `provision_organization()`

Implementation plan for [#211](https://github.com/cwaits6/two42/issues/211) (CWA-9),
Phase 2 of the multi-tenancy rearchitecture (epic [#209](https://github.com/cwaits6/two42/issues/209)–[#214](https://github.com/cwaits6/two42/issues/214)).

**Status:** plan only. No migrations, no app code, no CI changes in this branch.

---

## 1. Where this phase sits

| Phase | Issue | Owns |
|---|---|---|
| 0 (done) | #209 | pgTAP tenancy harness (`schema_tenancy_lint`, `tenancy_leak_suite`), stub `organizations` / `organization_members` / `provision_organization()`, service-role inventory |
| 1 (in flight, `feature/cwa-8`) | #210 | Org spine: `organizations` + `platform_admins`, `org_id` on ~27 tables with `DEFAULT app_current_org_id()`, backfill to a fixed org-#1 UUID, re-scoped PKs/uniques, temporary legacy global uniques, org-leading indexes |
| **2 (this plan)** | **#211** | **Make `org_id` the enforced boundary: org-aware helpers, RLS rewrite, composite FKs, fail-closed `handle_new_user()`, real `provision_organization()`** |
| 3 | #212 | Service-role call sites, signed tokens, branding → DB, email, storage |
| 4 | #213 | Onboarding, platform admin, public routes, tenant-#2 gate |
| 5 | #214 | Custom domains, per-org email, private storage, billing |

**Hard dependency:** Phase 2 cannot start until Phase 1 is merged to `main`. The
repo rule is that only one in-flight branch introduces migrations at a time, and
every statement here assumes `org_id` already exists, is `NOT NULL`, and is
backfilled. Phase 2 opens with a verification gate (Task 0) rather than
assuming.

**Framing for a public repo.** Nothing described here is exploitable today.
There is exactly one org, orgs are never seeded (#221), and no second tenant
exists. What follows is a list of *single-tenant assumptions* that are correct
now and become wrong the moment a second org exists — which is precisely why
they get fixed *before* tenant #2 is admitted, behind a leak suite that proves
isolation first.

---

## 2. Objectives and gate

**Objective.** After Phase 2, cross-tenant isolation is a property of the
database, not of application discipline. A member of org A must not be able to
read, write, reference, or infer any row belonging to org B — through a table, a
view, a `SECURITY DEFINER` helper, a foreign key, or a signup.

**Gate (from #211).** The full cross-tenant leak suite is green against **two
seeded orgs**, and — see §9 — every assertion in it is *non-vacuous*: org B must
actually hold rows in every table the suite enumerates, or the suite fails.

**Non-goals for Phase 2.** Service-role call sites and signed tokens (Phase 3),
onboarding UX and platform-admin cross-org access (Phase 4), custom domains
(Phase 5), storage-bucket policies (Phase 3), and any change to *group*-level
scoping of member-facing surfaces beyond what org isolation requires (see §3.4).

---

## 3. Architecture decisions

### 3.1 Two org-resolution helpers, not one

`app_current_org_id()` is named in #211. It needs a sibling for the anonymous
public surface, because anon has no profile to resolve from.

```sql
-- Authoritative org of the calling principal. Derived only from server-owned
-- state (the caller's own profile row). Never from a claim, header, or GUC the
-- client can influence. NULL when there is no authenticated principal.
create or replace function public.app_current_org_id() returns uuid
  language sql stable security definer set search_path = ''
as $$
  select org_id from public.profiles where id = (select auth.uid());
$$;

-- Org this HTTP request is *about*. Prefers the authenticated principal, so a
-- logged-in user can never widen their own scope by sending a header. Falls
-- back to host/slug resolution only for anonymous callers, and only ever
-- selects among orgs' already-public content.
create or replace function public.app_request_org_id() returns uuid
  language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select public.app_current_org_id()),
    (select o.id from public.organizations o
      where o.slug = nullif(
        current_setting('request.headers', true)::json ->> 'x-two42-org', ''))
  );
$$;
```

Rules that make this safe, and that reviewers should check line by line:

- **`SECURITY DEFINER` + `search_path = ''`** — matches every existing helper in
  the schema; fully-qualified names only.
- **`STABLE`**, and **every call site wraps it as `(select public.app_…())`** so
  the planner hoists it into an InitPlan and evaluates it once per statement
  instead of once per row. This repo has already paid for that lesson twice
  (`20260710000001_fix_rls_initplan.sql`, `20260712000000_rls_helper_perf.sql`);
  keep the convention.
- **No recursion risk.** `app_current_org_id()` reads `profiles`, and RLS on
  `profiles` calls `app_current_org_id()` — but `SECURITY DEFINER` bypasses RLS
  on the inner read, exactly as `is_admin()` / `is_member()` already do. The
  `20260715000000_fix_profiles_update_recursion.sql` migration is the cautionary
  tale; the pgTAP suite gets an explicit "profiles SELECT does not recurse" test.
- **Fail-closed by construction.** NULL return ⇒ `org_id = NULL` ⇒ NULL ⇒ not
  TRUE ⇒ row filtered on read and rejected on write. There is no "no org means
  everything" branch anywhere.
- **`GRANT EXECUTE` to `anon, authenticated`** (policy expressions run as the
  invoking role). `REVOKE` is for `provision_organization()`, not these.
- **Deliberately no GUC override for authenticated users.** Any role can
  `set_config('app.current_org_id', …)`, so a GUC-first resolution order would
  hand every member a tenant switch. If Phase 3 needs a trusted override for
  service-role code paths, it must be gated on `auth.role() = 'service_role'`
  and added there, with its own test.

**Known edge case, documented not solved:** an authenticated member of org A who
visits org B's *public* marketing page gets org A's resolution and therefore
sees nothing. Acceptable at Phase 2 (there is one org); Phase 5 custom domains
revisits it.

### 3.2 Restrictive isolation policy as the enforcement floor

#211 frames the work as "rewrite ~94 policies from a small template set". The
plan does that — but the *enforcement* does not depend on all 94 rewrites being
individually correct. Each org-owned table gets **one `AS RESTRICTIVE` policy**:

```sql
create policy "org isolation" on public.<table>
  as restrictive for all to anon, authenticated
  using      (org_id = (select public.app_request_org_id()))
  with check (org_id = (select public.app_request_org_id()));
```

Postgres ANDs restrictive policies with the OR-combined permissive ones. So:

- Isolation holds even if a permissive policy forgets its org predicate.
- A policy added later — by a future feature, by an agent, by anyone — is
  isolated by default. This is the single highest-leverage line in the phase.
- `WITH CHECK` blocks writing a row tagged into another org and blocks
  re-tagging an existing row's `org_id`.
- The schema lint can then assert a *structural* invariant ("every org-owned
  table has exactly one restrictive isolation policy") instead of trying to
  prove 94 hand-written predicates.

The permissive policies are still rewritten from the templates in §4 — for the
arms that are semantically wrong at two orgs (the `profiles` directory arm, the
`USING (true)` blanket arms), for readability, and so the org predicate is
visible where a reader looks. The duplication is intentional and costs nothing:
the planner sees the same predicate either way.

`organizations` is the tenant root and has no `org_id`; its restrictive policy
uses `id = (select public.app_request_org_id())`.

**No platform-admin escape hatch in Phase 2.** Adding
`or public.is_platform_admin()` to the restrictive predicate would punch a hole
through the one invariant this phase exists to establish. Platform admins get
their cross-org path in Phase 4, deliberately and with its own tests.

### 3.3 Composite foreign keys

Today a child row can reference a parent by UUID with nothing forcing them into
the same tenant. Single-tenant, that is unobservable. Multi-tenant, it is how a
row ends up rendered under the wrong church. The fix is structural:

```sql
-- 1. parent needs a unique key to point at
alter table public.<parent> add constraint <parent>_id_org_unique unique (id, org_id);

-- 2. child references it compositely
alter table public.<child>
  add constraint <child>_<fk>_org_fkey
  foreign key (<fk>, org_id) references public.<parent> (id, org_id)
  on delete cascade;
```

For `ON DELETE SET NULL` relations the naïve form is *wrong*: Postgres would try
to null every referencing column, including `org_id`, which is `NOT NULL` — so
deleting a parent would fail at runtime. PG15's column-list form fixes it:

```sql
  on delete set null (<fk>)   -- nulls only the FK column; org_id survives
```

Local stack is PostgreSQL 17.6, so the syntax is available. **Pre-flight:
confirm the remote project is PG ≥ 15** (Supabase dashboard; do not connect).

**The 7 `ON DELETE SET NULL` cases** — the relations where the FK points at a
tenant-owned *entity* or carries a capability, as opposed to bare authorship
attribution:

| # | Child.column | → Parent | Why it matters at two orgs |
|---|---|---|---|
| 1 | `access_requests.invite_token` | `family_invites.token` | An invite must not resolve a signup into another org's household |
| 2 | `events.calendar_id` | `event_calendars.id` | An event filed under another org's calendar |
| 3 | `lectures.series_id` | `lecture_series.id` | A lecture filed under another org's series |
| 4 | `prayer_call_sessions.event_id` | `events.id` | A prayer call bound to another org's event |
| 5 | `profiles.family_id` | `family_units.id` | A person placed in another org's household — the worst of the seven |
| 6 | `serving_signups.family_id` | `family_units.id` | A serving slot attributed to another org's household |
| 7 | `giving_funds.co_steward_id` | `profiles.id` | Co-steward is a *capability*: it grants fund management |

Attribution columns (`created_by`, `updated_by`, `author_id`, `sent_by`,
`reviewed_by`, `approved_by`, `assigned_by`, `prayer_call_sessions.leader_id`,
`feedback.profile_id`) are lower risk — they render a name, they don't grant
access. They get composite FKs too **where the parent is `public.profiles`**,
in the same migration, because it is cheap. FKs that reference `auth.users`
cannot be composite (no `org_id` there) and are left alone.

`ON DELETE CASCADE` relations into org-owned parents (`profile_groups`,
`family_members`, `family_invites`, `rsvps`, `prayer_responses`,
`giving_fund_methods`, `serving_*`, `class_teachers`,
`calendar_subscription_tokens`, `events.series_id`) get plain composite FKs —
cascade needs no column list.

### 3.4 Scoping matrix — org vs group

#221 resolved that the org is the tenant/billing/branding container and all
member-facing surfaces are group-scoped. Those are two different axes and Phase
2 only owns one:

- **Org boundary (Phase 2):** every row, every policy, every helper, no
  exceptions. Enforced by §3.2.
- **Group scoping (not Phase 2):** whether the prayer wall shows one group's
  requests or the whole org's is a product change with schema implications
  (`prayer_requests` has no `group_id` today). It does not affect isolation, it
  is not in #211's checklist, and folding it in would make this phase
  unreviewable. **Recommendation: split it into its own issue** ahead of Phase 4.
  Phase 2 leaves member-facing surfaces org-scoped and says so explicitly.
- **Member directory** — #221 marked "default group-scoped (confirm during
  build)". Phase 2 fixes the *org* arm of the directory policy (see §4, T5);
  the group-scoping question rides with the item above.

### 3.5 The legacy-global-uniques collision

Phase 1 deliberately keeps temporary global uniques (`site_settings.key`,
`page_content.slug`, `about_page` singleton, `class_teachers.profile_id`) so the
current app's `onConflict` targets keep working, and plans to drop them in Phase
4. **Phase 2's own gate makes that impossible to defer.** `provision_organization()`
seeds settings defaults and an about page; the leak suite requires two seeded
orgs; a global unique on `site_settings.key` means the second org's seed fails.

Phase 2 therefore pulls that slice of Phase 4 forward (Task 9). It is small and
mechanical: drop the legacy uniques, and update the handful of app upserts to
target the org-scoped keys. Verify PostgREST's inferred conflict target after
the change — a payload that omits `org_id` relies on the column default, and
that interaction should be asserted, not assumed.

---

## 4. The RLS policy template set

Every policy is `<org predicate> AND <role predicate>`. The org predicate is
identical everywhere; only the role arm varies. `TO authenticated` unless noted.

```
ORG   ::=  org_id = (select public.app_request_org_id())
```

| ID | Template | Body | Applies to |
|---|---|---|---|
| **T0** | Isolation floor | `AS RESTRICTIVE FOR ALL TO anon, authenticated USING (ORG) WITH CHECK (ORG)` | every org-owned table, exactly once |
| **T1** | Member read | `FOR SELECT USING (ORG AND (select public.is_member()))` | `events`, `announcements`†, `family_units`, `family_members`, `family_invites`, `member_groups`, `profile_groups`, `class_teachers`, `about_page`, `site_settings`†, `giving_funds`, `giving_fund_methods`, `prayer_call_sessions`, `rsvps`, `serving_*` |
| **T2** | Admin write | `FOR INSERT/UPDATE/DELETE USING (ORG AND (select public.is_admin())) WITH CHECK (same)` | admin-managed tables (announcements, events, calendars, lectures, series, member_groups, profile_groups, prayer_call_sessions, family_units, access_requests, site_settings, serving_team_settings, page_content) |
| **T3** | Editor write | `… (ORG AND (select public.is_content_editor()))` | `page_content`, `about_page`, `class_teachers` |
| **T4** | Self-owned row | `… (ORG AND <owner_col> = (select auth.uid()))` | `rsvps`, `feedback`, `prayer_requests`, `prayer_responses`, `calendar_subscription_tokens`, own `profiles` row |
| **T5** | Household arm | `… (ORG AND family_id = (select public.current_family_id()) AND (select public.is_member()))` | `profiles`, `family_units`, `family_members`, `family_invites` |
| **T6** | Group-leader arm | `… (ORG AND public.is_group_leader(group_id))` | `serving_signups`, `serving_team_settings`, `serving_broadcasts` |
| **T7** | Directory arm | `… (ORG AND (select public.is_member()) AND is_unlisted = false AND role = any(array['member','content_editor','admin']))` | `profiles` SELECT — **the arm #211 calls the directory-view leak**: it is the one place where "any member" is the predicate, so without `ORG` it is org-blind by construction |
| **T8** | Anon public read | `TO anon, authenticated FOR SELECT USING (ORG AND <public flag>)` | `page_content`, `lectures`, `lecture_series`, `event_calendars`, `site_settings` (`is_public`, per #215) |
| **T9** | Anon insert | `TO anon, authenticated FOR INSERT WITH CHECK (ORG)` | `access_requests` (the "anyone can request access" path — now org-pinned) |

† `announcements` and `site_settings` have published/public arms that OR into
T1; they are written as `ORG AND (member OR published)`, never `ORG` omitted
from either side of the OR.

**Every `USING (true)` disappears.** Today five policies are blanket-true reads
(page content, lectures, series, calendars). Under T8 each becomes org-resolved,
which is what makes anon traffic tenant-aware instead of tenant-blind. The
schema lint gets a check that no policy on an org-owned table contains a bare
`true` predicate.

**Composition rule for multi-arm policies.** Existing policies OR several arms
together (`admin OR household OR self`). Rewrite as `ORG AND (arm1 OR arm2 OR
arm3)` — factored out front, once. Never `(ORG AND arm1) OR arm2`; that shape is
how an org predicate goes missing on one arm and nobody notices in review.

### 4.1 Org-scoping the argument-taking helpers

`SECURITY DEFINER` helpers that take an id argument look up rows with RLS
bypassed. Passing an id from another org is the obvious next move, so each one
gets its own org check rather than trusting the caller:

| Helper | Change |
|---|---|
| `is_group_leader(_group_id)` | join `member_groups` and require `org_id = (select public.app_current_org_id())` |
| `giving_can_manage_fund(_fund_id)` | require the fund's `org_id` matches |
| `get_profile_role(profile_id)` / `get_profile_email(profile_id)` | add org equality alongside the existing family check |
| `current_family_id()` | unchanged in shape; add org equality for defense in depth |
| `is_admin()` / `is_member()` / `is_content_editor()` / `is_household_manager()` / `is_prayer_warrior()` | inherently self-scoped (they read the caller's own row). Add the org predicate anyway so the pattern is uniform and greppable |
| `sync_prayer_access_for_group()` / `sync_prayer_access_for_profile()` | trigger functions that join `profile_groups` → `member_groups`; add org equality to the join so a cross-org group can never flip a prayer-access flag |

### 4.2 Bare-key reads that break at two orgs

Two call sites named in #211 read a settings row by key alone, with no org
filter. They are not "leaks that need hiding" — they are single-tenant
assumptions that **fail loudly** the moment a second org exists, and they are
already public in the issue:

- **`giving_stewards_can_manage()`** — a scalar subquery over `site_settings`
  filtered only on `key`. At two orgs it matches two rows and raises
  `more than one row returned by a subquery used as an expression` (SQLSTATE
  21000). Every giving policy that calls it fails with it. Fix: add
  `and org_id = (select public.app_current_org_id())`.
- **`getServingLinkMode`** (`lib/serving/config.ts`) — same shape in TypeScript,
  `.eq("key", …).maybeSingle()` on a service-role client, so it silently falls
  back to the env default instead of the tenant's setting. Fix: take `orgId` as
  a required parameter and filter on it; update all four call sites.

Then generalize: the schema lint gains a check that no `SECURITY DEFINER`
function in `public` reads an org-owned table without referencing `org_id`,
with an explicit allowlist for the few that legitimately don't. That is the
guard that catches the *next* one rather than this one.

The broader service-role surface is already inventoried in
`docs/security/service-role-inventory.md`, with a per-site mitigation, and is
owned by Phase 3 (#212). Phase 2 fixes only the two above, because they are
DB-layer and because they break the two-org gate outright.

---

## 5. `handle_new_user()` — fail-closed org resolution

Today the trigger inserts a `profiles` row with `role` derived from an approved
`access_requests` match on email. After Phase 1, `profiles.org_id` is `NOT NULL`
with `DEFAULT app_current_org_id()` — and inside this trigger there is no
authenticated principal yet, so the default resolves to NULL and *every signup
fails with a `NOT NULL` violation* unless the trigger sets `org_id` explicitly.
So this is not optional polish; it is on the critical path.

Resolution order (all from server-owned rows; `raw_user_meta_data` is
client-supplied at signup and is **never** consulted for org selection):

1. Approved `access_requests` rows matching `new.email` → collect distinct `org_id`.
2. Unclaimed `family_invites` rows matching `new.email` → collect distinct `org_id`.
3. Exactly one distinct org across 1–2 → use it; set `role := 'member'` per
   today's approval logic.
4. Zero → `raise exception 'signup rejected: no approved access request or invite for %', new.email using errcode = '...'`.
5. More than one → `raise exception 'signup ambiguous: % matches approved invitations in multiple organizations'`. With P1 org-pinned identity (#221) one login belongs to one org, so ambiguity is a real conflict, not a case to guess at.

A server-set `new.raw_app_meta_data ->> 'org_id'` may be used as a
**disambiguator only** (it must intersect the set from steps 1–2, never widen
it). `raw_app_meta_data` is not writable by the client; `raw_user_meta_data` is.
The distinction is the whole security argument, so it belongs in a code comment.

**Consequence for Phase 4 onboarding, stated here as a contract:** an org's
first owner has no access request, so self-serve signup must be *org-first* —
`provision_organization()` creates the org **and** an approved `access_requests`
row for the owner's email, and only then is the auth user created. With that
ordering, `handle_new_user()` needs no special case and stays fail-closed. Phase
4 must not "solve" this by adding a fallback branch to the trigger.

---

## 6. `provision_organization()`

Replaces the Phase 0 stub (`_name text, _owner_id uuid`), which exists only to
seed leak-suite fixtures. New shape:

```sql
create or replace function public.provision_organization(
  _name        text,
  _slug        text,
  _owner_email text
) returns uuid
language plpgsql security definer set search_path = ''
```

Single transaction; everything or nothing:

1. `organizations` row — `name`, `slug` (unique, validated `^[a-z0-9][a-z0-9-]{1,62}$`), `branding` jsonb default (`display_name`, `logo_url`, `accent` only — the tenant-overridable contract from #221 / `docs/design/DESIGN.md`), `status`.
2. **Three functional groups** in `member_groups`, keyed by the `functional_role` column Phase 1 introduces (partial unique on `(org_id, functional_role)`):
   - `prayer_warriors` — `grants_prayer_access = true`
   - `serving_team` — `is_serving_role = true`
   - `leaders` — group leadership / serving administration

   *Open item:* #210 says "3 functional groups" without naming them. These three
   are the set the current schema's behaviour flags actually require. **Confirm
   with the maintainer before implementing** — renaming a `functional_role` after
   the fact is a migration.
3. **Prayer calendar** — an `event_calendars` row, with its id written to
   `site_settings ('prayer_calendar_id')`. This is why the calendar is part of
   provisioning rather than onboarding: `lib/prayerCalls.ts` and `app/prayer`
   read that key and a missing value degrades the prayer surface.
4. **Settings defaults** — `giving_manage_mode = 'stewards'`, `serving_link_mode`
   from the deploy default, `giving_dashboard_tile`, and the notification /
   feedback keys from `20260716000001`. Enumerate them in one `insert … select
   from (values …)` so the list is auditable in one place.
5. **Empty `about_page`** row for the org.
6. **Approved `access_requests` row for `_owner_email`**, so the owner's
   subsequent signup resolves under §5. Returns the new `org_id`.

Authorization: keep the Phase 0 `revoke execute … from public, anon,
authenticated`. In Phase 2 the only callers are migrations, seeds, and pgTAP
(all run as `postgres`, which bypasses ACLs). Phase 4 adds the guarded
self-serve entry point. Note in the function comment that `SECURITY DEFINER` +
`search_path = ''` + `REVOKE` is the whole authorization story, and that adding
a `GRANT` without a caller check re-opens PostgREST RPC to it.

---

## 7. Task order

Migrations are additive and land in dependency order. Suggested prefix
`2026MMDD00000N_`; one logical concern per file.

| # | Task | Artifact | Depends on |
|---|---|---|---|
| **0** | **Verify Phase 1 landed.** `org_id` present, `NOT NULL`, backfilled, defaulted on all org-owned tables; `platform_admins` exists; `member_groups.functional_role` exists; legacy uniques present as documented; re-scoped PKs match #210. Confirm remote PG ≥ 15. **Stop and report if any assumption is false** — the rest of this plan is written against #210's spec, not against merged code | checklist, no commit | #210 merged |
| **1** | `app_current_org_id()` + `app_request_org_id()`, grants, comments | `…_org_helpers.sql` | 0 |
| **2** | Org-scope the existing helpers (§4.1), incl. `giving_stewards_can_manage()` and the two prayer-access trigger functions | `…_org_scope_helpers.sql` | 1 |
| **3** | Restrictive `"org isolation"` policy on every org-owned table + `organizations` | `…_org_isolation_restrictive.sql` | 1 |
| **4** | Permissive policy rewrite, **one migration per domain** so each is reviewable: people & households · content & pages · events & calendars · prayer · serving · giving · settings & access | 7 × `…_rls_<domain>.sql` | 3 |
| **5** | Views: `profiles_directory`, `families_directory`, `families_directory_full`, `prayer_wall` — confirm `security_invoker = true` on all four, add explicit org predicates, expose `org_id` where the leak suite needs to enumerate it | `…_org_scope_views.sql` | 4 |
| **6** | Parent `unique (id, org_id)` constraints (~15 tables) | `…_composite_fk_parent_uniques.sql` | 0 |
| **7** | Composite FKs — cascade set first, then the 7 `ON DELETE SET NULL (col)` cases (§3.3) | `…_composite_fks.sql` | 6 |
| **8** | `handle_new_user()` fail-closed rewrite (§5) | `…_handle_new_user_org.sql` | 1 |
| **9** | Drop legacy global uniques (§3.5) + app `onConflict` / upsert-payload updates | `…_drop_legacy_global_uniques.sql` + app edits | 4 |
| **10** | `provision_organization()` (§6); update the Phase 0 leak-suite fixture to the new signature | `…_provision_organization.sql` | 9 |
| **11** | App: `getServingLinkMode(supabase, orgId)` + 4 call sites; host → `x-two42-org` header wiring in `lib/supabase/server.ts` / middleware for anon public pages (T8/T9) | app edits | 1, 4 |
| **12** | pgTAP: leak-suite upgrade + new suites (§9) | `supabase/tests/*.sql` | 1–11 |
| **13** | Schema-lint upgrade: empty the allowlist, add the four structural checks (§9.4) | `supabase/tests/schema_tenancy_lint.sql` | 12 |
| **14** | `npm run db:types`; refresh `supabase/schema.sql` dump; update `docs/security/service-role-inventory.md` with what Phase 2 closed and what remains Phase 3; add `docs/security/tenancy-model.md` describing the invariant and the two helpers | docs + generated | 1–13 |

Tasks 6–7 are independent of 1–5 and can run in parallel if two people are on
it; everything else is a chain.

**Commit convention.** `feat(tenancy): …` per migration/task (this is
release-triggering, which is correct — it is a behaviour change). Task 14 is
`docs:` / `chore(db):`.

**PR shape.** One PR. It is large but atomic: a half-applied RLS rewrite is
worse than either end state. Order the commits as above so the diff reads in
dependency order.

---

## 8. Verification workflow (local)

Per `CLAUDE.md`, against the shared local stack — never `db reset`, never
`supabase test db` locally, never the remote project:

```bash
supabase migration up --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres

docker exec -i supabase_db_small-group-hub \
  psql -U postgres -d postgres -f - < supabase/tests/tenancy_leak_suite.sql
```

Every suite is `begin; … rollback;` so nothing persists. CI runs `supabase test
db` in the `pgtap` job against an ephemeral database, and fails if
`lib/supabase/database.types.ts` drifts.

Manual smoke pass before opening the PR, as org #1 on a free port
(`npm run dev -- -p <port>`): dashboard, directory, household edit, events +
RSVP, prayer wall, serving signup, giving, admin settings, anon public pages,
signup via an approved access request. **Phase 2's success condition at one org
is "nothing changed"** — any visible difference is a bug in the rewrite, not a
feature.

---

## 9. Test plan

### 9.1 The leak suite is currently vacuous — fix that first

`tenancy_leak_suite.sql` enumerates every `org_id`-bearing table and asserts a
member of org A reads zero rows scoped to org B. If org B has no rows, the
assertion passes trivially. Today that's honest (no production table carries
`org_id` yet). After Phase 2 it would be a green suite that proves nothing.

Add a **fixture-completeness assertion**: for each enumerated table, as
`postgres`, assert org B holds ≥ 1 row; fail the suite by name for any table
where it does not. Then build a `seed_org_fixture(org_id)` helper that populates
every org-owned table for a given org, so adding a table without adding fixture
data is a hard failure rather than a silent gap.

### 9.2 Read isolation

- Member of A reads 0 rows of B, per table (existing loop, now non-vacuous).
- Same for each of the four views.
- Anon with `x-two42-org: org-a` reads only org A public rows; with no header,
  reads nothing.
- Authenticated member of A sending `x-two42-org: org-b` still resolves to A
  (proves `app_request_org_id()` prefers the principal over the header).
- Admin of A is an admin *in A only* — `is_admin()` true, but no B row is
  reachable through any admin-armed policy.
- `profiles` SELECT does not recurse (regression guard for
  `20260715000000_fix_profiles_update_recursion.sql`).

### 9.3 Write isolation, FKs, helpers, signup, provisioning

- INSERT into A tagged `org_id = B` → rejected (restrictive `WITH CHECK`).
- UPDATE own row's `org_id` → A to B → rejected.
- UPDATE/DELETE targeting a B row by id → 0 rows affected.
- Child in A referencing a parent in B → FK violation, for each composite FK.
- **`ON DELETE SET NULL` column-list proof**, per each of the 7: delete the
  parent, assert the FK column is now NULL **and `org_id` is unchanged**. This
  is the assertion that fails loudly if someone "simplifies" the column list
  away.
- `giving_stewards_can_manage()` with both orgs holding a
  `giving_manage_mode` row: returns each org's own value and **does not raise**.
  A parameterized test over every settings-key read is better than one test.
- `handle_new_user()`: approved request in A → profile pinned to A; no request
  and no invite → raises; approved in both A and B → raises; `raw_user_meta_data`
  carrying a foreign `org_id` → ignored.
- `provision_organization()`: creates org + 3 functional groups + prayer
  calendar + `prayer_calendar_id` setting + settings defaults + about page +
  owner access request; duplicate slug → rejected; a partial failure rolls the
  whole thing back; **not executable by `anon` or `authenticated`**.

### 9.4 Schema lint — structural invariants

Upgrade `schema_tenancy_lint.sql` to assert, with the allowlist emptied:

1. Every org-owned table has **exactly one** `AS RESTRICTIVE` isolation policy
   referencing `org_id` (query `pg_policies`).
2. No policy on an org-owned table has a bare `true` `USING` / `WITH CHECK`.
3. Every FK whose parent table carries `org_id` is composite (`pg_constraint`
   `conkey`/`confkey` include the `org_id` attnum) — allowlisted exceptions must
   be named with a reason.
4. Every `SECURITY DEFINER` function in `public` that reads an org-owned table
   references `org_id`, with a named allowlist.

Keep the existing negative-probe pattern (inject a violating object, assert the
lint flags it) for each new check. That pattern is why the Phase 0 lint is
trustworthy; do not add a check without one.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Phase 1 ships differently from #210's spec | Task 0 is a hard gate; report and re-plan rather than adapting silently mid-implementation |
| A rewritten policy is subtly *narrower* → a member loses access at one org | Manual smoke pass (§8); per-domain migrations keep each diff reviewable; "nothing changed at one org" is the success condition |
| Per-row helper evaluation regresses query plans | `(select public.app_…())` wrapping everywhere; `EXPLAIN` the directory, prayer wall, and events list before/after; Phase 1's org-leading indexes are the intended access path |
| Composite FK creation blocks on large tables | Trivial at current volume; note `NOT VALID` + `VALIDATE CONSTRAINT` as the pattern if this recurs at scale |
| Legacy-unique drop (Task 9) breaks an app upsert | Covered by the smoke pass; verify PostgREST's inferred conflict target explicitly rather than assuming |
| Green-but-vacuous leak suite | §9.1 fixture-completeness assertion is a prerequisite, not a nice-to-have |
| Anon public pages break when host → org resolution is missing | Deliberately fail-closed (blank, not wrong-tenant); Task 11 ships the header wiring in the same PR |
| Migration collision with another in-flight branch | Repo rule: one migration-bearing branch at a time. Confirm none is open before starting |

---

## 11. Definition of done

- [ ] Every org-owned table carries a restrictive isolation policy; permissive policies rewritten from §4; no `USING (true)` remains on an org-owned table
- [ ] `app_current_org_id()` / `app_request_org_id()` shipped, `STABLE`, `SECURITY DEFINER`, `search_path = ''`, InitPlan-wrapped at every call site, fail-closed on NULL
- [ ] Every argument-taking `SECURITY DEFINER` helper is org-scoped; no settings read is keyed on `key` alone
- [ ] Composite FKs in place, including all 7 `ON DELETE SET NULL (col)` cases, each with a test proving `org_id` survives the parent delete
- [ ] `handle_new_user()` raises rather than guessing; `provision_organization()` builds a complete, usable org in one transaction and is not callable from PostgREST
- [ ] `schema_tenancy_lint.sql` allowlist is empty and the four structural checks are live, each with a negative probe
- [ ] **Full cross-tenant leak suite green against two seeded orgs, with non-vacuous fixtures** (the #211 gate)
- [ ] `lib/supabase/database.types.ts` and `supabase/schema.sql` regenerated; `docs/security/service-role-inventory.md` updated; `docs/security/tenancy-model.md` added
- [ ] One-org behaviour verified unchanged by manual smoke pass

---

## 12. Open items for the maintainer

1. **Names of the three functional groups** (§6.2) — `prayer_warriors`,
   `serving_team`, `leaders` proposed; confirm before implementing.
2. **Group-scoping of member-facing surfaces** (§3.4) — recommend splitting into
   its own issue rather than folding into Phase 2. Needs a `group_id` on
   `prayer_requests` and a product decision on the directory default.
3. **Legacy-unique drop pulled forward from Phase 4** (§3.5) — confirm, or
   accept a leak suite whose second org has no settings/content rows.
4. **Anon host → org header wiring in Phase 2** (Task 11) rather than Phase 4 —
   needed for the T8/T9 templates to be testable end to end.
5. **Remote PostgreSQL ≥ 15** — confirm from the dashboard; the column-list
   `ON DELETE SET NULL` form has no pre-15 equivalent that preserves `org_id`.
