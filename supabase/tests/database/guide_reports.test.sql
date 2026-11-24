-- T-014: anonymous guide reports. Insert only, capped per guide, https-only guide links.
begin;
select * from no_plan();

insert into public.guides (id, kind, service_slug, title) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'cancel', 'netflix', 'Netflix');

select has_table('public', 'guide_reports', 'guide_reports exists');
select throws_ok(
  $q$insert into public.guides (kind, service_slug, title, url) values ('cancel', 'bad', 'Bad', 'http://a.example')$q$,
  '23514', null, 'non-https guide url fails');
select throws_ok(
  $q$insert into public.guides (kind, service_slug, title, source_url) values ('cancel', 'bad', 'Bad', 'javascript:x')$q$,
  '23514', null, 'non-https source_url fails');

set local request.jwt.claims = '';
set local role anon;

select lives_ok(
  $q$insert into public.guide_reports (guide_id, message) values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Step 2 is wrong')$q$,
  'anon can insert a report');
select throws_ok($q$select * from public.guide_reports$q$, '42501', null, 'anon cannot select reports');
select throws_ok($q$update public.guide_reports set status = 'fixed'$q$, '42501', null, 'anon cannot update reports');
select throws_ok($q$delete from public.guide_reports$q$, '42501', null, 'anon cannot delete reports');
select throws_ok(
  $q$insert into public.guide_reports (guide_id, message, status) values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Step 2 is wrong', 'fixed')$q$,
  '42501', null, 'anon cannot set status');
select throws_ok(
  $q$insert into public.guide_reports (guide_id, message) values ('cccccccc-cccc-cccc-cccc-cccccccccccc', repeat('a', 501))$q$,
  '23514', null, 'message over 500 fails');
select throws_ok(
  $q$insert into public.guide_reports (guide_id, message) values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'abcd')$q$,
  '23514', null, 'message under 5 fails');
select throws_ok(
  $q$insert into public.guides (kind, service_slug, title) values ('cancel', 'x', 'x')$q$,
  '42501', null, 'anon still cannot write guides');

-- 1 row exists. Add 19 more, then the 21st fails.
select lives_ok(
  $q$insert into public.guide_reports (guide_id, message)
     select 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Report number ' || g from generate_series(2, 20) g$q$,
  'rows 2 to 20 insert');
select throws_ok(
  $q$insert into public.guide_reports (guide_id, message) values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'One too many')$q$,
  '54000', null, '21st report in an hour fails');

set local role authenticated;
select throws_ok($q$select * from public.guide_reports$q$, '42501', null, 'authenticated cannot select reports');
select throws_ok($q$delete from public.guide_reports$q$, '42501', null, 'authenticated cannot delete reports');

reset role;
select is((select count(*)::int from public.guide_reports), 20, 'exactly 20 rows stored');

select * from finish();
rollback;
