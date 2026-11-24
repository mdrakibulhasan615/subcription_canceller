-- T-004 profile settings: reminder_hour, reminder_days shape, column grants.
begin;
select * from no_plan();

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@example.com');

-- D1: default.
select is((select reminder_hour from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 9,
  'reminder_hour defaults to 9');

set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
set local role authenticated;

-- D2: own hour.
select lives_ok($q$update public.profiles set reminder_hour = 0 where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$,
  'A sets hour 0');
select lives_ok($q$update public.profiles set reminder_hour = 23 where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$,
  'A sets hour 23');
select throws_ok($q$update public.profiles set reminder_hour = 24 where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$,
  '23514', null, 'hour 24 rejected');
select throws_ok($q$update public.profiles set reminder_hour = -1 where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$,
  '23514', null, 'hour -1 rejected');

-- D3: other user.
with u as (update public.profiles set reminder_hour = 5 where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' returning 1)
select is((select count(*)::int from u), 0, 'A cannot update B reminder_hour');

-- D4: reminder_days shape.
select throws_ok($q$update public.profiles set reminder_days = '{}' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$,
  '23514', null, 'empty reminder_days rejected');
select throws_ok($q$update public.profiles set reminder_days = '{0}' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$,
  '23514', null, 'reminder_days with 0 rejected');
select throws_ok($q$update public.profiles set reminder_days = '{1,2,3,4,5,6}' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$,
  '23514', null, 'six reminder_days rejected');
select throws_ok($q$update public.profiles set reminder_days = '{366}' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$,
  '23514', null, 'reminder_days 366 rejected');
select lives_ok($q$update public.profiles set reminder_days = '{365,30,14,7,1}' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$,
  'five days up to 365 accepted');
select throws_ok($q$update public.profiles set timezone = repeat('x', 65) where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$,
  '23514', null, 'timezone over 64 chars rejected');

-- D5: protected columns.
select throws_ok($q$update public.profiles set email = 'x@example.com' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$,
  '42501', null, 'email update denied');
select throws_ok($q$update public.profiles set id = gen_random_uuid() where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$,
  '42501', null, 'id update denied');

-- D6: onboarded_at (T-019).
select lives_ok($q$update public.profiles set onboarded_at = now() where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$,
  'A sets own onboarded_at');
with u as (update public.profiles set onboarded_at = now() where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' returning 1)
select is((select count(*)::int from u), 0, 'A cannot update B onboarded_at');
select throws_ok($q$update public.profiles set created_at = now() where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$,
  '42501', null, 'created_at update still denied');

select * from finish();
rollback;
