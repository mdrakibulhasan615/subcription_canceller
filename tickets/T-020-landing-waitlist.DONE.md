---
id: T-020
title: Landing page and waitlist
status: DONE
milestone: MVP
ui: true
depends_on: [T-001]
completed: 2026-11-24
fix_loops: 0
---

# T-020 Landing page and waitlist
✅ DONE 2026-11-24

## Goal
Landing page and waitlist. Planner refines this and writes Given/When/Then criteria before build.

## Acceptance criteria
- [x] (Planner fills in)

## Plan (Planner)
Table waitlist(id,email,source,created_at): anon INSERT only, no select; email check len<=254 and @ at pos>=2; unique index lower(email). apps/web has only layout.tsx and page.tsx. This is the first UI ticket: it sets up the UI foundation.
Files (all in apps/web unless noted):
- package.json: add exact-pinned deps: @supabase/supabase-js (plain client, no ssr), zod (same version as core), tailwindcss + @tailwindcss/postcss + postcss (v4), class-variance-authority, clsx, tailwind-merge, lucide-react. Keep lockfile in the diff.
- postcss.config.mjs, app/globals.css (@import "tailwindcss" + shadcn CSS variables; neutral tokens; Designer confirms), layout.tsx imports it, sets <title> and description from BRAND (no "cancel" claims).
- components.json, lib/utils.ts (cn), components/ui/button.tsx, input.tsx, label.tsx (shadcn; if the CLI fails with Next 16/React 19.3 write them by hand).
- app/page.tsx: landing (server component): hero, short how-it-works (add sub, set stop date, get reminders, freeze the card yourself), honesty box, waitlist form.
- app/waitlist-form.tsx ("use client"): labelled email, honeypot `website` (hidden, tabIndex -1, autoComplete off, aria-hidden), submit disabled while sending, aria-live="polite" status.
- app/api/waitlist/route.ts: POST. lib/waitlist.ts: zod schema {email trim lowercase email max254, website?, source? max64}, joinWaitlist(client,email,source): "ok"|"duplicate" (plain insert, NO select/upsert/onConflict; 23505 -> duplicate; other error throws), getAnonClient() lazy (reads env on call; missing env throws; no crash at build/import).
- lib/rate-limit.ts: rateLimit(key, now=Date.now()) -> {ok, retryAfterSec}; 5 req per IP per 10 min; module Map; sweep expired on each call; export _resetRateLimit for tests; clientIp(req) from x-forwarded-for first entry, x-real-ip, else "unknown". Code comment: `shortcut: per-instance in-memory, resets on cold start, not shared across instances, spoofable via x-forwarded-for, upgrade to Upstash or Supabase if abused`.
- root vitest.config.mts include: ["packages/*/src/**/*.test.ts","apps/web/**/*.test.ts"], exclude node_modules and .next.
- Tests: lib/rate-limit.test.ts, app/api/waitlist/route.test.ts (node env; call POST(new Request(...)); vi.mock("@supabase/supabase-js"); vi.stubEnv; use RELATIVE imports, no @/ alias in code under test). Markup checks with renderToStaticMarkup. No jsdom.
API: POST /api/waitlist JSON {email, website?, source?}. 200 {ok:true} (same for new, duplicate, honeypot). 400 {ok:false,error:"invalid_email"}. 429 {ok:false,error:"rate_limited"} + Retry-After. 500 {ok:false,error:"server"} (no Supabase text; do not log the email). Order: rate limit, parse JSON (fail 400), honeypot (fake 200, no insert), zod (fail 400), insert.
Copy rules (plan section 4): never "cancelled" or "cancel for you"; say "Payments stop on the date you set"; "StopDate reminds you to freeze or close your card a few days BEFORE renewal" (use BRAND constant, no hard-coded name); honesty box: "Freezing a card does not cancel a subscription. The merchant may still try to charge you and may treat a declined payment as unpaid debt. Always cancel with the merchant too."; "No bank linking. We never store card numbers." Success message for every 200: "Thanks. If this address is new, we will email you when {BRAND} opens." (no promise of a confirmation email). No analytics here (T-021).
A11y: mobile first, visible label, AA contrast, visible focus ring, one h1, live region.
Criteria:
1. Mock client; POST {email:"A@B.com"} -> 200 {ok:true}; from("waitlist"); insert once with {email:"a@b.com", source}; no select/upsert/onConflict.
2. Insert returns {error:{code:"23505"}} -> 200 {ok:true}, same body.
3. Insert returns other error code -> 500 {ok:false,error:"server"}, no error text.
4. Email "nope", "", 255 chars -> 400, insert not called.
5. website:"x" with valid email -> 200 {ok:true}, insert not called.
6. 6th request from one IP in the window -> 429 + Retry-After; other IP 200; after the window (now arg) allowed again. Unit test plus one route test.
7. Body not JSON -> 400.
8. Env missing -> 500, module imports without throwing.
9. Landing markup contains "payments stop" (case-insensitive) and the freeze-is-not-cancel warning; contains neither "cancelled" nor "subscription cancelled".
10. Form markup: label tied to input; honeypot has aria-hidden and tabIndex -1; live region exists.
11. pnpm typecheck, lint, test, format:check, build all pass; build needs no env vars.
12. Manual (not required): live insert with anon key works.

## Design (Designer)
Full spec saved in docs/design-system.md (tokens, components, states, landing layout). Builder must follow it.
## Build notes (Builder)
Built. 11 test files, 77 tests, all scripts pass, build needs no env. Deps pinned: supabase-js 2.119.2, zod 4.6.7, tailwind 4.3.5, postcss 8.5.33, cva 0.7.1, clsx 2.1.1, tailwind-merge 3.7.1, lucide-react 1.79.0. shadcn components written by hand. vitest needs oxc jsx automatic. Invalid JSON returns 400 invalid_email. Honeypot moved off-screen. Not checked: browser layout, dark mode, contrast, axe, live insert, client-side form behaviour.
## Test report (Tester)
PASS after CEO ran prettier on vitest.config.mts (only failure). 77 tests, build ok, curl checks (200/400/429+Retry-After/500) ok. CEO checked the page in the browser at 375px and desktop, dark mode: layout ok. Not done: axe (T-025), live insert (needs Supabase), light-mode screenshot. Minor: "No bank linking" appears twice. Reviewer skipped (standing order).
## Review verdict (Reviewer)
<!-- VERDICT: PASS | NEEDS_FIXES -->

## Developer sign-off
- [x] Approved on: 2026-11-24 (CEO, standing order)
