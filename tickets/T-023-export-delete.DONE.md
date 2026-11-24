---
id: T-023
title: Data export and account delete
status: DONE
milestone: MVP
ui: true
depends_on: [T-004]
completed: 2026-11-25
fix_loops: 1
---

# T-023 Data export and account delete
✅ DONE 2026-11-25 (DB verified in CI on c385e3c: 12 pgTAP files, 207 tests)

## Goal
Data export and account delete. Planner refines this and writes Given/When/Then criteria before build.

## Acceptance criteria
- [x] (Planner fills in)

## Plan (Planner)
Design: no separate Designer step. Follow docs/design-system.md (destructive button tokens, labels, visible focus, role="alert" errors, AA contrast). READ the Next docs (route handlers, server actions, redirect) first (apps/web/AGENTS.md).
DECISIONS (CEO accepted all): new page /app/settings/data (settings form untouched; settings/page.tsx gets one link "Your data"). DELETE = immediate hard delete ("Deleted now. Cannot be undone."; no soft delete). Export uses the user JWT + RLS only; the service role is used only by delete. Waitlist rows with the user's email are deleted too (lower(email) match, admin client, before the user delete). Re-auth: typed "DELETE" + the account email, plus a recent-session check (claims.iat within 15 minutes, else "Sign in again, then retry" with a sign-out link). Profile with null email: block delete with "contact us". Add dependency `server-only` to apps/web (exact pin) for admin.ts.
Not in export: events (insert-only RLS), guide_reports (no user link), push_subscriptions.keys (secrets; export endpoint + created_at only), waitlist (no select grant): the page copy lists the exclusions and why. In export: profile, subscriptions, reminders (incl. status, read_at), feedback, audit_log, push_subscriptions (endpoint only).
DB facts: profiles.id -> auth.users ON DELETE CASCADE; subscriptions, reminders, push_subscriptions, feedback -> profiles CASCADE; events.user_id and audit_log.user_id SET NULL; waitlist and guide_reports have no FK. So admin.auth.admin.deleteUser(id) removes everything except waitlist rows. Verify supabase/functions handler: mark_reminder_result on a missing id is a no-op (a send may already have started: one last email is possible; copy says so).
Add:
- apps/web/lib/export.ts (pure; no next/supabase imports): EXPORT_SCHEMA_VERSION = 1; buildJsonExport(rows,now) -> {schema_version:1, exported_at ISO, user_id, profile, subscriptions, reminders, feedback, audit_log, push_subscriptions}; neutralizeCell(v: string) (if the first char is = + - @ TAB or CR, prefix "'"), csvEscape (quote when comma, quote (doubled), CR or LF; neutralize first, then escape); subscriptionsToCsv(rows): fixed header (name, category, price, currency, billing_cycle, billing_interval, next_renewal_date, cancel_by_date, stop_date, is_trial, trial_end_date, payment_method_type, card_nickname, cancel_url, notes, created_at, archived_at), CRLF lines, UTF-8 BOM prefix, null -> empty cell; numbers (price) pass as numbers without a quote prefix, only string fields are neutralised (code comment).
- apps/web/lib/export-data.ts: loadExport(supabase,userId) with the USER client; every select adds .eq("user_id", userId) (profile: .eq("id", userId)) as a second guard; if a result length equals the row cap (use .limit(10000)) fail loudly (500 "too large"), never truncate silently; any select error -> 500, never a partial file.
- apps/web/app/api/export/json/route.ts and csv/route.ts (GET): 200 with Content-Disposition attachment filename `<brand-lowercase>-export-YYYY-MM-DD.json|csv` (brand from @app/core, not hard-coded), Cache-Control no-store, application/json or text/csv; charset=utf-8; 401 {error} without claims (no data query made); 429 + Retry-After from rateLimit(`export:${userId}`); 500 {error}. String body (small data; shortcut comment: no pagination/streaming).
- apps/web/lib/account.ts (pure, injected deps): deleteAccount(deps:{getUser(): {id,email,iat?}|null; admin:{deleteWaitlistByEmail(email), deleteUser(id)->{error}}; signOut(); rateLimit(key)->{ok,retryAfterSec}}, form:{confirm,email}) -> {status:"ok"}|{status:"error", code:"auth"|"confirm"|"rate"|"recent"|"no_email"|"server", message}. Order: auth -> rateLimit(`delete:${userId}`, counts all attempts) -> confirm (=== "DELETE" case-sensitive AND trimmed lowercased form email equals account email; take the email from the verified claims/profile, not the form) -> recent-session check -> deleteWaitlistByEmail(email) (on failure stop, nothing else deleted, idempotent retry) -> deleteUser(id) ("user not found" counts as success) -> signOut() (try/catch, ignore errors) -> ok. No pre-delete audit row (it would be orphaned); no PII logging.
- apps/web/lib/supabase/admin.ts: `import "server-only"`; createAdminClient() with SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY, auth persistSession false; imported only from data/actions.ts. Missing key -> server error, deletes nothing.
- apps/web/app/app/settings/data/{page.tsx (server), delete-form.tsx (client, useActionState), actions.ts ("use server": deleteAccountAction; on ok redirect("/goodbye") OUTSIDE try/catch)}. apps/web/app/goodbye/page.tsx (public; add "/goodbye" to the public list in lib/auth-routes.ts: one-line edit + test; /privacy and /terms are handled by T-022).
- Edit settings/page.tsx: link only.
Service role setup: README line (supabase/README.md or root README): Vercel Project Settings > Environment Variables: SUPABASE_SERVICE_ROLE_KEY (Production, Sensitive, never NEXT_PUBLIC; SUPABASE_URL can reuse NEXT_PUBLIC_SUPABASE_URL); local apps/web/.env.local (verify gitignored). Add to .env.example (name only, empty).
Copy: export page "Download a copy of the data we hold about you. JSON has everything. CSV has your subscriptions only (opens in Excel and Sheets). We do not include anonymous usage events or other people's data." Delete: "This deletes your account, subscriptions, reminders and feedback now. It cannot be undone. Download your data first. If you joined our waitlist with this email, we delete that too. Some copies remain outside our database: error reports (Sentry) and email logs (Resend) keep data for a short time under their own rules. A reminder email already being sent may still arrive." Goodbye: "Your account is deleted. We signed you out." Link the privacy page.
Edge cases: no session -> export 401 / action auth error; wrong or empty confirm, lowercase "delete", wrong email rejected; rate limit hit -> message with minutes; double submit/second tab -> user-not-found = success; export with zero rows -> valid empty JSON arrays / CSV header only; cells with = + - @ tab CR, quotes, commas, newlines, unicode, null; notes starting with "'" prefixed only when the first char is a trigger.
Criteria:
1. GET /api/export/json (signed in): 200, attachment with dated filename, schema_version 1, ISO exported_at, keys profile, subscriptions, reminders, feedback, audit_log, push_subscriptions; no push secrets.
2. Users A and B: A's export queries all carry the user_id eq; no B rows.
3. No session: export json and csv return 401, no data query.
4. CSV names "=cmd|' /C calc'!A0", "+1", "-2+3", "@SUM(A1)", "\tx", "\rx" each get a leading single quote; "Netflix" unchanged; numeric price not prefixed.
5. Note a,"b"\nc: wrapped in quotes, inner quotes doubled, newline kept inside quotes; CRLF rows; header row; BOM.
6. Zero data: empty arrays / header-only CSV.
7. 6th export in 10 minutes -> 429 + Retry-After.
8. Query error or row cap hit -> 500, no partial body.
9. Settings page has the link; data page has Download JSON / CSV links (<a href download>) and the delete form with labels, visible focus, role="alert" errors, AA contrast.
10. Confirm "delete" or wrong email: error, admin never called, still signed in.
11. Valid confirm: calls in order rateLimit, deleteWaitlistByEmail, deleteUser, signOut, then redirect /goodbye.
12. Rate limit exhausted: code rate, no admin call.
13. deleteWaitlistByEmail fails: deleteUser not called, still signed in, error shown.
14. deleteUser "user not found": success (idempotent), signed out, redirected.
15. deleteUser other error: "server", no signOut, no redirect.
16. SUPABASE_SERVICE_ROLE_KEY read only in lib/supabase/admin.ts (imports "server-only"); no NEXT_PUBLIC variant; a test asserts no "use client" file imports it.
17. Anonymous visitor opens /goodbye: 200.
18. Old session (iat > 15 minutes): "recent" error, nothing deleted. Null account email: "no_email" error.
19. Copy lines about waitlist, Sentry/Resend, in-flight email exist verbatim.
Tests (Vitest, no Docker): lib/export.test.ts (1,4,5,6); route tests with a fake supabase client recording calls (2,3,7,8); lib/account.test.ts with a fake admin and recorded call order (10-15,18); source-scan test (16); auth-routes test for /goodbye. Optional: a pgTAP test in a NEW file that deleting an auth user empties all child tables and nulls events/audit_log (CI proves the cascade).
Reviewer: YES (irreversible delete, service role).

