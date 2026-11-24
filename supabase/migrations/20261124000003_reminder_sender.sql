-- T-009 reminder sender. claimed_until is a lease: a SKIP LOCKED lock ends when the claim
-- function returns, so the lease is what stops a second run from sending the same row.
-- Delivery is at-least-once: a crash between send and mark re-sends after the lease ends.

alter table public.reminders add column claimed_until timestamptz;

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
  sub_inactive boolean
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
    (s.archived_at is not null or s.merchant_cancelled_at is not null or s.stop_confirmed_at is not null)
  from claimed c
  join public.subscriptions s on s.id = c.subscription_id
  join public.profiles p on p.id = c.user_id
  order by c.fire_at;
$$;

create function public.mark_reminder_result(p_id uuid, p_outcome text, p_error text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if p_outcome not in ('sent', 'skipped', 'retry') then
    raise exception 'invalid outcome: %', p_outcome;
  end if;

  -- Every update is guarded by status = 'pending'. A late or duplicate mark changes nothing.
  if p_outcome = 'sent' then
    update public.reminders r
    set status = 'sent', sent_at = now(), claimed_until = null
    where r.id = p_id and r.status = 'pending'
    returning r.status into v_status;
  elsif p_outcome = 'skipped' then
    update public.reminders r
    set status = 'skipped', claimed_until = null
    where r.id = p_id and r.status = 'pending'
    returning r.status into v_status;
  else
    -- fire_at stays as it is: it is part of the unique key. Backoff uses claimed_until.
    update public.reminders r
    set attempts = r.attempts + 1,
        last_error = p_error,
        status = case when r.attempts + 1 >= 3 then 'failed' else 'pending' end,
        claimed_until = case when r.attempts + 1 >= 3 then null
                             else now() + (r.attempts + 1) * interval '5 minutes' end
    where r.id = p_id and r.status = 'pending'
    returning r.status into v_status;
  end if;

  if v_status is null then
    select r.status into v_status from public.reminders r where r.id = p_id;
  end if;
  return v_status;
end;
$$;

revoke execute on function public.claim_due_reminders(int) from public, anon, authenticated;
revoke execute on function public.mark_reminder_result(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_due_reminders(int) to service_role;
grant execute on function public.mark_reminder_result(uuid, text, text) to service_role;

-- Schedule. Skipped when pg_cron is not available, so the migration never fails on it.
-- The secret and URL come from Vault (names: project_url, reminder_cron_secret).
do $do$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
    create extension if not exists pg_cron;
    perform cron.schedule(
      'send_due_reminders',
      '*/5 * * * *',
      $cmd$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/send_due_reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_cron_secret')
        ),
        body := '{}'::jsonb
      );
      $cmd$
    );
  end if;
end
$do$;
