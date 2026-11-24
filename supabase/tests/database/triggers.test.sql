-- Triggers and function privileges.
begin;
select * from no_plan();

insert into auth.users (id, email) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com');

select is((select count(*)::int from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 1,
  'new auth user gets exactly one profile');
select results_eq(
  $q$select timezone, currency, default_stop_days_before, reminder_days, email
     from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$,
  $q$values ('UTC'::text, 'USD'::text, 3, '{7,3,1}'::int[], 'a@example.com'::text)$q$,
  'profile has defaults');

-- updated_at moves forward (clock_timestamp is later than the now() default).
insert into public.subscriptions (id, user_id, name, price_minor, currency, billing_cycle) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A sub', 100, 'USD', 'monthly');
insert into public.guides (id, kind, service_slug, title) values
  ('55555555-5555-5555-5555-555555555555', 'cancel', 'netflix', 'Netflix');
create temp table before_ts on commit drop as
  select (select updated_at from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') as p,
         (select updated_at from public.subscriptions where id = '11111111-1111-1111-1111-111111111111') as s,
         (select updated_at from public.guides where id = '55555555-5555-5555-5555-555555555555') as g;
update public.profiles set display_name = 'x' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
update public.subscriptions set name = 'y' where id = '11111111-1111-1111-1111-111111111111';
update public.guides set title = 'z' where id = '55555555-5555-5555-5555-555555555555';
select ok((select updated_at from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') > (select p from before_ts),
  'profiles updated_at moves forward');
select ok((select updated_at from public.subscriptions where id = '11111111-1111-1111-1111-111111111111') > (select s from before_ts),
  'subscriptions updated_at moves forward');
select ok((select updated_at from public.guides where id = '55555555-5555-5555-5555-555555555555') > (select g from before_ts),
  'guides updated_at moves forward');

-- Function privileges.
select ok(not has_function_privilege('anon', 'public.handle_new_user()', 'execute'), 'anon cannot run handle_new_user');
select ok(not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'), 'authenticated cannot run handle_new_user');
select ok(not has_function_privilege('anon', 'public.set_updated_at()', 'execute'), 'anon cannot run set_updated_at');
select ok(not has_function_privilege('authenticated', 'public.set_updated_at()', 'execute'), 'authenticated cannot run set_updated_at');

select * from finish();
rollback;
