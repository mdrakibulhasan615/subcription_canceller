# PLAN_OVERVIEW.md

Working name: **StopDate** (placeholder; change it).
Language rule: use short, simple sentences. One idea per sentence.

---

## 1. Idea

A privacy-first subscription manager.

The user adds a subscription and sets a **stop date**. On that date, payments for that subscription must stop. The user never links a bank account to the tracker.

How payments stop depends on the payment method:

| Mode | Name | Who controls the card | Phase |
|---|---|---|---|
| A | User-managed card | The user (Wise, Privacy, Capital One, other). The app reminds the user to freeze or close the card. | MVP |
| B | Managed card | The app (virtual card from a US issuing partner). The app declines charges after the stop date. | Post-MVP, gated |

The app does not cancel the subscription with the merchant. See section 4.

## 2. Problem and evidence

Sources: Reddit-based write-ups and app-store review analyses (see "Research notes" at the end).

- People forget subscriptions. One r/personalfinance user paid for an app for 14 months after forgetting it.
- Trackers need risky bank linking, or charge for reminders, or bundle budgeting features.
- Big competitors (Rocket Money, Trim) use bank linking and human concierge cancellation.
- Virtual-card tools (Privacy.com, Monzo free-trial cards, Capital One) can block charges. None found lets the user pick any date and have the card shut off automatically, tied to a tracker. (Not proof that none exists.)
- A Monzo UK forum user asked for an expiry date on virtual cards to match a subscription. This is direct demand for the feature.

## 3. Users

1. **Forgetful subscriber.** Pays for 5 to 20 subscriptions. Forgets trials. Wants a reminder and a clear way to stop payment.
2. **Privacy-minded user.** Refuses bank linking. Accepts manual entry for control.
3. **Free-trial hunter.** Signs up for many trials. Wants to stop payment before the first charge.
4. **Freelancer with irregular income.** Needs to cut costs fast in a low month.

Primary persona for MVP: persona 1 and 3.

## 4. Honesty rules (must-have UI copy, marketing, terms)

- Blocking a card does NOT cancel a subscription.
- The merchant can still try to charge. The merchant can treat a declined payment as unpaid debt. The merchant can hold the user to the contract.
- Say "payments stop on the date". Never say "subscription cancelled".
- Every subscription shows the merchant cancel link and a checklist: "Did you also cancel with the merchant?"
- Tell the user to freeze or close the card a few days BEFORE renewal, not on the renewal date.
- Apple App Store and Google Play subscriptions: a third party cannot cancel them. Show deep links and steps for the user's own settings.
- Never store the user's real card number. Never store any full card number in MVP.

## 5. Must-haves (whole product)

1. Subscription tracking with manual entry.
2. Stop date per subscription.
3. Reminders before the stop date and before renewal.
4. Cancel guides and provider guides (Wise first).
5. Dashboard with totals and upcoming dates.
6. No bank linking.
7. Honesty rules in the UI.
8. A scheduler that never fails silently.
9. Data export and account delete.

## 6. MVP

Goal: prove that people add subscriptions and set stop dates. Prove that they want the card to close automatically.

### MVP scope (build in this order)

**E1. Foundation**
- Project setup, CI, lint, tests, environments.
- Auth (email magic link plus Google login).
- Profile and settings (currency, timezone, default reminder days).
- Row-level security on all user data.

**E2. Subscriptions**
- Add, edit, delete, archive a subscription.
- Fields: name, price, currency, billing cycle, next renewal date, cancel-by date, stop date, category, notes, cancel link, payment method type (none / Wise / other virtual card / managed card later), card nickname.
- Status: Active, Stopping soon, Stopped, Cancelled with merchant.
- Calculated fields: monthly cost, yearly cost.
- CSV import and "paste a list" import.

**E3. Stop-date and reminder engine**
- Stop date defaults to N days before renewal (user setting).
- Reminders at 7, 3, and 1 days before the stop date (configurable).
- Channels: in-app, email, web push (PWA).
- Snooze, extend stop date, mark as stopped, mark as cancelled with merchant.
- Scheduler design in section 11.

