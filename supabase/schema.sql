-- =========================================================
-- Maison Élan — Supabase schema
-- Run this once in Supabase: Dashboard → SQL Editor → New query → Run
-- All objects are prefixed with saloon_
-- =========================================================

-- ---------- Shared: keep updated_at current ----------
create or replace function public.saloon_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- Appointment requests ----------
create table if not exists public.saloon_bookings (
  id              uuid primary key default gen_random_uuid(),
  full_name       text        not null check (char_length(full_name) between 2 and 120),
  email           text        not null check (char_length(email) <= 254 and email = lower(email)
                                              and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone           text                 check (phone is null or char_length(phone) <= 30),
  service         text        not null,
  preferred_date  date        not null,
  notes           text                 check (notes is null or char_length(notes) <= 1000),
  status          text        not null default 'pending'
                              check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  source          text        not null default 'website',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Allowed services (drop + re-add so re-running this script updates the list)
alter table public.saloon_bookings drop constraint if exists saloon_bookings_service_check;
alter table public.saloon_bookings add constraint saloon_bookings_service_check
  check (service in ('Hair', 'Skin', 'Makeup', 'Nails', 'Eyebrows', 'Signature Ritual'));

create index if not exists saloon_bookings_preferred_date_idx on public.saloon_bookings (preferred_date);
create index if not exists saloon_bookings_status_idx         on public.saloon_bookings (status);
create index if not exists saloon_bookings_created_at_idx     on public.saloon_bookings (created_at desc);

drop trigger if exists saloon_bookings_set_updated_at on public.saloon_bookings;
create trigger saloon_bookings_set_updated_at
  before update on public.saloon_bookings
  for each row execute function public.saloon_set_updated_at();

-- ---------- Newsletter subscribers ----------
create table if not exists public.saloon_newsletter_subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           text        not null unique
                              check (char_length(email) <= 254 and email = lower(email)
                                     and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  is_active       boolean     not null default true,
  source          text        not null default 'website',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists saloon_newsletter_subscribers_set_updated_at on public.saloon_newsletter_subscribers;
create trigger saloon_newsletter_subscribers_set_updated_at
  before update on public.saloon_newsletter_subscribers
  for each row execute function public.saloon_set_updated_at();

-- ---------- Security ----------
-- RLS on with NO policies = the public anon/authenticated keys cannot read or write.
-- Only the website's server functions (using the service_role key) can access these tables.
alter table public.saloon_bookings               enable row level security;
alter table public.saloon_newsletter_subscribers enable row level security;

revoke all on public.saloon_bookings               from anon, authenticated;
revoke all on public.saloon_newsletter_subscribers from anon, authenticated;

-- Make sure the server role can use the tables (not granted automatically on every project)
grant usage on schema public to service_role;
grant select, insert, update, delete on public.saloon_bookings               to service_role;
grant select, insert, update, delete on public.saloon_newsletter_subscribers to service_role;
