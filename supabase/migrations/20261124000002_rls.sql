-- T-002 RLS. Deny by default: revoke everything, grant only what policies need.

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.reminders enable row level security;
alter table public.guides enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.events enable row level security;
alter table public.feedback enable row level security;
alter table public.audit_log enable row level security;
alter table public.waitlist enable row level security;

revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, timezone, currency, default_stop_days_before, reminder_days) on public.profiles to authenticated;
grant select, insert, update, delete on public.subscriptions to authenticated;
grant select, insert, update, delete on public.reminders to authenticated;
grant select on public.guides to anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant insert on public.events to anon, authenticated;
grant select, insert on public.feedback to authenticated;
grant select on public.audit_log to authenticated;
-- waitlist: the client must use a plain insert and ignore the duplicate error.
-- No returning and no on conflict: both need select or update rights.
grant insert on public.waitlist to anon, authenticated;

-- profiles: no insert or delete for clients (trigger inserts; auth.users cascade deletes).
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy subscriptions_select_own on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy subscriptions_insert_own on public.subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy subscriptions_update_own on public.subscriptions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy subscriptions_delete_own on public.subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- reminders: MVP accepts that clients may set status. T-009 uses the service role. Tighten later.
create policy reminders_select_own on public.reminders for select to authenticated
  using (user_id = (select auth.uid()));
create policy reminders_insert_own on public.reminders for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.subscriptions s
                where s.id = reminders.subscription_id and s.user_id = (select auth.uid()))
  );
create policy reminders_update_own on public.reminders for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.subscriptions s
                where s.id = reminders.subscription_id and s.user_id = (select auth.uid()))
  );
create policy reminders_delete_own on public.reminders for delete to authenticated
  using (user_id = (select auth.uid()));

create policy guides_select_all on public.guides for select to anon, authenticated
  using (true);

create policy push_select_own on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy push_insert_own on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy push_update_own on public.push_subscriptions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy push_delete_own on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

create policy events_insert_anon on public.events for insert to anon
  with check (user_id is null);
create policy events_insert_authenticated on public.events for insert to authenticated
  with check (user_id is null or user_id = (select auth.uid()));

create policy feedback_select_own on public.feedback for select to authenticated
  using (user_id = (select auth.uid()));
create policy feedback_insert_own on public.feedback for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy audit_log_select_own on public.audit_log for select to authenticated
  using (user_id = (select auth.uid()));

create policy waitlist_insert on public.waitlist for insert to anon, authenticated
  with check (true);
