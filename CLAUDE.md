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

## Git & PRs

- Conventional commits. Only `fix`, `feat`, `perf`, and breaking changes trigger a release. Use `ci:` / `ci(scope):` commits on `ci/` branches for CI/infra changes; `docs:` / `chore:` for other non-release changes.
- **Never merge a PR** — not even when CI is green or you're told to "merge it in". Open the PR (draft is fine) and stop; Cody reviews and merges personally.
- Do not include Claude/AI session links in PR titles or bodies.

## Local dev

- Multiple dev servers run in parallel worktrees. Pick a free port (`npm run dev -- -p <port>`) instead of assuming `:3000`.
- `npm install` may need real network access; sandboxed installs often fail DNS resolution in this repo (see `AGENTS.md`).

## UI conventions

- Plain, functional copy: verb+noun labels, no salesy subtitles or cute metaphors.
- The audience is 50–85 years old: large type, high contrast, generous touch targets.
- Assignment/roster UIs show current members by default with an explicit "add" mode — never render full toggle lists of every person.
- Base UI `Select` components must receive the `items` prop, or the trigger renders raw values.
