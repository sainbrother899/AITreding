
-- AI Trading Clean Core Schema
create table if not exists public.profiles (
  id text primary key,
  email text,
  name text,
  mobile text,
  role text default 'user',
  plan text default 'Free',
  referral_code text,
  referred_by text,
  created_at timestamp with time zone default now()
);

create table if not exists public.deposit_requests (
  id text primary key,
  user_id text,
  user_email text,
  user_name text,
  amount numeric default 0,
  txn text,
  status text default 'PENDING',
  created_at_text text,
  created_at timestamp with time zone default now()
);

create table if not exists public.withdrawal_requests (
  id text primary key,
  user_id text,
  user_email text,
  amount numeric default 0,
  method text,
  account text,
  name text,
  ifsc text,
  status text default 'PENDING',
  created_at_text text,
  created_at timestamp with time zone default now()
);

create table if not exists public.wallet_ledger (
  id bigserial primary key,
  user_id text,
  type text,
  amount numeric default 0,
  note text,
  created_at timestamp with time zone default now()
);

create table if not exists public.managed_trades (
  id text primary key,
  user_id text,
  user_email text,
  coin text,
  side text,
  risk text,
  amount numeric default 0,
  entry_price numeric default 0,
  close_price numeric,
  pnl numeric default 0,
  status text default 'OPEN',
  source text default 'ADMIN_MANAGED',
  opened_at text,
  closed_at text,
  created_at timestamp with time zone default now()
);

create table if not exists public.referrals (
  id bigserial primary key,
  referrer_id text,
  referrer_email text,
  user_id text,
  user_email text,
  deposit_id text,
  deposit_amount numeric default 0,
  bonus_amount numeric default 0,
  percent numeric default 10,
  status text default 'PAID',
  created_at timestamp with time zone default now()
);

create table if not exists public.kyc_requests (
  id text primary key,
  user_id text,
  user_email text,
  name text,
  mobile text,
  doc_type text,
  doc_number text,
  status text default 'PENDING',
  created_at timestamp with time zone default now()
);

create table if not exists public.subscription_plans (
  id text primary key,
  name text,
  price numeric default 0,
  duration text,
  signal_limit numeric default 5,
  ai_trade_limit numeric default 5,
  features jsonb default '[]'::jsonb,
  created_at timestamp with time zone default now()
);

create table if not exists public.payment_requests (
  id text primary key,
  user_id text,
  user_email text,
  plan_id text,
  plan_name text,
  amount numeric default 0,
  status text default 'PENDING',
  created_at timestamp with time zone default now()
);

create unique index if not exists idx_deposit_requests_unique_txn
on public.deposit_requests(txn)
where txn is not null and txn ~ '^[0-9]{12}$';

create index if not exists idx_profiles_referral_code on public.profiles(referral_code);
create index if not exists idx_profiles_referred_by on public.profiles(referred_by);
create index if not exists idx_referrals_user_percent on public.referrals(user_id, percent, status);

alter table public.profiles enable row level security;
alter table public.deposit_requests enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.managed_trades enable row level security;
alter table public.referrals enable row level security;
alter table public.kyc_requests enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.payment_requests enable row level security;

drop policy if exists "public all profiles" on public.profiles;
drop policy if exists "public all deposit_requests" on public.deposit_requests;
drop policy if exists "public all withdrawal_requests" on public.withdrawal_requests;
drop policy if exists "public all wallet_ledger" on public.wallet_ledger;
drop policy if exists "public all managed_trades" on public.managed_trades;
drop policy if exists "public all referrals" on public.referrals;
drop policy if exists "public all kyc_requests" on public.kyc_requests;
drop policy if exists "public all subscription_plans" on public.subscription_plans;
drop policy if exists "public all payment_requests" on public.payment_requests;

create policy "public all profiles" on public.profiles for all using (true) with check (true);
create policy "public all deposit_requests" on public.deposit_requests for all using (true) with check (true);
create policy "public all withdrawal_requests" on public.withdrawal_requests for all using (true) with check (true);
create policy "public all wallet_ledger" on public.wallet_ledger for all using (true) with check (true);
create policy "public all managed_trades" on public.managed_trades for all using (true) with check (true);
create policy "public all referrals" on public.referrals for all using (true) with check (true);
create policy "public all kyc_requests" on public.kyc_requests for all using (true) with check (true);
create policy "public all subscription_plans" on public.subscription_plans for all using (true) with check (true);
create policy "public all payment_requests" on public.payment_requests for all using (true) with check (true);



