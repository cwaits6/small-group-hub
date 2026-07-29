# Contributing to two42

Thanks for your interest — contributions are welcome. two42 is open source under **AGPL-3.0**.

## Before you start

- For anything non-trivial, **open an issue first** to discuss the approach.
- By contributing, you agree to the **Contributor License Agreement** ([CLA.md](./CLA.md)). A bot will ask you to sign it once, on your first pull request; PRs can't be merged until it's signed. The CLA lets the project be offered both under AGPL-3.0 and, where needed, under separate commercial terms — it does not take away your own rights to your contribution.

## Workflow

- **Conventional Commits.** Only `fix`, `feat`, `perf`, and breaking changes trigger a release. Use `chore:` / `docs:` / `ci:` for everything else.
- Keep pull requests focused and reviewable.
- Match the surrounding code — its naming, structure, and comment density.

## Database & migrations

- Migrations are timestamped SQL in `supabase/migrations/` and must stay **additive**.
- Never target the remote Supabase project directly; CI/CD owns remote schema state.
- Coordinate schema changes — only one in-flight branch should introduce migrations at a time.

## Design & UI

- Follow [`docs/design/DESIGN.md`](./docs/design/DESIGN.md): the wordmark, type, color, and the accessibility floor.
- Plain, functional copy — verb+noun labels, no salesy subtitles.

See also `AGENTS.md` and `CLAUDE.md` for repo conventions.
