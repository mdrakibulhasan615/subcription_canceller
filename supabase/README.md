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

A GitHub Actions workflow runs `pnpm sweep` daily at 02:00 UTC. It fixes missing reminder rows and checks the sender. A failed run means a critical finding. GitHub emails the repo owner.

1. In GitHub, add repository secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FOUNDER_ALERT_EMAIL`.
2. `FOUNDER_ALERT_EMAIL` is not used until T-011 adds the email alert.
3. Test it: run the workflow by hand (workflow_dispatch) and read the log.
