# Manual QA (developer)

Do these checks by hand. They need a real Supabase project, real mail, or real devices. Order is by risk: do 1 first. Tick a box only when the "expect" line is true. If a step cannot run, write "not run".

## 1. Auth on a real Supabase project

- [ ] Google OAuth sign-in. Expect: you reach /app (or onboarding for a new user).
- [ ] Magic link by real SMTP (T-003 criteria 16 to 20). Expect: the mail arrives, the link signs you in once, a second use of the link fails with a clear message.
- [ ] Session cookie. Expect: reload keeps you signed in; /app opens without a sign-in prompt.
- [ ] Sign out. Expect: you reach the signed-out page; /app redirects to /sign-in.

## 2. Real email through Resend

- [ ] Follow the go-live list in supabase/README.md and send one reminder. Expect: one mail arrives.
- [ ] Check SPF and DKIM in the mail headers. Expect: both pass.
- [ ] Open the mail in Gmail and in Apple Mail. Expect: text reads well, links work.
- [ ] Use the opt-out link. Expect: email reminders turn off; in-app reminders stay.
- [ ] Force a bad Resend key. Expect: after 3 tries the row is failed and the founder gets one alert mail.

## 3. Scheduler (pg_cron)

- [ ] Enable pg_cron only AFTER step 2 passes. Expect: the job send_due_reminders exists.
- [ ] Set the Vault secrets. Expect: the cron call returns 200, not 401.
- [ ] Add a reminder due in 10 minutes. Expect: it arrives within 5 minutes after fire_at.

## 4. Export and account delete (live)

- [ ] Set SUPABASE_SERVICE_ROLE_KEY on Vercel. Delete a test account. Expect: the user, rows and cookies are gone; the amr claim check passes.
- [ ] Export from an account with more than 1000 rows. Expect: the file has every row (page size 1000).

## 5. Safety sweep workflow

- [ ] Set GitHub secrets SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FOUNDER_ALERT_EMAIL.
- [ ] Run the workflow with workflow_dispatch once. Expect: green run; no alert mail when nothing is wrong.

## 6. Devices

- [ ] iOS Safari: add to home screen, date pickers, keyboard does not hide the field. Expect: all forms usable.
- [ ] Android Chrome. Expect: same.
- [ ] Firefox desktop. Expect: same.
- [ ] Safari desktop. Expect: same.

## 7. Visual

- [ ] 320 px and 1440 px on landing, dashboard, subscription form, stop flow, in light and dark. Expect: no overflow, no clipped text.
- [ ] 200% zoom. Expect: all content still usable.
- [ ] Reduced motion on. Expect: no animation.

## 8. Screen reader spot check (VoiceOver)

- [ ] Sign-in, add subscription, reminder list. Expect: labels, errors, and status changes are read out.

## 9. Guides

- [ ] Check the 11 guides against the vendor pages (docs/guides-verification.md). Expect: each step is true; "last checked" date updated.
- [ ] Run `pnpm seed:guides`. Expect: the guides show on the live site.

## 10. Legal and monitoring

- [ ] Set NEXT_PUBLIC_CONTACT_EMAIL and NEXT_PUBLIC_SENTRY_DSN. Expect: the contact address shows on privacy and terms.
- [ ] Send a test error to Sentry. Expect: it shows with no personal data.
- [ ] Expect: the template banner stays on the legal pages until legal review.

## 11. Events and analytics

- [ ] Run the SQL in docs/metrics.md on live data. Expect: events are written; the card question answers are counted.

## 12. Web push

- N/A (POST_MVP).

## Automated check you can run now

- `pnpm build`, then `pnpm e2e:public`. First time: `npx playwright install chromium`. Expect: all public pages pass axe (no serious or critical issue), one h1 per page, no sideways scroll at 320 px.

## Final MVP run

Do this once, when all MVP tickets are DONE and the e2e smoke (T-025b) is green. A Tester does it on the production-like build.

1. CI green on main: ci, db, e2e (smoke and a11y). Record the run URL.
2. Run `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` locally. Run `pnpm e2e:public` if Playwright installs.
3. Walk the demo script in the built-in browser against live Supabase. If no live Supabase exists, mark each live step "not run". Steps: sign in, onboarding, add Netflix, stop flow, dashboard, a reminder shown, mark stopped, import a CSV, export, delete.
4. Write one page with three lists: what works, what was only read in code, what the developer must check. Map each item to a section of this file. A step with no live Supabase is UNVERIFIED. Never write PASS for it.
