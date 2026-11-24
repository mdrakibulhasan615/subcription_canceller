# supabase

Auth setup: see [../README.md](../README.md#auth-one-time-setup).

## Reminder sender (T-009) one-time setup

Do this once per project, outside the repo.

1. In the SQL editor, run:
   `select vault.create_secret('<random 32+ bytes>', 'reminder_cron_secret');`
   `select vault.create_secret('https://<ref>.supabase.co', 'project_url');`
2. Run: `supabase secrets set CRON_SECRET=<same value as step 1> FOUNDER_ALERT_EMAIL=<address>`
3. Deploy: `supabase functions deploy send_due_reminders`

If a Vault entry is missing, the cron call fails with no error. Delivery is at-least-once: a crash between send and mark can send one reminder twice.

## Safety sweep (T-010) one-time setup

A GitHub Actions workflow runs `pnpm sweep` daily at 02:00 UTC. It fixes missing reminder rows and checks the sender. A failed run means a critical finding. GitHub emails the repo owner about a failed run. The sweep does not send the founder email yet (stub).

1. In GitHub, add repository secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FOUNDER_ALERT_EMAIL`.
2. `FOUNDER_ALERT_EMAIL` is the address for the founder alert. The sweep does not use it yet.
3. Test it: run the workflow by hand (workflow_dispatch) and read the log.

## Email and in-app reminders (T-011) go-live checklist

Do these in order. Do step 4 last.

1. Resend: add a sending domain and the DNS records (SPF, DKIM, DMARC). Wait until the domain shows Verified. Create a send-only API key. Free tier: 100 emails a day, 3000 a month. `onboarding@resend.dev` sends only to the account owner.
2. Set secrets: `supabase secrets set RESEND_API_KEY=... EMAIL_FROM="StopDate <reminders@yourdomain>" APP_URL=https://<app> APP_NAME=StopDate CRON_SECRET=... FOUNDER_ALERT_EMAIL=...`
3. Run `supabase db push`, then `supabase functions deploy send_due_reminders`.
4. Create the Vault secrets last (see the T-009 setup above). Without them the cron stays inert.
5. Test a send: insert one due email row for your own account. Call the function with curl and the `x-cron-secret` header. Check the mail, the links and the text. Check the row is `sent` and `provider_ref` equals the id in the Resend dashboard.
6. Test a failure: set a bad API key. The row must end `failed` and one founder email must arrive. Then restore the key.
7. Create the Vault secrets `project_url` and `reminder_cron_secret`. Check that `cron.job_run_details` shows status 200.
8. Add the GitHub secret `FOUNDER_ALERT_EMAIL`. Run the sweep workflow once by hand.
9. Check that `verify_jwt` is off for the function.

Migration 000007 reopens rows that failed with "email not configured" in the last day. Check it by hand on the real project: those rows must be `pending` with 0 attempts.
