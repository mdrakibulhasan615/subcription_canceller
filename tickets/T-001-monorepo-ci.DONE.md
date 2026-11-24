---
id: T-001
title: Monorepo, CI, lint, test setup
status: DONE
milestone: MVP
ui: false
depends_on: []
completed: 2026-11-24
fix_loops: 0
---

# T-001 Monorepo, CI, lint, test setup
✅ DONE 2026-11-24

## Goal
Create the pnpm monorepo (/apps/web Next.js, /packages/core, /supabase) with TypeScript strict, ESLint, Prettier, Vitest, and GitHub Actions CI. Set the test, build, and lint commands.

## Acceptance criteria
- [x] Given a fresh clone, when pnpm install runs, then it succeeds.
- [x] Given the repo, when pnpm typecheck, pnpm lint, pnpm test, and pnpm build run, then all pass.
- [x] Given /packages/core, when pps/web imports a function from it, then the build works and a Vitest test for that function passes.
- [x] Given a push to GitHub, when CI runs, then it runs typecheck, lint, test, and build.
- [x] Given the repo, then no secrets are committed and .env.example exists.
- [x] Brand name is one constant in a config file.

## Plan (Planner)
Layout: root package.json (packageManager pnpm, engines node >=20.9), pnpm-workspace.yaml, tsconfig.base.json (strict, noUncheckedIndexedAccess), flat eslint.config.mjs, Prettier, .editorconfig, .gitignore, .nvmrc, .env.example, .github/workflows/ci.yml.
- apps/web: Next.js App Router. Imports core. next.config.ts has transpilePackages.
- packages/core: TypeScript source, no build step. src/brand.ts (BRAND, one place only), src/hello.ts (pure fn), src/hello.test.ts.
- supabase/.gitkeep.
- Scope is neutral: `@app/*` (CEO decision, brand may change).
Scripts: typecheck (pnpm -r, tsc --noEmit), lint (eslint .), format:check, test (vitest run, root projects), build (web only). No Turbo.
CI: push + pull_request. Steps: install --frozen-lockfile, typecheck, lint, format:check, test, build. permissions contents: read. concurrency cancel-in-progress. No secrets.
Risks for Builder: check peer ranges of new majors (TypeScript 7, ESLint 10, Next 16) and pin newest working. Check pnpm 12 config keys and build-script allow-list. Run `git init`. Use cross-platform scripts only. Re-check versions with `npm view` before install.
Extra criteria: strict in every tsconfig. A deliberate type error makes typecheck fail (Tester checks once).
Open: no GitHub remote, so the CI run cannot be proven locally (asked at DEV_CHECKIN).

## Design (Designer)
## Build notes (Builder)
All scripts pass on Windows: install (376 pkgs), typecheck, lint, format:check, test (1), build. Scope @app/*. BRAND only in packages/core/src/brand.ts. git init done, nothing committed.
Deviations: TypeScript 6.0.3 (typescript-eslint needs <6.1). ESLint 9.39.5 (eslint-plugin-react needs <=9). Node >=22.12 (Vitest 5). @types/node 22. Vitest uses one root include glob (packages/*/src/**/*.test.ts). .prettierignore skips *.md, .claude, graphify-out.
Open: CI unproven (no GitHub remote). Not run: clean Linux frozen-lockfile install; deliberate type-error check.
## Test report (Tester)
PASS. All scripts exit 0. Deliberate type error fails typecheck. No secrets. Brand in one place. CI file read, not run (no remote). Vite config renamed to .mts by CEO to remove a warning. Reviewer skipped (infra, standing order).
## Review verdict (Reviewer)
<!-- VERDICT: PASS | NEEDS_FIXES -->

## Developer sign-off
- [x] Approved on: 2026-11-24 (CEO, standing order)
