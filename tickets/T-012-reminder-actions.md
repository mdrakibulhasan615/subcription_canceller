---
id: T-012
title: Snooze, extend, mark stopped, mark cancelled
status: TESTING
milestone: MVP
ui: true
depends_on: [T-007, T-011]
completed:
fix_loops: 0
---

# T-012 Snooze, extend, mark stopped, mark cancelled

## Goal
Snooze, extend, mark stopped, mark cancelled. Planner refines this and writes Given/When/Then criteria before build.

## Acceptance criteria
- [ ] (Planner fills in)

## Plan (Planner)
Design: no separate Designer step. Follow docs/design-system.md (min-h-11 targets, visible focus, no colour-only state, errors with icon + role="alert", status with role="status"/aria-live). READ node_modules/next/dist/docs (server actions, revalidatePath) first (apps/web/AGENTS.md).
Facts: authenticated has full CRUD on subscriptions (all columns, RLS own rows), so stop_confirmed_at and merchant_cancelled_at are already client-writable: by design, no migration needed. reminders: client can update only status (pending<->skipped) and read_at; rebuildReminders already skips pending reminders of stopped/cancelled/archived subs (core planReminders) and reopens/inserts on un-mark. audit_log has no client insert: SKIP audit for MVP (CEO decision; note in build notes). Pattern to copy: apps/web/lib/subscriptions.ts change(db,userId,now,write,rebuild), archiveSubscription/unarchiveSubscription, SubDb adapter, safeRebuild (UTC fallback); actions in app/app/subscriptions/actions.ts use run(id, fn). SubWrite comment says "Never stop_confirmed_at or merchant_cancelled_at (T-012)": use a NEW narrow method, not updateSub. Core schema.ts has stopDateWarnings and the refine stop_date <= next_renewal_date.
DECISIONS (CEO): "Snooze" = "Move my stop date" (extend stop_date later, <= next_renewal_date). No separate snooze column for MVP (a true snoozed_until needs a migration + planReminders change: POST_MVP). Moving the stop date makes planReminders produce new rows and skip obsolete pending ones, so no marker-less skipped row exists (avoids the T-004 reopen bug). A new stop date in the past is REJECTED ("That date has passed. Pick today or a later date."). Quick buttons "+1 day", "+3 days" next to a date input.
Add:
- apps/web/lib/sub-actions.ts (pure, injectable db; keep exports usable by T-013): markStopped, unmarkStopped, markMerchantCancelled, unmarkMerchantCancelled, extendStopDate. Export `change` from subscriptions.ts (additive) or re-implement ~10 lines.
- SubDb += patchSub(userId,id,patch: {stop_confirmed_at?: string|null; merchant_cancelled_at?: string|null; stop_date?: string}): Promise<boolean>; implement in createSubDb as .update(patch).match(mine).select("id"); touches no other column; false when no row matched. Add a stub to the fakes.
- apps/web/app/app/subscriptions/[id]/actions.ts ("use server", async function declarations only): markStoppedAction(id), unmarkStoppedAction(id), markCancelledAction(id), unmarkCancelledAction(id), extendStopAction(id, formData). Each: getClaims -> userIdFrom -> isUuid -> lib fn -> revalidatePath(`/app/subscriptions/${id}`), "/app/subscriptions" and "/app" layout -> ActionResult (reuse toActionResult/MESSAGES from form-utils; add a rebuild_failed text if missing).
- apps/web/app/app/subscriptions/[id]/reminder-actions.tsx ("use client"): buttons, confirm step, date input, result with role="status"/"alert"; copy the pattern of edit/row-actions.tsx (useTransition + ActionResult).
- Tests: apps/web/lib/sub-actions.test.ts (fake SubDb).
Change (additive only; a fix batch from the T-007/T-011 reviews may touch the same files: re-read them first):
- [id]/page.tsx: new <section> "Stop date actions" before "Cancel with the merchant" rendering <ReminderActions/>; replace ONLY the `// T-012` comment region + "Not marked yet" paragraph with the merchant control. No reordering.
- lib/notifications.ts: add subscription_id to the select and `subscriptionId` to Notification (additive). notifications/page.tsx: add a `View subscription` link (min-h-11) to /app/subscriptions/<id> in each card (do these two edits last). No quick actions duplicated in notifications.
Flow: tap -> server action -> getClaims/userId + uuid check -> getProfile -> patchSub under user JWT -> safeRebuild -> revalidatePath. Write first, then rebuild; rebuild failure -> "rebuild_failed" ("Saved, but reminders could not be updated. Try again."); the sweep (T-010) also repairs.
extendStopDate(db,userId,id,newDate,now): validate isIsoDate ("Enter a real date."); getSub (needs next_renewal_date); reject if next_renewal_date null or newDate > renewal ("Pick a date on or before the renewal date, <date>."); reject if newDate < today in profile tz; patchSub({stop_date}); safeRebuild.
Copy (plan section 4): mark-stopped button "I froze or closed my card". Confirm text: "This marks the subscription as stopped in StopDate. It does not cancel the subscription with the merchant. The merchant can still try to charge you if you did not cancel there. We stop sending reminders for it." Buttons "Yes, mark as stopped" / "Not yet". When marked: "Marked as stopped on <date>" + "Undo". Merchant control: "I cancelled with the merchant" (toggle button; states "Marked as cancelled with merchant on <date>" + "Undo"). Extend: label "New stop date", hint "Must be on or before your renewal date (<date>).", quick buttons disabled if the result > renewal date; success "Stop date moved to <date>. Reminders updated." Hide stop actions when archived; hide extend when stopped/cancelled (Undo still allowed). Show dates in the profile timezone.
Edge cases: not signed in / bad uuid / other user's row -> not_found (patchSub false). Mark stopped when already stopped: keep the original timestamp (no-op). Both stopped and cancelled allowed; status = cancelled (core precedence). Stop date null (legacy) on extend: allowed if renewal non-null. Trial subs follow core. Sent reminders never modified. D13: a passed stop date never sets stopped automatically; only the user button does.
Criteria:
1. Active sub with pending reminders: confirming "I froze or closed my card" sets stop_confirmed_at, badge Stopped, all pending reminders skipped; confirm text says it does not cancel the subscription.
2. Undo on a stopped sub: stop_confirmed_at null, status derived from dates, future reminders reopened/inserted.
3. "I cancelled with the merchant": merchant_cancelled_at set, badge "Cancelled with merchant", pending reminders skipped; Undo reverses both.
4. Renewal 2026-12-20, stop 2026-12-17, extend to 2026-12-19: stop_date 2026-12-19, new stop_date reminders (-7/-3/-1, future only), obsolete pending skipped, sent untouched.
5. Extend to 2026-12-21: field error naming the renewal date, nothing written.
6. Today 2026-11-25, extend to 2026-11-20: rejected, nothing written.
7. After a "+3 days" move, a later Settings save keeps reminders for the moved date (no skipped row reopened wrongly).
8. User B's id called by user A: not_found, no change.
9. Rebuild failure after the write: rebuild_failed with a retry message; the field is already saved.
10. In-app notification has a "View subscription" link (>= 44px) to /app/subscriptions/<id>; the detail page has all actions.
11. A11y: each button has a text name, result announced (role=status/alert), confirm is keyboard operable and returns focus.
Tests (Vitest, no Docker): lib/sub-actions.test.ts with a fake SubDb (patch columns, rebuild effects skip/reopen/insert, not_found, validation errors, rebuild_failed, idempotent mark); notifications.test.ts for subscriptionId; one app-level test that markStopped then rebuild yields skipIds for all pending. No pgTAP (no migration). Playwright/axe in T-025.
Reviewer: skip (no migration, no new grants).

CEO NOTE: rebuildReminders (apps/web/lib/profile-settings.ts) reopens status=skipped rows that match the desired set on every save. Do not model a user snooze/skip as status=skipped without a marker, or a later save undoes it. Prefer moving dates (snooze = new fire times via stop_date or a snoozed_until approach) or add a marker column in a new migration.
## Design (Designer)
## Build notes (Builder)
Built. 275/275 tests. Files: lib/sub-actions.ts (+test), subscriptions.ts (patchSub, SubPatch, export change), [id]/{actions.ts,reminder-actions.tsx,page.tsx additive}, notifications subscriptionId + View subscription link. Deviations: own rebuild_failed text in actions.ts ("Saved, but reminders could not be updated. Try again."); +1/+3 day buttons submit at once from the current stop date (or today if null/past), disabled past the renewal; archived subs hide the whole Stop date actions section (merchant control still shows); markStopped on an already-stopped sub is a no-op ok + rebuild; no audit log. Unverified: browser (focus return, Escape, role=status), patchSub vs real RLS, criterion 7 rests on existing rebuildReminders.
## Test report (Tester)
## Review verdict (Reviewer)
<!-- VERDICT: PASS | NEEDS_FIXES -->

## Developer sign-off
- [ ] Approved on:
