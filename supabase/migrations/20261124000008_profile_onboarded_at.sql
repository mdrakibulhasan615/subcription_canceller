-- T-019 onboarding: one-shot flag. Null means onboarding was not shown yet.
alter table public.profiles add column onboarded_at timestamptz;

-- Backfill first: people who signed up before onboarding existed must not see it.
update public.profiles set onboarded_at = now() where onboarded_at is null;

grant update (onboarded_at) on public.profiles to authenticated;
