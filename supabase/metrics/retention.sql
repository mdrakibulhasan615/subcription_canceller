-- Retention (week 4). Target: 25%.
-- Users with an app_opened event in week 4, divided by users who
-- signed up at least 28 days ago.
-- Day 1 = sign-up day, so week 4 = days 22 to 28 = [created_at + 21 days, created_at + 28 days).
-- Caveats: deleted users have user_id null and drop out (survivor bias). With about 20 users the
-- number is noisy.
-- Run in the Supabase SQL editor. Prints one row: numerator, denominator, percent.
select
  count(*) filter (where exists (
    select 1 from public.events e
    where e.user_id = p.id and e.name = 'app_opened'
      and e.created_at >= p.created_at + interval '21 days'
      and e.created_at < p.created_at + interval '28 days'
  )) as numerator,
  count(*) as denominator,
  round(100.0 * count(*) filter (where exists (
    select 1 from public.events e
    where e.user_id = p.id and e.name = 'app_opened'
      and e.created_at >= p.created_at + interval '21 days'
      and e.created_at < p.created_at + interval '28 days'
  )) / nullif(count(*), 0), 1) as percent
from public.profiles p
where p.created_at <= now() - interval '28 days';