**E4. Guides**
- Cancel guides for the top 50 services (steps, link, phone or email). Start with 20.
- Provider guides for user-managed cards: Wise first, then Privacy and Capital One.
- Apple and Google subscription guides (deep links and steps).
- "Free-trial mode": enter the trial end date, get a "stop before charge" flow.

**E5. Dashboard**
- Monthly and yearly totals.
- Next 5 stop and renewal dates.
- Estimated savings from stopped subscriptions.
- Spending by category.

**E6. Validation tools**
- Landing page with waitlist.
- Privacy-friendly analytics (no third-party trackers, or a self-hostable tool).
- In-app question: "Would you want the card to close automatically?" Store the answer.
- Event tracking for the validation metrics (section 17).

**E7. Quality**
- Unit, integration, and end-to-end tests.
- Accessibility pass.
- Time-based scheduler tests.
- Data export and account delete.

### MVP exit criteria
- All E1 to E7 tickets are DONE.
- 20 real users run it for 30 days.
- Validation metrics in section 17 are measured.

## 7. Out of scope for MVP (POST_MVP backlog, in order)

1. **Email forwarding.** Per-user forwarding address. Extract merchant, price, cycle, renewal date from forwarded receipts.
2. **Calendar export (ICS).**
3. **Browser extension or share-sheet** "track this subscription".
4. **Managed virtual cards** (Mode B). Gated. See section 18.
5. **Assisted cancellation** (human concierge). Gated.
6. **Browser automation for cancel flows.** Evaluate only. High risk (section 19).
7. **Pricing and billing** for our own paid plan.
8. **Referral program.**
9. **Admin back office.**
10. **Mobile apps** (native wrapper).
11. **Malaysia expansion** (MYR, BNM rules, local partner).

Never in scope: bank linking, bill negotiation, budgeting features.

## 8. Tech

### Must-use
- TypeScript everywhere.
- Free or low-cost tiers for MVP. The founder is self-funded and in Malaysia. Check current free-tier limits before you commit.
- Simulated card provider for all dev and test work (post-MVP).

### Recommended stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React with Next.js (App Router), or Vite plus React Router | Good tooling. Easy PWA. Large community. |
| Styling | Tailwind CSS plus a component kit (shadcn/ui) | Fast, consistent UI. |
| Backend and DB | Supabase (Postgres, Auth, Row-Level Security, Edge Functions, pg_cron) | One service for auth, DB, and scheduled jobs. Free tier. |
| Hosting | Vercel or Cloudflare Pages | Free tier for small apps. |
| Scheduler | Supabase pg_cron calling an Edge Function, plus a daily "safety sweep" | Runs inside the DB. See section 11. |
| Email (outbound) | Resend or Postmark | Simple API. Good deliverability. |
| Email (inbound, post-MVP) | Postmark inbound or Cloudflare Email Routing to a Worker | Parse forwarded receipts. |
| Push | Web Push (VAPID) in a PWA | No app store needed. |
| Validation | Zod | Same schemas for client and server. |
| Testing | Vitest (unit), Playwright (end to end), pgTAP or SQL tests for RLS | Cover logic, UI, and security. |
| Lint and format | ESLint, Prettier, TypeScript strict | Keep quality high. |
| Analytics | Plausible or self-hosted Umami | No cookies, privacy-first. |
| Error tracking | Sentry (free tier) | Find bugs fast. |
| Email parsing (post-MVP) | Rules first, then an LLM call for hard cases | Low cost at small volume. |

The CEO may change any choice if there is a better reason. Ask the founder first.

## 9. Architecture

```
[Browser PWA: Next.js]
      |  (HTTPS, JWT)
      v
[Supabase]
  - Auth
  - Postgres (RLS)
  - Edge Functions: reminders, stop-date sweep, import
  - pg_cron: triggers jobs
      |
      +--> [Resend/Postmark]  (email)
      +--> [Web Push service] (push)

POST_MVP:
[Postmark inbound] --> [Parser Worker] --> [Supabase]
[CardProvider interface] --> [MockCardProvider | Issuer adapter]
[Authorization Service (real-time)] <-- issuer webhook
```

