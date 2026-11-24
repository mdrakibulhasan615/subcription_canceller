---
id: T-016
title: Draft 10 guides content; developer verifies
status: DONE
milestone: MVP
ui: false
depends_on: [T-014]
completed: 2026-11-25
fix_loops: 0
---

# T-016 Draft 10 guides content; developer verifies
✅ DONE 2026-11-25 (DRAFT CONTENT: developer must verify each guide, set last_checked_at, run pnpm seed:guides; see docs/guides-verification.md)

## Goal
CEO scope: write 8 CANCEL guides as JSON files in packages/core/src/guides-data/ (netflix, spotify, youtube-premium, disney-plus, amazon-prime, adobe-creative-cloud, microsoft-365, chatgpt-plus). Apple App Store, Google Play (kind store) and Wise (kind provider) belong to T-015. Do not invent last_checked_at: leave null unless a human verified it.
Draft 10 guides content; developer verifies. Planner refines this and writes Given/When/Then criteria before build.

## Acceptance criteria
- [x] (Planner fills in)

## Plan (Planner)
## Design (Designer)
## Build notes (Builder)
11 guides (8 cancel, 2 store, 1 provider) as JSON in packages/core/src/guides-data, all last_checked_at null (stale badge shows until verified). Steps written from general knowledge; the Builder only checked HTTP status of source URLs (Amazon 503, Apple 118428 429, account.microsoft.com no response: unverifiable); Microsoft and Wise source_url are general landing pages; chatgpt/wise/apple `url` are entry pages. 347 tests. Checklist: docs/guides-verification.md. Test/review: guides-data.test.ts only (content tickets).
## Test report (Tester)
## Review verdict (Reviewer)
<!-- VERDICT: PASS | NEEDS_FIXES -->

## Developer sign-off
- [x] Approved on: 2026-11-25 (CEO, standing order)
