# MVP status (final run, 2026-11-25)

For the developer. Short sentences. Brand name is still the placeholder "StopDate".

Scope: tickets T-001 to T-025 are DONE. T-024 (web push) is POST_MVP by decision.

## 1. What works and is PROVEN by CI

Evidence: GitHub Actions on main, commit a6fb2bf. All three workflows are green.

| Workflow | Result | Run URL |
| --- | --- | --- |
| CI | success. 402 unit tests in 57 files | https://github.com/mdrakibulhasan615/subcription_canceller/actions/runs/45466551276 |
| DB | success. pgTAP 14 files, 229 tests, Result: PASS | https://github.com/mdrakibulhasan615/subcription_canceller/actions/runs/45466551352 |
| E2E | success. Playwright 36 passed | https://github.com/mdrakibulhasan615/subcription_canceller/actions/runs/45466551395 |

Same result on the earlier commit 7eb6d38 (E2E run 45465727792: 36 passed, 24.6 s).

Playwright 36 = 30 public-page axe tests + 6 smoke tests on a local Supabase stack:
- S1: magic-link sign-in (Mailpit), onboarding, dashboard.
- S2: add a subscription. The default stop date is set.
- S3: stop flow, dashboard totals, 7/3/1 reminder rows.
- S4: mark stopped. The badge reads Stopped. Pending reminders are skipped.
- S5: signed-out redirect. A user cannot open another user's subscription (404).
- Public pages (/, /sign-in, /privacy, /terms, /guides, /guides/cancel/netflix): zero serious or critical axe issues at 375 and 1280 px, light and dark. No sideways scroll at 320 px.

pgTAP areas (229 tests): schema sanity, RLS on all user tables, column grants, triggers, profile settings, reminder sender (claim, lease, retry, failed), sweep facts, email and in-app notices, guides and guide reports, events, metrics SQL, onboarding flag.

Local run by The Tester (same day, built app):
- `pnpm install --frozen-lockfile`: ok.
- `pnpm typecheck`: ok (includes scripts/ and e2e/).
- `pnpm lint`: ok, no output.
- `pnpm format:check`: "All matched files use Prettier code style!"
- `pnpm test`: 57 files, 402 tests passed.
- `pnpm build`: ok. 33 static pages. Routes: / , /privacy, /terms, /goodbye, /guides (+ 11 guide pages), /sign-in, /auth/callback, /auth/signout, /app and its sub-pages (subscriptions, new, [id], edit, stop-flow, import, notifications, onboarding, settings, settings/data), /api/export/csv, /api/export/json, /api/guide-report, /api/waitlist.
- `pnpm e2e:public` against `next start`: 30 passed.
- Browser walk (headless Chromium, no live Supabase): every public page at 1280 and 375 px, light and dark. No overflow. One h1 each. /app redirects to /sign-in?next=%2Fapp (307).
- Waitlist form: an invalid email shows "Enter a valid email address, like name@example.com." A valid email, with no Supabase, shows "Something went wrong on our side. Your email was not saved. Please try again." This message is sensible and honest.

## 2. Only code-read or unit-tested (UNVERIFIED live)

Do not call these PASS. No live Supabase, Resend or device was used.
- Google OAuth sign-in. Real SMTP magic link. Session cookie across reload. Sign-out (T-003 criteria 16 to 20).
- Real email through Resend: delivery, SPF and DKIM, Gmail and Apple Mail rendering, opt-out link, failed-after-3-tries alert mail.
- The Edge Function `index.ts` (Deno). Only the pure handler is tested.
- pg_cron job and Vault secrets (the cron call returning 200).
- Safety sweep workflow with real secrets.
- Export with more than 1000 rows. Account delete with the real service role key. The `amr` claim check.
- Events: `app_opened` rows on a real deploy. The five metric queries on real data.
- Sentry: a real event with no personal data.
- CSV import, export, delete, timezone change in a browser (no e2e yet).
- Authenticated pages: no axe check, no dark-mode and no 320/1440 px visual check.
- Focus move to Undo after "mark stopped". `aria-describedby` on the stop-method radios.
- Real devices: iOS Safari, Android Chrome, Firefox, Safari. 200% zoom. Reduced motion. VoiceOver.
- Guide content (draft). See section 3, step 12.

## 3. What you MUST do before 20 test users (in order)