Rules:
- All business logic lives in one shared package (`/packages/core`). The UI and the Edge Functions both import it.
- All date logic uses UTC in the DB and the user timezone at the edge.
- Every job is idempotent.

## 10. Data model (MVP)

**profiles**: id, email, display_name, timezone, currency, default_stop_days_before, reminder_days[], created_at.

**subscriptions**: id, user_id, name, category, price_minor (integer), currency, billing_cycle (weekly | monthly | quarterly | yearly | custom), billing_interval, next_renewal_date, cancel_by_date, stop_date, status, payment_method_type (none | wise | privacy | other_virtual | managed), card_nickname, cancel_url, notes, is_trial, trial_end_date, merchant_cancelled_at, archived_at, created_at, updated_at.

**reminders**: id, subscription_id, user_id, type (stop_date | renewal | trial_end), fire_at (UTC), channel (in_app | email | push), status (pending | sent | failed | skipped), attempts, last_error, sent_at.

**guides**: id, kind (cancel | provider | store), service_slug, title, steps (jsonb), url, updated_at. Public read.

**push_subscriptions**: id, user_id, endpoint, keys (jsonb), created_at.

**events**: id, user_id (nullable), name, props (jsonb), created_at. Used for validation metrics.

**feedback**: id, user_id, key (for example `auto_close_interest`), value, created_at.

**audit_log**: id, user_id, action, entity, entity_id, before, after, created_at.

Post-MVP tables: forwarding_addresses, parsed_emails, cards, card_events, authorizations, funding_sources, plans, invoices.

Rules:
- Money is stored in minor units (integer) with a currency code.
- RLS: a user can read and write only rows with their user_id.
- Soft delete for subscriptions (archived_at). Hard delete on account delete.

## 11. Scheduler and reminders (critical)

The stop date must never fail silently.

Design:
1. When a subscription is saved, create reminder rows (fire_at in UTC).
2. `pg_cron` runs every 5 minutes. It calls the `send_due_reminders` function.
3. The function selects reminders with `status = 'pending'` and `fire_at <= now()`. It locks rows (`FOR UPDATE SKIP LOCKED`).
4. It sends the message. It sets `status = 'sent'` or increments `attempts`.
5. After 3 failed attempts, status = `failed`. An alert goes to the founder.
6. A daily **safety sweep** finds stop dates that have no reminder row and creates them. It also finds `sent` reminders with no delivery proof.
7. When a stop date passes, the app marks the subscription "Stopped" only after the user confirms they froze or closed the card (MVP). In Mode B, the system decides alone.

Edge cases to test:
- User timezone change.
- Daylight saving change.
- Stop date in the past when saving.
- Renewal date before stop date.
- Edit of a date after reminders are created.
- Duplicate job run.
- Email provider outage.

## 12. Screens (MVP)

1. Landing and waitlist.
2. Sign in.
3. Onboarding (3 steps: currency and timezone, add first subscription, reminder preferences).
4. Dashboard.
5. Subscription list (filter by status, sort by next date).
6. Add and edit subscription.
7. Subscription detail (dates, payment method, checklist, guides, history).
8. Stop-date flow ("Set your stop date", "Create a card in Wise", "Remind me to freeze it").
9. Cancel guide page.
10. Provider guide page (Wise, Privacy, Capital One).
11. Import (CSV and paste).
12. Settings (reminders, timezone, data export, delete account).
13. In-app notifications.

Design rules: mobile first, accessible (WCAG AA), plain language, honest copy from section 4.

## 13. Security and privacy

