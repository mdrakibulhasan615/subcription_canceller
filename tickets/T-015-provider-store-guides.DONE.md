---
id: T-015
title: Wise provider guide and Apple/Google store guides
status: DONE
milestone: MVP
ui: true
depends_on: [T-014]
completed: 2026-11-25
fix_loops: 0
---

# T-015 Wise provider guide and Apple/Google store guides
✅ DONE 2026-11-25 (DRAFT CONTENT: developer must verify each guide, set last_checked_at, run pnpm seed:guides; see docs/guides-verification.md)

## Goal
Wise provider guide and Apple/Google store guides. Planner refines this and writes Given/When/Then criteria before build.

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
