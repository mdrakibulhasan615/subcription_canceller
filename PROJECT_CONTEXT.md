# PROJECT_CONTEXT
<!-- OWNER: The CEO only. Other agents READ this file. They never edit it. -->
<!-- Keep under ~150 lines. Compress old items. Code structure is NOT here: use graphify-out/GRAPH_REPORT.md. -->
<!-- Written in ASD-STE100. -->

## Goal
StopDate (code name) is a privacy-first subscription manager. The user adds a subscription and sets a stop date. The app reminds the user to freeze or close the card before that date. The app never links to a bank. It does not cancel subscriptions with the merchant. Full plan: `PLAN_OVERVIEW.md`.

## MVP
Mode A only (user-managed card). Epics E1 to E7 from the plan, with these changes:
- IN: auth, profile, subscription CRUD, stop-date and reminder engine (in-app + email), dashboard, CSV import, free-trial mode, 10 guides, Wise provider guide, Apple/Google store guides, landing + waitlist, analytics, card-interest question, data export, account delete, template legal pages, tests.
- Web push: last E3 ticket. May slip to POST_MVP.
- OUT (POST_MVP): "paste a list" import, Privacy and Capital One provider guides, guides 11 to 50, email forwarding, ICS, extension, managed cards, assisted cancel, billing, mobile apps, Malaysia.
- Never: bank linking, bill negotiation, budgeting.
- Exit: all MVP tickets DONE. 20 real users for 30 days (the developer recruits them). Metrics in plan section 17 measured.

## Stack & Constraints
- Stack: TypeScript, Next.js (App Router, PWA), Tailwind, shadcn/ui, Supabase (Auth, Postgres, RLS, Edge Functions, pg_cron), Zod, Vitest, Playwright, pgTAP, Resend (email), Umami (analytics), Sentry (free), Vercel (host), GitHub, pnpm monorepo.
- Layout: `/apps/web`, `/packages/core` (all business logic), `/supabase`.
- Constraints: free tiers only. Self-funded founder in Malaysia. Mobile first. WCAG AA. Plain language. Honest copy (plan section 4).

## Decisions (settled in grilling)
- D1: MVP scope is E1 to E7 plus free-trial mode.
- D2: Next.js PWA. Supabase backend. Vercel host. pnpm monorepo.
- D3: Global English. Currencies USD, MYR, EUR, GBP. Minor units. One total per currency. No conversion.
- D4: Default stop date is 3 days before renewal. User can change it (settings and per subscription).
- D5: Reminders at 7, 3, 1 days before stop date. Sent at 09:00 user local time (changeable). Stored as UTC fire_at. Recompute on timezone change.
- D6: Channels: in-app and email first. Web push last, may slip.
- D7: 10 cancel guides at MVP: Netflix, Spotify, YouTube Premium, Disney+, Amazon Prime, Adobe CC, Microsoft 365, ChatGPT Plus, Apple App Store, Google Play. Guides are data rows. Builder drafts from public help pages. Developer verifies. Each guide has source link, "last checked" date, "report a problem" button. Wise is the only provider guide.
- D8: Free MVP. Umami for analytics (final check in E6 ticket). Sentry free tier. Email alert to founder when a reminder reaches `failed`.
- D9: CSV import only.
- D10: Template privacy and terms pages in MVP. Legal review before public launch (post-MVP gate).
- D11: Brand name stays "StopDate" in one config constant until the developer picks a name.
- D12: Quality gate per ticket: typecheck, lint, unit tests, RLS tests (DB tickets) pass in CI. Playwright covers main flows only. axe on key screens.
- D13: Stop date passes: status becomes Stopped only after the user confirms (MVP).
- D14: Questions Q12, Q13, Q15 of the plan (visa, US company, Wise API) wait until POST_MVP step 4.