- No bank linking. No full card numbers stored.
- Encrypt data in transit (TLS) and at rest (provider default).
- RLS on every table. Test it with automated tests.
- Secrets only in environment variables. Never in the repo.
- Rate limit auth and import endpoints.
- Data export (JSON and CSV). Full delete in 30 days or less.
- Minimal analytics. No third-party ad trackers.
- Write a clear privacy policy and terms before launch. Get legal review.

## 14. Cost (MVP)

Target: near zero per month on free tiers. Check each provider's current limits. Possible costs: a domain, a transactional email plan if free limits are exceeded. The CEO must list expected cost per month in PROJECT_CONTEXT.md.

## 15. Testing

- Unit tests: date logic, reminder scheduling, price math.
- Integration tests: Edge Functions against a test database.
- RLS tests: user A cannot read user B data.
- End-to-end (Playwright): sign in, add subscription, set stop date, receive reminder (use a test inbox).
- Time tests: fake clock for the scheduler.
- Accessibility checks (axe).
- Import tests: bad CSV, large CSV, duplicate rows.

## 16. Ticket rules

- Each ticket is small. One outcome per ticket.
- Each ticket has acceptance criteria in Given/When/Then.
- Each ticket lists dependencies.
- MVP tickets come first. POST_MVP tickets follow in the order of section 7.
- UI tickets go through the Designer step.

## 17. Success metrics and validation gate

Measure during the 30-day MVP run:

1. **Activation:** share of new users who add at least 3 subscriptions. Target: 50% or more.
2. **Stop dates:** share of subscriptions with a stop date set. Target: 40% or more.
3. **Reminder value:** users who act on a reminder (mark stopped or cancelled). Target: 30% or more.
4. **Card interest:** share of users who answer "yes" to "Would you want the card to close automatically?" Target: 40% or more.
5. **Retention:** users active in week 4. Target: 25% or more.

Adjust targets with the founder. The gate to start Post-MVP step 4 (managed cards): metrics 2 and 4 pass, AND an issuing partner path is confirmed (section 18), AND legal advice is done.

## 18. Post-MVP: managed cards (Mode B) — GATED

Do not build until the gate in section 17 passes.

### Market
- United States first (mature issuing APIs: Lithic, Stripe Issuing, or similar).
- The founder lives in Malaysia. Eligibility of a non-US-resident founder is UNKNOWN. A US company, KYC, and a sponsor bank may be needed. Get legal advice first.
- Malaysia is a later phase. Malaysian rules for card issuing and e-money (Bank Negara Malaysia) apply. Local partners for consumer card programs were not found. Research again later.

### Funding model
Pull-per-charge. The app does not hold a user balance.

Flow:
1. Merchant charges the card.
2. The issuer sends a real-time authorization request to our Authorization Service.
3. The service decides in seconds: approve or decline.
4. If approved, the app pulls money from the user's funding source after the charge.

The kill switch is pure decision logic (decline after the stop date). It moves no money. Money moves only for approved charges.

Risk: the issuer settles with the merchant before the app collects from the user. If the pull fails, the app loses money. Controls: low per-card limits, balance pre-check, merchant lock, amount lock, suspend users on failure.

### CardProvider interface
```
createCard(userId, merchantLock?, spendLimit?, expiry?) -> Card
setMerchantLock(cardId, merchant)
setSpendLimit(cardId, amountMinor)
setExpiry(cardId, date)
pause(cardId)
close(cardId)
getStatus(cardId)
webhook: onAuthorizationRequest(event) -> approve | decline
webhook: onTransaction(event)
```
Build `MockCardProvider` first (label "SIMULATED"). Then add one issuer adapter (sandbox first).

### Authorization Service requirements
- Answer inside the network time limit (a few seconds). Check the exact limit with the provider.
- Fallback decision if our service is down: decline.
- Idempotent.
- Rules: card active, before stop date, amount within limit, merchant matches, funding source healthy.
- Log every decision.
- Decline monitoring: show the user "a merchant tried to charge after your stop date and we blocked it". Flag merchants that retry often.
- Load and timeout tests.

### Other work in this phase
KYC and onboarding, funding source setup, disputes and chargebacks, fraud controls, collections flow, unit economics (interchange versus cost per user), terms and legal text.

