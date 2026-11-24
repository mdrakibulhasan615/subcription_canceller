---
id: T-017
title: Dashboard
status: DONE
milestone: MVP
ui: true
depends_on: [T-007]
completed: 2026-11-25
fix_loops: 0
---

# T-017 Dashboard
✅ DONE 2026-11-25

## Goal
Dashboard. Planner refines this and writes Given/When/Then criteria before build.

## Acceptance criteria
- [x] (Planner fills in)

## Plan (Planner)
Design: no separate Designer step. Follow docs/design-system.md and the dataviz rules (accessible, text labels, no colour-only meaning; no chart library). READ node_modules/next/dist/docs first if needed (apps/web/AGENTS.md).
Decisions (CEO accepted): core owns the logic in packages/core/src/dashboard.ts (+ test, export from index.ts). Web loader apps/web/lib/dashboard.ts (+ test) uses SubDb.listSubs and getProfile (no SubDb change). Page: replace apps/web/app/app/page.tsx ("You are signed in" proof page is removed; layout already shows the email; grep found no test referencing it).
Counting (via deriveStatus; archived_at ignored for status): totals, upcoming and categories use only NON-archived subs with status active or stopping_soon (stopping_soon counts until the user confirms the stop, D13, including a passed unconfirmed stop date). stopped and cancelled never count; archived excluded.
Savings: per currency, sum yearlyMinor of every stopped or cancelled sub (archived ones included: it is history). Show "about X a year" and the monthly equivalent. Copy: "Estimate only. This is the yearly cost of subscriptions you stopped or cancelled, if you had kept paying. It is not a promise of savings. Check your card statement." Never write "you saved", "guaranteed", or "cancelled" for our own action.
Core API (packages/core/src/dashboard.ts):
type DashSub = {id,name,category|null,price_minor,currency,billing_cycle,billing_interval,next_renewal_date|null,stop_date|null,stop_confirmed_at|null,merchant_cancelled_at|null,archived_at|null} (SubFull assignable). PerCurrency = Partial<Record<Currency,number>>.
countedSubs(subs,today); totals(subs,today) -> {monthly,yearly,skipped} (monthly = sum of per-sub monthlyMinor; yearly = sum of per-sub yearlyMinor, NOT monthly x 12; a bad interval throws RangeError: catch, skip that sub, skipped+1; page says "N subscriptions left out because of a bad billing interval."); upcoming(subs,today,limit=5) -> UpcomingEvent{subId,name,kind:"stop"|"renewal",date,daysLeft,status} (events from stop_date and next_renewal_date of counted subs; past renewal dates skipped; past stop dates kept with negative daysLeft shown as "Stop date passed"; sort by date, then stop before renewal, then name, then id; take 5; one sub may give two events); savings(subs,today) -> {yearly,monthly,count}; categoryBreakdown(subs,today) -> Partial<Record<Currency,CategoryRow[]>> with CategoryRow{category,monthlyMinor,percent} (key = category?.trim() || "Uncategorised"; per currency; sorted descending; percent = round share of that currency's monthly total). Currency order follows CURRENCIES.
Web: loadDashboard(db: SubDb, userId, now) -> DashboardView{today,totals,upcoming,savings,categories,total}|"error". getProfile + listSubs in parallel; today = todayIn(profile?.timezone ?? "UTC", now). Put text builders (days-left label, savings note) in lib/dashboard.ts so they are unit-testable. Reuse StatusBadge, daysLeftText and formatDate from lib/sub-view.ts, todayIn from lib/subscriptions.ts, formatMoney: read-only reuse, no signature changes; if they were renamed by a fix batch, adapt or duplicate.
Page: one h1 "Dashboard", h2s in order: Totals (one card per currency with "Per month" / "Per year"; never mix currencies, D3); Next 5 dates (list: name link to /app/subscriptions/{id}, "Stop date" or "Renewal", formatted date, days left, StatusBadge); Estimated savings (+ the estimate note); Spending by category (per currency semantic <table>: Category, Per month text, Share text "42%", and a bar cell: a div whose width is percent, aria-hidden; meaning is in text; bar uses a design-token fill plus border); honest note "Totals use the prices you typed in. Different currencies are not added together. We do not link to your bank. Check your card statement." Zero subs: one sentence "Add your first subscription to set a stop date." + "Add subscription" button to /app/subscriptions/new, no empty table. Subs exist but none counted: "No active subscriptions" line + CTA; savings card still shows. Loader "error": role="alert" text like the list page. Long names [overflow-wrap:anywhere]. Single column at 320px, no horizontal scroll, 44px targets, status by text + icon.
Layout nav: add a "Dashboard" link to /app and make the brand a link: do this AFTER the T-011 fix batch lands (layout.tsx is shared); if not possible, list it in the build notes.
Edge cases: missing profile or bad timezone -> UTC. stop_date null -> counted in totals, in upcoming only by renewal. Both dates null -> counted in totals, absent from upcoming. Trial counts at its entered price. A sub both cancelled and stop-confirmed counts once (status cancelled). A currency with no counted subs is not shown. Category text is escaped by React.
Criteria:
1. Active subs 10.00 monthly USD, 12.00 yearly USD, 5.00 monthly MYR: USD 11.00 per month and 132.00 per year; MYR 5.00 per month and 60.00 per year; no combined total.
2. A stopping_soon sub with a passed unconfirmed stop date is counted.
3. stopped, cancelled and archived subs contribute to none of totals, upcoming, categories.
4. 7 counted subs with dates: upcoming returns exactly 5, soonest first, each with kind, daysLeft, status; ties: stop before renewal.
5. Past renewal omitted; past stop date included with negative daysLeft and shown "Stop date passed".
6. Stopped sub 10.00 monthly USD + cancelled sub 120.00 yearly USD: savings yearly USD 240.00, monthly USD 20.00; the estimate text is on screen; no "you saved" or "guaranteed".
7. Empty category -> "Uncategorised"; rows sorted descending; percentages within each currency; rendered as a table with the same data as text.
8. Bad interval: no crash, sub skipped, skipped = 1.
9. Zero subs: one sentence + one "Add subscription" button; no empty table.
10. listSubs throws: loader returns "error".
11. 320px and 1440px: no horizontal scroll, one h1, ordered h2s, targets >= 44px, status by text + icon.
12. "You are signed in" is gone; typecheck, lint, test, format:check, build pass.
Tests (Vitest, no Docker): core tables for all pure functions with a fixed today (all statuses, archived_at, currency order); loadDashboard with a fake SubDb (getProfile + listSubs only): error path, UTC fallback, "today" follows profile tz (a case where UTC and Kuala Lumpur differ). No DOM tests; keep render logic thin. Axe in T-025.
Reviewer: skip.

## Design (Designer)
## Build notes (Builder)
Built. 251/252 tests (one failure in T-018 csv test, not T-017). Files: core dashboard.ts (+test), lib/dashboard.ts (+test), app/app/page.tsx replaced. Deviations: "No active subscriptions." sentence with the Add button; bar column hidden below 640px; DashboardView.counted; savings empty text "Nothing stopped yet..."; renewal events use daysLeftText(n,false). CEO added the Dashboard nav link and made the brand a link in layout.tsx. Unverified: layout 320/1440, dark mode, axe, live Supabase.
## Test report (Tester)
PASS. Core and loader tested incl. day-boundary (UTC vs Kuala Lumpur), static-markup render of 4 states (headings, table caption/scope, aria-hidden bar, escaped categories, no "you saved"). Minor, accepted: category percents are independent rounds (can sum to 99); category keys are case-sensitive; days label reads "6 days" without "left". Not tested: 320/1440px browser, dark mode, axe (T-025), live Supabase. Reviewer skipped.
## Review verdict (Reviewer)
<!-- VERDICT: PASS | NEEDS_FIXES -->

## Developer sign-off
- [x] Approved on: 2026-11-25 (CEO, standing order)