-- Compatibility patch for existing tables with bigint id.
-- App no longer inserts string IDs into bigint id columns.
alter table public.deposit_requests add column if not exists user_name text;
alter table public.deposit_requests add column if not exists txn text;
alter table public.deposit_requests add column if not exists created_at_text text;
alter table public.withdrawal_requests add column if not exists created_at_text text;
alter table public.withdrawal_requests add column if not exists account text;
alter table public.withdrawal_requests add column if not exists method text;
alter table public.withdrawal_requests add column if not exists name text;
alter table public.withdrawal_requests add column if not exists ifsc text;
alter table public.kyc_requests add column if not exists doc_type text;
alter table public.kyc_requests add column if not exists doc_number text;

drop index if exists public.idx_deposit_requests_unique_txn;
create unique index if not exists idx_deposit_requests_unique_txn
on public.deposit_requests(txn)
where txn is not null and txn ~ '^[0-9]{12}$';



-- Deposit bigint hard fix schema support
alter table public.deposit_requests add column if not exists user_name text;
alter table public.deposit_requests add column if not exists txn text;
alter table public.deposit_requests add column if not exists created_at_text text;

drop index if exists public.idx_deposit_requests_unique_txn;
create unique index if not exists idx_deposit_requests_unique_txn
on public.deposit_requests(txn)
where txn is not null and txn ~ '^[0-9]{12}$';



-- Plan buy from wallet support
alter table public.wallet_ledger add column if not exists note text;
alter table public.payment_requests add column if not exists user_email text;
alter table public.payment_requests add column if not exists plan_id text;
alter table public.payment_requests add column if not exists plan_name text;
alter table public.payment_requests add column if not exists amount numeric default 0;
alter table public.payment_requests add column if not exists status text default 'PENDING';
alter table public.profiles add column if not exists plan text default 'Free';



-- Admin stability optional columns
alter table public.payment_requests add column if not exists user_email text;
alter table public.payment_requests add column if not exists plan_name text;
alter table public.payment_requests add column if not exists status text default 'PENDING';
alter table public.kyc_requests add column if not exists doc_type text;
alter table public.kyc_requests add column if not exists doc_number text;
alter table public.managed_trades add column if not exists source text default 'ADMIN_MANAGED';
alter table public.managed_trades add column if not exists risk text;



-- User selected AI trade percent support
alter table public.profiles add column if not exists ai_trade_percent numeric default 25;
alter table public.profiles add column if not exists auto_trade_permission boolean default true;



-- Admin users panel support
alter table public.profiles add column if not exists ai_trade_percent numeric default 25;
alter table public.profiles add column if not exists auto_trade_permission boolean default true;
alter table public.profiles add column if not exists status text default 'ACTIVE';
alter table public.wallet_ledger add column if not exists note text;



-- Admin users force panel support
alter table public.profiles add column if not exists ai_trade_percent numeric default 25;
alter table public.profiles add column if not exists auto_trade_permission boolean default true;
alter table public.profiles add column if not exists status text default 'ACTIVE';
alter table public.wallet_ledger add column if not exists note text;



-- Admin users hard insert support
alter table public.profiles add column if not exists ai_trade_percent numeric default 25;
alter table public.profiles add column if not exists auto_trade_permission boolean default true;
alter table public.profiles add column if not exists status text default 'ACTIVE';
alter table public.wallet_ledger add column if not exists note text;



-- Final stability pack: permanent manual trade history
create table if not exists public.manual_trades (
  id text primary key,
  user_id uuid,
  coin text,
  side text,
  amount numeric default 0,
  entry_price numeric default 0,
  close_price numeric default 0,
  leverage numeric default 1,
  pnl numeric default 0,
  status text default 'CLOSED',
  opened_at timestamptz,
  closed_at timestamptz default now(),
  mode text default 'REAL',
  created_at timestamptz default now()
);

alter table public.manual_trades enable row level security;