## 19. Risks

| Risk | Impact | Plan |
|---|---|---|
| Founder cannot work with US issuers or sponsor banks | Blocks Mode B | Get legal advice early. Keep Mode A as a full product. |
| Visa or work limits for a foreigner in Malaysia | Blocks business activity | Check visa terms before launch. |
| Merchants retry declined cards or send debt to collections | User harm | Honest copy. Tell users to cancel with the merchant too. |
| Funding pull fails after approval | Money loss | Low limits, pre-checks, suspensions. |
| Scheduler fails silently | Users pay after stop date | Idempotent jobs, safety sweep, alerts, tests. |
| Apple and Google subscriptions cannot be cancelled by a third party | Limited reach | Deep links and guides. |
| No public API to freeze Wise or other user cards | Mode A stays manual | Reminders and guides. Re-check API options yearly. |
| Cancel guides go out of date | Wrong help | Version the guides. Add a "report a problem" button. Review quarterly. |
| Browser automation breaks and risks user credentials | Security and legal risk | Do not build without a risk review. |
| Low demand | Wasted effort | Validation gate in section 17. |
| Regulation (money transmission, e-money, auto-renewal law) | Legal exposure | Legal advice before any money flow. |

## 20. Unknowns (CEO: ask in rounds, with a recommended answer)

1. **MVP scope:** Phases 1 and free-trial mode only? *Recommended: yes. Email forwarding is POST_MVP.*
2. **Frontend framework:** Next.js or Vite? *Recommended: Next.js, PWA.*
3. **Backend:** Supabase? *Recommended: yes (auth, DB, RLS, cron in one place).*
4. **Launch market for MVP users:** global English, or Malaysia and US? *Recommended: global English, USD plus MYR display.*
5. **Default stop date:** how many days before renewal? *Recommended: 3 days, user can change.*
6. **Reminder channels at launch:** email only, or email plus push? *Recommended: in-app plus email at launch, push in the same phase if time allows.*
7. **Number of cancel guides at launch:** 20 or 50? *Recommended: 20.*
8. **Currencies:** which to support first? *Recommended: USD, MYR, EUR, GBP. Store in minor units.*
9. **Pricing:** free MVP? *Recommended: free during validation. Decide pricing after metrics.*
10. **Analytics tool:** Plausible, Umami, or none? *Recommended: Umami self-hosted or Plausible.*
11. **Brand name and domain:** final name? *Founder to decide.*
12. **Visa and business rules for the founder in Malaysia:** checked? *Founder to confirm.*
13. **Company setup for a US issuing program:** needed? *Get legal advice before Post-MVP step 4.*
14. **Who writes the cancel guides?** *Recommended: founder writes the first 20, with source links and dates.*
15. **Wise API:** any public way to freeze cards for a third party? *Research task. Assume none until proven.*
16. **Terms of service and privacy policy:** who writes them? *Recommended: use a template, then pay for a legal review before public launch.*

## 21. Research notes (sources)

- Reddit-based analyses: bigideasdb.com (best app ideas 2026), dev.to (Daji Labs, best app ideas 2026), r/iosapps "What's an app that you wish existed?" thread.
- Competitor behavior: Rocket Money concierge cancellation (1,000+ services, no guarantee); Trim (some automatic, some manual).
- Virtual cards: Privacy.com (merchant-locked, single-use, pause and close), Monzo US free-trial cards, Capital One virtual cards with custom expiry, Revolut disposable cards, Wise virtual cards (free for Malaysian customers).
- Apple: no developer API to cancel a user's subscription for them.
- US FTC "Click-to-Cancel" rule was vacated in 2025. The FTC still enforces ROSCA. Many state auto-renewal laws apply.
- Malaysia: e-money issuance needs Bank Negara Malaysia approval. Consumer-card issuing partners were not found.
- Issuing infrastructure (US): Lithic, Stripe Issuing (BIN sponsor bank needed).
