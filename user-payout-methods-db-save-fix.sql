-- =========================================================
-- USER PAYOUT METHODS DB SAVE FIX
-- Run in Supabase SQL Editor if payment methods are not saving.
-- =========================================================

create table if not exists public.user_payout_methods (
  id text primary key,
  user_id text,
  method_type text,
  holder_name text,
  kyc_name_snapshot text,
  upi_id text,
  bank_name text,
  account_number text,
  ifsc text,
  status text default 'PENDING',
  name_match boolean default true,
  created_at_text text,
  created_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by text
);

alter table public.user_payout_methods add column if not exists user_email text;
alter table public.user_payout_methods add column if not exists reviewed_at timestamptz;
alter table public.user_payout_methods add column if not exists reviewed_by text;
alter table public.user_payout_methods add column if not exists name_match boolean default true;
alter table public.user_payout_methods add column if not exists created_at_text text;

alter table public.user_payout_methods enable row level security;

drop policy if exists "public all user_payout_methods" on public.user_payout_methods;
drop policy if exists "Allow user_payout_methods insert" on public.user_payout_methods;
drop policy if exists "Allow user_payout_methods select" on public.user_payout_methods;
drop policy if exists "Allow user_payout_methods update" on public.user_payout_methods;

create policy "Allow user_payout_methods insert"
on public.user_payout_methods
for insert
to anon, authenticated
with check (true);

create policy "Allow user_payout_methods select"
on public.user_payout_methods
for select
to anon, authenticated
using (true);

create policy "Allow user_payout_methods update"
on public.user_payout_methods
for update
to anon, authenticated
using (true)
with check (true);

-- Check rows:
-- select * from public.user_payout_methods order by created_at desc;
