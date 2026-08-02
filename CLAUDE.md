# CLAUDE.md

Guidance for AI agents working in this repo — interactive Claude Code sessions and autonomous Archon workflow runs alike. See `AGENTS.md` for additional agent notes.

## Project

Next.js + Supabase app for a church small group, deployed on Vercel. Open source. Releases are automated with semantic-release on conventional commits.

## Database — hard rules

- **Never touch the remote Supabase project.** No `supabase db push`, no `supabase migration repair` without `--db-url` pointing at local, no direct remote connections. The CI/CD pipeline is the sole owner of remote schema state.
- **Never run `supabase db reset`.** It wipes local test data. To apply pending migrations locally:

  ```bash
  supabase migration up --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres
  ```

- The local Supabase stack (API `:54321`, Postgres `:54322`, Studio `:54323`) is a **single shared instance** used by every worktree and parallel agent session. Never stop, restart, or reset it.
- Migrations are timestamped SQL files in `supabase/migrations/`. Keep them additive. Only one in-flight branch should introduce migrations at a time; if your task needs a schema change and another open PR already adds migrations, flag it instead of racing.

### Multi-tenancy (`org_id`)

`org_id` is the enforced tenant boundary. `supabase/tests/schema_tenancy_lint.sql` hard-fails CI on each of these, so they are structural requirements for every migration, not style preferences:

- **Every new table gets `org_id uuid not null default public.app_current_org_id()`** — the DEFAULT is fail-closed: no authenticated principal resolves NULL, which violates NOT NULL rather than guessing a tenant.
- **Every org-owned table gets the restrictive isolation policy** (`as restrictive ... using (org_id = (select public.app_request_org_id()))`). The request-scoped helper is required — anonymous reads of public content resolve their org from the `x-two42-org` header, which `app_current_org_id()` cannot do; authenticated principals always resolve to their own org regardless of the header. It is the isolation floor; permissive policies compose on top as `ORG AND (arms)`, never `(ORG AND arm1) OR arm2`.
- **No bare `using (true)` / `with check (true)`** on an org-owned table.
- **Every FK into an org-owned parent is composite** — `(col, org_id) references parent(col, org_id)`. `on delete set null` must name the FK column explicitly, e.g. `on delete set null (calendar_id)`, or it will try to null `org_id` too.
- **Wrap helper calls in RLS policy expressions as `(select public.helper())`** so the planner evaluates them once per statement (InitPlan). This repo has regressed on it twice. The rule is about policy expressions — inside SECURITY DEFINER function bodies the bare call is fine.

Full rationale, the helper inventory, and the deviations register: [`docs/security/tenancy-model.md`](docs/security/tenancy-model.md).

### Testing

- pgTAP suites live in `supabase/tests/`. Run them locally through the shared stack's container — each file is wrapped in `begin;`/`rollback;` so it never persists anything:

  ```bash
  docker exec -i supabase_db_small-group-hub \
    psql -U postgres -d postgres -f - < supabase/tests/<file>.sql
  ```

- **Never run `supabase test db` locally.** It resets the database, which violates the shared-stack rules above. CI runs it in the `pgtap` job of `.github/workflows/supabase.yml` against an ephemeral, isolated Postgres.
- Regenerate DB types after schema changes with `npm run db:types` (read-only against the local stack); CI fails if `lib/supabase/database.types.ts` drifts from the migrations.
- Adding a `createServiceClient()` call site? Document it in `docs/security/service-role-inventory.md` in the same PR — every service-role query bypasses RLS and must be justified.

## Git & PRs

- Conventional commits. Only `fix`, `feat`, `perf`, and breaking changes trigger a release. Use `ci:` / `ci(scope):` commits on `ci/` branches for CI/infra changes; `docs:` / `chore:` for other non-release changes.
- **Merge a PR only when the maintainer explicitly and directly tells you to merge that specific PR** (e.g. "merge #123", "merge it in now"). Never infer or assume merge intent — green CI, "looks good", "ship it", an approved plan, or an implied next step do NOT authorize a merge. Default to opening the PR (draft is fine) and stopping. If it's at all ambiguous whether an instruction is an explicit merge directive, leave the PR open and ask.
- Do not include Claude/AI session links in PR titles or bodies.

## Local dev

- Multiple dev servers run in parallel worktrees. Pick a free port (`npm run dev -- -p <port>`) instead of assuming `:3000`.
- `npm install` may need real network access; sandboxed installs often fail DNS resolution in this repo (see `AGENTS.md`).

## UI conventions

- The brand and design system — wordmark, typography, and the canonical color palette (Clay / Marigold / Espresso / Warm Paper) — is specified in [`docs/design/DESIGN.md`](docs/design/DESIGN.md). Treat it as the source of truth; keep it and any theme tokens in sync.
- Plain, functional copy: verb+noun labels, no salesy subtitles or cute metaphors.
- The audience spans adults 18+ through members in their late 80s. Design for the oldest members — large type, high contrast, generous touch targets — without making the UI feel dated to younger ones.
- Assignment/roster UIs show current members by default with an explicit "add" mode — never render full toggle lists of every person.
- Base UI `Select` components must receive the `items` prop, or the trigger renders raw values.
- Per-org branding (`organizations.branding`) is admin-supplied free text reaching CSS and RFC 5322 headers. `HEX` and the control-character strip in `lib/branding.ts`, and `PLAIN_NAME` in `lib/email/identity.ts`, are the injection boundary — not style choices. Do not relax them to support richer names or color formats; add a new validated key instead.
