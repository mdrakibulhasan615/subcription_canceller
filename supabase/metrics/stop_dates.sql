-- Stop dates. Target: 40%.
-- Share of subscriptions with a stop date set.
-- Run in the Supabase SQL editor. Prints one row: numerator, denominator, percent.
select
  count(*) filter (where stop_date is not null) as numerator,
  count(*) as denominator,
  round(100.0 * count(*) filter (where stop_date is not null) / nullif(count(*), 0), 1) as percent
from public.subscriptions;
