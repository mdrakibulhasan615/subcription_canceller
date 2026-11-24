-- T-010 client grants and status trigger on reminders.
begin;
select * from no_plan();

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@example.com');
insert into public.subscriptions (id, user_id, name, price_minor, currency, billing_cycle) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A sub', 100, 'USD', 'monthly'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B sub', 100, 'USD', 'monthly');
insert into public.reminders (id, subscription_id, user_id, type, channel, fire_at, status) values
  ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stop_date', 'in_app', now() + interval '1 day', 'pending'),
  ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stop_date', 'email', now() + interval '1 day', 'failed'),
  ('00000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'renewal', 'in_app', now() + interval '1 day', 'skipped'),
  ('00000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'renewal', 'email', now() + interval '1 day', 'pending'),
  ('00000000-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'renewal', 'email', now() + interval '1 day', 'pending');

set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
set local role authenticated;

-- Insert.
select throws_ok(
  $q$insert into public.reminders (subscription_id, user_id, type, channel, fire_at, status)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'trial_end', 'in_app', now() + interval '2 days', 'sent')$q$,
  '42501', null, 'insert with status sent fails');
select lives_ok(
  $q$insert into public.reminders (subscription_id, user_id, type, channel, fire_at)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'trial_end', 'in_app', now() + interval '2 days')$q$,
  'insert of the 5 allowed columns works');
select results_eq(
  $q$select status, attempts from public.reminders where type = 'trial_end'$q$,
  $q$values ('pending'::text, 0)$q$,
  'new row is pending with 0 attempts');
select throws_ok(
  $q$insert into public.reminders (subscription_id, user_id, type, channel, fire_at)
     values ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'trial_end', 'email', now() + interval '2 days')$q$,
  '42501', null, 'insert for another user subscription fails');

-- Update of other columns.
select throws_ok($q$update public.reminders set attempts = 0 where id = '00000000-0000-0000-0000-000000000001'$q$,
  '42501', null, 'update of attempts fails');
select throws_ok($q$update public.reminders set claimed_until = null where id = '00000000-0000-0000-0000-000000000001'$q$,
  '42501', null, 'update of claimed_until fails');
select throws_ok($q$update public.reminders set sent_at = now() where id = '00000000-0000-0000-0000-000000000001'$q$,
  '42501', null, 'update of sent_at fails');
select throws_ok($q$update public.reminders set last_error = 'x' where id = '00000000-0000-0000-0000-000000000001'$q$,
  '42501', null, 'update of last_error fails');

-- Status changes.
select throws_ok($q$update public.reminders set status = 'sent' where id = '00000000-0000-0000-0000-000000000001'$q$,
  '42501', null, 'pending to sent fails');
select throws_ok($q$update public.reminders set status = 'pending' where id = '00000000-0000-0000-0000-000000000002'$q$,
  '42501', null, 'failed to pending fails');
select lives_ok($q$update public.reminders set status = 'skipped' where id = '00000000-0000-0000-0000-000000000001'$q$,
  'pending to skipped works');
select lives_ok($q$update public.reminders set status = 'pending' where id = '00000000-0000-0000-0000-000000000003'$q$,
  'skipped to pending works');

-- Delete own rows.
select lives_ok($q$delete from public.reminders where id = '00000000-0000-0000-0000-000000000004'$q$,
  'delete own row works');

reset role;

-- The definer function and service_role are not blocked.
set local role service_role;
select is(public.mark_reminder_result('00000000-0000-0000-0000-000000000003', 'sent', null, 'prov-1'), 'sent',
  'mark_reminder_result sent works as service_role (4-arg)');
select is((select provider_ref from public.reminders where id = '00000000-0000-0000-0000-000000000003'), 'prov-1',
  'provider_ref is stored');
select is(public.mark_reminder_result('00000000-0000-0000-0000-000000000001', 'skipped'), 'skipped',
  'mark_reminder_result works with 3 args');
reset role;

select * from finish();
rollback;
