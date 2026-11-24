-- T-011 cap of 1000 pending reminders per client insert.
begin;
select * from no_plan();

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@example.com');
insert into public.subscriptions (id, user_id, name, price_minor, currency, billing_cycle) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A sub', 100, 'USD', 'monthly'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B sub', 100, 'USD', 'monthly');
-- The owner role is not capped, so this seeds exactly 1000 pending rows for A.
insert into public.reminders (subscription_id, user_id, type, channel, fire_at)
select '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'renewal', 'email',
  now() + interval '10 days' + g * interval '1 minute'
from generate_series(1, 1000) g;

set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
set local role authenticated;

select throws_ok(
  $q$insert into public.reminders (subscription_id, user_id, type, channel, fire_at)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stop_date', 'in_app', now() + interval '2 days')$q$,
  '54000', null, 'client with 1000 pending rows cannot insert');
select lives_ok($q$update public.reminders set status = 'skipped'
  where id = (select id from public.reminders order by fire_at limit 1)$q$, 'client skips one row');
select lives_ok(
  $q$insert into public.reminders (subscription_id, user_id, type, channel, fire_at)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stop_date', 'in_app', now() + interval '2 days')$q$,
  'insert works after one row is skipped');
select throws_ok(
  $q$insert into public.reminders (subscription_id, user_id, type, channel, fire_at)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stop_date', 'email', now() + interval '2 days')$q$,
  '54000', null, 'cap applies again at 1000');
select lives_ok($q$delete from public.reminders
  where id = (select id from public.reminders where status = 'pending' order by fire_at limit 1)$q$, 'client deletes one row');
select lives_ok(
  $q$insert into public.reminders (subscription_id, user_id, type, channel, fire_at)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stop_date', 'email', now() + interval '2 days')$q$,
  'insert works after one row is deleted');

reset role;

-- Another user is not affected.
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
set local role authenticated;
select lives_ok(
  $q$insert into public.reminders (subscription_id, user_id, type, channel, fire_at)
     values ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'stop_date', 'in_app', now() + interval '2 days')$q$,
  'another user can insert');
reset role;

-- service_role is never capped (A is at 1000 pending again).
set local role service_role;
select lives_ok(
  $q$insert into public.reminders (subscription_id, user_id, type, channel, fire_at)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'trial_end', 'in_app', now() + interval '3 days')$q$,
  'service_role is not capped');
reset role;

select ok(not has_function_privilege('authenticated', 'public.reminders_cap_insert()', 'execute'),
  'authenticated cannot run the cap function');

select * from finish();
rollback;