## Conventions
<!-- naming, folder layout, test command, build command, lint command -->
- Sweep: `pnpm sweep` (needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY). `pnpm typecheck` includes scripts/.
- Test: `pnpm test` (vitest run; globs: packages/*/src, apps/web, supabase/functions). Lint: `pnpm lint`. Also `pnpm typecheck`, `pnpm format:check`.
- Core API: dates are ISO strings; custom billing interval = days; no stored status (deriveStatus); render cancel_url trimmed.
- DB: profiles UPDATE is column-granted; T-004 adds reminder_hour (default 9) and adds it to the grant. No stored subscription status. Reminders: stop date -7/-3/-1 days, renewal -1 day.
- Design system: docs/design-system.md (tokens, status badges, a11y rules). All UI tickets follow it.
- Edge Functions do not import core (Deno extension rule). Handler is pure, tested with Vitest fakes. reminders.claimed_until is the lease. Delivery is at-least-once.
- UI tickets after T-020 skip the Designer: builder follows docs/design-system.md.
- Scope `@app/*`. Brand only in packages/core/src/brand.ts. Node >=22.12. Pins: TypeScript 6.0.x, ESLint 9.x (peer limits).
- Build: `pnpm build` (web only).

## Ticket Board
<!-- T-001 | title | STATUS | owner-agent | one-line note -->
Roadmap approved 2026-11-24. Ticket files T-001 to T-025 exist in `tickets/`. T-002 to T-025 are BACKLOG stubs. The Planner writes their criteria when each starts.
T-001 | Monorepo, CI, lint, test setup | DONE | - | CI unproven, no remote
T-002 | Supabase schema, RLS, RLS tests | DONE | - | pgTAP verified in CI (118 tests)
T-003 | Auth (ui) | DONE | - | live auth untested; needs Supabase project + Google + SMTP
T-004 | Profile and settings (ui) | DONE | - | 132 tests, CI DB verified; see T-012 note
T-005 | Core: money, dates, cost | DONE | - | 42 tests; zod 4.6.7
T-006 | Subscription CRUD (ui) | DONE | - | 181 tests; card guard whole-field only
T-007 | List, detail, checklist (ui) | DONE | - | minors fixed in fix batch
T-008 | Reminder generation (core) | DONE | - | 62 core tests
T-009 | Reminder sender + pg_cron | DONE | - | pgTAP verified in CI; do not enable prod cron before T-011
T-010 | Safety sweep | DONE | - | CI verified; needs GH secrets; T-011 must pass p_ref
T-011 | Email + in-app notices (ui) | DONE | - | CI verified; go-live checklist in supabase/README.md
T-012 | Reminder actions (ui) | BUILDING | builder | snooze = move stop date
T-013 | Stop-date flow + trial mode (ui) | PLANNED | - | core change: trial skips trial_end reminders when a stop date exists; after T-012 tested
T-014 | Guides core (ui) | DONE | - | CI verified; guides-data/index.ts needs one line per guide; run seed:guides before launch
T-015 | Wise + store guides (ui) | BACKLOG | - | dep T-014
T-016 | Guides content (10) | BACKLOG | - | dep T-014
T-017 | Dashboard (ui) | DONE | - | nav + brand link added
T-018 | CSV import (ui) | DONE | - | polish batch: name echo, copy, plural
T-019 | Onboarding (ui) | BACKLOG | - | dep T-013
T-020 | Landing + waitlist (ui) | DONE | - | Tailwind+shadcn base; 77 tests
T-021 | Analytics + card question (ui) | BACKLOG | - | dep T-019
T-022 | Sentry + legal pages (ui) | BUILDING | builder | placeholder contact email; template banner
T-023 | Export + account delete (ui) | PLANNED | - | after T-022; Reviewer required
T-024 | Web push (may slip) | BACKLOG | - | dep T-011
T-025 | E2E, axe, time tests | BACKLOG | - | dep all MVP

## Open Questions / Risks
- Standing order (developer, 2026-11-24): run T-001 to T-025 without check-ins. CEO approves. Reviewer only when needed (security, DB, scheduler, risky). Ask developer only if blocked.
- CI is live on GitHub (main): workflows CI and DB both green on first push (2026-11-24). Edge Function index.ts (Deno) is still untested.
- Dev actions later: GitHub secrets SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FOUNDER_ALERT_EMAIL for the sweep workflow.  Supabase project + Google OAuth client + custom SMTP (see README, T-003).  create a GitHub remote so CI can run.

## Deferred Recommendations
<!-- Reviewer recommendations the developer archived. -->

## Changelog (latest 10 only)
- 2026-11-24: Grilling done. Decisions D1 to D14 written.
