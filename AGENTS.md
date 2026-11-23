# Agent Guidelines — pregnantBattery

## Project Overview

Client-side Android bugreport analyzer (`React 19` + `Vite` + `TypeScript` + `Bun`).

- Keep all bugreport parsing 100% browser-local with zero backend calls.
- Keep the parametric 3D wireframe & section-heatmap engine isolated in `src/chassis-engine/`.
- Keep 2-layer device profiles (`model -> brand -> generic`) isolated in `src/profiles/`.

## Versioning & CI Automation

- **Single source of truth**: `package.json` (`"version": "X.Y.Z-alpha"`), documented in `CHANGELOG.md`.
- **Hybrid `CHANGELOG.md` workflow**:
  - Add concise user-facing bullets under `## Unreleased` in `CHANGELOG.md` when implementing features or fixes (skip for pure `chore:` / `refac:` housekeeping).
  - Do **not** manually create a versioned `## X.Y.Z-alpha` header for routine commits — GitHub Actions (`scripts/bump-version.ts`) automatically promotes `## Unreleased` to `## <NEW_VERSION> (YYYY-MM-DD)` when bumping `package.json` (or generates bullets from commits since the last release if `## Unreleased` is empty).
- **Do NOT manually increment `package.json` version** for routine commits — GitHub Actions (`.github/workflows/deploy.yml` running `scripts/bump-version.ts`) automatically bumps the version on push to `main` based on commit headers:
  - `fix:` / `ci:` -> increments patch (`X.Y.(Z+1)-alpha`)
  - `feat:` / `huge:` -> increments minor & resets patch (`X.(Y+1).0-alpha`)
  - `refac:` / `chore:` -> no version bump
  - Major (`X.0.0-alpha`) -> manual-only when explicitly requested by the maintainer
- Note: Do **not** remove `assets/bug_reports/` from `.gitignore`; local `.zip` bug reports are private test fixtures.

## Commit Format & Git Hooks

- **Pre-commit (`Bun >= 1.4.4`)**: `.githooks/pre-commit` automatically runs `bun fmt --staged` (formatting & re-staging) and `bun lint --staged --max-warnings=0` before every commit. (Run `bun run prepare` or `bun install` if hooks are not yet active.)
- **Commit messages**: Validated locally by `.githooks/commit-msg` and in CI by `.github/workflows/commitlint.yml`:
  - Allowed types: `fix`, `feat`, `ci`, `huge`, `refac`, `chore`
  - Syntax: `<type>(optional-scope): <short summary>` (e.g. `feat(profiles): add pixel 9a flush pill chassis`)

## Verification Commands

Always run before concluding changes:

- `bun fmt --check` (`bun run check:fmt`)
- `bun lint --max-warnings=0` (`bun run check:lint`)
- `bun test`
- `bun run build` (`tsc --noEmit && vite build`)
