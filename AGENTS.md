# Agent Guidelines — pregnantBattery

## Project Overview

Client-side Android bugreport analyzer (`React 19` + `Vite` + `TypeScript` + `Bun`).

- Keep all bugreport parsing 100% browser-local with zero backend calls.
- Keep the parametric 3D wireframe & section-heatmap engine isolated in `src/chassis-engine/`.
- Keep 2-layer device profiles (`model -> brand -> generic`) isolated in `src/profiles/`.

## Versioning & CI Automation

- **Single source of truth**: `package.json` (`"version": "X.Y.Z-alpha"`), documented in `CHANGELOG.md`.
- **Hybrid `CHANGELOG.md` workflow**:
  - Add concise user-facing bullets under `## Unreleased` in `CHANGELOG.md` when implementing features or fixes (skip for pure `housekeep:` commits unless notable).
  - Do **not** manually create a versioned `## X.Y.Z-alpha` header for routine commits — GitHub Actions (`scripts/bump-version.ts`) automatically promotes `## Unreleased` to `## <NEW_VERSION> (YYYY-MM-DD)` when bumping `package.json` (or generates bullets from commits since the last release if `## Unreleased` is empty).
- **Linear per-commit versioning** — Do **not** manually increment `package.json` version for routine commits. GitHub Actions (`.github/workflows/deploy.yml`, running on `bun-version: canary` after `verify` passes) replays all commits chronologically since the last `package.json` `"version"` edit via `scripts/bump-version.ts`:
  - `upgrade:` -> increments major (`X+1`) and resets `Y.Z` to `0.0` (`(X+1).0.0-alpha`)
  - `feat:` / `huge:` -> increments minor (`Y+1`) and **preserves** `Z` (`X.(Y+1).Z-alpha`)
  - `fix:` / `ci:` -> increments patch (`Z+1`) (`X.Y.(Z+1)-alpha`)
  - `housekeep:` (replaces `chore` & `refac`), `housekeep(release):` / `chore(release):`, and commits containing `[skip bump]` -> no version bump
  - **Manual override safety**: Editing `"version"` directly in `package.json` in `HEAD` (or adding `[skip bump]`) causes CI to honor your version without re-incrementing.
- **CI runtime**: Both workflows use `bun-version: canary` because `bun lint` requires Bun canary/1.4.4+.
- Note: Do **not** remove `assets/bug_reports/` from `.gitignore`; local `.zip` bug reports are private test fixtures.

## Commit Format & Git Hooks

- **Pre-commit (`Bun >= 1.4.4`)**: `.githooks/pre-commit` automatically runs `bun fmt --staged` (formatting & re-staging) and `bun lint --staged --max-warnings=0` before every commit. (Run `bun run prepare` or `bun install` if hooks are not yet active.)
- **Commit messages**: Validated locally by `.githooks/commit-msg` and in CI by `.github/workflows/commitlint.yml`:
  - Allowed types: `upgrade`, `feat`, `huge`, `fix`, `ci`, `housekeep` (no `chore` or `refac`)
  - Syntax: `<type>(optional-scope): <short summary>` (e.g. `feat(profiles): add pixel 9a flush pill chassis`)

## Verification Commands

Always run before concluding changes:

- `bun fmt --check` (`bun run check:fmt`)
- `bun lint --max-warnings=0` (`bun run check:lint`)
- `bun test`
- `bun run build` (`tsc --noEmit && vite build`)
