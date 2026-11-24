---
id: T-019
title: Onboarding (3 steps)
status: DONE
milestone: MVP
ui: true
depends_on: [T-013]
completed: 2026-11-25
fix_loops: 0
---

# T-019 Onboarding (3 steps)
✅ DONE 2026-11-25 (DB verified in CI on 44e3828: 12 pgTAP files, 210 tests)

## Goal
Onboarding (3 steps). Planner refines this and writes Given/When/Then criteria before build.

## Acceptance criteria
- [x] (Planner fills in)

## Plan (Planner)
Design: no separate Designer step. Follow docs/design-system.md (h1 per step, "Step n of 3", error summary role="alert", 44px targets, tokens). READ node_modules/next/dist/docs (server actions, redirect, searchParams are Promises) first (apps/web/AGENTS.md).
DECISIONS (CEO accepted): (1) a flag, not state-derived detection: migration 20261124000008_profile_onboarded_at.sql adds profiles.onboarded_at timestamptz (null), grant update (onboarded_at) to authenticated (same style as 000005), backfills existing rows with now(); add pgTAP cases to supabase/tests/database/profile_settings.test.sql (owner can update onboarded_at; another user cannot; no other grant widened). (2) STEP ORDER CHANGED from plan section 12 (no return plumbing needed): 1 currency + timezone, 2 reminder preferences, 3 add first subscription (finish goes into that subscription's /stop-flow via saveSub's existing redirect). (3) One-shot: onboarding is shown once; an abandoned onboarding is not shown again (settings stays the home for these options; "Finish setup" link only if cheap).
Components:
- apps/web/lib/auth-routes.ts (small edit): export ONBOARDING_PATH = "/app/onboarding" and pure postSignInPath(next, onboardedAt): string -> ONBOARDING_PATH when next === DEFAULT_AFTER_SIGN_IN ("/app") and onboardedAt == null; else next. safeNext unchanged (/app/onboarding already passes isAppPath; the target is a server constant, not user input).
- apps/web/app/auth/callback/route.ts: after exchangeCodeForSession take data.user.id; read profiles.onboarded_at via the server client; compute postSignInPath(safeNext(next), onboardedAt); if it returns onboarding run `update profiles set onboarded_at = now() where id = :id and onboarded_at is null` (one-shot); if the select/update fails fall back to next (never block sign-in). A deep link next other than /app skips onboarding.
- apps/web/app/app/onboarding/page.tsx (server; searchParams Promise {step?, err?}; unknown step -> 1; unknown err keys ignored via a whitelist; getProfile null -> same "settings could not be loaded" text as settings/page.tsx), actions.ts ("use server"): saveOnboardingStep(step: 1|2, formData) ending in redirect(): fields per step ONBOARDING_FIELDS = {1:["timezone","currency"], 2:["default_stop_days_before","reminder_days","reminder_hour","email_reminders"]}; user id from getClaims() (none -> redirect /sign-in); load the full profile via createDb(...).getProfile; build input with a pure buildStepInput(profile, fd, step) = {...profileAsInput, ...pick(parseSettingsForm(fd), fieldsForStep)}; call saveProfileSettings(db,id,input,new Date()) (validation, FIELD_MESSAGES and the reminder rebuild are reused, nothing duplicated); ok -> redirect `?step=next`; fieldErrors -> `?step=n&err=<comma list of keys>` (page shows only FIELD_MESSAGES[key] for whitelisted keys); server/rebuild_failed -> `?step=n&err=server` with MESSAGES text. Do not edit settings-form.tsx.
- apps/web/app/app/onboarding/tz-input.tsx (small client component): copy the timezone effect from settings-form.tsx (prefill from Intl when the saved tz is "UTC", datalist of zones).
- Flow: step 1 timezone + currency (select from CURRENCIES), buttons Continue and "Skip for now" (a plain link to ?step=2; skip never calls the action). Step 2 default stop days, reminder days, hour, email checkbox ("Send reminders by email"; in-app stays on); Continue -> ?step=3, Skip link -> ?step=3. Step 3: 44px links "Add subscription" (/app/subscriptions/new), "Free trial? Start here" (/app/subscriptions/new?trial=1), "Import CSV" (/app/import), and "Skip, go to dashboard" (/app). Each step: visible "Step n of 3", one h1, error summary role="alert" focused.
- apps/web/app/app/page.tsx: activation nudge when the number of NON-archived subscriptions is 1 or 2 (check whether DashboardView.total includes archived; use counted/non-archived): "You have {n} of 3 subscriptions. Most people have more. Add the rest so your totals and reminders are complete." + links Add subscription and Import CSV. Not shown for 0 or 3+. No tracking (T-021 measures activation). Do not edit layout.tsx.
Edge cases: invalid tz/currency redisplays the step with FIELD_MESSAGES and focuses the summary; session expiring mid-wizard: proxy redirects to sign-in with next=/app/onboarding... (safeNext allows it); returning user or deep-link next: no onboarding; callback select/update failure -> /app; double submit idempotent; revisiting /app/onboarding after onboarded is allowed and harmless; open redirect: postSignInPath only returns a constant or a safeNext result.
Criteria:
1. New user (onboarded_at null), next=/app: callback 303 to /app/onboarding and onboarded_at set.
2. onboarded_at set, next=/app: redirect /app.
3. onboarded_at null, next=/app/subscriptions/new: redirect to that path; onboarded_at unchanged.
4. next `//evil.com` or `/app\x`: postSignInPath(safeNext(next), null) = /app/onboarding, no external target.
5. Callback select fails: redirect /app, not /sign-in?error.
6. Step 1 Asia/Kuala_Lumpur + MYR saves those, other settings unchanged, redirect ?step=2.
7. Step 1 timezone Mars/Base: step 1 redisplayed with the timezone message; profile unchanged.
8. Step 2 days `7, 3, 1`, hour 8, email unchecked: saved, reminders rebuilt, email_reminders false.
9. Step 2 days `7;3`: reminder days error shown at step 2.
10. Skip on steps 1 and 2: profile unchanged, page moves on.
11. Step 3 links point to /app/subscriptions/new, /app/subscriptions/new?trial=1, /app/import; Skip goes to /app.
12. Adding from step 3 lands on that subscription's /stop-flow (existing behaviour).
13. Dashboard with 1 or 2 subscriptions shows the nudge with the count and an add link; 0 or 3+ no nudge.
14. Migration backfills existing profiles; pgTAP passes (owner can update onboarded_at; another user cannot; other grants unchanged).
15. A11y: labels on all controls, targets >= 44px, focus order correct, one h1 per step.
Tests (no Docker): postSignInPath table in apps/web/app/auth/auth-routes.test.ts (criteria 1-4); buildStepInput + saveOnboardingStep logic with a fake DbLike like lib/profile-settings.test.ts (6-10); callback with mocked createClient (1, 2, 3, 5); static-markup render of the page (11, 13, err whitelist). pgTAP in CI (DB workflow). Playwright and live auth in T-025.
Reviewer: skip unless the Tester flags the callback change (auth redirect: Tester must fuzz it).

## Design (Designer)
## Build notes (Builder)
## Test report (Tester)
PASS. 365 tests; callback fuzz (25 next variants, onboarded_at variants, error paths, race) found no bug: only same-origin 303s, flag updated once and only for exact /app, failed update never blocks sign-in nor loops; step isolation, err whitelist, nudge via counted verified; CI + DB green. Low notes: next=/app/onboarding with null flag also sets the flag (harmless); safeNext accepts /app/..//evil.com (browser-normalised same-origin 404, not a redirect; pre-existing T-003); deep link /app?x=1 skips onboarding by design. Not tested: live sign-in, browser, axe. Reviewer skipped (callback fuzz clean).
## Review verdict (Reviewer)
<!-- VERDICT: PASS | NEEDS_FIXES -->

## Developer sign-off
- [x] Approved on: 2026-11-25 (CEO, standing order)