drop policy if exists "manual_trades_select_own" on public.manual_trades;
create policy "manual_trades_select_own"
on public.manual_trades for select
using (auth.uid() = user_id);

drop policy if exists "manual_trades_insert_own" on public.manual_trades;
create policy "manual_trades_insert_own"
on public.manual_trades for insert
with check (auth.uid() = user_id);

drop policy if exists "manual_trades_update_own" on public.manual_trades;
create policy "manual_trades_update_own"
on public.manual_trades for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists idx_manual_trades_user_closed
on public.manual_trades(user_id, closed_at desc);


-- =========================================================
-- DB CONNECTED KYC + PAYOUT + PAYMENT SETTINGS PATCH
-- Run this in Supabase SQL Editor.
-- NOTE: policies below are permissive for testing. For production, replace with auth-based RLS.
-- =========================================================

alter table public.kyc_requests add column if not exists full_name text;
alter table public.kyc_requests add column if not exists dob text;
alter table public.kyc_requests add column if not exists address text;
alter table public.kyc_requests add column if not exists documents jsonb default '{}'::jsonb;
alter table public.kyc_requests add column if not exists submitted_at timestamp with time zone default now();
alter table public.kyc_requests add column if not exists reviewed_at timestamp with time zone;
alter table public.kyc_requests add column if not exists reviewed_by text;

create table if not exists public.kyc_documents (
  id text primary key,
  kyc_id text,
  user_id text,
  doc_key text,
  file_name text,
  file_path text,
  file_url text,
  mime_type text,
  size_bytes bigint default 0,
  uploaded_at timestamp with time zone default now()
);

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
  created_at timestamp with time zone default now(),
  reviewed_at timestamp with time zone,
  reviewed_by text
);

create table if not exists public.payment_settings (
  id text primary key,
  method text,
  title text,
  upi_id text,
  qr_url text,
  account_name text,
  bank_name text,
  account_number text,
  ifsc text,
  branch text,
  is_active boolean default true,
  updated_at timestamp with time zone default now()
);

alter table public.kyc_documents enable row level security;
alter table public.user_payout_methods enable row level security;
alter table public.payment_settings enable row level security;

drop policy if exists "public all kyc_documents" on public.kyc_documents;
drop policy if exists "public all user_payout_methods" on public.user_payout_methods;
drop policy if exists "public all payment_settings" on public.payment_settings;

create policy "public all kyc_documents" on public.kyc_documents for all using (true) with check (true);
create policy "public all user_payout_methods" on public.user_payout_methods for all using (true) with check (true);
create policy "public all payment_settings" on public.payment_settings for all using (true) with check (true);

insert into public.payment_settings (id, method, title, upi_id, is_active)
values ('upi_default', 'UPI', 'UPI Payment', 'admin@upi', true)
on conflict (id) do nothing;

insert into public.payment_settings (id, method, title, account_name, bank_name, account_number, ifsc, branch, is_active)
values ('bank_default', 'BANK', 'Bank Transfer', 'AI Trading', 'Demo Bank', '0000000000', 'DEMO0000001', 'Main', true)
on conflict (id) do nothing;

-- Storage bucket for KYC documents
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kyc-documents',
  'kyc-documents',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do nothing;

drop policy if exists "public upload kyc documents" on storage.objects;
drop policy if exists "public read kyc documents" on storage.objects;
drop policy if exists "public update kyc documents" on storage.objects;
drop policy if exists "public delete kyc documents" on storage.objects;

create policy "public upload kyc documents"
on storage.objects for insert
with check (bucket_id = 'kyc-documents');

create policy "public read kyc documents"
on storage.objects for select
using (bucket_id = 'kyc-documents');

create policy "public update kyc documents"
on storage.objects for update
using (bucket_id = 'kyc-documents')
with check (bucket_id = 'kyc-documents');

create policy "public delete kyc documents"
on storage.objects for delete
using (bucket_id = 'kyc-documents');

create index if not exists idx_kyc_requests_user_status on public.kyc_requests(user_id, status);
create index if not exists idx_kyc_documents_user on public.kyc_documents(user_id, kyc_id);
create index if not exists idx_payout_methods_user_status on public.user_payout_methods(user_id, status);
