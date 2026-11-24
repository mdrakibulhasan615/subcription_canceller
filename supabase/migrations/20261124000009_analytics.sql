-- T-021: first-party analytics. No new grants, no policies, no functions.

-- One answer per user and key (the card-interest question; a double click is a no-op).
create unique index feedback_user_key_uq on public.feedback (user_id, key);

-- At most one app_opened event per user per UTC day.
-- timestamptz AT TIME ZONE 'UTC' (constant) is immutable, and so is timestamp -> date,
-- so the expression is allowed in an index.
create unique index events_app_opened_daily_uq
  on public.events (user_id, ((created_at at time zone 'UTC')::date))
  where name = 'app_opened' and user_id is not null;
