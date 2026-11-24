-- T-023: deleting an auth user removes child rows and nulls events/audit_log.
begin;
select * from no_plan();

insert into auth.users (id, email) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com');
insert into public.subscriptions (id, user_id, name, price_minor, currency, billing_cycle) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A sub', 100, 'USD', 'monthly');
insert into public.reminders (subscription_id, user_id, type, fire_at, channel) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stop_date', now(), 'in_app');
insert into public.push_subscriptions (user_id, endpoint, keys) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'https://push.example/1', '{}');
insert into public.feedback (user_id, key, value) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'k', 'v');
insert into public.events (user_id, name) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'e');
insert into public.audit_log (user_id, action) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x');

delete from auth.users where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select is((select count(*)::int from public.profiles), 0, 'profile is gone');
select is((select count(*)::int from public.subscriptions), 0, 'subscriptions are gone');
select is((select count(*)::int from public.reminders), 0, 'reminders are gone');
select is((select count(*)::int from public.push_subscriptions), 0, 'push subscriptions are gone');
select is((select count(*)::int from public.feedback), 0, 'feedback is gone');
select is((select count(*)::int from public.events where user_id is null and name = 'e'), 1,
  'event is kept with a null user');
select is((select count(*)::int from public.audit_log where user_id is null and action = 'x'), 1,
  'audit row is kept with a null user');

select * from finish();
rollback;
