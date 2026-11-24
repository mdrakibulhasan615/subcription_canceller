---
id: T-011
title: Email channel (Resend) and in-app notifications
status: REVIEWING
milestone: MVP
ui: true
depends_on: [T-009]
completed:
fix_loops: 0
---

# T-011 Email channel (Resend) and in-app notifications

## Goal
Email channel (Resend) and in-app notifications. Planner refines this and writes Given/When/Then criteria before build.

## Acceptance criteria
- [ ] (Planner fills in)

## Plan (Planner)
Design: no separate Designer step. Follow docs/design-system.md. READ node_modules/next/dist/docs (server actions, revalidatePath) first (apps/web/AGENTS.md).
Facts: claim_due_reminders returns only sub_name, the three dates and sub_inactive. Clients can UPDATE only reminders.status (column grant, 000004). The in_app sender marks rows sent at fire time, so the in-app list = the `sent` in_app rows. rebuildReminders (apps/web/lib/profile-settings.ts and one in subscriptions.ts) inserts rows one request at a time, any error other than 23505 is a failure.
NEW migration supabase/migrations/20261124000007_notifications_email.sql (renumber if another migration landed first):
1. Drop and recreate claim_due_reminders(int): keep every existing column; add subscription_id (if missing), cancel_url, price_minor, currency, timezone, email_reminders. Re-run revoke from public/anon/authenticated, grant to service_role. Existing reminder_sender tests must pass (update only for new columns).
2. alter table profiles add column email_reminders boolean not null default true; grant update (email_reminders) on profiles to authenticated.
3. alter table reminders add column read_at timestamptz; grant update (read_at) on reminders to authenticated; partial index on reminders(user_id) where channel='in_app' and status='sent' and read_at is null. The status guard trigger needs no change.
4. One-off reopen: set status='pending', attempts=0, claimed_until=null, last_error=null where status in ('failed','pending') and last_error='email not configured' and fire_at > now() - interval '1 day'. Idempotent; touches 0 rows on a fresh DB (CI proves only that it applies).
5. Cap trigger reminders_cap_insert: BEFORE INSERT, security invoker, search_path=''. Does nothing unless current_user='authenticated'. Takes pg_advisory_xact_lock(hashtext(new.user_id::text)) first (rebuildReminders inserts in parallel). If the user has >=1000 pending rows raise errcode 54000. Revoke execute on the function from public, anon, authenticated. service_role never capped.
Edge Function supabase/functions/send_due_reminders/ (pure TS, no core import):
- email-template.ts: renderReminderEmail(r,{appUrl,brand})->{subject,text,html}; renderFounderAlert(r,error,o); own HTML escape.
- resend.ts: createResendTransport({apiKey,from,fetch=globalThis.fetch}) -> {sendEmail({to,subject,text,html,idempotencyKey})->Promise<string>}. POST https://api.resend.com/emails, Authorization Bearer, JSON {from,to:[addr],subject,text,html}, header Idempotency-Key = reminder id, AbortSignal.timeout(10000). 2xx with {id} returns id; else throw Error("resend <status>") with no key and no body in the message.
- senders.ts: replace stubEmailSender with emailReminderSender(transport,opts); keep a stub for the unconfigured case; alertFounder(transport,founderEmail,opts) builds a real body.
- handler.ts: ClaimedReminder gains subscriptionId, cancelUrl, priceMinor, currency, timezone, stopDate, nextRenewalDate, trialEndDate, emailReminders. ChannelSender.send returns Promise<string|void> (provider ref). SenderDb.mark(id,outcome,error?,ref?). Rules: skip an email row when emailReminders===false; skip any row whose key date (by type: stop_date, next_renewal_date, trial_end_date) is already past. RunDeps gets now?: () => Date.
- index.ts: map new columns; send p_ref in the mark rpc; secrets RESEND_API_KEY, EMAIL_FROM, APP_URL, FOUNDER_ALERT_EMAIL, APP_NAME (default "StopDate"; the Function cannot import core BRAND; CEO confirmed). If RESEND_API_KEY or EMAIL_FROM missing, use the stub.
- Update handler.test.ts; add email-template.test.ts and resend.test.ts.
Email content (ASD-STE style, all types): "Payments stop on <date>."; "Freeze or close your card a few days before the renewal date, not on it."; "Blocking a card does not cancel the subscription. Cancel with <merchant> too." followed by the cancel link if present. Subject e.g. "Netflix: payments stop on 12 Dec 2026". Never "cancelled". Footer says why the user got the email and links to notification settings (APP_URL/app/settings). App link APP_URL/app/subscriptions (one constant; T-007 may change it). Cancel link only if cancelUrl.trim() starts with http:// or https:// (escaped href; never javascript:). Price via Intl.NumberFormat('en',{style:'currency',currency}) with price_minor/100. Dates as UTC date-only like "12 Dec 2026". In-app text = same sentences, shorter. Founder alert body: reminder id, type, channel, attempts, error text, fire_at, user_id, subscription_id; NO user email and NO sub name.
Web /app/notifications:
- apps/web/lib/notifications.ts (pure + thin adapter): notificationText(type,sub,now); formatBadge(n) (cap "9+"); listNotifications(sb): reminders joined to subscriptions(name, stop_date, next_renewal_date, trial_end_date) where channel='in_app' and status='sent', order fire_at desc, limit 50; unreadCount(sb): head count where read_at is null (0 on error); markRead(sb, ids|'all'): update({read_at: now}).is('read_at', null).
- app/app/notifications/page.tsx (server): h1, list, unread marker NOT colour-only, "Mark all as read" and per-item "Mark read" buttons, empty state; actions.ts (server actions; async function declarations only) with revalidatePath('/app','layout').
- layout.tsx (small edit, ~8 lines): unreadCount(await createClient()), add <Link href="/app/notifications">Notifications</Link> in the nav with a badge only when count>0 and aria-label="Notifications, N unread". Do not touch the T-006 subscriptions files.
Settings (T-004 files, small edits): core profileSettingsSchema and ProfileSettings get email_reminders: boolean; lib/profile-settings.ts add email_reminders to PROFILE_COLS and FIELD_MESSAGES; settings/form-utils.ts parse checkbox as formData.get(...)==='on'; update settings-form.tsx, settings/page.tsx initial values, and the existing settings and profile-settings tests. Label "Send reminders by email", help "In-app reminders stay on." No change to core reminder planning (opted-out email rows are skipped at send time).
Docs: supabase/README.md gets the go-live checklist (below) and fix the stale line about FOUNDER_ALERT_EMAIL.
Go-live checklist (README): 1 Resend: add sending domain + DNS (SPF, DKIM, DMARC), wait Verified, create a send-only API key (free tier 100/day, 3000/month; onboarding@resend.dev only sends to the account owner). 2 `supabase secrets set RESEND_API_KEY=... EMAIL_FROM="StopDate <reminders@yourdomain>" APP_URL=https://<app> APP_NAME=StopDate CRON_SECRET=... FOUNDER_ALERT_EMAIL=...`. 3 `supabase db push`, `supabase functions deploy send_due_reminders`. 4 Create the Vault secrets LAST (missing Vault entries keep the cron inert). 5 Test send: insert one due email row for your own account, call the function with curl and the x-cron-secret header; check mail, links, copy, row sent, provider_ref equals the Resend dashboard id. 6 Failure test: bad API key -> failed + founder alert; restore key. 7 Create Vault secrets project_url and reminder_cron_secret; check cron.job_run_details shows 200. 8 Add GitHub secret FOUNDER_ALERT_EMAIL; run the sweep workflow once by hand. 9 Confirm verify_jwt is off for the function.
Criteria:
1. Due email reminder with cancel_url: Resend gets one POST with Bearer auth and Idempotency-Key = reminder id, text and HTML bodies; row sent with provider_ref = Resend id.
2. Text and HTML contain "payments stop on", the freeze/close advice, the "blocking a card does not cancel" sentence, the merchant cancel link, the app link and the settings link; no "cancelled".
3. cancel_url `javascript:alert(1)` or empty: no cancel link. Sub name with <script>: HTML escaped.
4. Resend returns 500 three times: row ends failed and one founder email goes out with reminder id, error, type, channel and no user email.
5. Unconfigured: email rows fail "email not configured"; in_app rows still send.
6. email_reminders=false: email row skipped, no HTTP call; in_app unaffected.
7. Stop_date reminder whose stop_date is before today is skipped.
8. DB: failed rows with last_error 'email not configured' and fire_at within 1 day become pending, attempts 0, no lease; older rows and other errors unchanged.
9. DB: client with 1000 pending rows inserting another gets 54000; another user can insert; after deleting or skipping one, insert works; service_role never capped.
10. DB: client can set read_at on own rows; not on another user's (0 rows); still cannot update attempts, sent_at, claimed_until; existing reminder_client_grants tests pass.
11. DB: claim_due_reminders returns the new columns, runs only for service_role; existing reminder_sender tests pass.
12. UI: 3 unread sent in_app rows -> three messages newest first with unread markers, nav badge 3 with accessible name; "Mark all as read" removes the badge; other users' rows never show.
13. Settings: email_reminders false -> checkbox unchecked; saving unchecked stores false.
14. README has the go-live checklist; sweep line fixed.
15. typecheck, lint, test, format:check pass; DB workflow green.
Tests (Vitest, no Docker): email-template, resend (fake fetch: headers, body, id, error mapping with no key), handler (ref passing, opt-out, stale skip, alert body), lib/notifications (fake client), updated settings tests. pgTAP written now, run only in CI: notifications_read.test.sql, reminders_cap.test.sql, additions to reminder_sender.test.sql for the claim columns. State in build notes that the reopen one-off is checked by hand on the real project.
Reviewer: yes (email, cap trigger, grants).

## Design (Designer)
## Build notes (Builder)
Built. 227 tests, build ok. SQL not run locally (CI). Migration 000007 + 3 pgTAP files; Edge Function email-template/resend/senders/handler/index updated; README go-live checklist; core + settings email_reminders; notifications lib + page + actions; layout nav badge. Deviations: one-line edit in lib/subscriptions.test.ts (email_reminders:true); prettier --write over apps/web/app/app and lib; email/in-app date = key date by type so a RENEWAL reminder reads "Payments stop on <renewal date>" (CEO concern: wrong wording for renewals, Reviewer to check/fix); alert shows attempts+1; alertFounder takes null transport when unconfigured and throws; unread marker icon + "Unread" text. Unverified: SQL/cap trigger under parallel inserts, reopen one-off, Deno index.ts, live Resend, browser. If APP_URL unset, email links are relative.
## Test report (Tester)
## Review verdict (Reviewer)
<!-- VERDICT: PASS | NEEDS_FIXES -->

## Developer sign-off
- [ ] Approved on:
