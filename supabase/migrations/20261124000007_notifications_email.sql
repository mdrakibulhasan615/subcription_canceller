-- T-011 email channel and in-app notifications.
-- Order matters: columns first, then the function that reads them.
-- 1 email opt-out. 2 read_at for in-app. 3 claim_due_reminders returns the fields the email needs.
-- 4 one-off reopen of rows that failed before email was set up. 5 cap on pending rows per client.

-- 1. Email opt-out. In-app reminders stay on.
alter table public.profiles add column email_reminders boolean not null default true;
grant update (email_reminders) on public.profiles to authenticated;

-- 2. In-app read state. A client may set read_at only. The status guard trigger is not affected.
alter table public.reminders add column read_at timestamptz;
grant update (read_at) on public.reminders to authenticated;
create index reminders_unread_in_app_idx on public.reminders (user_id)
  where channel = 'in_app' and status = 'sent' and read_at is null;

-- 3. A return type cannot change in place, so drop and create again. Same body, new columns.
drop function public.claim_due_reminders(int);

create function public.claim_due_reminders(batch int default 50)
returns table (
  id uuid,
  subscription_id uuid,
  user_id uuid,
  type text,
  channel text,
  fire_at timestamptz,
  attempts int,
  user_email text,
  sub_name text,
  stop_date date,
  next_renewal_date date,
  trial_end_date date,
  sub_inactive boolean,
  cancel_url text,
  price_minor int,
  currency text,
  timezone text,
  email_reminders boolean
)
language sql
security definer
set search_path = ''
as $$
  with picked as (
    select r.id
    from public.reminders r
    where r.status = 'pending'
      and r.fire_at <= now()
      and r.attempts < 3
      and (r.claimed_until is null or r.claimed_until < now())
    order by r.fire_at
    limit greatest(least(batch, 200), 0)
    for update of r skip locked
  ),
  claimed as (
    update public.reminders r
    set claimed_until = now() + interval '10 minutes'
    from picked
    where r.id = picked.id
    returning r.id, r.subscription_id, r.user_id, r.type, r.channel, r.fire_at, r.attempts
  )
  select c.id, c.subscription_id, c.user_id, c.type, c.channel, c.fire_at, c.attempts,
    p.email,
    s.name,
    s.stop_date,
    s.next_renewal_date,
    s.trial_end_date,
    (s.archived_at is not null or s.merchant_cancelled_at is not null or s.stop_confirmed_at is not null),
    s.cancel_url,
    s.price_minor,
    s.currency,
    p.timezone,
    p.email_reminders
  from claimed c
  join public.subscriptions s on s.id = c.subscription_id
  join public.profiles p on p.id = c.user_id
  order by c.fire_at;
$$;

revoke execute on function public.claim_due_reminders(int) from public, anon, authenticated;
grant execute on function public.claim_due_reminders(int) to service_role;

-- 4. One-off: rows that failed only because email was not set up get a new try.
-- Safe to run again. It changes 0 rows on a new database.
update public.reminders
set status = 'pending', attempts = 0, claimed_until = null, last_error = null
where status in ('failed', 'pending')
  and last_error = 'email not configured'
  and fire_at > now() - interval '1 day';

-- 5. A client may hold at most 1000 pending rows. service_role and the owner are never capped.
-- The lock makes parallel inserts of one user count one at a time.
create function public.reminders_cap_insert() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    perform pg_advisory_xact_lock(hashtext(new.user_id::text));
    if (select count(*) from public.reminders r
        where r.user_id = new.user_id and r.status = 'pending') >= 1000 then
      raise exception 'too many pending reminders'
        using errcode = '54000';
    end if;
  end if;
  return new;
end;
$$;
create trigger reminders_cap_insert before insert on public.reminders
  for each row execute function public.reminders_cap_insert();
revoke execute on function public.reminders_cap_insert() from public, anon, authenticated;
