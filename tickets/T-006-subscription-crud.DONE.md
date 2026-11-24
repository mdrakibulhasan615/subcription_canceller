---
id: T-006
title: Subscription add, edit, archive, delete
status: DONE
milestone: MVP
ui: true
depends_on: [T-002, T-004, T-005]
completed: 2026-11-25
fix_loops: 0
---

# T-006 Subscription add, edit, archive, delete
✅ DONE 2026-11-25

## Goal
Subscription add, edit, archive, delete. Planner refines this and writes Given/When/Then criteria before build.

## Acceptance criteria
- [x] (Planner fills in)

## Plan (Planner)
Design: no separate Designer step. Follow docs/design-system.md (h-11 inputs, visible labels, error text with CircleAlert icon, one primary button per view, destructive delete, spinner on Save, aria-live status, focusable error summary). READ node_modules/next/dist/docs (redirect, notFound, async params `params: Promise<{id}>`, server actions) first (apps/web/AGENTS.md).
Facts: subscriptions has full owner CRUD under RLS; archived_at and card_nickname exist. Zod is stricter than DB (name 100 vs 200; next_renewal_date required). apps/web/lib/profile-settings.ts already has DbLike, rebuildReminders(db,userId,profile,now), createDb(sb), SubRow: rebuildReminders lists ALL subs + reminders and applies only the diff, so it works after any single-sub change. Copy the pattern of app/app/settings/{actions.ts,form-utils.ts,settings-form.tsx,page.tsx}. Core already exports subscriptionInputSchema, stopDateWarnings, toMinor, formatMoney, monthlyMinor, yearlyMinor, defaultStopDate, nextRenewal, isIsoDate, CURRENCIES, BILLING_CYCLES, planReminders, reminderWrites. Client rights on reminders: INSERT 5 cols, UPDATE status only (pending<->skipped), 23505 = success, never attempts/claimed_until, no upsert DO UPDATE.
Files (you own apps/web/app/app/subscriptions/**, apps/web/lib/subscriptions.ts, lib/card-guard.ts, lib/sub-cost.ts and tests, and a nav edit in apps/web/app/app/layout.tsx; do NOT edit lib/profile-settings.ts or app/app/settings/*; do not touch app/guides/**, app/api/**, core guides files or migrations):
1. lib/subscriptions.ts (pure, DB-injected): SubDb extends DbLike with getSub(userId,id), insertSub(row)->id, updateSub(userId,id,row), setArchived(userId,id,at|null), deleteSub(userId,id); createSubDb(sb)={...createDb(sb),...} thin glue; parseSubForm(fd,profile); saveSubscription(db,userId,id|null,fd,now), archiveSubscription, unarchiveSubscription, deleteSubscription. After each write call safeRebuild(db,userId,profile,now): calls rebuildReminders; on RangeError (bad timezone) retry once with timezone "UTC"; still failing -> {ok:false,error:"rebuild_failed"} with message "Saved. Reminders could not be updated. Try Save again." (stay on the form, no redirect).
2. lib/card-guard.ts looksLikeCardNumber(s): strip spaces/dashes; all digits, length 13..19, passes Luhn -> true. Run in the server action AND live on the client for card_nickname AND notes (CEO confirmed). Never echo a rejected card-like value back in returned values (blank that field).
3. lib/sub-cost.ts previewCost(priceStr,currency,cycle,interval) -> {monthly,yearly}|null using toMinor (catch RangeError -> null), monthlyMinor, yearlyMinor, formatMoney.
4. app/app/subscriptions/actions.ts ("use server"): saveSub(id|null,prev,fd), archiveSub(id), unarchiveSub(id), deleteSub(id). Each: getClaims() (none -> auth error), createSubDb(await createClient()), revalidatePath("/app/subscriptions"). Save success: redirect("/app/subscriptions") OUTSIDE any try/catch.
5. sub-form.tsx (client, useActionState): fields in order: name, price (text, inputMode decimal), currency (select, default profile currency), billing_cycle, billing_interval (shown only for custom, label "Every N days"), next_renewal_date (date), stop_date (date), category, payment_method_type (select; labels: none "Not set", wise "Wise virtual card", privacy "Privacy.com card", other_virtual "Other virtual card"; HIDE managed: it is POST_MVP, CEO confirmed), card_nickname, cancel_url, notes, is_trial checkbox + trial_end_date (shown when checked). Live cost preview under price in `<p aria-live="polite" id="price-help">` e.g. "About $9.99 / month, $119.88 / year" (use "About" for weekly/custom); price/currency/cycle/interval controlled with useState, others defaultValue. Stop date default: on the NEW form, when the user edits next_renewal_date and has not touched stop_date (touched ref), set stop_date to defaultStopDate(renewal, defaultStopDays); never auto-overwrite on edit; helper "We suggest N days before renewal. You can change it." Server: blank stop_date -> defaultStopDate(renewal, profile.default_stop_days_before). Live non-blocking warnings from stopDateWarnings: stop_in_past "This stop date has passed. No stop-date reminder will be sent." and stop_after_renewal "This stop date is after the renewal. The card could be charged first." (zod rejects stop after renewal on save; stop_in_past is allowed and saved). Honesty text under card_nickname (aria-describedby): "Never enter card numbers. Use a nickname only, like 'Wise card for streaming'. We never need your real card." Label "Card nickname (optional)". Card error: "This looks like a card number. Remove it. Use a nickname only." Copy a small local Field component (do not extract from settings).
6. app/app/subscriptions/page.tsx: MINIMAL list: h1 "Subscriptions", "Add subscription" button, plain <ul> of names (and an "Archived" text mark) with an Edit link each; comment "T-007 replaces this file in full". No cost/status/sort. new/page.tsx and [id]/edit/page.tsx (server): load profile (and sub for edit); missing or foreign id -> notFound(). [id]/edit/row-actions.tsx (client): Archive/Unarchive button (no confirm; reversible) and Delete with an inline confirm ("Delete [name]? This cannot be undone. Its reminders are deleted too." with Delete and Cancel). Archived sub shows an "Archived" notice + Unarchive.
7. layout.tsx: add nav link "Subscriptions" (/app/subscriptions) before Settings, same classes.
Data flow (save): getClaims -> read profile (timezone, currency, default_stop_days_before, reminder_days, reminder_hour) -> parseSubForm: price text via toMinor (RangeError -> "Enter an amount like 9.99"; reject comma/negative; "0" allowed); blank optional strings -> undefined/null; cancel_url trimmed, no scheme -> error "Start with https://"; billing_interval forced 1 unless custom; is_trial false -> trial_end_date null; checkbox = fd.get("is_trial")==="on" -> card guard -> subscriptionInputSchema.safeParse, map issues by path[0] to friendly messages -> insertSub or updateSub (.eq user_id, .select("id"); zero rows -> not_found) -> safeRebuild -> revalidatePath -> redirect. Never send stop_confirmed_at or merchant_cancelled_at (T-012). No auto-roll of a past renewal date (CEO confirmed: stop_in_past warning only). Archive: setArchived(now ISO) then rebuild (pending -> skipped). Unarchive: setArchived(null) then rebuild (future reminders reopened; past not recreated). Delete: hard delete (reminders cascade), then rebuild.
Edge cases: price "9.999","abc","-1","1,50","" error; max 1,000,000.00. Card "4111 1111 1111 1111" and with dashes rejected; Luhn-failing 16 digits accepted (known limit); "Wise 2024" ok. javascript:/ftp: URLs rejected. Dates "2026-02-30" rejected; trial on without end date rejected; custom interval 0/366/non-integer rejected. Edit of unknown/foreign id: notFound / not_found. Double submit: Save disabled while pending. Rebuild fails after good save: stay on form with message. Session ended: reuse auth message.
Criteria:
1. User with currency MYR submits Netflix, price "55.90", monthly, renewal 2026-12-20, stop date: one row, price_minor 5590, currency MYR, user_id me; lands on /app/subscriptions.
2. Live cost: price "10.00" yearly -> about 0.83/month and 10.00/year; custom interval 30 -> yearly 121.67 (yearlyMinor(1000,{custom,30}) = 12167); invalid price -> no preview, no crash.
3. default_stop_days_before 3, renewal 2026-12-20 on a new form with untouched stop date -> stop date 2026-12-17; typed stop date not overwritten; blank submit stores 2026-12-17.
4. New future sub: reminder rows per core planReminders (stop -7/-3/-1 at reminder_hour in profile tz, renewal -1 day), inserted with exactly the 5 allowed keys.
5. Edit moves stop date later: old pending become skipped, new inserted, sent rows untouched.
6. Archive: archived_at set, pending reminders skipped. Unarchive: archived_at null, future reminders pending again.
7. Delete: Delete then confirm removes the row and its reminders; Cancel changes nothing.
8. card_nickname "4111 1111 1111 1111" rejected (client and direct server call), nothing written; "Wise streaming card" saves; help text linked by aria-describedby.
9. cancel_url "javascript:alert(1)" or "ftp://x" error; "https://netflix.com/cancel" saves.
10. Stop date before today: non-blocking warning, save works. Stop after renewal: warning, save rejected with the zod message.
11. Invalid profile timezone: reminders built with UTC, save succeeds.
12. Another user's id: notFound / not_found, no change.
13. Nav has "Subscriptions"; /app/subscriptions renders with an Add button and names.
14. A11y: labels on all fields, aria-invalid + described-by, error summary takes focus, h-11 targets; typecheck, lint, format:check, test, build pass.
Tests (Vitest, no Docker): copy and extend the in-memory DbLike fake from profile-settings.test.ts into a SubDb fake; test saveSubscription/archive/unarchive/delete, parseSubForm, looksLikeCardNumber (valid Luhn 13/16/19 digits with spaces and dashes; invalid Luhn; 12 and 20 digits; "Wise 2024"), previewCost, safeRebuild (RangeError -> UTC; second failure -> rebuild_failed; sub stays saved). Assert reminder inserts have exactly the 5 keys, setReminderStatus only gets "skipped"/"pending", no attempts/claimed_until. Fixed now; profile in Asia/Kuala_Lumpur. No pgTAP (no DB change). Add the no-claims test for the actions' pure guard (the T-004 Tester noted W6 untested there too: add a small test if cheap).
Reviewer: skip (no DB change; Tester covers).

CEO NOTES for the Planner (from T-004/T-010): after saving a subscription call core planReminders + reminderWrites with the user JWT. Client rights on reminders: INSERT only (subscription_id,user_id,type,channel,fire_at), UPDATE only status (pending<->skipped, trigger-guarded). Use ON CONFLICT DO NOTHING (no DO UPDATE upsert). A reopen only sets status=pending. Never send attempts/claimed_until. Catch RangeError from a bad profile timezone and fall back to UTC. Reuse rebuildReminders from apps/web/lib/profile-settings.ts if T-004 shipped it.
## Design (Designer)
## Build notes (Builder)
Built. 181 tests, build ok. Files: lib/{card-guard,sub-cost,subscriptions}.ts + tests; app/app/subscriptions/{form-utils,actions,sub-form,page,new/page,[id]/edit/page,[id]/edit/row-actions}; layout nav link. Deviations: SubDb.listSubNames; hidden sub_id field so a retry after rebuild_failed edits the same row; delete does not rebuild (cascade); write methods return boolean; actions do not echo values (all inputs controlled); server actions as async function declarations (Next rejects const arrows in use-server files); isUuid guards. Limits: card guard only catches a whole-field card number; Luhn-failing numbers pass. Unverified: live Supabase, browser, axe.
## Test report (Tester)
PASS. 181 tests, build ok; criteria 1-14 verified by code/tests; ownership, card guard, reminder writes (5 keys, status only), hidden sub_id retry, bad tz fallback all OK. Low-severity open: forged bad currency adds a spurious price error; previewCost unknown cycle -> "$NaN" (unreachable from UI); cancel_url has no length cap; trial_end_date past/after renewal accepted; stop-date warnings not in a live region. Not tested: live Supabase, browser, axe. Reviewer skipped.
## Review verdict (Reviewer)
<!-- VERDICT: PASS | NEEDS_FIXES -->

## Developer sign-off
- [x] Approved on: 2026-11-25 (CEO, standing order)
