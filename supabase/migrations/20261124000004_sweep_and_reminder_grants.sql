-- T-010 safety sweep. sweep_facts() only collects facts. The decisions live in packages/core/src/sweep.ts.
-- Also: tighten client grants on reminders, add provider_ref, and give mark_reminder_result a 4th parameter.

alter table public.reminders add column provider_ref text;

-- Client grants. A client may add a pending row and flip pending <-> skipped. Nothing else.
revoke insert, update on public.reminders from authenticated;
grant insert (subscription_id, user_id, type, channel, fire_at) on public.reminders to authenticated;
grant update (status) on public.reminders to authenticated;

create function public.reminders_guard_status() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Security invoker: current_user is the session role. The definer function mark_reminder_result
  -- runs as its owner and service_role is another role, so neither is blocked.
  if current_user = 'authenticated'
     and new.status is distinct from old.status
     and not ((old.status = 'pending' and new.status = 'skipped')
           or (old.status = 'skipped' and new.status = 'pending')) then
    raise exception 'reminder status change not allowed: % to %', old.status, new.status
      using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger reminders_guard_status before update on public.reminders
  for each row execute function public.reminders_guard_status();
revoke execute on function public.reminders_guard_status() from public, anon, authenticated;

-- mark_reminder_result: new 4th parameter p_ref (provider message id). Drop the old signature.
drop function public.mark_reminder_result(uuid, text, text);

create function public.mark_reminder_result(
  p_id uuid, p_outcome text, p_error text default null, p_ref text default null
)
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
    set status = 'sent', sent_at = now(), claimed_until = null, provider_ref = p_ref
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

revoke execute on function public.mark_reminder_result(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.mark_reminder_result(uuid, text, text, text) to service_role;

-- Facts for the daily sweep. Each optional section is guarded, so a missing extension gives false or 0.
create function public.sweep_facts() returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_overdue jsonb;
  v_failed jsonb;
  v_noproof jsonb;
  v_url boolean := false;
  v_secret boolean := false;
  v_installed boolean := false;
  v_active boolean := false;
  v_last timestamptz;
  v_failed_runs int := 0;
  v_bad int := 0;
begin
  select jsonb_build_object('count', count(*),
           'ids', coalesce(to_jsonb((array_agg(r.id order by r.fire_at))[1:20]), '[]'::jsonb))
    into v_overdue
    from public.reminders r
    where r.status = 'pending' and r.fire_at < now() - interval '30 minutes';

  select jsonb_build_object('count', count(*),
           'ids', coalesce(to_jsonb((array_agg(r.id order by r.fire_at))[1:20]), '[]'::jsonb))
    into v_failed
    from public.reminders r
    where r.status = 'failed' and r.fire_at > now() - interval '7 days';

  -- Proof of delivery. in_app: sent_at set and not before fire_at, no live lease.
  -- email: also needs provider_ref one hour after sending.
  select jsonb_build_object('count', count(*),
           'ids', coalesce(to_jsonb((array_agg(r.id order by r.fire_at))[1:20]), '[]'::jsonb))
    into v_noproof
    from public.reminders r
    where r.status = 'sent'
      and r.fire_at > now() - interval '7 days'
      and (r.sent_at is null
           or r.sent_at < r.fire_at
           or r.claimed_until is not null
           or (r.channel = 'email' and r.sent_at < now() - interval '1 hour' and r.provider_ref is null));

  begin
    select exists (select 1 from vault.secrets s where s.name = 'project_url') into v_url;
    select exists (select 1 from vault.secrets s where s.name = 'reminder_cron_secret') into v_secret;
  exception when others then
    v_url := false;
    v_secret := false;
  end;

  begin
    if exists (select 1 from pg_extension where extname = 'pg_cron') then
      v_installed := true;
      select exists (select 1 from cron.job j where j.jobname = 'send_due_reminders' and j.active) into v_active;
      select max(d.start_time) into v_last
        from cron.job_run_details d join cron.job j on j.jobid = d.jobid
        where j.jobname = 'send_due_reminders';
      select count(*)::int into v_failed_runs
        from cron.job_run_details d join cron.job j on j.jobid = d.jobid
        where j.jobname = 'send_due_reminders'
          and d.status = 'failed'
          and d.start_time > now() - interval '1 hour';
    end if;
  exception when others then
    v_active := false;
    v_last := null;
    v_failed_runs := 0;
  end;

  begin
    select count(*)::int into v_bad
      from net._http_response h
      where h.created > now() - interval '6 hours'
        and (coalesce(h.timed_out, false)
             or h.error_msg is not null
             or h.status_code < 200
             or h.status_code >= 300);
  exception when others then
    v_bad := 0;
  end;

  return jsonb_build_object(
    'overduePending', v_overdue,
    'failedRecent', v_failed,
    'sentNoProof', v_noproof,
    'vault', jsonb_build_object('project_url', v_url, 'reminder_cron_secret', v_secret),
    'cron', jsonb_build_object(
      'installed', v_installed,
      'jobActive', v_active,
      'lastRunAt', v_last,
      'failedRuns1h', v_failed_runs),
    'http', jsonb_build_object('badResponses', v_bad)
  );
end;
$$;

revoke execute on function public.sweep_facts() from public, anon, authenticated;
grant execute on function public.sweep_facts() to service_role;
