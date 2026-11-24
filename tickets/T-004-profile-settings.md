---
id: T-004
title: Profile and settings
status: TESTING
milestone: MVP
ui: true
depends_on: [T-003]
completed:
fix_loops: 0
---

# T-004 Profile and settings

## Goal
Profile and settings. Planner refines this and writes Given/When/Then criteria before build.

## Acceptance criteria
- [ ] (Planner fills in)

## Plan (Planner)
Page /app/settings (display name, timezone, currency, default stop days, reminder days, reminder hour). Saving rebuilds the user's pending reminders. READ node_modules/next/dist/docs (server actions, useActionState, revalidatePath) before coding: this Next has breaking changes (see apps/web/AGENTS.md).
Facts: profiles has display_name, timezone (default UTC, no DB check), currency check, default_stop_days_before 0..60, reminder_days int[] (check >0 only). Client UPDATE grant is column-level (migration 000002 line ~17). Migration 000004 is T-010's: use 20261124000005. Client rights on reminders after T-010: INSERT (subscription_id,user_id,type,channel,fire_at); UPDATE only status (pending<->skipped, trigger-guarded). Never send attempts or claimed_until.
Files:
1. NEW supabase/migrations/20261124000005_profile_reminder_hour.sql: add column reminder_hour int not null default 9 check 0..23; grant update (reminder_hour) on public.profiles to authenticated; add check reminder_days length 1..5 and every item <=365 (CEO accepted); timezone char_length <= 64 check. Make sure existing default {7,3,1} and existing pgTAP rows still pass.
2. NEW supabase/tests/database/profile_settings.test.sql: D1 default 9; D2 A updates own reminder_hour to 0 and 23, 24 and -1 throw 23514; D3 A cannot update B's reminder_hour (0 rows); D4 reminder_days '{}','{0}',6 items,'{366}' rejected; D5 email/id update still 42501.
3. NEW packages/core/src/profile.ts + profile.test.ts, one export line in index.ts: DEFAULT_REMINDER_DAYS=[7,3,1]; profileSettingsSchema (display_name trim max 80, empty -> null; timezone refine isValidTimezone (<=64 chars); currency enum CURRENCIES; default_stop_days_before int 0..60; reminder_days array int 1..365, min 1 max 5, deduped and sorted descending; reminder_hour int 0..23); type ProfileSettings; needsReminderRebuild(before, after) true when timezone, reminder_hour or reminder_days (as sorted sets) changed.
4. NEW apps/web/lib/profile-settings.ts: narrow DbLike interface (getProfile, updateProfile, listSubsWithReminders, writeReminders) + real Supabase adapter (~30 lines, untested glue); saveProfileSettings(db,userId,input,now) -> {ok:true}|{ok:false,fieldErrors}|{ok:false,error:"server"|"rebuild_failed"}; rebuildReminders(db,userId,profile,now): select subs (id, stop_date, next_renewal_date, is_trial, trial_end_date, stop_confirmed_at, merchant_cancelled_at, archived_at) and reminders with status pending or skipped; per sub planReminders then reminderWrites; run inserts (23505 = success), then status='skipped' for skipIds, then status='pending' for reopenIds, batching with .in(). CEO decision: ALWAYS rebuild when the three fields are submitted (diff is a no-op if nothing changed; this makes retry after a partial failure work); needsReminderRebuild may only be used to skip the queries when nothing relevant changed AND the previous save did not fail: keep it simple, always rebuild. On rebuild failure after the profile saved: return "Settings saved. Reminders could not be updated. Try Save again."
5. NEW apps/web/app/app/settings/actions.ts ("use server": only async exports) updateSettings(prevState, formData): createClient + getClaims (no claims -> auth error, no db call), parse FormData with a pure parseSettingsForm (in a separate plain file; "7, 3, 1" -> [7,3,1]; "7;3" -> field error), saveProfileSettings, revalidatePath("/app/settings").
6. NEW apps/web/app/app/settings/page.tsx (server; reads profile with RLS) + settings-form.tsx (client, useActionState). Visible labels. Timezone: text input + datalist from Intl.supportedValuesOf("timeZone"); if saved value is the untouched 'UTC' and the browser zone differs, prefill the browser zone with helper "Detected from your browser". Currency: native select styled like Input. Stop days number input. Reminder days text "7, 3, 1" helper "Days before the stop date. 1 to 5 numbers". Reminder hour select 00:00..23:00. Focusable error summary when 2+ errors; field errors linked by aria-describedby; role=status "Saved"; button disabled "Saving..." while pending. Honest copy: "We use your timezone to send reminders at your local hour." No export/delete (T-023). Follow docs/design-system.md.
7. EDIT apps/web/app/app/layout.tsx: add <nav aria-label="Main"> with a Settings link (min-h-11). Dashboard and Subscriptions links come with T-006/T-017 (no dead links). aria-current only if cheap.
8. Tests: apps/web/lib/profile-settings.test.ts (fakes), apps/web/app/app/settings/settings.test.ts (parseSettingsForm, markup helpers).
Known gaps recorded: timezone validity enforced only in the server action (DB cannot check); T-006 must catch RangeError from bad timezone and fall back to UTC. No transaction between profile update and rebuild (idempotent retry covers it). Browser timezone default applies only client-side until the first save.
Criteria:
C1 valid input parses; reminder_days "3, 7, 7, 1" -> [7,3,1]. C2 timezone "Mars/Base" error, "Asia/Kuala_Lumpur" ok. C3 invalid: JPY, hour 24/-1, stop days 61/-1/1.5, reminder_days [], [0], [-1], [1.5], 6 items, [366] each fail on the right field; boundaries (0, 60, 0, 23, 1, 365, 5 items) pass. C4 display_name "  " -> null; 81 chars fails. C5 needsReminderRebuild: true when only timezone, hour or days change (order-insensitive); false when only name, currency or stop days change.
W1 fake db: profile + 2 subs with pending reminders; timezone changes to Asia/Kuala_Lumpur -> inserts at 09:00 MYT, status='skipped' updates for old pending ids, no update has a key other than status. W2 only currency changes -> no writes. W3 skipped reminder matching the new desired set is reopened (status pending), not inserted. W4 invalid input -> no db call, fieldErrors name the fields. W5 profile update error -> "server", no reminder query; reminders insert fails -> settings saved but reminders not updated. W6 no claims -> auth error, no db call. W7 parseSettingsForm "7, 3, 1" -> [7,3,1]; "7;3" -> field error; missing keys -> errors. W8 markup: each input has a label; errors have aria-describedby.
DB D1-D5 above (CI). pnpm typecheck, lint, format:check, test, build pass.
Manual/E2E later: M1 fresh user sees defaults, saves, reloads; keyboard-only works. M2 Settings link visible, 44px.
Reviewer: yes (DB migration + permission-sensitive writes).

## Design (Designer)
## Build notes (Builder)
Built. 132 tests, build ok (/app/settings dynamic). Migration 000005 (reminder_hour, reminder_days shape check incl. no null items, timezone length) + pgTAP. Deviations: DbLike uses insertReminder (one row at a time, returns pg error code, 23505=success) and setReminderStatus(ids,to) (filters on expected old status); SettingsForm takes action/initialState props; two inline eslint-disable in settings-form.tsx (browser tz effect). Unverified: SQL (CI), live Supabase, browser, axe, dark mode. Gaps: tz validity only in server action; no transaction; row-by-row insert (shortcut comment).
## Test report (Tester)
## Review verdict (Reviewer)
<!-- VERDICT: PASS | NEEDS_FIXES -->

## Developer sign-off
- [ ] Approved on:
