---
id: T-010
title: Daily safety sweep
status: BUILDING
milestone: MVP
ui: false
depends_on: [T-009]
completed:
fix_loops: 0
---

# T-010 Daily safety sweep

## Goal
Daily safety sweep. Planner refines this and writes Given/When/Then criteria before build.

## Acceptance criteria
- [ ] (Planner fills in)

## Plan (Planner)
DECISION (CEO confirmed): sweep logic lives in core as plain TS with injected I/O; a thin script run daily by a scheduled GitHub Actions workflow (an external trigger also catches a dead pg_cron). SQL only collects facts and decides nothing. Alert stub until T-011: log findings and exit code 1 (GitHub emails the failed run). A Vercel Cron wrapper can reuse runSweep later.
Files:
- NEW packages/core/src/sweep.ts (+ export in index.ts, + sweep.test.ts): pure rules + runSweep.
- NEW supabase/migrations/20261124000004_sweep_and_reminder_grants.sql: sweep_facts(), reminder grant tightening, transition trigger, reminders.provider_ref text (CEO confirmed), mark_reminder_result gets 4th param p_ref default null (drop old signature, recreate with same grants; set provider_ref on 'sent').
- NEW supabase/tests/database/sweep_facts.test.sql and reminder_client_grants.test.sql. CHANGE rls_user_isolation.test.sql only if needed (pending->skipped status update must still pass).
- NEW scripts/safety-sweep.ts (supabase-js glue, untested) and .github/workflows/safety-sweep.yml (cron `0 2 * * *` + workflow_dispatch; secrets SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FOUNDER_ALERT_EMAIL; permissions contents: read).
- Root package.json: add devDeps tsx and @supabase/supabase-js (CEO confirmed), root script "sweep": "tsx scripts/safety-sweep.ts". (tsx needed: Node strip-types cannot resolve core's extensionless imports.) Update lockfile.
- supabase/README.md: add sweep secrets setup.
Interfaces (core/sweep.ts):
SweepSub {id,userId,sub:ReminderSubInput,profile:ReminderProfile,existing:ExistingReminder[]}.
SweepFacts (JSON from sweep_facts()): overduePending{count,ids} (pending, fire_at < now-30min); failedRecent{count,ids} (failed, fire_at > now-7d); sentNoProof{count,ids}; vault{project_url:boolean,reminder_cron_secret:boolean}; cron{installed,jobActive,lastRunAt:string|null,failedRuns1h}; http{badResponses:number} (net._http_response non-2xx/timed_out/error_msg, window 6h).
Finding {code,severity:"warn"|"critical",detail,count?} (plus an "info" level for late_stop_date_no_reminder: add it to the severity union). evaluateFacts(f, now): Finding[] (pure).
SweepDb {facts(), listActiveSubs() (active subs with any anchor date >= today-2, joined with profiles and reminders, paged by 1000), apply(w: ReminderWrites)}. SweepAlerter {alert(findings)}. runSweep({db,alerter,now?}) -> {repaired, findings}.
SQL sweep_facts() returns jsonb: security definer, set search_path='', revoke from public, anon, authenticated, grant to service_role. Each section guarded (exception when others / extension exists) so installed:false works without pg_cron. Vault check = exists(select 1 from vault.secrets where name=...), no decrypt. Cron from cron.job (jobname send_due_reminders, active) and cron.job_run_details (last hour). HTTP from net._http_response, last 6 hours; verify column names. Delivery proof: in_app = status sent and sent_at not null; sentNoProof = status sent and (sent_at is null or sent_at < fire_at or claimed_until is not null); email also flagged when status sent, sent_at < now-1h and provider_ref is null.
Flow: runSweep: listActiveSubs; per sub planReminders(sub, {timezone, reminderDays, sendHour: reminder_hour ?? 9}, existing, now) then reminderWrites; db.apply only when inserts/skips/reopens exist; a repair is itself a finding "repaired". Then db.facts + evaluateFacts. No findings: silent, exit 0. Alerter throws: finish, exit 1. Critical findings: exit 1. facts failure: critical sweep_facts_failed. Per-sub errors (bad timezone -> bad_profile finding; apply failure -> finding) never stop the loop.
Grant tightening: revoke insert, update on public.reminders from authenticated; grant insert (subscription_id,user_id,type,channel,fire_at) to authenticated; grant update (status) to authenticated; keep select/delete and RLS. BEFORE UPDATE trigger (security invoker) raises 42501 when current_user='authenticated' and new.status is distinct from old.status unless pair is pending<->skipped. mark_reminder_result (definer) and service_role are not blocked. Contract for T-006: client reopen only sets status pending (cannot reset attempts or claimed_until); update the doc comment on reminderWrites.reopenIds and say so in the T-006 ticket (CEO does the ticket). T-011 still must cap client-inserted due email rows (quota abuse).
Edge: stop date with all fire times past -> info finding late_stop_date_no_reminder, no invented reminder, not a repair. Inactive subs: stale pending rows skipped (repair). reminder_hour missing/null -> 9. Alert repeats daily for 7 days (digest; accepted). Duplicate sweep runs idempotent (unique key).
Criteria:
1. Active sub, stop_date +10d, no rows: apply gets the 7/3/1 inserts (in_app+email); findings include repaired.
2. All rows exist: apply not called, findings empty, alerter not called.
3. Renewal only or trial with trial_end_date, no rows: renewal(-1d) or trial_end rows inserted.
4. Archived sub with pending future row: id in skipIds. Skipped row wanted again: id in reopenIds.
5. Stop date with all fire times past: no insert; info finding.
6. facts overduePending>0 -> critical overdue_pending; failedRecent>0 -> failed_reminders; sentNoProof>0 -> sent_no_proof.
7. vault.project_url=false, vault.reminder_cron_secret=false, cron.jobActive=false, cron.installed=false, failedRuns1h>0, lastRunAt older than 15 min, http.badResponses>0 each give their own critical finding; all good gives none.
8. Throwing alerter: runSweep resolves with findings. Throwing listActiveSubs or facts: critical finding, no silent crash.
9. Bad timezone on one profile: bad_profile for that sub, others processed.
10. pgTAP sweep_facts: pending row 2h overdue, failed row, sent row with sent_at null, in-flight pending row (not overdue) -> counts 1,1,1, in-flight not counted. anon/authenticated cannot execute sweep_facts(); service_role can. Vault flags false without secrets, true with.
11. pgTAP grants as authenticated: insert with status='sent' fails 42501; insert of the 5 allowed columns works (status pending, attempts 0); update of attempts, claimed_until, sent_at or last_error fails 42501; pending->sent and failed->pending fail; pending->skipped and skipped->pending work; insert for another user's sub fails; delete own rows works; mark_reminder_result still works as service_role (4-arg form; T-009 pgTAP file updated to match and still passes).
12. rls_user_isolation.test.sql still passes; migration applies on top of 000003 (CI).
13. typecheck, lint, test, format:check pass; workflow YAML valid with schedule and workflow_dispatch.
Reviewer required (DB, security, scheduler).

## Design (Designer)
## Build notes (Builder)
## Test report (Tester)
## Review verdict (Reviewer)
<!-- VERDICT: PASS | NEEDS_FIXES -->

## Developer sign-off
- [ ] Approved on:
