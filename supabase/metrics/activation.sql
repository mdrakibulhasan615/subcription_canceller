-- Activation. Target: 50%.
-- Share of users (profiles) with at least 3 subscriptions.
-- Caveat: deleted subscriptions are not counted, so the number can only be too low.
-- Run in the Supabase SQL editor. Prints one row: numerator, denominator, percent.
select
  count(*) filter (where n >= 3) as numerator,
  count(*) as denominator,
  round(100.0 * count(*) filter (where n >= 3) / nullif(count(*), 0), 1) as percent
from (
  select p.id, (select count(*) from public.subscriptions s where s.user_id = p.id) as n
  from public.profiles p
) t;
