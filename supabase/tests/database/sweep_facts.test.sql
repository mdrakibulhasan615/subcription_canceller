-- T-010 sweep_facts().
begin;
select * from no_plan();

insert into auth.users (id, email) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com');
insert into public.subscriptions (id, user_id, name, price_minor, currency, billing_cycle) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A sub', 100, 'USD', 'monthly');

-- r1 overdue pending. r2 failed. r3 sent with no sent_at. r4 in-flight pending (not overdue).
-- r5 good sent in_app row.
insert into public.reminders (id, subscription_id, user_id, type, channel, fire_at, status, sent_at) values
  ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stop_date', 'in_app', now() - interval '2 hours', 'pending', null),
  ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stop_date', 'email', now() - interval '2 hours', 'failed', null),
  ('00000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'renewal', 'in_app', now() - interval '2 hours', 'sent', null),
  ('00000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'renewal', 'email', now() - interval '5 minutes', 'pending', null),
  ('00000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'trial_end', 'in_app', now() - interval '2 hours', 'sent', now() - interval '90 minutes');

select is((public.sweep_facts() -> 'overduePending' ->> 'count')::int, 1, 'one overdue pending row');
select is(public.sweep_facts() -> 'overduePending' -> 'ids' ->> 0, '00000000-0000-0000-0000-000000000001', 'overdue id is r1');
select is((public.sweep_facts() -> 'failedRecent' ->> 'count')::int, 1, 'one failed row');
select is((public.sweep_facts() -> 'sentNoProof' ->> 'count')::int, 1, 'one sent row without proof');
select is(public.sweep_facts() -> 'sentNoProof' -> 'ids' ->> 0, '00000000-0000-0000-0000-000000000003', 'no-proof id is r3');

-- Vault flags.
select is((public.sweep_facts() -> 'vault' ->> 'project_url')::boolean, false, 'project_url false without secret');
select is((public.sweep_facts() -> 'vault' ->> 'reminder_cron_secret')::boolean, false, 'cron secret false without secret');
select vault.create_secret('https://example.supabase.co', 'project_url');
select vault.create_secret('0123456789abcdef0123456789abcdef', 'reminder_cron_secret');
select is((public.sweep_facts() -> 'vault' ->> 'project_url')::boolean, true, 'project_url true with secret');
select is((public.sweep_facts() -> 'vault' ->> 'reminder_cron_secret')::boolean, true, 'cron secret true with secret');

-- Shape of the other sections.
select ok(public.sweep_facts() -> 'cron' ? 'installed', 'cron section has installed');
select ok(public.sweep_facts() -> 'http' ? 'badResponses', 'http section has badResponses');

-- Privileges.
select ok(not has_function_privilege('anon', 'public.sweep_facts()', 'execute'), 'anon cannot run sweep_facts');
select ok(not has_function_privilege('authenticated', 'public.sweep_facts()', 'execute'), 'authenticated cannot run sweep_facts');
select ok(has_function_privilege('service_role', 'public.sweep_facts()', 'execute'), 'service_role can run sweep_facts');

select * from finish();
rollback;
