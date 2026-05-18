
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
