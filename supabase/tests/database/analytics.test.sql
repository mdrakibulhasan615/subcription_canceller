-- T-021: events insert rules, one app_opened per UTC day, one feedback answer per key.
begin;
select * from no_plan();

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@example.com');
insert into public.feedback (user_id, key, value) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'auto_close_interest', 'no');

-- Anon.
set local request.jwt.claims = '';
set local role anon;
select lives_ok(
  $q$insert into public.events (name, props) values ('waitlist_joined', '{}')$q$,
  'anon can insert an event with no user id');
select throws_ok(
  $q$insert into public.events (user_id, name) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'app_opened')$q$,
  '42501', null, 'anon cannot insert an event with a user id');
select throws_ok($q$select * from public.events$q$, '42501', null, 'anon cannot read events');

-- Authenticated as A.
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
set local role authenticated;
select throws_ok($q$select * from public.events$q$, '42501', null, 'authenticated cannot read events');
select throws_ok(
  $q$insert into public.events (user_id, name) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'app_opened')$q$,
  '42501', null, 'authenticated cannot insert an event for another user');
select throws_ok(
  $q$insert into public.events (name, props) values ('csv_imported', jsonb_build_object('x', repeat('a', 5000)))$q$,
  '23514', null, 'props of 4096 bytes or more fail');

select lives_ok(
  $q$insert into public.events (user_id, name, created_at)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'app_opened', '2026-06-01 00:30:00+00')$q$,
  'first app_opened of a UTC day works');
select throws_ok(
  $q$insert into public.events (user_id, name, created_at)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'app_opened', '2026-06-01 23:30:00+00')$q$,
  '23505', null, 'second app_opened on the same UTC day fails');
select lives_ok(
  $q$insert into public.events (user_id, name, created_at)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'app_opened', '2026-06-02 00:30:00+00')$q$,
  'app_opened on another UTC day works');
select lives_ok(
  $q$insert into public.events (user_id, name, created_at)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'subscription_added', '2026-06-01 00:30:00+00'),
            ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'subscription_added', '2026-06-01 00:31:00+00')$q$,
  'other event names are not limited');

-- Feedback.
select lives_ok(
  $q$insert into public.feedback (user_id, key, value) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'auto_close_interest', 'yes')$q$,
  'first answer works');
select throws_ok(
  $q$insert into public.feedback (user_id, key, value) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'auto_close_interest', 'no')$q$,
  '23505', null, 'second answer for the same key fails');
select is((select count(*)::int from public.feedback), 1, 'A sees only own feedback');

reset role;
select * from finish();
rollback;
