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
