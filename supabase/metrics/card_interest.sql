-- Card interest. Target: 40%.
-- Answers to the feedback key 'auto_close_interest': yes divided by all answers.
-- maybe_count and no_count are extra columns for context.
-- Run in the Supabase SQL editor. Prints one row: numerator, denominator, percent.
select
  count(*) filter (where value = 'yes') as numerator,
  count(*) as denominator,
  round(100.0 * count(*) filter (where value = 'yes') / nullif(count(*), 0), 1) as percent,
  count(*) filter (where value = 'maybe') as maybe_count,
  count(*) filter (where value = 'no') as no_count
from public.feedback
where key = 'auto_close_interest';
