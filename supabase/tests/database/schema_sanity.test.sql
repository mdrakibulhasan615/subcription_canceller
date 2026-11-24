-- Schema shape, RLS flags, CHECK and UNIQUE rules, delete cascade.
begin;
select * from no_plan();

select has_table('public', t, t || ' exists')
from unnest(array['profiles', 'subscriptions', 'reminders', 'guides', 'push_subscriptions',
                  'events', 'feedback', 'audit_log', 'waitlist']) as t;

-- Fails when a later ticket adds a public table without RLS.
select is((select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity), 0,
  'every public table has RLS enabled');

select hasnt_column('public', 'subscriptions', 'status', 'subscriptions has no stored status');
select has_column('public', 'subscriptions', 'stop_confirmed_at', 'subscriptions has stop_confirmed_at');

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com');
insert into public.subscriptions (id, user_id, name, price_minor, currency, billing_cycle) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A sub', 100, 'USD', 'monthly');

-- CHECK violations.
select throws_ok(
  $q$insert into public.subscriptions (user_id, name, price_minor, currency, billing_cycle)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x', -1, 'USD', 'monthly')$q$,
  '23514', null, 'negative price fails');
select throws_ok(
  $q$insert into public.subscriptions (user_id, name, price_minor, currency, billing_cycle)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x', 1, 'JPY', 'monthly')$q$,
  '23514', null, 'currency JPY fails');
select throws_ok(
  $q$insert into public.subscriptions (user_id, name, price_minor, currency, billing_cycle)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x', 1, 'USD', 'daily')$q$,
  '23514', null, 'cycle daily fails');
select throws_ok(
  $q$insert into public.subscriptions (user_id, name, price_minor, currency, billing_cycle, is_trial)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x', 1, 'USD', 'monthly', true)$q$,
  '23514', null, 'trial without end date fails');

-- Duplicate reminder.
insert into public.reminders (subscription_id, user_id, type, fire_at, channel) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stop_date', '2030-01-01T09:00:00Z', 'email');
select throws_ok(
  $q$insert into public.reminders (subscription_id, user_id, type, fire_at, channel)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stop_date', '2030-01-01T09:00:00Z', 'email')$q$,
  '23505', null, 'duplicate reminder fails');

-- Delete cascade: owned rows go, events and audit_log stay with user_id null.
insert into public.push_subscriptions (user_id, endpoint, keys) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'https://push.example/a', '{}');
insert into public.feedback (user_id, key, value) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'k', 'v');
insert into public.events (user_id, name) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'e');
insert into public.audit_log (user_id, action) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a');

delete from auth.users where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select is((select count(*)::int from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0, 'profile removed');
select is((select count(*)::int from public.subscriptions where id = '11111111-1111-1111-1111-111111111111'), 0, 'subscriptions removed');
select is((select count(*)::int from public.reminders where subscription_id = '11111111-1111-1111-1111-111111111111'), 0, 'reminders removed');
select is((select count(*)::int from public.push_subscriptions where endpoint = 'https://push.example/a'), 0, 'push_subscriptions removed');
select is((select count(*)::int from public.feedback where key = 'k'), 0, 'feedback removed');
select is((select count(*)::int from public.events where name = 'e' and user_id is null), 1, 'event kept with null user_id');
select is((select count(*)::int from public.audit_log where action = 'a' and user_id is null), 1, 'audit_log kept with null user_id');

select * from finish();
rollback;
