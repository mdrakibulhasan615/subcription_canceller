-- T-009 claim_due_reminders and mark_reminder_result.
begin;
select * from no_plan();

insert into auth.users (id, email) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com');
insert into public.subscriptions (id, user_id, name, price_minor, currency, billing_cycle) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A sub', 100, 'USD', 'monthly');

-- r1..r3 due (oldest first r1). r4 future. r5 sent. r6 attempts 3. r7 already leased.
insert into public.reminders (id, subscription_id, user_id, type, channel, fire_at, status, attempts, claimed_until) values
  ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stop_date', 'in_app', now() - interval '3 hours', 'pending', 0, null),
  ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stop_date', 'email', now() - interval '2 hours', 'pending', 0, null),
  ('00000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'renewal', 'in_app', now() - interval '1 hour', 'pending', 2, now() - interval '1 minute'),
  ('00000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'renewal', 'email', now() + interval '1 day', 'pending', 0, null),
  ('00000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'trial_end', 'in_app', now() - interval '5 hours', 'sent', 0, null),
  ('00000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'trial_end', 'email', now() - interval '5 hours', 'pending', 3, null),
  ('00000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'trial_end', 'push', now() - interval '5 hours', 'pending', 0, now() + interval '5 minutes');

-- Criteria 1: limit and order. Batch 2 returns r1, r2 only, with a future lease.
select results_eq(
  $q$select id from public.claim_due_reminders(2)$q$,
  $q$values ('00000000-0000-0000-0000-000000000001'::uuid), ('00000000-0000-0000-0000-000000000002'::uuid)$q$,
  'claim returns the oldest due rows up to the batch size');
select is((select count(*)::int from public.reminders
  where id in ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')
    and claimed_until > now()), 2, 'claimed rows have a future lease');

-- Criteria 2 and 3: leased rows, future, sent, attempts>=3 are not returned. Only r3 is left.
select results_eq(
  $q$select id from public.claim_due_reminders(10)$q$,
  $q$values ('00000000-0000-0000-0000-000000000003'::uuid)$q$,
  'second claim returns only rows with no live lease');
select is((select count(*)::int from public.claim_due_reminders(10)), 0, 'third claim returns nothing');

-- Lease ends: r1 comes back.
update public.reminders set claimed_until = now() - interval '1 second'
  where id = '00000000-0000-0000-0000-000000000001';
select results_eq(
  $q$select id from public.claim_due_reminders(10)$q$,
  $q$values ('00000000-0000-0000-0000-000000000001'::uuid)$q$,
  'row returns after its lease ends');

-- Joined fields.
update public.reminders set claimed_until = null where id = '00000000-0000-0000-0000-000000000001';
select results_eq(
  $q$select user_email, sub_name, sub_inactive from public.claim_due_reminders(1)$q$,
  $q$values ('a@example.com'::text, 'A sub'::text, false)$q$,
  'claim returns email, sub name and sub_inactive');
update public.subscriptions set archived_at = now() where id = '11111111-1111-1111-1111-111111111111';
update public.reminders set claimed_until = null where id = '00000000-0000-0000-0000-000000000001';
select is((select sub_inactive from public.claim_due_reminders(1)), true, 'archived sub gives sub_inactive true');
update public.subscriptions set archived_at = null where id = '11111111-1111-1111-1111-111111111111';

-- T-011 columns.
update public.reminders set claimed_until = null where id = '00000000-0000-0000-0000-000000000001';
select results_eq(
  $q$select subscription_id, cancel_url, price_minor, currency, timezone, email_reminders from public.claim_due_reminders(1)$q$,
  $q$values ('11111111-1111-1111-1111-111111111111'::uuid, null::text, 100, 'USD'::text, 'UTC'::text, true)$q$,
  'claim returns subscription, cancel_url, price, currency, timezone and email_reminders');
update public.reminders set claimed_until = null where id = '00000000-0000-0000-0000-000000000001';

-- Criteria 4: mark sent, then a second mark changes nothing.
select is(public.mark_reminder_result('00000000-0000-0000-0000-000000000001', 'sent'), 'sent', 'mark sent returns sent');
select results_eq(
  $q$select status, sent_at is not null, claimed_until is null from public.reminders where id = '00000000-0000-0000-0000-000000000001'$q$,
  $q$values ('sent'::text, true, true)$q$,
  'sent row has sent_at and no lease');
select is(public.mark_reminder_result('00000000-0000-0000-0000-000000000001', 'retry', 'late'), 'sent',
  'late mark is a no-op and returns the current status');
select is((select attempts from public.reminders where id = '00000000-0000-0000-0000-000000000001'), 0,
  'late mark does not change attempts');

-- A second mark sent keeps sent_at and provider_ref.
update public.reminders set sent_at = now() - interval '1 hour', provider_ref = 'ref-1'
  where id = '00000000-0000-0000-0000-000000000001';
select is(public.mark_reminder_result('00000000-0000-0000-0000-000000000001', 'sent', null, 'ref-2'), 'sent',
  'second mark sent returns sent');
select results_eq(
  $q$select provider_ref, sent_at < now() - interval '30 minutes' from public.reminders where id = '00000000-0000-0000-0000-000000000001'$q$,
  $q$values ('ref-1'::text, true)$q$,
  'second mark sent leaves provider_ref and sent_at unchanged');

-- Criteria 5: retry backoff and failure.
select is(public.mark_reminder_result('00000000-0000-0000-0000-000000000002', 'retry', 'x'), 'pending', 'first retry stays pending');
select results_eq(
  $q$select attempts, last_error, claimed_until > now() from public.reminders where id = '00000000-0000-0000-0000-000000000002'$q$,
  $q$values (1, 'x'::text, true)$q$,
  'retry counts the attempt, keeps the error, sets backoff');
select is(public.mark_reminder_result('00000000-0000-0000-0000-000000000003', 'retry', 'boom'), 'failed', 'third failed attempt gives failed');
select is((select attempts from public.reminders where id = '00000000-0000-0000-0000-000000000003'), 3, 'failed row has 3 attempts');

select is(public.mark_reminder_result('00000000-0000-0000-0000-000000000007', 'skipped'), 'skipped', 'mark skipped returns skipped');

-- Criteria 6: privileges and invalid outcome.
select ok(not has_function_privilege('anon', 'public.claim_due_reminders(int)', 'execute'), 'anon cannot claim');
select ok(not has_function_privilege('authenticated', 'public.claim_due_reminders(int)', 'execute'), 'authenticated cannot claim');
select ok(not has_function_privilege('anon', 'public.mark_reminder_result(uuid,text,text,text)', 'execute'), 'anon cannot mark');
select ok(not has_function_privilege('authenticated', 'public.mark_reminder_result(uuid,text,text,text)', 'execute'), 'authenticated cannot mark');
select ok(has_function_privilege('service_role', 'public.claim_due_reminders(int)', 'execute'), 'service_role can claim');
select ok(has_function_privilege('service_role', 'public.mark_reminder_result(uuid,text,text,text)', 'execute'), 'service_role can mark');
select throws_ok(
  $q$select public.mark_reminder_result('00000000-0000-0000-0000-000000000002', 'bogus')$q$,
  'invalid outcome: bogus');

-- Criteria 12: the cron job exists when pg_cron is installed.
select ok(
  not exists (select 1 from pg_extension where extname = 'pg_cron')
  or (select count(*) from cron.job where jobname = 'send_due_reminders') = 1,
  'send_due_reminders cron job exists');

select * from finish();
rollback;
