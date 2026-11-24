---
id: T-005
title: Core package: money, dates, monthly and yearly cost
status: DONE
milestone: MVP
ui: false
depends_on: [T-001]
completed: 2026-11-24
fix_loops: 0
---

# T-005 Core package: money, dates, monthly and yearly cost
✅ DONE 2026-11-24

## Goal
Core package: money, dates, monthly and yearly cost. Planner refines this and writes Given/When/Then criteria before build.

## Acceptance criteria
- [x] (Planner fills in)

## Plan (Planner)
All code in packages/core/src. No I/O. Pass `now`/`today` in. Add dependency zod (latest stable, pin exact). One *.test.ts per file. Delete hello.ts and hello.test.ts. apps/web/app/page.tsx renders BRAND only. Add a BRAND test. Do not touch /supabase.
Dates are ISO strings `YYYY-MM-DD` (type IsoDate). Use Date.UTC inside only.

money.ts: CURRENCIES = USD,MYR,EUR,GBP. type Money {minor, currency}. toMinor(amount:string,currency) by regex ^\d+(\.\d{1,2})?$ (no float math; RangeError on bad, >2 decimals, negative). formatMoney(minor,currency,locale='en-US') via Intl. sumByCurrency(Money[]) -> Partial<Record<Currency,number>>.
cost.ts: BillingCycle weekly|monthly|quarterly|yearly|custom. Billing {cycle, interval>=1 int}. CEO DECISION: for custom, interval = DAYS. yearlyMinor(price,b), monthlyMinor(price,b): factors weekly 365/7/interval, monthly 12/interval, quarterly 4/interval, yearly 1/interval, custom 365/interval. Round once at end (half up). monthly = price*factor/12 unrounded. RangeError on bad interval.
dates.ts: addMonthsClamped, addDays (negative ok), nextRenewal(anchor,b,today) (k-th date from ORIGINAL anchor, no drift; weekly=7*interval days; custom=interval days; closed-form guess, no unbounded loop; anchor>=today returns anchor), defaultStopDate(renewal,daysBefore=3), daysBetween(a,b). Invalid dates throw RangeError.
status.ts: SubStatus active|stopping_soon|stopped|cancelled. StatusInput {stopDate, merchantCancelledAt, stopConfirmedAt, archivedAt?}. deriveStatus(s,today,soonDays=7). Order: merchantCancelledAt->cancelled; stopConfirmedAt->stopped; no stopDate->active; 0<=days to stop<=soonDays->stopping_soon; stop date passed and unconfirmed->stopping_soon; else active. (DB column stop_confirmed_at is added by T-002.)
timezone.ts: isValidTimezone(tz), localToUtc(date,hour,minute,tz):Date using Intl only. Gap time -> instant just after the gap. Overlap -> first (earlier) occurrence. RangeError on bad tz.
schema.ts (zod): isoDateSchema (real calendar date), subscriptionInputSchema, type SubscriptionInput. Snake_case fields like DB: name (trim 1..100), category (<=50, optional), price_minor (int 0..100_000_000), currency, billing_cycle, billing_interval (int 1..365, default 1), next_renewal_date, cancel_by_date?, stop_date?, payment_method_type (none|wise|privacy|other_virtual|managed, default none), card_nickname (<=50)?, cancel_url (http/https only)?, notes (<=2000)?, is_trial (default false), trial_end_date?. Refine: stop_date <= next_renewal_date (path stop_date); is_trial requires trial_end_date. Past stop date is not an error. Export stopDateWarnings(input,today) -> ("stop_in_past"|"stop_after_renewal")[].
index.ts exports all public names.

Criteria (Given/When/Then) are in the list above and below; Builder writes tests for each:
1. toMinor "9.99"->999; "9.999","-1","1e3","",","-> RangeError; "0","0.5" ok.
2. formatMoney 999: USD "$9.99", EUR "€9.99", GBP "£9.99", MYR contains "9.99".
3. sumByCurrency [USD100,USD250,MYR500] -> {USD:350,MYR:500}.
4. 1200 monthly -> yearly 14400, monthly 1200. 1200 yearly -> 1200/100. 3000 quarterly -> 12000/1000. 1000 weekly -> 52143/4345. 500 custom 30 -> 6083/507. 1200 monthly x2 -> yearly 7200.
5. anchor 2026-01-31 monthly, today 2026-02-10 -> 2026-02-28. today 2026-03-01 -> 2026-03-31.
6. anchor 2028-02-29 yearly: today 2029-01-01 -> 2029-02-28; today 2032-01-01 -> 2032-02-29.
7. anchor 2026-12-15 monthly, today same -> same. Future anchor -> anchor.
8. weekly anchor 2026-11-02 interval 2, today 2026-11-24 -> 2026-11-30.
9. defaultStopDate(2026-03-02,3)=2026-02-27. (2028-03-01,3)=2028-02-27.
10. Status rules (cancelled wins; stop 2026-12-01 today 2026-11-24 -> stopping_soon; 2026-12-20 -> active; passed+unconfirmed -> stopping_soon; confirmed -> stopped; no stop date -> active).
11. Schema: valid payload parses with defaults. Fails with path-specific issue for price 9.5, negative, currency JPY, name "  ", cancel_url javascript:, date 2026-02-30, stop after renewal.
12. localToUtc: Asia/Kuala_Lumpur 2026-12-01 09:00 -> 01:00Z. America/New_York 2026-11-01 09:00 -> 14:00Z. 2026-03-08 09:00 -> 13:00Z. Europe/London 2027-03-28 01:30 (gap) -> 2027-03-28T01:30:00Z. America/New_York 2026-11-01 01:30 (overlap) -> 05:30Z. "Mars/Base" -> RangeError; isValidTimezone false.
13. pnpm typecheck, lint, format:check, test, build pass. hello is gone. Web page renders BRAND.
Planner hand-computed values in 4: recheck on first test run. Edge Functions (Deno) will import zod via npm: so keep version exact.

## Design (Designer)
## Build notes (Builder)
Built. 7 test files, 42 tests, all scripts pass. zod 4.6.7 pinned. hello removed; page renders BRAND. Gap rule: localToUtc shifts forward by the gap (London 2027-03-28 01:30 -> 01:30Z); CEO accepts, ticket text "just after the gap" read as this. formatMoney uses minor/100 float (display only). Deno npm:zod import not checked.
## Test report (Tester)
PASS. 42 tests. Brute-force check of nextRenewal, 9-zone DST round-trip, toMinor and URL fuzz found no bug. Note: render cancel_url trimmed / via new URL().href. Reviewer skipped (standing order).
## Review verdict (Reviewer)
<!-- VERDICT: PASS | NEEDS_FIXES -->

## Developer sign-off
- [x] Approved on: 2026-11-24 (CEO, standing order)
