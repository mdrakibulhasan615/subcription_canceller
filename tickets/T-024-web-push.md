---
id: T-024
title: Web push (PWA). May slip to POST_MVP
status: POST_MVP
milestone: POST_MVP
ui: false
depends_on: [T-011]
completed:
fix_loops: 0
---

# T-024 Web push (PWA). May slip to POST_MVP

## Goal
Web push (PWA). May slip to POST_MVP. Planner refines this and writes Given/When/Then criteria before build.

## Acceptance criteria
- [ ] (Planner fills in)

## Plan (Planner)
DECISION (CEO, 2026-11-25): DEFERRED to POST_MVP (D6: push last, may slip). Reasons: metric 3 (users who act on a reminder) is reachable through email + in-app (T-011/T-012 done); effort 3-4 builder days + Reviewer; unproven Deno crypto; iOS needs an installed PWA; real push cannot be tested in CI; the 20-user run is mostly email + in-app; a new scheduler channel is the riskiest change. No code edits now. Build only if the 30-day data shows low email deliverability/opens.
What exists (nothing to change): push_subscriptions table + RLS; reminders.channel allows 'push'; core ReminderChannel has "push"; desiredReminders defaults in_app+email; export excludes keys; send_due_reminders has no push sender (a missing sender is an error); no apps/web/public, manifest or service worker; CSP is only frame-ancestors; legal text has no push wording (add when it ships).
SPEC for the post-MVP ticket:
- Migration: profiles.push_reminders boolean not null default false + grant update + pgTAP; (optional) push_subscriptions.last_error.
- Core: planReminders/ReminderProfile.channels adds "push" only when push_reminders is true (default in_app+email); tests; recompute reminders when the toggle changes (as timezone change does).
- Web: public/manifest.webmanifest (name from brand.ts, display standalone, start_url /app, linked in layout.tsx); public/sw.js (push -> showNotification; notificationclick -> open /app/...; no caching); settings client component "Turn on push notifications": Notification.requestPermission() ONLY in the click handler, then pushManager.subscribe({userVisibleOnly:true, applicationServerKey: NEXT_PUBLIC_VAPID_PUBLIC_KEY}), then a server action savePushSubscription({endpoint, keys:{p256dh,auth}}) validated with zod (https endpoint, key lengths), upsert under the user JWT on unique(user_id,endpoint); removePushSubscription(endpoint) unsubscribes and deletes the row; toggle sets push_reminders. Copy: "On iPhone and iPad, add StopDate to your Home Screen first. Push does not work in the browser tab."; "not supported" state when PushManager is missing; "blocked in browser settings" when permission is denied. Follow docs/design-system.md.
- Edge Function: senders.ts pushReminderSender(db, vapid): loads the user's subscriptions with the service role; a user with none -> row `skipped` (NOT an error: needs a ChannelSender contract change returning "skipped", handler support and tests, otherwise every such user triggers a failed alert); send to all with TTL 86400, Urgency high, Topic = reminder id; 404/410 -> delete that subscription (not an error); 429/5xx -> throw (lease/retry applies); all gone after cleanup -> skipped; index.ts adds push; without VAPID secrets use a stub that rejects. Crypto: try npm:web-push under deno test and a deployed function; else hand-written VAPID ES256 JWT + aes128gcm (RFC 8291) with WebCrypto, verified against the RFC test vectors.
- Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:) in supabase/README.md and the go-live checklist; never rotate without re-subscribing all users.
- Headers: /sw.js needs Service-Worker-Allowed and no-cache; if a stricter CSP comes later allow worker-src 'self' and connect-src for push services; update next.config.test.ts.
- Privacy/data page: say what is stored (endpoint and keys), that it can be removed, that the browser vendor's push service sees the message route; delete cascades on account delete (check the FK); export stays endpoint only.
- Payload: title "StopDate reminder" (brand constant); body default "A subscription stop date is coming up. Open the app." or with the name ("Stop date for <name> in N days") — developer decides (lock screen shows it); never price, card or email.
Criteria: 1 user allows push -> push_subscriptions row, push_reminders true, future reminders include push rows. 2 settings load shows no permission prompt. 3 denied or no PushManager -> toggle disabled with text, nothing saved. 4 toggle off -> browser subscription removed, row deleted, pending push reminders skipped. 5 due push reminder, 2 subscriptions -> both get a message with TTL 86400, reminder sent. 6 one 410 -> that row deleted, reminder still sent if the other worked. 7 push_reminders true but no rows -> skipped, no founder alert. 8 push service 5xx -> retry by lease/attempts rules. 9 RLS denies A reading/writing B's subscriptions (pgTAP, extend). 10 export has no keys. 11 VAPID secrets missing -> stub fails visibly; in-app/email unaffected. 12 Tests: Vitest fakes for the sender (fake fetch, fake db), RFC 8291 vectors, core planner tests, server action tests; pgTAP in CI; real delivery is a manual developer check in Chrome and an installed iOS PWA. Reviewer: required.

## Design (Designer)
## Build notes (Builder)
## Test report (Tester)
## Review verdict (Reviewer)
<!-- VERDICT: PASS | NEEDS_FIXES -->

## Developer sign-off
- [ ] Approved on:
