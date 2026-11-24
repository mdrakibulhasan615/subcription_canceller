-- RLS isolation: user A must never see or change user B data.
begin;
select * from no_plan();

-- Setup as superuser. The trigger creates the profiles.
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@example.com');
insert into public.subscriptions (id, user_id, name, price_minor, currency, billing_cycle) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A sub', 100, 'USD', 'monthly'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B sub', 200, 'USD', 'monthly');
insert into public.reminders (id, subscription_id, user_id, type, fire_at, channel) values
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'stop_date', now(), 'email');
insert into public.push_subscriptions (id, user_id, endpoint, keys) values
  ('44444444-4444-4444-4444-444444444444', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'https://push.example/b', '{}');
insert into public.feedback (user_id, key, value) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'card_interest', 'yes');
insert into public.audit_log (user_id, action) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'test');

-- Act as user A.
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
set local role authenticated;

select is((select count(*)::int from public.subscriptions), 1, 'A sees only own subscriptions');
select is((select count(*)::int from public.subscriptions where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0, 'A sees none of B subscriptions');

with u as (update public.subscriptions set name = 'hacked' where id = '22222222-2222-2222-2222-222222222222' returning 1)
select is((select count(*)::int from u), 0, 'A update of B subscription changes 0 rows');
with d as (delete from public.subscriptions where id = '22222222-2222-2222-2222-222222222222' returning 1)
select is((select count(*)::int from d), 0, 'A delete of B subscription changes 0 rows');

select throws_ok(
  $q$insert into public.subscriptions (user_id, name, price_minor, currency, billing_cycle)
     values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'x', 1, 'USD', 'monthly')$q$,
  '42501', null, 'A cannot insert a subscription for B');
select throws_ok(
  $q$update public.subscriptions set user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
     where id = '11111111-1111-1111-1111-111111111111'$q$,
  '42501', null, 'A cannot move own subscription to B');

select throws_ok(
  $q$insert into public.reminders (subscription_id, user_id, type, fire_at, channel)
     values ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'renewal', now(), 'email')$q$,
  '42501', null, 'A cannot add a reminder to B subscription (own user_id)');
select throws_ok(
  $q$insert into public.reminders (subscription_id, user_id, type, fire_at, channel)
     values ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'renewal', now(), 'email')$q$,
  '42501', null, 'A cannot add a reminder to B subscription (B user_id)');

select is((select count(*)::int from public.reminders), 0, 'A sees 0 reminders');
select is((select count(*)::int from public.push_subscriptions), 0, 'A sees 0 push_subscriptions');
select is((select count(*)::int from public.feedback), 0, 'A sees 0 feedback');
select is((select count(*)::int from public.audit_log), 0, 'A sees 0 audit_log');
select is((select count(*)::int from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0, 'A cannot see B profile');
select is((select count(*)::int from public.profiles), 1, 'A sees only own profile');

with u as (update public.profiles set display_name = 'x' where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' returning 1)
select is((select count(*)::int from u), 0, 'A update of B profile changes 0 rows');
with u as (update public.reminders set status = 'skipped' where id = '33333333-3333-3333-3333-333333333333' returning 1)
select is((select count(*)::int from u), 0, 'A update of B reminder changes 0 rows');
with d as (delete from public.reminders where id = '33333333-3333-3333-3333-333333333333' returning 1)
select is((select count(*)::int from d), 0, 'A delete of B reminder changes 0 rows');
with u as (update public.push_subscriptions set endpoint = 'x' where id = '44444444-4444-4444-4444-444444444444' returning 1)
select is((select count(*)::int from u), 0, 'A update of B push_subscription changes 0 rows');
with d as (delete from public.push_subscriptions where id = '44444444-4444-4444-4444-444444444444' returning 1)
select is((select count(*)::int from d), 0, 'A delete of B push_subscription changes 0 rows');

select throws_ok($q$delete from public.profiles$q$, '42501', null, 'A cannot delete profiles');
select throws_ok($q$insert into public.profiles (id) values (gen_random_uuid())$q$, '42501', null, 'A cannot insert profiles');
select throws_ok($q$update public.feedback set value = 'x'$q$, '42501', null, 'A cannot update feedback');
select throws_ok(
  $q$insert into public.feedback (user_id, key, value) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'k', 'v')$q$,
  '42501', null, 'A cannot insert feedback for B');
select lives_ok(
  $q$insert into public.feedback (user_id, key, value) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'k', 'v')$q$,
  'A can insert own feedback');
select is((select count(*)::int from public.feedback), 1, 'A sees own feedback');
select throws_ok(
  $q$insert into public.audit_log (user_id, action) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x')$q$,
  '42501', null, 'authenticated cannot insert audit_log');

-- Own data still works.
select lives_ok(
  $q$insert into public.subscriptions (user_id, name, price_minor, currency, billing_cycle)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A two', 1, 'USD', 'monthly')$q$,
  'A can insert own subscription');
select lives_ok(
  $q$insert into public.reminders (subscription_id, user_id, type, fire_at, channel)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'renewal', now(), 'email')$q$,
  'A can add a reminder to own subscription');

select throws_ok(
  $q$update public.profiles set email = 'victim@example.com' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$,
  '42501', null, 'A cannot change own profile email (column grant)');
select lives_ok(
  $q$update public.profiles set display_name = 'Me' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$,
  'A can change own display_name');

reset role;
select * from finish();
rollback;
