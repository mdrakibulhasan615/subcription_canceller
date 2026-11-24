-- T-004 profile settings: reminder hour, tighter reminder_days, timezone length.
-- Existing rows hold the defaults ('UTC', '{7,3,1}'), so the new checks pass on them.

alter table public.profiles
  add column reminder_hour int not null default 9 check (reminder_hour between 0 and 23);

grant update (reminder_hour) on public.profiles to authenticated;

alter table public.profiles
  add constraint profiles_reminder_days_shape
  check (
    cardinality(reminder_days) between 1 and 5
    and 365 >= all (reminder_days)
    and array_position(reminder_days, null) is null
  );

-- Only the length is checked here. Timezone validity is checked in the server action.
alter table public.profiles
  add constraint profiles_timezone_length check (char_length(timezone) <= 64);
