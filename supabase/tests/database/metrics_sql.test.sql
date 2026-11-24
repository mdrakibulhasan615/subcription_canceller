-- T-021: metrics queries. The query text below is copied from supabase/metrics/*.sql. Keep in sync.
begin;
select * from no_plan();

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@example.com'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'c@example.com'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'd@example.com'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'e@example.com');
-- A to D signed up long ago on a fixed instant. E signed up just now (not in the denominator).
update public.profiles set created_at = '2026-01-01 00:00:00+00'
  where id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
               'cccccccc-cccc-cccc-cccc-cccccccccccc', 'dddddddd-dddd-dddd-dddd-dddddddddddd');

insert into public.events (user_id, name, created_at) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'app_opened', '2026-01-01 00:00:00+00'::timestamptz + interval '20 days 23 hours'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'app_opened', '2026-01-01 00:00:00+00'::timestamptz + interval '21 days'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'app_opened', '2026-01-01 00:00:00+00'::timestamptz + interval '27 days 23 hours'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'app_opened', '2026-01-01 00:00:00+00'::timestamptz + interval '28 days');

-- retention.sql
create temp table retention_out on commit drop as
select
  count(*) filter (where exists (
    select 1 from public.events e
    where e.user_id = p.id and e.name = 'app_opened'
      and e.created_at >= p.created_at + interval '21 days'
      and e.created_at < p.created_at + interval '28 days'
  )) as numerator,
  count(*) as denominator
from public.profiles p
where p.created_at <= now() - interval '28 days';

select is((select numerator::int from retention_out), 2, 'retention numerator: +21d and +27d23h in, +20d23h and +28d out');
select is((select denominator::int from retention_out), 4, 'retention denominator: only profiles 28 days old');

-- stop_dates.sql
insert into public.subscriptions (user_id, name, price_minor, currency, billing_cycle, stop_date) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'With', 100, 'USD', 'monthly', '2026-12-01'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Without', 100, 'USD', 'monthly', null);
create temp table stop_out on commit drop as
select
  count(*) filter (where stop_date is not null) as numerator,
  count(*) as denominator
from public.subscriptions;
select is((select numerator::int from stop_out), 1, 'stop dates numerator');
select is((select denominator::int from stop_out), 2, 'stop dates denominator');

select * from finish();
rollback;
