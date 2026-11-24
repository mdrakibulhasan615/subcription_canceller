---
id: T-014
title: Guides table, cancel guide page, report-a-problem button
status: DONE
milestone: MVP
ui: true
depends_on: [T-002]
completed: 2026-11-25
fix_loops: 0
---

# T-014 Guides table, cancel guide page, report-a-problem button
✅ DONE 2026-11-25 (DB verified in CI: 9 pgTAP files, 178 tests PASS)

## Goal
Guides table, cancel guide page, report-a-problem button. Planner refines this and writes Given/When/Then criteria before build.

## Acceptance criteria
- [x] (Planner fills in)

## Plan (Planner)
Design: no separate Designer step. Follow docs/design-system.md (cards, badge "soon" tone for stale, focus, 44px targets). READ node_modules/next/dist/docs (metadata API, generateStaticParams, revalidate, async params) before coding pages (apps/web/AGENTS.md).
Facts: guides table (000001) has id, kind(cancel|provider|store), service_slug, title, steps jsonb array, url, source_url, last_checked_at, updated_at; unique(kind,service_slug); anon+authenticated select only. No phone/email columns. feedback is unfit for anonymous reports. proxy.ts gates only /app so /guides is public.
Files:
- NEW packages/core/src/guides.ts (+ guides.test.ts, export in index.ts): guideStepSchema {text trim 1..500, link https only <=500 optional, note <=300 optional}; guideStepsSchema array max 30; guideKindSchema; guideSchema {kind, service_slug /^[a-z0-9-]{1,64}$/, title 1..120, steps min 1, url + source_url https nullable, contact_phone <=40 nullable, contact_email email nullable, last_checked_at iso date nullable, updated_at optional}; STALE_DAYS=120; isGuideStale(lastCheckedAt, todayIso) (null = stale; >120 days stale; exactly 120 not stale); matchGuideSlug(name) -> {kind,slug}|null (lowercase, drop punctuation except "+", whole-word alias match, longest alias wins; aliases: netflix; spotify; youtube premium|youtube|yt premium -> youtube-premium; disney+|disney plus -> disney-plus; amazon prime|prime video|prime -> amazon-prime; adobe|creative cloud -> adobe-creative-cloud; microsoft 365|office 365|m365 -> microsoft-365; chatgpt|chatgpt plus|openai -> chatgpt-plus; app store|itunes|apple -> store/apple-app-store; google play|play store -> store/google-play; wise -> provider/wise); guideReportSchema {kind, slug, message trim 5..500, website? honeypot}.
- NEW packages/core/src/guides-data/<kind>--<slug>.json one file per guide (content source of truth = build fallback = seed). T-016 and T-015 only add files. Ship ONE sample file now (cancel--netflix.json) clearly DRAFT with last_checked_at null so pages and tests have data; do NOT invent verified dates. NEW guides-data.test.ts globs the folder: each file passes guideSchema, filename matches kind--slug, steps non-empty, no step uses the word "cancelled" for our own action; source_url required, last_checked_at may be null for drafts (stale badge shows).
- NEW supabase/migrations/20261124000006_guides_reports.sql: guides.contact_phone, guides.contact_email (nullable text, length checks); CHECK url and source_url start with https://; table guide_reports(id uuid pk, guide_id uuid not null references guides on delete cascade + index, message text not null check length 5..500, created_at default now(), status text default 'open' check open|fixed|dismissed); RLS on; revoke all from anon, authenticated; grant insert (guide_id, message) to anon and authenticated; policy insert with check (true); no select/update/delete for clients; BEFORE INSERT trigger (SECURITY DEFINER, set search_path='') raising when >20 rows for that guide in the last hour or >200 rows total in the last hour (global cap); no IP, email or user_id stored.
- NEW supabase/tests/database/guide_reports.test.sql (pgTAP): anon can insert (guide_id,message); anon/authenticated cannot select/update/delete reports; message >500 fails 23514; 21st insert in an hour for one guide fails; anon still cannot write guides; non-https url fails the CHECK.
- NEW apps/web/lib/guides.ts: loadGuides(), loadGuide(kind,slug), submitGuideReport(client,{kind,slug,message}); plain anon client (getAnonClient from lib/waitlist.ts), pages static with `export const revalidate = 3600`; missing env or DB error or invalid row -> fall back to the JSON files (never throw; build must work with no env); validate DB rows with guideSchema (skip invalid, fall back for same kind/slug).
- NEW apps/web/app/guides/page.tsx (index grouped: Cancel guides, Store, Provider; card links), app/guides/[kind]/[slug]/page.tsx (generateMetadata, generateStaticParams from fallback + DB without throwing; notFound() for unknown kind/slug, validate kind first), app/guides/report-button.tsx (client; visible label; honeypot hidden field; aria-live status; disabled while sending; copy "Thanks. We will check this guide." no promise of reply), app/api/guide-report/route.ts (+ route.test.ts): POST {kind,slug,message,website?}; 200 {ok:true} (also for honeypot, no insert); 400 invalid; 404 not_found; 429 + Retry-After (reuse lib/rate-limit.ts key "report:"+ip); 500 server (no internals).
- NEW scripts/seed-guides.ts + root script `seed:guides`: upserts the JSON files on (kind,service_slug) with the service role (like pnpm sweep); idempotent; uses last_checked_at from the JSON only.
- Landing page footer: add link to /guides. app/sitemap.ts only if cheap (optional).
Detail page renders: h1 title; honest note "Freezing or closing a card does not cancel a subscription. Cancel with the merchant first. Payments stop on the date you set."; ordered steps (text, optional link rel="noopener noreferrer", optional note); "Official page" link; tel:/mailto: only if present (no empty labels); Source link; "Last checked <date>" (fixed locale, UTC) or "Not checked yet"; stale badge (icon + text "May be out of date", soon tone) when isGuideStale. Title "How to cancel <title> | {BRAND}" (BRAND constant), description from the first step (<=160), canonical URL. Never render a URL that failed the schema. Copy never says "cancelled" for our own action.
Scope decision (CEO): D7's 10 guides = 8 cancel guides (T-016) + Apple App Store and Google Play as kind store (T-015) + Wise as kind provider (T-015).
Do not touch T-006/T-007 files (apps/web/app/app/**, lib/profile-settings.ts).
Criteria:
1. Guide exists, signed-out visitor opens /guides: 200, lists it with a link to /guides/<kind>/<slug>.
2. Supabase env missing: pnpm build and page render without error, guides come from JSON.
3. Guide page shows steps in order, links with rel noopener noreferrer, "Last checked <date>", and the "Freezing or closing a card does not cancel" note.
4. last_checked_at 121 days before today -> stale badge; exactly 120 -> none; null -> badge.
5. contact_phone/email set -> tel:/mailto: link; neither -> no label.
6. Unknown slug or kind -> 404.
7. Valid report -> 200 and one guide_reports row with the right guide_id (fake client in Vitest).
8. Honeypot filled -> 200, no insert.
9. 6th report from one IP in 10 min -> 429 + Retry-After.
10. Message <5 or >500 chars -> 400.
11. pgTAP as listed above (verified by the DB workflow in CI).
12. guideStepsSchema rejects non-array and steps with an http link.
13. matchGuideSlug("Netflix Premium"), "Disney Plus", "YouTube Premium family", "Amazon Prime Video", "Apple App Store" match correctly; "Gym" -> null; case-insensitive.
14. Each guides-data file passes guideSchema and its filename matches kind and slug.
15. Each guide page has a unique title, description and canonical URL; index has a title.
16. One h1, ordered headings, 44px targets, visible focus, labelled form fields, stale badge has icon + text.
17. typecheck, lint, format:check, test, build (no env) pass.
Reviewer: skip unless the Tester finds a security issue (public insert table is covered by pgTAP + the DB cap).

## Design (Designer)
## Build notes (Builder)
## Test report (Tester)
PASS. 181 tests. Curl: /guides and /guides/cancel/netflix 200, unknown 404, report API 400/200 honeypot/429+Retry-After/500 without DB. CI DB green (guide_reports ok, no regressions). CEO fix: removed bare "apple" alias (Apple Music/iCloud false positives). Open: isGuideStale fails open on garbage dates (unreachable: schema validates), contact_phone only length-capped. Note: each new guide needs one import in guides-data/index.ts (test fails otherwise). Dev actions: run `pnpm seed:guides` before launch (reports need seeded rows); set NEXT_PUBLIC_SITE_URL. Reviewer skipped.
## Review verdict (Reviewer)
<!-- VERDICT: PASS | NEEDS_FIXES -->

## Developer sign-off
- [x] Approved on: 2026-11-25 (CEO, standing order)
