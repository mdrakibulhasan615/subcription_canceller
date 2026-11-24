---
id: T-012
title: Snooze, extend, mark stopped, mark cancelled
status: BACKLOG
milestone: MVP
ui: true
depends_on: [T-007, T-011]
completed:
fix_loops: 0
---

# T-012 Snooze, extend, mark stopped, mark cancelled

## Goal
Snooze, extend, mark stopped, mark cancelled. Planner refines this and writes Given/When/Then criteria before build.

## Acceptance criteria
- [ ] (Planner fills in)

## Plan (Planner)
CEO NOTE: rebuildReminders (apps/web/lib/profile-settings.ts) reopens status=skipped rows that match the desired set on every save. Do not model a user snooze/skip as status=skipped without a marker, or a later save undoes it. Prefer moving dates (snooze = new fire times via stop_date or a snoozed_until approach) or add a marker column in a new migration.
## Design (Designer)
## Build notes (Builder)
## Test report (Tester)
## Review verdict (Reviewer)
<!-- VERDICT: PASS | NEEDS_FIXES -->

## Developer sign-off
- [ ] Approved on:
