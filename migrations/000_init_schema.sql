-- ============================================================================
-- Sacré Pádel — base schema (reconstructed from application code, since the
-- original Supabase project was deleted and no schema dump existed).
-- Run this ONCE on a fresh Supabase project's SQL Editor, top to bottom.
-- migrations/001_add_stripe_payment_intent.sql is already folded in below,
-- but it is also safe to run afterward (its guards are all IF NOT EXISTS /
-- DROP...IF EXISTS, so it's a no-op on a schema created by this file).
-- ============================================================================

-- ---- extensions ----
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists btree_gist; -- needed for the EXCLUDE constraint below

-- ============================================================================
-- courts
-- ============================================================================
create table public.courts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- customers
-- ============================================================================
create table public.customers (
  id           uuid primary key default gen_random_uuid(),
  full_name    text,
  phone_e164   text,
  email        text,
  notes        text,
  birthday     date,
  player_notes text,
  sex          text,
  division     text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- The app looks customers up by phone to avoid duplicates on every
-- confirm — enforce that assumption at the DB level too.
create unique index customers_phone_e164_key
  on public.customers (phone_e164)
  where phone_e164 is not null;

create index customers_full_name_idx on public.customers (full_name);
create index customers_created_at_idx on public.customers (created_at);

-- ============================================================================
-- profiles (1:1 with auth.users)
-- ============================================================================
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'customer' check (role in ('owner', 'reception', 'customer')),
  full_name  text,
  phone_e164 text,
  birth_date date,
  notes      text,
  sex        text,
  division   text,
  updated_at timestamptz
);

-- Auto-create a profile row on signup so an admin can grant owner/reception
-- access from the Supabase table editor without the user needing to visit
-- /perfil first. The app also upserts this row itself, so this is a
-- convenience, not a hard dependency.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'customer')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- bookings
-- ============================================================================
create table public.bookings (
  id                        uuid primary key default gen_random_uuid(),
  court_id                  uuid not null references public.courts (id),
  start_at                  timestamptz not null,
  end_at                    timestamptz not null,
  status                    text not null default 'HOLD'
                              check (status in ('HOLD', 'CONFIRMED', 'CANCELLED', 'NO_SHOW', 'COMPLETED')),
  source                    text not null default 'WEB'
                              check (source in ('WEB', 'WHATSAPP', 'RECEPTION')),
  kind                      text not null default 'STANDARD',
  payment_status            text not null default 'UNPAID'
                              check (payment_status in ('UNPAID', 'PAID')),
  paid_amount               numeric,
  payment_method            text check (payment_method in ('CASH', 'CARD', 'TRANSFER', 'STRIPE')),
  paid_at                   timestamptz,
  customer_id               uuid references public.customers (id),
  user_id                   uuid references auth.users (id),
  hold_expires_at           timestamptz,
  cancelled_by              text,
  stripe_payment_intent_id  text,
  created_at                timestamptz not null default now(),

  constraint bookings_end_after_start check (end_at > start_at),

  -- Mirrors src/lib/demo/store.ts's overlap check: two ACTIVE bookings on
  -- the same court can't have overlapping [start_at, end_at) ranges.
  -- Expired HOLDs are NOT excluded here (a static constraint can't see
  -- "now()") — the app deletes expired HOLDs before inserting, which is
  -- why /api/web/hold cleans up stale rows first. Don't remove that cleanup.
  constraint bookings_no_overlap exclude using gist (
    court_id with =,
    tstzrange(start_at, end_at) with &&
  ) where (status in ('HOLD', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'))
);

create index bookings_court_range_idx on public.bookings (court_id, start_at, end_at);
create index bookings_status_idx on public.bookings (status);
create index bookings_customer_id_idx on public.bookings (customer_id);
create index bookings_user_id_idx on public.bookings (user_id);
create index bookings_hold_expires_at_idx on public.bookings (hold_expires_at);
create index bookings_start_at_idx on public.bookings (start_at);
create unique index idx_bookings_stripe_pi
  on public.bookings (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

-- ============================================================================
-- booking_events (best-effort audit log)
-- ============================================================================
create table public.booking_events (
  id         uuid primary key default gen_random_uuid(),
  -- No FK to bookings on purpose: /api/web/release-hold deletes the HOLD
  -- row and only THEN inserts this event referencing that same booking_id
  -- (see src/app/api/web/release-hold/route.ts). A real FK would make that
  -- insert fail every single time.
  booking_id uuid not null,
  event_type text not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index booking_events_booking_id_idx on public.booking_events (booking_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================
-- Everything except `profiles` is only ever touched server-side with the
-- service_role key (src/lib/supabaseAdmin.ts), which bypasses RLS entirely.
-- Enabling RLS with NO policies on those tables means the browser (anon /
-- authenticated role) gets zero direct access — all reads/writes must go
-- through the app's own API routes, which already enforce their own auth
-- checks (requireReceptionAccess, etc). This is the safe default.
alter table public.courts enable row level security;
alter table public.customers enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_events enable row level security;

-- `profiles` IS read/written directly from the browser (ReservarClient,
-- AppHeader, TopNav, /perfil all call supabase.from("profiles") with the
-- user's own session), so it needs real policies.
alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Privilege-escalation guard: the update policy above only checks "is this
-- your own row", which would let any authenticated user set their OWN role
-- to 'owner' by calling the REST API directly (RLS row-level checks can't
-- express "role column must stay unchanged"). Column-level GRANTs close
-- that gap: authenticated users can update every profile column except
-- `role`. Granting reception/owner access must go through the Supabase
-- dashboard (service_role), never through the app.
--
-- `id` IS included here even though the app never actually changes it:
-- supabase-js's .upsert() (used by /perfil to save) issues
-- INSERT ... ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id, <other cols>,
-- i.e. Postgres always includes the conflict column in the UPDATE's SET
-- list even though its value can't actually change. Without UPDATE
-- privilege on `id` that whole statement is rejected with "permission
-- denied for table profiles". The RLS policy's `with check (auth.uid() =
-- id)` still blocks anyone from reassigning a row to a different id.
revoke update on public.profiles from authenticated;
grant update (id, full_name, phone_e164, birth_date, notes, sex, division, updated_at)
  on public.profiles to authenticated;

-- ============================================================================
-- Seed data — adjust court names/count to match the real club before going live.
-- ============================================================================
insert into public.courts (name, is_active) values
  ('Cancha 1', true),
  ('Cancha 2', true),
  ('Cancha 3', true),
  ('Cancha 4', true);