CEO NOTE (from T-018): CSV export must neutralise formula injection: prefix a single quote to any cell starting with = + - @ tab or CR. Store data as typed; neutralise only on export.
## Design (Designer)
## Build notes (Builder)
## Test report (Tester)
After fix loop 1 (355 tests, lint/typecheck/format/build ok): export pages with .order(id).range() and throws too_large at 10000 (tests: full first page -> second request; cap -> 500 no body); waitlist delete is `.eq("email", lowercased)` (test with `*%_\@example.com`: eq gets the exact string, ilike never called); recent-session check uses authTimeFromAmr (max amr timestamp; missing -> "recent" error). Re-review skipped (fixes were exact and covered by tests). MANUAL go-live checks: a real session's amr claim shape/timestamps and the 1000-row page size against a live Supabase project; real service-role delete + cookie clearing; the by-hand Resend/vault steps. Dev action: set SUPABASE_SERVICE_ROLE_KEY on Vercel (Sensitive, never NEXT_PUBLIC).
## Review verdict (Reviewer)
VERDICT: NEEDS_FIXES (loop 1). BLOCKING: (1) export-data.ts: PostgREST max_rows 1000 default makes .limit(10000) + length>=cap check never fire: silent truncation; fix = page with .order(id).range(), throw too_large at 10000, test a second request. (2) settings/data/actions.ts: waitlist delete via ilike: `*` is a PostgREST wildcard so `*@company.com` could delete a domain with the admin client; fix = .eq("email", lowercased). (3) account.ts: recent-session check used iat (= last token refresh): wrong both ways; CEO accepted spec change: use max(amr[].timestamp), missing amr => "recent" error. Checked OK: order of steps, user-not-found detection, signOut after delete, redirect outside try/catch, lazy admin client, key never leaked, export RLS-only, push keys excluded, CSV neutralisation, legal text matches, pgTAP account_delete_cascade valid. Evidence: CI and DB runs green on c385e3c (12 pgTAP files, 207 tests PASS, incl. account_delete_cascade). Non-blocking: leading-space-before-= and full-width lookalikes outside the OWASP set.
<!-- VERDICT: PASS | NEEDS_FIXES -->

## Developer sign-off
- [x] Approved on: 2026-11-25 (CEO, standing order)
