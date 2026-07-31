# Member Import/Export + CMS (Rock RMS) Integration — Design

**Issue:** cwaits6/small-group-hub#289 (Linear CWA-40) · **Decision log:** #221
**Status:** Design only — no application code, no migrations, no schema changes in this branch.
**Date:** 2026-07-30

---

## 0. Hard constraints (these override everything below)

1. **CMS integration is optional, forever.** Any Rock RMS / church-management-software
   functionality sits behind an **org-level opt-in feature flag** and is **never a hard
   requirement** for anything.
2. **Import/export works fully standalone.** An org with no CMS, no integration flags, and
   no external credentials must be able to import a roster, export a roster, and run the
   full member lifecycle with zero degraded behavior.
3. **The member data model must not hard-depend on CMS fields.** No column exists solely
   because a CMS exists; every affordance is nullable, defaulted, and meaningful (or
   trivially absent) in a standalone org. No core foreign key points at integration state.
4. **Schema changes are deferred.** Section 6 is a *recommendation set*, written as SQL for
   precision only. Nothing in it is applied here. It belongs to a later, dedicated
   migrations branch, sequenced so it never races another in-flight migrations branch
   (`CLAUDE.md`), and landing **after** Phase 1 puts `org_id` on the member tables.

---

## 1. Scope

**In scope for this document**

- (a) Per-org member **import/export** wire formats (CSV + JSON) and the HTTP API surface.
- (b) The **minimal schema affordances** (nullable `external_ref` + `source`) that keep a
  later CMS sync additive — as recommendations, deferred.
- (c) How member data flows **group→church** and **church→group** inside one org under the
  P1 org-pinned identity model.
- (d) **Feature-flag strategy** and **phasing** relative to migration Phases 1–4.
- (e) A forward-looking, non-binding sketch of what a Rock RMS sync would look like.

**Not in scope**

