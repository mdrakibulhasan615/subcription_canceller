-- RLS for guides, waitlist, events, and anon with no JWT.
begin;
select * from no_plan();

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@example.com');
insert into public.guides (kind, service_slug, title) values ('cancel', 'netflix', 'Netflix');

-- Anon with no JWT.
set local request.jwt.claims = '';
set local role anon;

select is((select count(*)::int from public.guides), 1, 'anon can select guides');
select throws_ok($q$insert into public.guides (kind, service_slug, title) values ('cancel', 'x', 'x')$q$,
  '42501', null, 'anon cannot insert guides');
select throws_ok($q$update public.guides set title = 'x'$q$, '42501', null, 'anon cannot update guides');
select throws_ok($q$delete from public.guides$q$, '42501', null, 'anon cannot delete guides');

select throws_ok($q$select * from public.subscriptions$q$, '42501', null, 'anon cannot read subscriptions');
select throws_ok($q$select * from public.profiles$q$, '42501', null, 'anon cannot read profiles');
select throws_ok($q$select * from public.reminders$q$, '42501', null, 'anon cannot read reminders');
select throws_ok($q$select * from public.push_subscriptions$q$, '42501', null, 'anon cannot read push_subscriptions');
select throws_ok($q$select * from public.feedback$q$, '42501', null, 'anon cannot read feedback');
select throws_ok($q$select * from public.audit_log$q$, '42501', null, 'anon cannot read audit_log');
select throws_ok(
  $q$insert into public.subscriptions (user_id, name, price_minor, currency, billing_cycle)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x', 1, 'USD', 'monthly')$q$,
  '42501', null, 'anon cannot insert subscriptions');

-- Waitlist (anon).
select lives_ok($q$insert into public.waitlist (email) values ('Person@Example.com')$q$, 'anon can join waitlist');
select throws_ok($q$insert into public.waitlist (email) values ('person@example.com')$q$,
  '23505', null, 'same email in other case fails');
select throws_ok($q$insert into public.waitlist (email) values ('nope')$q$, '23514', null, 'email without @ fails');
select throws_ok($q$insert into public.waitlist (email) values ('@example.com')$q$, '23514', null, 'email starting with @ fails');
select throws_ok($q$select * from public.waitlist$q$, '42501', null, 'anon cannot read waitlist');
select throws_ok($q$update public.waitlist set source = 'x'$q$, '42501', null, 'anon cannot update waitlist');
select throws_ok($q$delete from public.waitlist$q$, '42501', null, 'anon cannot delete waitlist');

-- Events (anon).
select lives_ok($q$insert into public.events (name) values ('landing_view')$q$, 'anon can insert event with null user');
select throws_ok(
  $q$insert into public.events (user_id, name) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x')$q$,
  '42501', null, 'anon cannot insert event with user_id');
select throws_ok($q$select * from public.events$q$, '42501', null, 'anon cannot read events');

-- Authenticated as A.
reset role;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
set local role authenticated;

select is((select count(*)::int from public.guides), 1, 'authenticated can select guides');
select throws_ok($q$insert into public.guides (kind, service_slug, title) values ('cancel', 'y', 'y')$q$,
  '42501', null, 'authenticated cannot insert guides');
select throws_ok($q$update public.guides set title = 'x'$q$, '42501', null, 'authenticated cannot update guides');
select throws_ok($q$delete from public.guides$q$, '42501', null, 'authenticated cannot delete guides');

select lives_ok($q$insert into public.waitlist (email) values ('other@example.com')$q$, 'authenticated can join waitlist');
select throws_ok($q$select * from public.waitlist$q$, '42501', null, 'authenticated cannot read waitlist');

select lives_ok($q$insert into public.events (name) values ('x')$q$, 'authenticated can insert event with null user');
select lives_ok(
  $q$insert into public.events (user_id, name) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x')$q$,
  'authenticated can insert own event');
select throws_ok(
  $q$insert into public.events (user_id, name) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'x')$q$,
  '42501', null, 'authenticated cannot insert event for B');
select throws_ok($q$select * from public.events$q$, '42501', null, 'authenticated cannot read events');

reset role;
select * from finish();
rollback;
