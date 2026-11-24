---
id: T-013
title: Stop-date flow and free-trial mode
status: TESTING
milestone: MVP
ui: true
depends_on: [T-012]
completed:
fix_loops: 0
---

# T-013 Stop-date flow and free-trial mode

## Goal
Stop-date flow and free-trial mode. Planner refines this and writes Given/When/Then criteria before build.

## Acceptance criteria
- [ ] (Planner fills in)

## Plan (Planner)
Design: no separate Designer step. Follow docs/design-system.md (step count "Step 2 of 3", fieldset+legend for radios, labelled inputs, focusable error summary, role="alert"). READ node_modules/next/dist/docs (server actions, searchParams are Promises, redirect) first (apps/web/AGENTS.md). Wait for T-012 to be DONE before editing [id]/page.tsx (it imports reminder-actions.tsx).
Facts: T-006 already handles is_trial and trial_end_date (parseSubForm and the schema require trial_end_date when is_trial; blank stop_date = defaultStopDate(renewal, N)). Core desiredReminders: a trial gets stop_date reminders AND trial_end reminders (-7/-3/-1 each, no renewal reminder) = duplicate noise. next_renewal_date is required by the schema: for a trial define it as the first payment date = trial_end_date (the trial form sets next_renewal_date = trial_end_date; stop = trial end minus N days; both schema rules hold). sub-form.tsx is a client form posting to saveSub which redirects to the list. loadGuide reads GUIDE_FILES: no Wise guide yet (T-015). The detail page has ReminderActions (T-012) but NO "stop date passed" prompt (only daysLeftText label) so the prompt belongs in T-013.
Decisions (CEO): (1) CORE CHANGE accepted: in packages/core/src/reminders.ts, for a trial that has a valid stop_date anchor, SKIP the trial_end reminders (stop_date reminders are enough); keep trial_end reminders when there is no stop date. Update reminders.test.ts (T-008 tests that expect both sets must be changed and a new test added), and re-check sweep.ts and profile/subscriptions tests that rely on trial behaviour. (2) Trial default stop gap uses default_stop_days_before (D4). (3) Free-trial entry: /app/subscriptions/new?trial=1 + a link "Free trial? Start here" at the top of the new page (no client toggle). (4) Step flow is a server-rendered route /app/subscriptions/[id]/stop-flow?step=1|2|3|done (default 1; unknown value -> 1) with plain GET/POST forms (works without JS); only the actions are server actions. (5) Extend SubPatch (additive) with payment_method_type; verify the subscriptions column grants (T-002/000002: authenticated has full update on subscriptions, so ok).
Components:
- new/page.tsx (small edit): read searchParams.trial (async); trial=1 -> initial.is_trial=true + trialMode prop; toggle link.
- sub-form.tsx (additive, `trialMode?: boolean`): hides next_renewal_date and the is_trial checkbox; labels "Trial ends on" (trial_end_date) and "Price after the trial" (price); a hidden next_renewal_date input driven by trial_end_date; stop_date = defaultStopDate(trial_end, defaultStopDays) until the user edits it. Non-trial form unchanged.
- actions.ts (small): saveSub redirects to /app/subscriptions/{id}/stop-flow for a NEW save (id === null) and to the list for edits; the rebuild_failed path stays on the form as today.
- stop-flow/page.tsx (server; loadDetail + searchParams): Step 1 "Set your stop date": shows the current stop date and the renewal (or trial end) date; explains: the renewal date is when the merchant charges you, the stop date is the day you freeze or close the card, BEFORE the charge; a <form method="post"> with a date input posts to a server action wrapping extendStopDate (keeps rules: no past date, not after renewal; error in role="alert"); skip link "Keep {date}". Step 2 "Pick how you will stop payment": fieldset+legend radios wise | privacy | other_virtual | merchant with fixed text per method in stop-flow/methods.ts STOP_METHODS (Wise: create a card in Wise for this subscription or freeze it; Privacy: pause or close the card; other: freeze or close the card; merchant: cancel with the merchant); always show "Blocking a card does not cancel a subscription."; Wise guide link /guides/provider/wise ONLY if loadGuide("provider","wise") is non-null else plain text; saving the method patches payment_method_type (merchant -> none; never "managed"). Step 3 "Remind me to freeze it": previewReminders via core desiredReminders (pure, no DB write) with the profile tz/reminder_days/reminder_hour: list "Date at HH:00 (timezone), In-app + Email"; past reminders omitted by core; none -> "No reminders will be sent because the dates have passed."; say "These reminders are set." (they were created on save); link to /app/settings; bad tz -> RangeError caught, retry with UTC. Done screen: "View subscription", "Add another" (/app/subscriptions/new), trial copy when is_trial: "The trial ends on X. The first payment can start on X. Freeze or close the card a few days before." Archived/stopped/merchant-cancelled sub: "No reminders are active" + link back. Visible "Step N of 3".
- stop-flow/actions.ts: server actions for step 1 (extendStopDate wrapper) and step 2 (patch method) following the run() pattern with userIdFrom, isUuid, revalidatePath; redirect to the next step.
- [id]/page.tsx (additive): link "Open stop-date flow" in the Stop date actions section; a StopPassedCard when status is not stopped/cancelled/archived and stop_date < today (use deriveStatus/stopPassed): "Your stop date has passed. Did you freeze or close the card?" above the existing ReminderActions (anchor to it or render ReminderActions; do not copy the actions); hidden for stopped/archived subs.
- lib/stop-flow.ts (pure): previewReminders(sub, profile, now) -> {type, channel, local}[] (local via formatFireAt); stopPassed(sub, today). lib/subscriptions.ts: SubPatch += payment_method_type (+ patchSub column).
Edge cases: foreign/bad id -> notFound(); past stop date on a new save: the form already warns; step 1 extendStopDate fieldError shown; trial end in the past: stop date in the past, warning + "No reminders will be sent..."; trial with stop after trial end rejected by the schema; unknown step/method params fall back to defaults (no injection); rebuild_failed after save keeps the form with savedId (redirect only on ok).
Criteria:
1. New save -> lands on /app/subscriptions/{id}/stop-flow step 1 and reminders exist for the sub.
2. Edit save -> goes to the list (unchanged).
3. Step 1: a date after the renewal shows an error and the date is unchanged.
4. Step 1: a valid date updates stop_date and rebuilds reminders (extendStopDate rules).
5. Step 2: picking Wise shows the Wise text, sets payment_method_type=wise, and shows "Blocking a card does not cancel".
6. No Wise guide -> no link to /guides/provider/wise; guide exists -> link shown.
7. Step 3: listed dates equal desiredReminders output in the user's tz, channels "In-app, Email"; no DB write happens (fake SubDb write count = 0).
8. /new?trial=1: renewal input hidden; labels "Trial ends on" and "Price after the trial"; is_trial checkbox hidden/checked.
9. Trial with end date D and default N days saves is_trial=true, trial_end_date=D, next_renewal_date=D, stop_date = D - N.
10. Trial flow copy contains "The trial ends on X. The first payment can start on X. Freeze or close the card a few days before."
11. Sub with stop_date < today and not stopped: detail page shows the passed card with the T-012 mark-stopped and move-date actions.
12. Stopped or archived sub: no passed card.
13. JS off: steps 1-3 and done work through plain forms and links.
14. Core: a trial with a stop_date gets only stop_date reminders (no trial_end reminders); a trial without a stop date still gets trial_end reminders.
15. A11y: each step has one h1, labelled inputs, focus on the error summary, "Step 2 of 3", radio group fieldset+legend. typecheck, lint, format:check, test, build pass.
Tests (Vitest, no Docker): lib/stop-flow.test.ts (previewReminders normal/trial/past/bad tz/inactive; stopPassed boundary; every STOP_METHODS text contains "does not cancel" via a shared footer and payment maps to a valid enum; trial form mapping through parseSubForm with a FormData fixture); server action tests with a fake SubDb (extend and patch paths); core reminders tests updated/added; no page render tests (axe in T-025).
Reviewer: skip (no DB change).

## Design (Designer)
## Build notes (Builder)
Built. 336 tests, build ok. Core: trial with a valid stop-date anchor gets only stop_date reminders (new test 14b); trial without stop date still gets trial_end. Files: lib/stop-flow.ts (+test; STOP_METHODS lives here, not stop-flow/methods.ts), subscriptions.ts (SubPatch.payment_method_type), app/app/subscriptions/{actions.ts (new save -> stop-flow), new/page.tsx (?trial=1 + toggle link), sub-form.tsx (trialMode), [id]/page.tsx (flow link + passed card), [id]/stop-flow/{page,actions,error-summary}}. Errors travel as closed ?err= codes mapped to fixed text. Unverified: browser/JS-off/focus/dark mode, server-action redirects live, column grant, pgTAP. Step 3 says "These reminders are set" even if an earlier rebuild failed (already shown on the form). loadGuide fetches all guides per load.
## Test report (Tester)
## Review verdict (Reviewer)
<!-- VERDICT: PASS | NEEDS_FIXES -->

## Developer sign-off
- [ ] Approved on:
