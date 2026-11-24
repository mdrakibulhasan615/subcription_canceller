---
id: T-006
title: Subscription add, edit, archive, delete
status: BACKLOG
milestone: MVP
ui: true
depends_on: [T-002, T-004, T-005]
completed:
fix_loops: 0
---

# T-006 Subscription add, edit, archive, delete

## Goal
Subscription add, edit, archive, delete. Planner refines this and writes Given/When/Then criteria before build.

## Acceptance criteria
- [ ] (Planner fills in)

## Plan (Planner)
CEO NOTES for the Planner (from T-004/T-010): after saving a subscription call core planReminders + reminderWrites with the user JWT. Client rights on reminders: INSERT only (subscription_id,user_id,type,channel,fire_at), UPDATE only status (pending<->skipped, trigger-guarded). Use ON CONFLICT DO NOTHING (no DO UPDATE upsert). A reopen only sets status=pending. Never send attempts/claimed_until. Catch RangeError from a bad profile timezone and fall back to UTC. Reuse rebuildReminders from apps/web/lib/profile-settings.ts if T-004 shipped it.
## Design (Designer)
## Build notes (Builder)
## Test report (Tester)
## Review verdict (Reviewer)
<!-- VERDICT: PASS | NEEDS_FIXES -->

## Developer sign-off
- [ ] Approved on:
