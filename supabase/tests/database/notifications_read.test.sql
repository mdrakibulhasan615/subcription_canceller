-- T-011 read_at grant, claim columns, email opt-out column, reopen rule (copy of migration step 4).
begin;
select * from no_plan();

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@example.com');
insert into public.subscriptions (id, user_id, name, price_minor, currency, billing_cycle) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A sub', 100, 'USD', 'monthly'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B sub', 100, 'USD', 'monthly');
insert into public.reminders (id, subscription_id, user_id, type, channel, fire_at, status, sent_at) values
  ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stop_date', 'in_app', now() - interval '1 day', 'sent', now()),
  ('00000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'stop_date', 'in_app', now() - interval '1 day', 'sent', now());

select is((select email_reminders from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), true,
  'email_reminders defaults to true');

set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
set local role authenticated;

select lives_ok($q$update public.profiles set email_reminders = false where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$,
  'client can set email_reminders');
select lives_ok($q$update public.reminders set read_at = now() where id = '00000000-0000-0000-0000-000000000001'$q$,
  'client can set read_at on own row');
with u as (update public.reminders set read_at = now() where id = '00000000-0000-0000-0000-000000000002' returning 1)
select is((select count(*)::int from u), 0, 'client cannot set read_at on another user row');
select throws_ok($q$update public.reminders set attempts = 1 where id = '00000000-0000-0000-0000-000000000001'$q$,
  '42501', null, 'attempts is still not updatable');
select throws_ok($q$update public.reminders set sent_at = now() where id = '00000000-0000-0000-0000-000000000001'$q$,
  '42501', null, 'sent_at is still not updatable');
select throws_ok($q$update public.reminders set claimed_until = null where id = '00000000-0000-0000-0000-000000000001'$q$,
  '42501', null, 'claimed_until is still not updatable');
select throws_ok($q$select * from public.claim_due_reminders(1)$q$, '42501', null, 'client cannot claim');

reset role;

select is((select count(*)::int from public.reminders where read_at is not null), 1, 'only the own row was read');

-- Claim returns the new columns (service_role only).
insert into public.reminders (id, subscription_id, user_id, type, channel, fire_at) values
  ('00000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'renewal', 'email', now() - interval '1 hour');
update public.subscriptions set cancel_url = 'https://example.com/cancel' where id = '11111111-1111-1111-1111-111111111111';
set local role service_role;
select results_eq(
  $q$select subscription_id, cancel_url, price_minor, currency, timezone, email_reminders from public.claim_due_reminders(5)$q$,
  $q$values ('11111111-1111-1111-1111-111111111111'::uuid, 'https://example.com/cancel'::text, 100, 'USD'::text, 'UTC'::text, false)$q$,
  'claim returns subscription, cancel_url, price, currency, timezone and opt-out');
reset role;

-- NOT the migration itself: the migration ran on an empty database, so it changed 0 rows.
-- This runs a COPY of migration step 4 on test rows. Keep it the same as the migration.
-- The real one-off is checked by hand on the project (see supabase/README.md).
insert into public.reminders (id, subscription_id, user_id, type, channel, fire_at, status, attempts, last_error) values
  ('00000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stop_date', 'email', now() - interval '2 hours', 'failed', 3, 'email not configured'),
  ('00000000-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stop_date', 'email', now() - interval '3 hours', 'failed', 3, 'resend 500');
update public.reminders
set status = 'pending', attempts = 0, claimed_until = null, last_error = null
where status in ('failed', 'pending') and last_error = 'email not configured' and fire_at > now() - interval '1 day';
select results_eq(
  $q$select status, attempts from public.reminders where id = '00000000-0000-0000-0000-000000000011'$q$,
  $q$values ('pending'::text, 0)$q$, 'copy of step 4: recent not-configured failure is reopened');
select is((select status from public.reminders where id = '00000000-0000-0000-0000-000000000012'), 'failed',
  'copy of step 4: other errors stay failed');

select * from finish();
rollback;
