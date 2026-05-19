-- =========================================================
-- WALLET DEPOSIT / WITHDRAW CLEAN FLOW DB FIX
-- Run in Supabase SQL Editor if deposit/withdraw save fails.
-- =========================================================

create table if not exists public.deposit_requests (
  id text primary key,
  user_id text,
  user_email text,
  amount numeric,
  payment_mode text,
  utr text,
  transaction_id text,
  status text default 'PENDING',
  created_at_text text,
  created_at timestamptz default now(),
  reviewed_at timestamptz
);

create table if not exists public.withdrawal_requests (
  id text primary key,
  user_id text,
  user_email text,
  amount numeric,
  method_id text,
  method_type text,
  method_text text,
  holder_name text,
  status text default 'PENDING',
  created_at_text text,
  created_at timestamptz default now(),
  reviewed_at timestamptz
);

alter table public.deposit_requests add column if not exists user_email text;
alter table public.deposit_requests add column if not exists payment_mode text;
alter table public.deposit_requests add column if not exists utr text;
alter table public.deposit_requests add column if not exists transaction_id text;
alter table public.deposit_requests add column if not exists created_at_text text;
alter table public.deposit_requests add column if not exists reviewed_at timestamptz;

alter table public.withdrawal_requests add column if not exists user_email text;
alter table public.withdrawal_requests add column if not exists method_id text;
alter table public.withdrawal_requests add column if not exists method_type text;
alter table public.withdrawal_requests add column if not exists method_text text;
alter table public.withdrawal_requests add column if not exists holder_name text;
alter table public.withdrawal_requests add column if not exists created_at_text text;
alter table public.withdrawal_requests add column if not exists reviewed_at timestamptz;

alter table public.deposit_requests enable row level security;
alter table public.withdrawal_requests enable row level security;

drop policy if exists "Allow deposit_requests insert" on public.deposit_requests;
drop policy if exists "Allow deposit_requests select" on public.deposit_requests;
drop policy if exists "Allow deposit_requests update" on public.deposit_requests;
drop policy if exists "Allow withdrawal_requests insert" on public.withdrawal_requests;
drop policy if exists "Allow withdrawal_requests select" on public.withdrawal_requests;
drop policy if exists "Allow withdrawal_requests update" on public.withdrawal_requests;

create policy "Allow deposit_requests insert" on public.deposit_requests for insert to anon, authenticated with check (true);
create policy "Allow deposit_requests select" on public.deposit_requests for select to anon, authenticated using (true);
create policy "Allow deposit_requests update" on public.deposit_requests for update to anon, authenticated using (true) with check (true);

create policy "Allow withdrawal_requests insert" on public.withdrawal_requests for insert to anon, authenticated with check (true);
create policy "Allow withdrawal_requests select" on public.withdrawal_requests for select to anon, authenticated using (true);
create policy "Allow withdrawal_requests update" on public.withdrawal_requests for update to anon, authenticated using (true) with check (true);

-- Optional duplicate UTR check:
-- select utr, count(*) from public.deposit_requests group by utr having count(*) > 1;
