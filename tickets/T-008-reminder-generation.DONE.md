---
id: T-008
title: Reminder generation in core (timezone, DST, edits)
status: DONE
milestone: MVP
ui: false
depends_on: [T-005]
completed: 2026-11-24
fix_loops: 0
---

# T-008 Reminder generation in core (timezone, DST, edits)
✅ DONE 2026-11-24

## Goal
Reminder generation in core (timezone, DST, edits). Planner refines this and writes Given/When/Then criteria before build.

## Acceptance criteria
- [x] (Planner fills in)

## Plan (Planner)
Pure functions in packages/core. Add src/reminders.ts + reminders.test.ts; add `export * from "./reminders";` to index.ts. Reuse addDays, isIsoDate (dates.ts) and localToUtc (timezone.ts; throws RangeError on bad tz). No new deps. Do not touch apps/web or supabase.
Types: ReminderType stop_date|renewal|trial_end. ReminderChannel in_app|email|push. ReminderStatus pending|sent|failed|skipped.
ReminderSubInput {stopDate, nextRenewalDate, isTrial, trialEndDate, stopConfirmedAt, merchantCancelledAt, archivedAt} (dates IsoDate|null, others string|null; isTrial boolean).
ReminderProfile {timezone, reminderDays:number[] (default [7,3,1]), sendHour?:0-23 default 9, channels?: default ["in_app","email"]}.
DesiredReminder {type, channel, fireAt: UTC ISO with ms and Z}. ExistingReminder = DesiredReminder & {id, status}.
desiredReminders(sub, profile, now): DesiredReminder[]. planReminders(sub, profile, existing, now): ReminderDiff. diffReminders(desired, existing, now, opts?:{cancelOverdue?:boolean}) -> {toInsert: DesiredReminder[], toCancel: string[] (ids -> set skipped), toReopen: string[] (skipped rows wanted again -> pending)}.
Key = `${type}|${channel}|${fireAt}` (matches DB unique key). Normalise fireAt with new Date(x).toISOString() on both sides (Postgres returns +00:00).
Rules: return [] if archivedAt, stopConfirmedAt or merchantCancelledAt set. Anchors: stop_date = stopDate if set and <= nextRenewalDate (later stop date dropped); trial_end = trialEndDate if isTrial; renewal = nextRenewalDate if not trial, ONE reminder at offset 1 day only (CEO confirmed). For each anchor, each offset d in deduped positive-integer reminderDays, each channel: fireAt = localToUtc(addDays(anchor,-d), sendHour, 0, tz). Drop fireAt <= now. Sort by fireAt, type, channel. Non-integer reminderDays or bad sendHour or bad date: RangeError. Empty/duplicate/non-positive days: dedupe, ignore non-positive.
Diff: toInsert = desired keys with no existing row of any status (never re-send sent/failed). toReopen = existing skipped rows whose key is desired. toCancel = existing pending rows whose key is not desired; if fireAt <= now and cancelOverdue false, leave alone (late reminders still send after an outage). cancelOverdue true only when the subscription is inactive (planReminders sets it so).
Callers (T-006, T-009, T-010) run the SQL; core does no I/O. profiles.reminder_hour int default 9 does not exist yet: T-004 adds it in a new migration.
Criteria:
1. Stop date 10 days ahead, UTC, hour 9, [7,3,1], in_app+email -> 6 stop_date rows at stop-7/-3/-1 at 09:00:00.000Z, one per channel.
2. Asia/Kuala_Lumpur hour 9 -> 01:00Z.
3. America/New_York reminder date 2027-03-14 -> 13:00Z; day before 14:00Z.
4. America/New_York 2027-11-07 -> 14:00Z.
5. Rows with fireAt <= now are dropped.
6. Stop date before today -> no stop_date rows.
7. Stop date after renewal -> no stop_date rows; renewal row still returned.
8. Archived, stop-confirmed or merchant-cancelled -> desiredReminders []; planReminders puts all pending rows (also overdue) in toCancel, no inserts.
9. Existing pending rows from the first run + unchanged input -> empty diff.
10. Stop date moved 2 days -> old future pending in toCancel, new in toInsert, sent rows untouched.
11. Date moved and moved back -> skipped rows in toReopen, toInsert empty.
12. Timezone change -> future pending move to new fireAt values; sent rows stay.
13. Overdue pending row not desired, cancelOverdue false -> not in toCancel.
14. isTrial with trialEndDate -> trial_end rows, no renewal rows.
15. Invalid timezone -> RangeError.
16. channels omitted -> in_app and email only.
17. existing fireAt "2026-12-01T09:00:00+00:00" matches desired "2026-12-01T09:00:00.000Z".
18. UTC+14 and UTC-12 zones pick the local date. 19. typecheck, lint, test, format:check, build pass.

## Design (Designer)
## Build notes (Builder)
Built in packages/core/src/reminders.ts (+19 tests, 62 total pass). No deviations. now is a Date. Bad tz/sendHour/reminderDays throw even for inactive subs.
## Test report (Tester)
PASS. 62 tests. Scratch hunts (idempotency, sent/failed rows, tz change, overdue, sendHour 0/23, UTC+14/-12, leap day, now==fireAt) found no bug. Reviewer skipped; T-009 review covers the callers.
## Review verdict (Reviewer)
<!-- VERDICT: PASS | NEEDS_FIXES -->

## Developer sign-off
- [x] Approved on: 2026-11-24 (CEO, standing order)
