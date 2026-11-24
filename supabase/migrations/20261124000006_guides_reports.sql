-- T-014: guide contact fields, https-only links, and anonymous "report a problem" rows.

alter table public.guides
  add column contact_phone text check (char_length(contact_phone) <= 40),
  add column contact_email text check (char_length(contact_email) <= 254);

alter table public.guides
  add constraint guides_url_https check (url is null or url like 'https://%'),
  add constraint guides_source_url_https check (source_url is null or source_url like 'https://%');

create table public.guide_reports (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.guides (id) on delete cascade,
  message text not null check (char_length(message) between 5 and 500),
  created_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'fixed', 'dismissed'))
);
create index guide_reports_guide_created_idx on public.guide_reports (guide_id, created_at);
create index guide_reports_created_idx on public.guide_reports (created_at);

alter table public.guide_reports enable row level security;

-- Clients may only insert guide_id and message. No select, update or delete.
revoke all on public.guide_reports from anon, authenticated;
grant insert (guide_id, message) on public.guide_reports to anon, authenticated;

create policy guide_reports_insert on public.guide_reports
  for insert to anon, authenticated
  with check (true);

-- Spam cap. SECURITY DEFINER because clients cannot select this table.
create function public.guide_reports_rate_cap() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.guide_reports
      where guide_id = new.guide_id and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'too many reports for this guide' using errcode = '54000';
  end if;
  if (select count(*) from public.guide_reports
      where created_at > now() - interval '1 hour') >= 200 then
    raise exception 'too many reports' using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke all on function public.guide_reports_rate_cap() from public;

create trigger guide_reports_rate_cap before insert on public.guide_reports
  for each row execute function public.guide_reports_rate_cap();