1. Pick the brand name and domain. Change the constant in `packages/core/src/brand.ts`. Copy and legal text use it.
2. Create the Supabase project (free tier). Note the project ref, URL, anon key, service role key.
3. Push the schema: `supabase link --project-ref <ref>` then `supabase db push`.
4. Create the Vercel project from the GitHub repo. Set env vars:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`,
   `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_SENTRY_DSN`,
   `SUPABASE_SERVICE_ROLE_KEY` (mark Sensitive; account delete needs it).
5. Set a real contact email in `NEXT_PUBLIC_CONTACT_EMAIL`. Today the legal pages show `contact@example.com`.
6. Create a Sentry project (free). Put the DSN in `NEXT_PUBLIC_SENTRY_DSN`. Send one test error. Check it holds no personal data.
7. Google OAuth: create a client in Google Cloud. Add the Supabase callback URL. Put the client id and secret in Supabase Dashboard, Authentication, Providers, Google. Add your site URL and `/auth/callback` to the Supabase redirect URL list.
8. Custom SMTP: set it in Supabase Dashboard, Authentication, SMTP settings. The built-in mailer is too limited for users.
9. Resend: add your sending domain. Add DNS records (SPF, DKIM, DMARC). Wait for Verified. Create a send-only API key.
10. Set function secrets: `supabase secrets set RESEND_API_KEY=... EMAIL_FROM="<Brand> <reminders@yourdomain>" APP_URL=https://<app> APP_NAME=<Brand> CRON_SECRET=<random 32+ bytes> FOUNDER_ALERT_EMAIL=<address>`
11. Deploy: `supabase functions deploy send_due_reminders`. Check that `verify_jwt` is off for it.
12. Verify the 11 guides against the vendor pages (`docs/guides-verification.md`). Update each "last checked" date. Then run `pnpm seed:guides` (needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).
13. Test a send BEFORE the cron: insert one due email row for your account. Call the function with curl and the `x-cron-secret` header. Check the mail, links, and the row status `sent`. Then set a bad API key. The row must end `failed` and one alert mail must arrive. Restore the key.
14. Create the Vault secrets LAST: `select vault.create_secret('<same as CRON_SECRET>', 'reminder_cron_secret');` and `select vault.create_secret('https://<ref>.supabase.co', 'project_url');`. Enable pg_cron only now. Check `cron.job_run_details` shows 200. Check the migration 000007 reopened rows are `pending`.
15. GitHub repository secrets for the sweep: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FOUNDER_ALERT_EMAIL`. Run the "safety sweep" workflow once with workflow_dispatch. Expect green.
16. Do the live checks in `docs/manual-qa.md` sections 1 to 11. Write "not run" for any you skip.
17. After the first deploy, open the app once. Check that an `app_opened` row exists in `events`.
18. Legal review: a lawyer must review privacy and terms before any public launch. Keep the "template" banner until then. Update the privacy analytics line if events change.
19. Recruit 20 users. Start the 30-day run. Write the start date down.

Not needed now, but decide before POST_MVP step 4: Q12 (visa), Q13 (US company), Q15 (Wise API). They wait by decision D14.

## 4. Known gaps and low-severity open items

Found in the final run (Tester, no product code changed):
- Privacy and terms pages show `contact@example.com` and a "Template text" banner. Expected until steps 5 and 18.
- Privacy page: "Last updated: 2026-11-26". This date is one day after today (2026-11-25). Low. Builder should fix.
- Landing page says "No bank linking." twice (under the form, and again in the footer line). Low. Copy only.
- Netflix guide: the hint "If you pay through a partner, Apple, Google or a mobile carrier, cancel there" sits under step 5 ("Check your email"). It fits step 1 better. Low. Content.
- Guides show "Not checked yet / May be out of date". This is correct until step 12.

By ticket (from the ticket files):
- T-002: some SQL behaviours were first unverified. CI later passed all of them.
- T-004: "utc" and "+08:00" pass the timezone check. Zero-width characters are allowed in display_name. Large imports (500 subs) do many parallel inserts.
- T-006: a forged bad currency adds a spurious price error. `cancel_url` has no length cap. A trial end date in the past or after renewal is accepted. Stop-date warnings are not in a live region (fixed in T-025). Card guard checks the whole field only.
- T-007: minor display items were queued for the fix batch (money format "MYR 55.90", wording when no stop date and renewal is past, UTC date on the "marked as cancelled" line). Check they are fixed.
- T-011: if `APP_URL` is unset, email links are relative. Set it (step 10). Deno `index.ts` and parallel inserts of the cap trigger are untested.
- T-012: aria-labels for the two Undo buttons do not hold the subscription name.
- T-013: step 3 says "These reminders are set" even if an earlier rebuild failed. `loadGuide` loads all guides each time.
- T-014: `isGuideStale` accepts bad dates (unreachable). `contact_phone` is only length-capped. Each new guide needs one line in `guides-data/index.ts`.
- T-017: category percents are separate rounds and can sum to 99. Day labels read "6 days" without "left".
- T-021: `events.created_at` can be forged by a user (hardening queued, POST_MVP). The `onboarding_skipped` event is reserved and not sent.
- T-023: the export cap is 10000 rows (an error, not silent truncation).
- T-025: extended e2e is not done (section 6).

## 5. Metrics plan and validation gate

Run the SQL files in `supabase/metrics/` in the Supabase SQL editor at day 30 (see `docs/metrics.md`). Each prints numerator, denominator, percent.

| Metric | Target |
| --- | --- |
| Activation (3 or more subscriptions) | 50% |
| Stop dates set on subscriptions | 40% |
| Reminder value (acted on a reminder) | 30% |
| Card interest ("yes") | 40% |
| Retention, week 4 | 25% |

Caveats: reminder value is a proxy. Retention has survivor bias (deleted users drop out). With about 20 users the numbers are noisy.

Gate for POST_MVP step 4 (managed cards), from PLAN_OVERVIEW section 17: metrics 2 and 4 pass, AND an issuing partner path is confirmed (section 18), AND legal advice is done.

## 6. POST_MVP backlog (in order)

PLAN_OVERVIEW section 7:
1. Email forwarding.
2. Calendar export (ICS).
3. Browser extension or share-sheet.
4. Managed virtual cards (Mode B). Gated (section 5 above).
5. Assisted cancellation. Gated.
6. Browser automation for cancel flows (evaluate only).
7. Pricing and billing.
8. Referral program.
9. Admin back office.
10. Mobile apps.
11. Malaysia expansion.

Items deferred during the build (do early, they are small or reduce risk):
- Web push (T-024). Spec is in the ticket.
- Extended e2e: CSV import, export, account delete, timezone change, authenticated axe, keyboard-only suite, 2 light/dark combos for signed-in pages. Real Resend delivery e2e stays manual.
- "Paste a list" import.
- Privacy and Capital One provider guides.
- Guides 11 to 50.
- `events.created_at` hardening.
- Umami (optional, instead of first-party events).
- Edge Function `index.ts` (Deno) test.
- `onboarding_skipped` event.
- Fix the low items in section 4.
