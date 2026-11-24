-- Reminder value. Target: 30%.
-- Users with at least one subscription that has stop_confirmed_at or merchant_cancelled_at set,
-- divided by users with at least one reminder sent.
-- This is a PROXY. It does not prove that a reminder caused the stop. Cross-check with the events
-- subscription_stop_confirmed and merchant_cancelled_marked.
-- Run in the Supabase SQL editor. Prints one row: numerator, denominator, percent.
with reminded as (
  select distinct user_id from public.reminders where status = 'sent'
)
select
  count(*) filter (where exists (
    select 1 from public.subscriptions s
    where s.user_id = r.user_id
      and (s.stop_confirmed_at is not null or s.merchant_cancelled_at is not null)
  )) as numerator,
  count(*) as denominator,
  round(100.0 * count(*) filter (where exists (
    select 1 from public.subscriptions s
    where s.user_id = r.user_id
      and (s.stop_confirmed_at is not null or s.merchant_cancelled_at is not null)
  )) / nullif(count(*), 0), 1) as percent
from reminded r;