- Building any of it. This is a plan.
- Multi-org identity / account linking (P2, deferred in #221).
- Billing, custom domains, per-org email (Phase 5).
- Non-member entities (events, giving, prayer). The per-org **offboarding** export in §5.2
  is the one place a full-tenant bundle is discussed, because #221 requires it before the
  second tenant; its detailed shape is a separate design.

---

## 2. Current state (what exists today)

Member data lives across five tables plus the org scaffold:

| Table | Role | Notes |
|---|---|---|
| `profiles` | The member record. ~40 columns: name, contact, address, birthdate parts, occupation, bio, `role` (`pending`/`member`/`content_editor`/`admin`), 9 `hide_*` privacy flags, `is_unlisted`, `is_prayer_warrior`, `email_announcements`, `family_id`, `setup_completed`. | 1:1 with `auth.users`. |
| `family_units` | Household: `family_name`, shared address, `phone_home`, `anniversary`, `photo_url`, `hide_address`, `hide_phone_home`. | |
| `family_members` | Non-login household members (children, spouses who never signed in): names, birthdate parts, `relationship`, `is_class_member`, `claimed_profile_id`. | Important: **not every person is a profile.** |
| `member_groups` | Groups within the org: name, description, `is_serving_role`, `grants_prayer_access`, display metadata. | Phase 1 adds `functional_role`. |
| `profile_groups` | Membership join: `(profile_id, group_id, is_leader)`. | Denormalized role flags on `profiles` are kept in sync by triggers. |
| `access_requests` | Invite/approval pipeline: email, `status`, `signup_token`, `token_expires_at`. | Existing bulk-invite path (`app/api/admin/invite-bulk/route.ts`) writes here. |
| `organizations`, `organization_members` | **Phase 0 scaffold only** (`20260730000000_tenancy_test_harness_scaffold.sql`) — enough to seed fixture orgs for the pgTAP leak suite. No `org_id` on real tables yet. | Phase 1 (#210) is the real spine. |

Two adjacent facts that shape this design:

- `app/api/admin/invite-bulk/route.ts` already takes a list of emails and creates approved
  `access_requests` + sends invites. Import must **not** duplicate that; it may optionally
  hand off to it.
- `app/api/members/[id]/vcard/route.ts` is the only existing "export" and reads from the
  privacy-applied `profiles_directory` view. That precedent — **export what the caller can
  actually see** — carries forward.

---

## 3. Design principles

1. **Org is the boundary.** Every import and export is scoped to exactly one org, derived
   from the caller's session — never from the payload. A file cannot name its own org.
2. **RLS is the enforcement, not the route.** Import/export ships with **no service-role
   client**. If a future async job needs one, it gets a row in
   `docs/security/service-role-inventory.md` in the same PR.
3. **Dry-run first.** Every import has a mandatory validate mode that reports exactly what
   would change. Nothing writes until the admin sees the diff.
4. **Never silently destroy.** Blank cells mean "not provided," not "clear this field."
5. **Members own their privacy.** Once `setup_completed = true`, an import (or a CMS sync)
   does not overwrite `hide_*`, `is_unlisted`, `email_announcements`, `bio`, or `avatar_url`
   without an explicit, separately-named opt-in.
6. **The format is the contract, not the schema.** The interchange format is versioned and
   decoupled from column names, so schema evolution doesn't break a church's spreadsheets
   and a CMS mapping doesn't leak into the core model.
7. **Church = controller, Two42 = processor** (#221). Export is a controller right and must
   be available without asking us. Uploaded files are parsed in memory and never persisted;
   only the run report is stored.

---

## 4. Canonical member interchange format v1

### 4.1 Entities

Three entities travel together, because a roster is meaningless without households and
group assignments:

- **member** — a person. May or may not have a login. Maps to `profiles` when
  `has_login = true` (or when an invite is later accepted), otherwise to `family_members`.
- **household** — maps to `family_units`. Derived from `household_key` in CSV; explicit in JSON.
- **group assignment** — maps to `profile_groups`. Groups are referenced **by name**, resolved
  within the org.

### 4.2 JSON shape (the canonical form; CSV is a projection of it)

```jsonc
{
  "format": "two42.members",
  "version": 1,
  "exported_at": "2026-07-30T14:02:11Z",
  "org": { "slug": "first-redeemer", "name": "First Redeemer" },  // metadata only; ignored on import
  "scope": "admin",                    // directory | admin | offboarding
  "counts": { "members": 128, "households": 61, "groups": 3 },
  "households": [
    {
      "key": "hh-0042",                // stable within this file
      "external_ref": null,            // opaque id in a source system, if any
      "name": "The Alvarez Family",
      "address_line1": "12 Poplar St", "address_line2": null,
      "city": "Cumming", "state": "GA", "postal_code": "30040",
      "phone_home": "+1-770-555-0113",
      "anniversary": "1998-06-20",
      "privacy": { "hide_address": false, "hide_phone_home": false }
    }
  ],
  "members": [
    {
      "external_ref": null,            // opaque id in the source system
      "source": "csv",                 // local | csv | json | rock | <system>
      "household_key": "hh-0042",
      "has_login": true,               // false => household member without an account
      "relationship": "self",          // self | spouse | child | other
      "first_name": "Maria", "preferred_name": "Mari", "last_name": "Alvarez",
      "email": "maria@example.org",
      "phone_mobile": "+1-770-555-0114", "phone_home": null, "phone_work": null,
      "birth": { "month": 4, "day": 9, "year": 1979 },
      "address": null,                 // null => inherit the household address
      "occupation": "Nurse", "employer": "Northside",
      "bio": null,
      "role": "member",                // pending | member | content_editor  (never "admin"; see §5.5)
      "is_unlisted": false,
      "email_announcements": true,
      "privacy": {
        "hide_email": false, "hide_phone_mobile": false, "hide_phone_home": false,
        "hide_phone_work": false, "hide_address": false, "hide_birthday": false,
        "hide_birth_year": true, "hide_anniversary": false, "hide_occupation": false
      },
      "groups": ["Incouragers"],
      "leads": [],
      "notes": null                    // free text, admin-only, never shown to members
    }
  ]
}
```

**Deliberately absent from the wire format:** `id` (internal UUIDs are not a church's
business and not stable across systems), `org_id` (derived from session), `avatar_url` /
`photo_url` (binary assets are out of scope for v1 — flagged in §11), `is_prayer_warrior`
(derived from group membership via `grants_prayer_access`), `family_id`, `created_at`.

### 4.3 CSV shape

One row per **member**. Households are implied by a shared `household_key`. Multi-valued
fields are `|`-separated. Header row required; column order irrelevant; unknown columns
reported as warnings, not errors. UTF-8, BOM tolerated.

```
external_ref,first_name,preferred_name,last_name,email,phone_mobile,phone_home,phone_work,
birth_month,birth_day,birth_year,relationship,has_login,role,
household_key,household_name,household_primary,address_line1,address_line2,city,state,postal_code,anniversary,
occupation,employer,is_unlisted,email_announcements,hidden_fields,groups,leads,notes
```

Notes on the CSV projection:

- `hidden_fields` collapses the nine `hide_*` booleans into one pipe-separated token list:
  `email|phone_mobile|phone_home|phone_work|address|birthday|birth_year|anniversary|occupation`.
  Nine boolean columns is a spreadsheet no church admin will edit correctly.
- Household-level fields (`household_name`, address, `anniversary`) are read from the row
  with `household_primary = true`; if no row is flagged, the first row for that key wins and
  the run reports a warning. Conflicting household values across rows are **warnings**, not
  silent last-write-wins.
- `has_login = false` → the person is created as a `family_members` row, not a profile. This
  is how children and non-signup spouses import correctly.
- Dates: `YYYY-MM-DD` for `anniversary`; birth as three integer columns so a
  year-unknown birthday (very common in church rosters) is representable.
- Phones are stored as given and normalized for **matching only** (digits, last 10).
- **Formula-injection guard on export:** any cell whose first character is `= + - @`, tab, or
  CR is prefixed with a single quote.

### 4.4 Versioning

`version` is an integer on the envelope; CSV declares it via an optional `#two42-members:1`
comment line or, absent that, is assumed v1. Importers accept `version <= current`. Adding
optional fields is a non-breaking change; removing or retyping one bumps the version. The
v1 reader is kept until no supported export produces v1.

### 4.5 Privacy, minors, and export scopes

Three scopes, each answering a different question:

| Scope | Who | Contents |
|---|---|---|
| `directory` | Any member (their own groups); group leaders (groups they lead) | Exactly what the `profiles_directory` / `families_directory` views expose to that caller. Privacy flags **applied** (hidden fields omitted), not exported as data. Minors excluded. Unlisted members excluded. |
| `admin` | Org admin | Full member records for the org, privacy flags exported **as data** so a round-trip preserves them. Minors included only with `include_minors=true`. |
| `offboarding` | Org owner / platform admin | Full per-org bundle (#221 requirement). JSON only. Superset of `admin` plus the non-member entities; separate design. |

Minors (#221: default-hide minors from non-household members; per-household visibility
controls): a member is treated as a minor if `birth_year` implies age < 18, or if
`relationship = 'child'` and no birth year is present (fail-safe). `include_minors=true`
requires org-admin role and is recorded in the audit row with the actor.

---

## 5. API surface

All routes live under `app/api/admin/members/…`, matching the existing admin-route
convention, and authenticate via the normal session client (`lib/supabase/server.ts`).

### 5.1 Export

```
GET /api/admin/members/export
      ?format=csv|json            (default csv)
      &scope=directory|admin      (default directory)
      &group=<group_id>           (repeatable; default all groups the caller may see)
      &include_minors=false
      &include_unlisted=false
      &include_households=true
```

- `200` streamed response, `Content-Disposition: attachment; filename="members-<org-slug>-<date>.csv"`,
  `Cache-Control: private, no-store` (the ICS `Cache-Control` incident, #217, is the lesson here).
- `403` if the requested scope exceeds the caller's role.
- `413` with `{ error, row_count, limit }` above the sync row cap (see §5.6) — the async-job
  path is deliberately deferred until a real org needs it.
- Export is **read-only and idempotent**; no audit row is required for `directory` scope, but
  `admin`/`offboarding` exports write a `member_export_runs` audit entry (actor, scope,
  filters, row count) because they are bulk-PII egress.

### 5.2 Offboarding export (#221)

```
GET /api/admin/org/export      → { format: "two42.org", version: 1, ... }
```

Full-tenant JSON bundle, owner/platform-admin only, always audited. Listed here so the
member format is designed as a *subset* of it rather than a parallel invention. Detailed
design (non-member entities, storage objects, restore runbook) is separate work, required
before the second tenant per #221.

### 5.3 Import

```
POST /api/admin/members/import
Content-Type: multipart/form-data   (file=<csv|json>, options=<json>)
              | application/json    ({ format, version, members, households, options })
Idempotency-Key: <uuid>             (required for mode=apply)
```

`options`:

```jsonc
{
  "mode": "validate",              // validate (default) | apply
  "match_on": ["external_ref", "email"],   // ordered; "name_birthdate" is opt-in
  "on_conflict": "update",         // update | skip | fail
  "create_households": true,
  "create_groups": false,          // if false, an unknown group name is a row error
  "assign_groups": true,
  "overwrite_privacy": false,      // see principle 5
  "allow_role_change": false,      // and never to "admin" regardless
  "invite": "none",                // none | invite  (hands off to the existing bulk-invite pipeline)
  "source_label": "csv",           // recorded on each touched record
  "null_semantics": "ignore"       // ignore | explicit (explicit honors the literal token __CLEAR__)
}
```

Response (`200`, both modes):

```jsonc
{
  "run_id": "…",
  "mode": "validate",
  "summary": { "rows": 128, "create": 12, "update": 96, "skip": 18, "error": 2,
               "households_create": 3, "group_assignments": 41, "invites_queued": 0 },
  "rows": [
    { "line": 7, "action": "update", "matched_by": "email", "member": "maria@example.org",
      "changes": { "phone_mobile": ["+1-770-555-0100", "+1-770-555-0114"] }, "warnings": [] },
    { "line": 9, "action": "error", "errors": [
      { "code": "AMBIGUOUS_MATCH", "field": "email", "message": "2 members share this email" } ] }
  ],
  "truncated": false
}
```

`mode=apply` runs in a single transaction per household group; a row error aborts only that
row unless `on_conflict=fail`. The same `Idempotency-Key` replays the stored report instead
of re-applying.

### 5.4 Matching and idempotency

Precedence, first match wins, **always scoped to the caller's org**:

1. `(external_system, external_ref)` when both present.
2. Normalized email (lowercased, trimmed) against `profiles.email`.
3. `first_name + last_name + full birthdate` — **only** if `match_on` includes
   `name_birthdate` and the match is unique.

If a rule matches more than one record → `AMBIGUOUS_MATCH` row error. The importer never
guesses, never fuzzy-matches names, and never matches across orgs (structurally impossible
once Phase 2 RLS lands, but asserted in code and in pgTAP regardless).

Non-matching rows are **created**. Created members with `has_login=true` and an email are
created as pending records; whether they get an invite is governed solely by `invite`.

### 5.5 Permissions

| Caller | Export `directory` | Export `admin` | Import |
|---|---|---|---|
| Member | own groups only | ✗ | ✗ |
| Group leader | groups they lead | ✗ | ✗ |
| Content editor | own groups | ✗ | ✗ |
| Org admin | ✓ | ✓ | ✓ |
| Platform admin | via org admin path only | ✓ | ✓ (audited as platform actor) |

Import can never set `role = 'admin'`. Elevating an admin is a deliberate, single-record,
in-app action — not a spreadsheet cell. `role` changes at all require `allow_role_change`.

### 5.6 Limits, safety, auditing

- Sync limits: **5 MB / 5,000 rows**. Above that → `413` (async path deferred).
- Rate limit: 5 `apply` runs per org per hour; 20 `validate` runs.
- Raw uploads are parsed in memory and **never persisted**. Only the run report is stored,
  with PII limited to the identifiers already in the DB, and purged after 90 days.
- CSV parsing uses a real parser (quoted fields, embedded newlines) — never `split(",")`.
- Every `apply` run writes `member_import_runs` (§6). Every export at `admin` scope writes
  `member_export_runs`. Both are org-scoped and admin-readable.

### 5.7 What import explicitly does not do

Delete members, deactivate members, merge duplicates, change `org_id`, send email unless
`invite=invite`, touch `auth.users`, or create admins. Deletion and merge are separate,
individually-confirmed flows — a bulk file is the wrong instrument for destructive ops.

---

## 6. Schema affordances — **recommendations only, deferred**

> **None of this is applied in this branch.** It is written as SQL for precision. It belongs
> to a dedicated migrations branch, opened when no other migrations branch is in flight
> (`CLAUDE.md`), and sequenced **after** Phase 1 lands `org_id` on `profiles`,
> `family_units`, `family_members`, and `member_groups` — the unique index below depends on it.

### 6.1 Recommended (inline, nullable)

```sql
-- SKETCH — do not apply from this branch.
alter table public.profiles
  add column source             text not null default 'local',
  add column external_system    text,          -- null => not from an external system
  add column external_ref       text,          -- opaque id in that system
  add column external_synced_at timestamptz;

alter table public.profiles
  add constraint profiles_source_check
  check (source in ('local', 'import', 'cms'));

create unique index profiles_external_ref_key
  on public.profiles (org_id, external_system, external_ref)
  where external_ref is not null;
```

The same four columns, equally optional, on `family_units`, `family_members`, and
`member_groups` — a CMS sync that can map people but not households or groups is not worth
building, and adding them all at once is one migration instead of three.

Why this shape:

- **Nullable + defaulted.** A standalone org never sets any of them; `source = 'local'` is
  the truthful default and requires no integration to be meaningful.
- **`external_system` is generic text, not an enum of CMS vendors.** Rock is one possible
  value (`'rock'`); so is `'csv:2026-fall-roster'`. Nothing in the schema names a vendor.
- **Partial unique index**, so unmatched records don't collide on `NULL`.
- **No FK to integration state.** Deleting every integration table leaves these columns as
  inert text.
- `external_synced_at` (not `last_synced_at`) is per-record, so a partial sync failure is
  visible per member rather than only per run.

### 6.2 Alternative considered: `external_identities` mapping table

```sql
-- Not recommended for the first migration.
create table public.external_identities (
  org_id      uuid not null,
  entity_type text not null,   -- 'profile' | 'family_unit' | 'member_group'
  entity_id   uuid not null,
  system      text not null,
  external_id text not null,
  synced_at   timestamptz,
  primary key (org_id, entity_type, entity_id, system)
);
```

More general (multiple systems per record, multiple refs per record, no columns added to
`profiles`), but it adds a join to every sync query and a second RLS surface for zero
benefit while exactly zero orgs have an integration. **Recommendation: ship §6.1 first;
promote to §6.2 the moment a second external system or a second ref-per-record appears.**
The promotion is a clean additive migration (backfill from the columns, then drop them),
which is precisely the "additive, not a rewrite" property #221 asks for.

### 6.3 Audit tables (also deferred)

```sql
create table public.member_import_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  actor_id uuid not null references public.profiles(id),
  mode text not null,                 -- 'validate' | 'apply'
  source_label text not null,         -- 'csv' | 'json' | 'rock' | …
  filename text,
  options jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  report  jsonb,                      -- capped; purged after 90 days
  idempotency_key text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index member_import_runs_idem_key
  on public.member_import_runs (org_id, idempotency_key)
  where idempotency_key is not null;
```

Plus a lighter `member_export_runs` for bulk-PII egress.

### 6.4 RLS and visibility requirements for the affordance columns

- `external_system` / `external_ref` / `external_synced_at` are **admin-only**. They must not
  be added to `profiles_directory`, `families_directory`, or `families_directory_full` — an
  external ref is an org-internal identifier and leaking it across the directory is a
  needless information disclosure.
- Phase 2's policy rewrite must cover the new columns (they inherit the table policies; the
  requirement is that the **views** are not widened).
- pgTAP additions: (i) external refs are not readable cross-org; (ii) the directory views
  do not expose them; (iii) the partial unique index does not collide across orgs.

---

## 7. Member data flow inside one org (P1 org-pinned identity)

Under P1 (#221): `profiles.org_id`, **one login per org**. The org (church) is the tenant;
groups are the member-facing surfaces. This makes the church↔group flow question mostly a
*permissions and assignment* question, not a data-movement one.

### 7.1 The invariant

**Members belong to the org. Groups are an attribute of that membership.** A member imported
by the church and a member added by a group leader are the same kind of record in the same
table with the same `org_id`; they differ only in `profile_groups` rows. Nothing "moves"
between church and group — the shape is a projection, not a transfer.

### 7.2 church → group

1. Church admin exports a roster from their CMS (or a spreadsheet).
2. `POST /api/admin/members/import` with `mode=validate`, reviews the diff, then `apply`.
3. Rows with a `groups` column land directly in the named groups; rows without land as
   **org members with no group assignment**.
4. Those unassigned members are visible in `/admin/members` and invisible on every
   member-facing surface (all of which are group-scoped per #221).
5. A group leader picks members up from an org-scoped "add member" picker — matching the
   existing convention: *current members by default, explicit "add" mode*, never a toggle
   list of every person in the church.

**Requirement this creates:** `/admin/members` needs an explicit "not in any group" filter,
otherwise imported-but-unassigned members become invisible inventory. Call this out in the
Phase 4 build.

### 7.3 group → church

1. A group leader exports their roster at `directory` scope (privacy applied) — the common
   case, e.g. handing the church office an updated Incouragers list.
2. An org admin exports at `admin` scope for the full-fidelity, round-trippable file.
3. The church loads that file into their CMS by hand, or (later, flag-gated) a Rock push
   does it.

No record changes owner. "Flowing to the church" is an export, because the church already
owns the record.

### 7.4 Cross-org movement is out of scope

Moving a member from org A to org B is **export from A + import to B**, producing a *new
identity* in B with a separate login. That is the honest consequence of P1 and should be
stated in the UI, not papered over. Multi-org identity / account linking is P2 (#221).

### 7.5 Household integrity

`household_key` resolves **within the org only**. An import can never attach a member to
another org's `family_unit` — structurally blocked by RLS after Phase 2, and asserted by an
explicit check in the importer and in pgTAP. This mirrors the known risk already logged for
`app/api/household/link-member/route.ts` in the service-role inventory.

### 7.6 Minors

Per #221: default-hide minors from non-household members, per-household visibility controls.
Import must set minors as `family_members` (no login) by default; promoting a minor to a
login-bearing profile is a deliberate in-app action. Export honors §4.5.

---

## 8. Feature flags and phasing

### 8.1 Flag storage

Recommend `organizations.features jsonb not null default '{}'::jsonb` — mirroring the
`organizations.branding` jsonb precedent set in #221 / `docs/design/DESIGN.md` — read through
a helper following Phase 2's conventions (STABLE, SECURITY DEFINER, `search_path = ''`,
wrapped `(select …)` so RLS initplans stay flat):

```sql
create or replace function public.org_feature_enabled(_key text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select (features #>> string_to_array(_key, '.'))::boolean
     from public.organizations where id = public.app_current_org_id()),
    false);
$$;
```

Default is **false** for anything absent — flags fail closed.

### 8.2 The flags

| Flag | Default | Who can flip | Meaning |
|---|---|---|---|
| `members.import_export` | off at ship → on by default after rollout | Platform admin during rollout | Core CSV/JSON import/export. A **rollout** gate, not a permanent one. |
| `integrations.cms` | **off, permanently, unless requested** | Platform admin only | Master org-level opt-in for *any* church-management-software integration. |
| `integrations.cms.rock` | off | Platform admin only | Rock RMS provider. Requires `integrations.cms`. |

Plus a **platform kill-switch**: env `CMS_INTEGRATION_ENABLED` (default `false`), evaluated
*before* the org flag. An org flag can never enable something the platform has disabled —
this is the one-line stop for a misbehaving integration across all tenants.

Org admins cannot self-enable `integrations.*`. A church asks; a platform admin turns it on
after reviewing the credential and data-processing implications (church = controller,
Two42 = processor).

### 8.3 Enforcement rules (non-negotiable, checked at review)

1. **No import from integrations in core.** Core import/export code must not import anything
   from `lib/integrations/**`. Enforce mechanically with an ESLint `no-restricted-imports`
   zone (or dependency-cruiser) so it fails in CI, not in review.
2. **All CMS code is quarantined** in `lib/integrations/cms/rock/**` and
   `app/api/admin/integrations/**`. With the flag off: routes return **404** (not 403 —
   don't advertise a feature the org hasn't bought), nav entries are absent, no cron is
   registered, and **no outbound request is ever made**.
3. **No CMS-driven NOT NULL.** No column on a member table may be `NOT NULL` because a CMS
   exists; no core FK may reference an integration table.
4. **CI runs with all integration flags off** as the default configuration. Add a dedicated
   *standalone org* test: an org with `features = '{}'` completes import → export → member
   lifecycle end to end.
5. **The deletability test.** Deleting the entire `lib/integrations/cms` tree must leave the
   app green. Make that a literal checklist item on the integration PR. If it fails, the
   quarantine has leaked and the maintainer directive has been violated.

### 8.4 Phasing against the migration plan

| Phase | Issue | What happens here |
|---|---|---|
| **Phase 1 — org spine** | #210 | **Nothing shipped for #289.** Only requirement: `org_id` lands on `profiles`, `family_units`, `family_members`, `member_groups`. The §6.1 affordance columns are a *follow-on* migration on their own branch, after Phase 1, never racing it. |
| **Phase 2 — RLS + composite FKs** | #211 | If §6.1 has landed, the rewritten policies must cover the new columns and the directory views must **not** expose them (§6.4). Add the three pgTAP assertions. |
| **Phase 3 — service role, tokens, branding** | #212 | Import/export is designed to need **no service role**. If an async export job appears, it gets a service-role-inventory row in the same PR. `organizations.features` lands naturally alongside `organizations.branding` here. |
| **Phase 4 — onboarding + platform admin + gate** | #213 | **Ship core import/export** behind `members.import_export`. This is also the natural home for the #221 per-org offboarding export, which is required before tenant #2. Requires the `/admin/members` "no group" filter (§7.2). |
| **Post-gate (Phase 5+)** | #214 | **Only after** the leak suite + IDOR suite are green in CI and the service-role inventory is reviewed line by line: Rock RMS **read-only pull** behind `integrations.cms.rock`, one pilot org, dry-run first. |

The ordering constraint that matters: **core import/export ships before any CMS work
starts**, and is proven to work standalone in a real org, so the integration is
demonstrably additive rather than load-bearing.

---

## 9. Rock RMS integration sketch (forward-looking, non-binding)

Everything in this section is gated by §8.2 and blocked until the Phase 4 hard gate passes.
Rock's API surface varies by version and by REST Key permissions — **verify against the
target church's Rock version before building.**

- **Auth.** Rock issues a REST Key (Admin Tools → Security → REST Keys); requests send it as
  an `Authorization-Token` header. Store the credential in a per-org `org_integrations` row
  with the secret in Supabase Vault — **never** in `organizations.features`, which org
  admins can read.
- **Endpoints.** `/api/People`, `/api/Groups`, `/api/GroupMembers?$expand=Person&$filter=GroupId eq N`,
  `/api/PhoneNumbers`, `/api/Campuses`. OData-style `$filter`, `$top`, `$skip`, `$select`,
  `$expand`, plus Rock's `loadAttributes=simple|expanded` for custom attributes.
- **Direction.** **Pull-only in v1.** Rock is the source of truth for legal name, contact
  info, and household composition. Two42 owns everything group-app-specific.
- **Field ownership** (the crux — write this table down before writing code):

  | Rock-owned (sync in) | Two42-owned (never overwritten) | Never synced |
  |---|---|---|
  | first/last/nick name, email, phones, address, birthdate, household composition, campus | privacy flags, `is_unlisted`, `email_announcements`, `bio`, `avatar_url`, group assignments, `is_prayer_warrior` | prayer requests, giving, serving signups, feedback |

- **Mechanics.** Incremental by `ModifiedDateTime` watermark; page size 100; exponential
  backoff; per-run report reusing `member_import_runs` with `source_label = 'rock'`; the
  first run for an org is **always** a dry run the admin must approve.
- **Conflicts.** For Two42-owned fields, a divergence is *reported*, never applied. For
  Rock-owned fields, Rock wins. Field-level, not record-level.
- **Deletion.** Rock `RecordStatus = Inactive` → mark inactive in Two42; **never hard-delete**.
  Disconnecting the integration nulls `external_ref` / `external_system` and leaves every
  member record intact and fully editable. This is the concrete test of "not a hard
  dependency."
- **Failure isolation.** Sync runs out-of-band (cron edge function, per-org try/catch per
  Phase 3 conventions). A Rock outage, a rotated key, or a 500 must never affect login,
  directory, or any member-facing surface.

Sources for the API details above:
[Rock REST API overview](https://community.rockrms.com/rx2018/subscription/using-the-rock-rest-api) ·
[REST filter syntax](https://community.rockrms.com/ask/developing/2144) ·
[loadAttributes / $expand behavior](https://github.com/SparkDevNetwork/Rock/issues/2429)

---

## 10. Testing requirements

- **pgTAP** — cross-org import rejection; household resolution stays in-org; directory views
  do not expose `external_ref`; partial unique index behaves per-org.
- **Route tests** — permission matrix (§5.5) for every role × scope; `validate` writes
  nothing; `apply` is idempotent under a repeated `Idempotency-Key`; blank cells never clear
  populated fields; role escalation to `admin` is impossible.
- **Format tests** — round-trip `admin` export → import → no-op diff. This is the single
  highest-value test in the suite.
- **Standalone test** — an org with `features = '{}'` completes the full lifecycle (§8.3.4).
- **CSV hardening** — quoted fields, embedded newlines/commas, BOM, CRLF, duplicate headers,
  formula-injection prefixes on export.

---

## 11. Open questions

1. **Avatars / household photos.** v1 excludes binary assets. Does the offboarding export
   (#221) need them? Probably yes — which argues for a JSON-plus-media-manifest bundle for
   `offboarding` scope only.
2. **Group-leader import.** Should a group leader be able to import into *their own group*
   (org-member creation still admin-only)? Convenient for a standalone single-group org
   (#221 supports selling to independent classes), but it widens PII write access. Leaning
   no for v1.
3. **`family_members` vs `profiles` on import.** `has_login` is the proposed discriminator.
   Worth confirming against how the household self-service flow actually behaves before build.
4. **Async export threshold.** 5,000 rows is a guess. Revisit with a real church-size roster
   before Phase 4.
5. **Retention of run reports.** 90 days proposed; confirm against whatever the DPA says
   when it is drafted.

## 12. Follow-up issues to file (not filed by this branch)

- Migrations branch: §6.1 affordance columns + §6.3 audit tables (after Phase 1).
- Phase 4 build: core import/export behind `members.import_export`.
- Phase 4 build: `/admin/members` "not in any group" filter (§7.2).
- `organizations.features` jsonb + `org_feature_enabled()` helper (alongside branding, Phase 3).
- Per-org offboarding export + restore runbook (#221 — required before tenant #2).
- Post-gate: Rock RMS read-only pull behind `integrations.cms.rock`.
