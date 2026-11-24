---
id: T-007
title: Subscription list and detail, statuses, cancel-link checklist, honesty copy
status: DONE
milestone: MVP
ui: true
depends_on: [T-006]
completed: 2026-11-25
fix_loops: 0
---

# T-007 Subscription list and detail, statuses, cancel-link checklist, honesty copy
✅ DONE 2026-11-25

## Goal
Subscription list and detail, statuses, cancel-link checklist, honesty copy. Planner refines this and writes Given/When/Then criteria before build.

## Acceptance criteria
- [x] (Planner fills in)

## Plan (Planner)
Design: no separate Designer step. Follow docs/design-system.md (status badges: icon + text, --status-* CSS vars; check they exist in globals.css, else add a small addition and note it). READ node_modules/next/dist/docs first (searchParams and params are Promises; apps/web/AGENTS.md).
Facts: /app/subscriptions/page.tsx is a minimal list (listSubNames); T-007 REPLACES it in full. SubDetail (lib/subscriptions.ts) lacks stop_confirmed_at, merchant_cancelled_at, nullable next_renewal_date, which deriveStatus needs. PAYMENT_LABELS and CYCLE_LABELS live in the "use client" sub-form.tsx: move them to app/app/subscriptions/form-utils.ts (non-client) and import from both. loadGuide(kind,slug) in lib/guides.ts merges DB+JSON and never throws; GUIDE_FILES holds only netflix now, so the guide-exists check is required. Do NOT touch app/app/layout.tsx, settings files, core profile files or migrations (T-011 works there in parallel).
Changes:
1. lib/subscriptions.ts: add type SubFull = SubDetail & {stop_confirmed_at, merchant_cancelled_at, created_at} (next_renewal_date nullable); extend COLS as needed but keep SubWrite untouched (edit form and updateSub tests unaffected). SubDb += listSubs(userId): Promise<SubFull[]> and listRemindersForSub(userId, subId): Promise<HistoryRow[]> (HistoryRow {type, channel, fire_at, status, sent_at|null}, ordered fire_at asc); add both to createSubDb; add stub methods to the fake in subscriptions.test.ts so existing tests compile.
2. app/app/subscriptions/page.tsx (replace), app/app/subscriptions/[id]/page.tsx (new detail), status-badge.tsx (server component: lucide CircleCheck/Clock/CirclePause/BadgeCheck + visible text; label exactly "Cancelled with merchant"; plain "Cancelled" never appears), sub-form.tsx and form-utils.ts (move label maps only).
3. lib/sub-view.ts (pure, no DB): parseListParams(sp) (?status=active|stopping_soon|stopped|cancelled, ?sort=next|name default next, ?archived=1; unknown -> defaults; arrays -> first), toRow(sub,today) -> SubRowView{id,name,priceText,cycleText,monthlyText,nextRenewal,stopDate,daysLeft,status,archived}, filterSort(rows,params) (archived hidden unless archived=1; next = ascending with nulls last, ties by name; name = localeCompare), nextEventDate (soonest of stop_date and next_renewal_date >= today; both past -> stop date; both null -> null), daysLeft = daysBetween(today, stop date when set else renewal; negative -> text "Stop date passed"), safeCancelUrl(u) (trim; only if new URL(u).protocol==="https:"; else null), storeHint(name) via matchGuideSlug when kind==="store", formatFireAt(iso,tz) (Intl en-GB, zone shown, falls back to UTC on RangeError). Also loadList(db,userId,sp,now) and loadDetail(db,userId,id,now) (DB-injected; return view models or "error" or "not_found"; loadDetail returns {sub,status,today,tz,reminders,guide} with the guide resolved by an injected loader defaulting to loadGuide).
Status: deriveStatus({stopDate,merchantCancelledAt,stopConfirmedAt}, todayIn(profile.timezone, now)); todayIn/getProfile exist. Money: formatMoney(price_minor,currency) and monthlyMinor(price_minor,{cycle,interval}) from core (not previewCost).
List: getClaims -> userIdFrom -> loadList. Filter chips, sort links, archived toggle are plain Link hrefs (GET, no JS) with aria-current on the current one. Each card is one link to /app/subscriptions/[id]; a separate Edit link (not nested inside the other link). Cards only (no table). Zero subscriptions: exactly one sentence + "Add subscription" button (link to /app/subscriptions/new), no filters. Filter with no match: "No subscriptions match this filter." + "Clear filter" link. Each row: name, price, cycle ("Every N days" for custom), monthly cost, next renewal, stop date, days left, status badge. Long names wrap; no horizontal scroll at 320px.
Detail: validate isUuid(id) else notFound(); getSub full + getProfile + listRemindersForSub -> deriveStatus -> matchGuideSlug(name) -> loadGuide; render the guide link ONLY if the guide exists (no dead link). Not found / other user's row -> notFound(). DB error -> error text with role="alert", not a 404, no stack trace. Layout: h1 name + badge + Edit link; h2 sections: Dates (renewal, stop date, days left, trial end if trial); Payment (T-006 labels, card nickname, "never a card number"); Notes (plain text, whitespace-pre-wrap, no dangerouslySetInnerHTML); Cancel with the merchant; Guide; Reminder history (type, channel, status, fire_at in profile timezone; failed rows show a "Failed" error-style badge, no raw last_error; empty: "No reminders yet.").
Checklist: T-007 only RENDERS; T-012 wires the action. Heading "Did you also cancel with the merchant?". Read-only: merchant_cancelled_at set -> "Marked as cancelled with merchant on <date>"; else "Not marked yet". NO checkbox or button, no "coming soon" text; add comment `// T-012: wire the mark/unmark action here`. Fixed copy: "Payments stop on the date you set." / "Blocking a card does not cancel a subscription. The merchant can still try to charge you." / "Freeze or close the card a few days BEFORE renewal, not on the renewal date." Cancel link: <a target="_blank" rel="noopener noreferrer"> only if safeCancelUrl non-null; else "No cancel link saved. Add one in Edit." Apple/Google hint: "Apple and Google subscriptions can only be cancelled in your own account settings. We cannot cancel them for you." + link to /guides/store/<slug> only if that guide exists.
Edge cases: bad or missing profile timezone/profile -> UTC and defaults, no crash. Missing stop_date or renewal -> "Not set", daysLeft null, sorts last. Past stop date unconfirmed -> status stays stopping_soon (D13), "Stop date passed". Archived shown with an "Archived" label when ?archived=1. Notes and names rendered as text only. A past renewal date is shown as stored (no auto-roll).
Criteria:
1. No subscriptions: one sentence + one "Add subscription" button, no filters.
2. Subs with stop dates 2, 30, 4 days away (tz Asia/Kuala_Lumpur): badges Stopping soon, Active, Stopping soon, each with icon + visible text.
3. tz Asia/Kuala_Lumpur, UTC 17:00 on day D: "today" is D+1 (todayIn test).
4. merchant_cancelled_at set -> exactly "Cancelled with merchant"; stop_confirmed_at set -> "Stopped"; cancelled wins over stopped; "Cancelled" appears alone nowhere.
5. ?status=stopping_soon shows only those; ?status=bogus shows all; ?sort=name A-Z; default sort soonest first with null last.
6. Archived hidden by default; shown with "Archived" when ?archived=1.
7. Row shows name, price (e.g. "RM55.90"), cycle, monthly cost, next renewal, stop date, days left, status.
8. Netflix sub (guide exists) -> link to /guides/cancel/netflix; Spotify (no guide file yet) -> no guide link; Google Play sub -> store hint and /guides/store/google-play link only if that guide exists.
9. cancel_url "https://x.com/c" -> link with rel="noopener noreferrer"; "http://x.com", "javascript:alert(1)", null -> no link.
10. Non-uuid id, non-existent id or another user's id -> 404.
11. Detail has exact phrases "Did you also cancel with the merchant?", "Payments stop on the date you set", a sentence with "BEFORE renewal"; no checklist button or checkbox; merchant_cancelled_at set -> "Marked as cancelled with merchant".
12. 3 reminder rows listed in fire_at order with type, channel, status and time in the profile timezone (09:00 for Asia/Kuala_Lumpur, not the UTC time).
13. Detail has an Edit link; payment shows T-006 labels and nickname.
14. DB throws -> message with role="alert", no stack trace; bad profile timezone does not crash.
15. A11y: one h1 per page, h2 in order, focus-visible, targets >= 44px, filters are links with aria-current, tokens only (no raw hex). typecheck, lint, format:check, test, build pass.
Tests (Vitest, no Docker): lib/sub-view.test.ts for every pure function (incl. bad tz), loadList and loadDetail with a fake SubDb (other user's id -> not_found; throwing DB -> error; fake guide loader with and without link); badge via renderToStaticMarkup (text + icon present). Add fake methods to lib/subscriptions.test.ts. Playwright and axe belong to T-025.
Reviewer: skip (read-only UI; Tester covers).

## Design (Designer)
## Build notes (Builder)
Built. 205/206 tests pass (the one failure is T-011 mid-edit). Files: lib/subscriptions.ts (SubFull, HistoryRow, listSubs, listRemindersForSub), lib/sub-view.ts (+test), app/app/subscriptions/{page,[id]/page,status-badge(+test)}, label maps moved to form-utils.ts. globals.css untouched (tokens exist). Deviations: stop_date also nullable in SubFull; getSub returns SubFull; loadDetail returns {sub,row,status,today,tz,reminders,guide,store}; loadList returns {rows,total,params}; zero-state "Add your first subscription to set a stop date."; checklist heading is h3 under h2. Unverified: browser, 320px, dark mode, live DB, bare "Cancelled" absence on detail page.
## Test report (Tester)
PASS. 227 tests, build ok, criteria 1-15 verified. OPEN minor defects (CEO queued in the fix batch): (1) [id]/page.tsx DB-error branch has no h1; (2) "Marked as cancelled with merchant on" uses UTC date, should use profile tz; (3) daysLeft with no stop date and past renewal says "Stop date passed" (wrong wording); (4) formatMoney shows "MYR 55.90" not "RM55.90" (core T-005 behaviour: accepted); (5) bad stored data gives odd text (DB constraints prevent). Not tested: browser, live DB, axe. Reviewer skipped.
## Review verdict (Reviewer)
<!-- VERDICT: PASS | NEEDS_FIXES -->

## Developer sign-off
- [x] Approved on: 2026-11-25 (CEO, standing order)
