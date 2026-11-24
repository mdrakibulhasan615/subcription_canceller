---
id: T-002
title: Supabase schema, migrations, RLS, RLS tests
status: DONE
milestone: MVP
ui: false
depends_on: [T-001]
completed: 2026-11-24
fix_loops: 0
---

# T-002 Supabase schema, migrations, RLS, RLS tests
✅ DONE 2026-11-24 (UNVERIFIED: SQL never executed; proof = first green db CI run)

## Goal
Supabase schema, migrations, RLS, RLS tests. Planner refines this and writes Given/When/Then criteria before build.

## Acceptance criteria
- [x] (Planner fills in)

## Plan (Planner)
Env: no Docker, no Supabase CLI, no psql, no GitHub remote. Builder writes SQL and pgTAP tests but cannot run them. Ticket ends "DONE (unverified)" until a green `db` CI run. Reviewer reads the SQL.
Files (all new, touch only these): supabase/config.toml (supabase init defaults, project_id only), supabase/migrations/<ts>_init_schema.sql, supabase/migrations/<ts>_rls.sql, supabase/tests/database/*.test.sql (rls_user_isolation, rls_public_tables, schema_sanity, triggers), .github/workflows/db.yml (new file; do not edit ci.yml; supabase/setup-cli pinned to a looked-up stable version; `supabase db start` then `supabase test db`; trigger on supabase/** changes and push to main; permissions contents: read). No seed.sql. Do not touch packages/core, apps/web, or root package.json.
Check .prettierignore so SQL/TOML files do not break format:check.

Schema (text + CHECK, no Postgres enums; all timestamps timestamptz; index every FK):
- profiles: id uuid PK -> auth.users(id) on delete cascade; email; display_name; timezone default 'UTC'; currency default 'USD' check USD,MYR,EUR,GBP; default_stop_days_before int default 3 check 0..60; reminder_days int[] default {7,3,1} (each >0); created_at; updated_at.
- subscriptions: id uuid default gen_random_uuid(); user_id -> profiles(id) cascade; name (len 1..200); category; price_minor int >=0; currency check; billing_cycle check weekly,monthly,quarterly,yearly,custom; billing_interval int default 1 check >0 (custom = days); next_renewal_date date; cancel_by_date; stop_date; is_trial bool default false; trial_end_date; payment_method_type default 'none' check none,wise,privacy,other_virtual,managed; card_nickname (comment: never store card numbers); cancel_url; notes; stop_confirmed_at timestamptz (CEO: new; D13); merchant_cancelled_at; archived_at; created_at; updated_at. CHECK is_trial=false or trial_end_date not null. CEO DECISION: NO stored `status` column. Status is derived in core (deriveStatus) from stop_date, stop_confirmed_at, merchant_cancelled_at.
- reminders: id; subscription_id -> subscriptions cascade; user_id -> profiles cascade; type check stop_date,renewal,trial_end; fire_at; channel check in_app,email,push; status default 'pending' check pending,sent,failed,skipped; attempts default 0 >=0; last_error; sent_at; created_at. UNIQUE(subscription_id,type,channel,fire_at).
- guides: id; kind check cancel,provider,store; service_slug not null; title not null; steps jsonb default '[]' check jsonb_typeof='array'; url; source_url; last_checked_at date; updated_at; UNIQUE(kind,service_slug).
- push_subscriptions: id; user_id; endpoint not null; keys jsonb not null; created_at; UNIQUE(user_id,endpoint).
- events: id; user_id null -> profiles on delete set null; name (len<=100); props jsonb default '{}' check pg_column_size(props)<4096; created_at.
- feedback: id; user_id not null; key not null; value (len<=2000); created_at. No unique key.
- audit_log: id; user_id -> profiles on delete set null; action; entity; entity_id uuid; before jsonb; after jsonb; created_at.
- waitlist: id; email not null (len<=254, contains @ at pos>1); source; created_at; unique index on lower(email).
Functions: set_updated_at() BEFORE UPDATE on profiles, subscriptions, guides (use clock_timestamp()). handle_new_user() SECURITY DEFINER, set search_path='', inserts (id,email) into public.profiles ON CONFLICT DO NOTHING; trigger AFTER INSERT on auth.users. Revoke execute on both from public, anon, authenticated.
Indexes: subscriptions(user_id,stop_date) where archived_at is null; reminders(fire_at) where status='pending'; plus FK indexes; events(name,created_at); audit_log(user_id,created_at).

RLS (enable on all 9 tables; use (select auth.uid()); always `to anon`/`to authenticated`): first revoke all on all public tables from anon and authenticated, then grant only what policies need.
- profiles: select/update own. No insert/delete for clients.
- subscriptions: select/insert/update/delete own; WITH CHECK user_id = uid.
- reminders: select own; insert/update/delete own with WITH CHECK that the subscription belongs to the user (exists check). (Accepted for MVP: clients may set status; T-009 uses service role. Tighten later.)
- guides: select for anon + authenticated; no writes.
- push_subscriptions: own CRUD.
- events: INSERT for anon (user_id must be null) and authenticated (user_id null or own). No select/update/delete.
- feedback: authenticated insert own, select own.
- audit_log: authenticated select own. No client writes.
- waitlist: INSERT only for anon + authenticated. No select (note in migration comment: client must use plain insert and ignore the duplicate error; no returning, no on conflict).

pgTAP: begin; plan(n); ... finish(); rollback. Two users inserted into auth.users; use `set local role authenticated` plus `set local request.jwt.claims` (repeat the small helper per file; no extra extension). Assert row counts for select/update/delete (RLS filters silently), 42501 for denied inserts. schema_sanity: count of public tables with rowsecurity=false must be 0 (fails when a later ticket forgets RLS).

Acceptance criteria (Given/When/Then; Builder writes a test for each):
1. Empty DB, `supabase db reset` applies cleanly; the 9 tables exist.
2. Every public table has rowsecurity true.
3. New auth.users row gives exactly one profile with defaults (UTC, USD, 3, {7,3,1}).
4. A sees only A's subscriptions.
5. A update/delete of B's subscription changes 0 rows.
6. A inserting a subscription with user_id=B fails 42501. 7. A moving own row to user_id=B fails 42501.
8. A inserting a reminder for B's subscription fails 42501.
9. A sees 0 of B's reminders, push_subscriptions, feedback, audit_log, profiles; update/delete change 0 rows.
10. authenticated insert into audit_log fails.
11. guides: anon and authenticated can select; writes fail or change 0 rows.
12. waitlist: anon insert ok; select/update/delete see/change nothing; same email in other case fails 23505; bad email fails 23514.
13. events: anon null user ok; anon with user_id fails; authenticated user_id=B fails; own or null ok; nobody selects rows.
14. anon with no JWT: 0 rows or denied on private tables; inserts fail.
15. updated_at moves forward on update for profiles, subscriptions, guides.
16. Check violations (23514): price -1, currency JPY, cycle 'daily', trial without end date.
17. Duplicate reminder (subscription_id,type,channel,fire_at) fails 23505.
18. Deleting auth.users row removes profile, subscriptions, reminders, push_subscriptions, feedback; events and audit_log stay with user_id null.
19. handle_new_user and set_updated_at cannot be called by anon or authenticated.
20. db.yml runs `supabase test db` on supabase/** changes (provable only with a remote).
21. pnpm typecheck, lint, format:check, test still pass.

## Design (Designer)
## Build notes (Builder)
Built, NOT executed (no Docker/CLI). Files: supabase/config.toml, migrations 20261124000001_init_schema.sql and 20261124000002_rls.sql, 4 pgTAP files in supabase/tests/database, .github/workflows/db.yml (setup-cli v3.2.0, CLI 3.3.0), .prettierignore adds supabase. No status column; stop_confirmed_at added. Tests use no_plan(). Denied-grant cases expect 42501. profiles update grant covers all columns (email editable by owner). Unverified: auth.users bare insert, temp tables after set local role, minimal config.toml, db.yml path filter. Proof comes from the first green db CI run.
## Test report (Tester)
## Review verdict (Reviewer)
VERDICT: PASS. No blockers. CEO applied the recommendation: column-level UPDATE grant on profiles (email and created_at not writable) + test; reminders exists-check qualified as reminders.subscription_id. T-004 must add reminder_hour to that grant. Risks for first CI run: `supabase db start` name in CLI 3.3.0, config.toml with only project_id, bare insert into auth.users.
<!-- VERDICT: PASS | NEEDS_FIXES -->

## Developer sign-off
- [x] Approved on: 2026-11-24 (CEO, standing order)
