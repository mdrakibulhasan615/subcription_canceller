-- T-002 init schema. Text + CHECK instead of enums. Status is NOT stored (derived in core).

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  timezone text not null default 'UTC',
  currency text not null default 'USD' check (currency in ('USD', 'MYR', 'EUR', 'GBP')),
  default_stop_days_before int not null default 3 check (default_stop_days_before between 0 and 60),
  reminder_days int[] not null default '{7,3,1}' check (0 < all (reminder_days)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  category text,
  price_minor int not null check (price_minor >= 0),
  currency text not null check (currency in ('USD', 'MYR', 'EUR', 'GBP')),
  billing_cycle text not null check (billing_cycle in ('weekly', 'monthly', 'quarterly', 'yearly', 'custom')),
  billing_interval int not null default 1 check (billing_interval > 0), -- custom = days
  next_renewal_date date,
  cancel_by_date date,
  stop_date date,
  is_trial boolean not null default false,
  trial_end_date date,
  payment_method_type text not null default 'none'
    check (payment_method_type in ('none', 'wise', 'privacy', 'other_virtual', 'managed')),
  card_nickname text, -- never store card numbers
  cancel_url text,
  notes text,
  stop_confirmed_at timestamptz,
  merchant_cancelled_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_trial = false or trial_end_date is not null)
);
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('stop_date', 'renewal', 'trial_end')),
  fire_at timestamptz not null,
  channel text not null check (channel in ('in_app', 'email', 'push')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts int not null default 0 check (attempts >= 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (subscription_id, type, channel, fire_at)
);

create table public.guides (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('cancel', 'provider', 'store')),
  service_slug text not null,
  title text not null,
  steps jsonb not null default '[]' check (jsonb_typeof(steps) = 'array'),
  url text,
  source_url text,
  last_checked_at date,
  updated_at timestamptz not null default now(),
  unique (kind, service_slug)
);
create trigger guides_set_updated_at before update on public.guides
  for each row execute function public.set_updated_at();

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null,
  keys jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(name) <= 100),
  props jsonb not null default '{}' check (pg_column_size(props) < 4096),
  created_at timestamptz not null default now()
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  key text not null,
  value text check (char_length(value) <= 2000),
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) <= 254 and position('@' in email) > 1),
  source text,
  created_at timestamptz not null default now()
);
create unique index waitlist_email_lower_key on public.waitlist (lower(email));

-- Indexes. Every FK is covered. reminders.subscription_id and push_subscriptions.user_id
-- lead a unique key already.
create index subscriptions_user_id_idx on public.subscriptions (user_id);
create index subscriptions_user_stop_idx on public.subscriptions (user_id, stop_date) where archived_at is null;
create index reminders_user_id_idx on public.reminders (user_id);
create index reminders_pending_fire_idx on public.reminders (fire_at) where status = 'pending';
create index events_user_id_idx on public.events (user_id);
create index events_name_created_idx on public.events (name, created_at);
create index feedback_user_id_idx on public.feedback (user_id);
create index audit_log_user_created_idx on public.audit_log (user_id, created_at);

-- A new auth user gets a profile.
create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
