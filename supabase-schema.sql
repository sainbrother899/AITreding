-- AITradeX Phase 5.29 RLS Safety Pack + Final Deep Consistency
-- Includes notification delete compatibility and hashed password runtime support.
-- AITradeX Phase 5.19 Strict DB-First Critical Runtime
-- Keeps schema/RLS aligned with DB-first critical writes and emergency-only manual repair sync.

-- AITradeX Phase 5.16.1 Clean Action Database Runtime Schema
-- Updated: 2026-05-23
-- Purpose: Keep Supabase schema aligned with the action-based database runtime.
-- Safe to run multiple times. It does not delete old data.

create table if not exists public.users (id text primary key,name text,email text unique,mobile text,role text default 'user',status text default 'ACTIVE',referral_code text,referred_by text,created_at timestamptz default now());
create table if not exists public.wallet_ledger (id text primary key,user_id text not null,account_type text default 'REAL',type text not null,amount numeric not null,reference_id text not null,note text,balance_after numeric,created_at timestamptz default now(),unique(user_id,account_type,type,reference_id));
create table if not exists public.kyc_requests (id text primary key,user_id text,user_email text,full_name text,mobile text,id_number text,address text,status text default 'PENDING',reviewed_at timestamptz,created_at timestamptz default now());
create table if not exists public.payment_methods (id text primary key,user_id text,user_email text,type text,holder_name text,upi_id text,bank_name text,account_number text,ifsc text,status text default 'PENDING',rejection_reason text,created_at timestamptz default now());
create table if not exists public.deposit_requests (id text primary key,user_id text,user_email text,amount numeric,method text,utr text unique,status text default 'PENDING',balance_applied boolean default false,first_deposit_referral_checked boolean default false,created_at timestamptz default now());
create table if not exists public.withdrawal_requests (id text primary key,user_id text,user_email text,amount numeric,payment_method_id text,status text default 'PENDING',hold_applied boolean default true,created_at timestamptz default now());
create table if not exists public.ai_trades (id text primary key,user_id text,user_email text,account_type text,pair text,side text,amount numeric,leverage numeric,status text default 'OPEN',pnl numeric,created_at timestamptz default now(),closed_at timestamptz);
create table if not exists public.referrals (id text primary key,referrer_user_id text,referred_user_id text,status text default 'REGISTERED',commission_paid boolean default false,commission_amount numeric default 0,created_at timestamptz default now());
create table if not exists public.plans (id text primary key,name text,price numeric,signals integer,ai_access text,trade_limit numeric,is_active boolean default true);
alter table public.plans add column if not exists status text default 'ACTIVE';
alter table public.plans add column if not exists duration_days integer default 30;
alter table public.users add column if not exists plan_changed_at timestamptz;
alter table public.users add column if not exists plan_changed_by text;
create table if not exists public.subscriptions (id text primary key,user_id text,plan_id text,plan_name text,amount numeric,status text default 'PENDING',starts_at timestamptz,expires_at timestamptz,created_at timestamptz default now());


-- Phase 5.0 Database Foundation
-- This snapshot table lets the current frontend app safely backup/restore all platform state while the full row-by-row backend migration is done in phases.
create table if not exists public.app_state_snapshots (
  id bigserial primary key,
  app_version text default 'AITradeX',
  saved_by text,
  note text,
  counts jsonb default '{}'::jsonb,
  state jsonb not null,
  saved_at timestamptz default now()
);

create index if not exists app_state_snapshots_saved_at_idx on public.app_state_snapshots(saved_at desc);

-- Extra future-ready columns. These are safe if they already exist.
alter table public.users add column if not exists password_hash text;
alter table public.users add column if not exists ai_trade_on boolean default false;
alter table public.users add column if not exists ai_trade_percent numeric default 25;
alter table public.users add column if not exists free_trial_started_at timestamptz;
alter table public.deposit_requests add column if not exists proof_image text;
alter table public.deposit_requests add column if not exists admin_note text;
alter table public.withdrawal_requests add column if not exists admin_note text;
alter table public.ai_trades add column if not exists trade_type text;
alter table public.ai_trades add column if not exists entry_price numeric;
alter table public.ai_trades add column if not exists close_price numeric;
alter table public.ai_trades add column if not exists target_pnl numeric;
alter table public.ai_trades add column if not exists closed_by text;

create table if not exists public.notifications (
  id text primary key,
  audience text default 'USER',
  user_id text,
  title text,
  message text,
  type text default 'INFO',
  link_page text,
  reference_id text,
  read boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.support_tickets (
  id text primary key,
  user_id text,
  user_email text,
  subject text,
  category text,
  message text,
  status text default 'OPEN',
  replies jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.admin_action_logs (
  id text primary key,
  admin_user_id text,
  action text not null,
  target_type text,
  target_id text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Phase 5.5 audit log compatibility: older schema used bigserial id. Keep existing projects sync-safe.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_action_logs' and column_name = 'id' and data_type <> 'text'
  ) then
    alter table public.admin_action_logs alter column id drop default;
    alter table public.admin_action_logs alter column id type text using id::text;
  end if;
end $$;

-- Phase 5.4 Trade + AI + Orders Sync
-- Generic table for manual positions, limit orders, closed manual history, AI live positions and instant AI user entries.
create table if not exists public.trade_orders (
  id text primary key,
  user_id text not null,
  batch_id text,
  trade_type text default 'MANUAL',
  account_type text default 'REAL',
  order_type text default 'MARKET',
  market text default 'CRYPTO',
  pair text,
  side text,
  status text default 'OPEN',
  source text,
  entry_price numeric,
  entry_price_display text,
  exit_price numeric,
  exit_price_display text,
  limit_price numeric,
  limit_price_display text,
  leverage numeric default 1,
  margin_amount numeric default 0,
  margin_locked boolean default false,
  position_size numeric default 0,
  pnl numeric default 0,
  settlement_amount numeric default 0,
  target_type text,
  target_percent numeric default 0,
  close_reason text,
  closed_by text,
  note text,
  raw jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  opened_at timestamptz,
  closed_at timestamptz
);

create index if not exists trade_orders_user_id_idx on public.trade_orders(user_id);
create index if not exists trade_orders_status_idx on public.trade_orders(status);
create index if not exists trade_orders_trade_type_idx on public.trade_orders(trade_type);
create index if not exists trade_orders_created_at_idx on public.trade_orders(created_at desc);

-- Admin-created AI batches for instant AI trades and live AI positions.
create table if not exists public.ai_trade_batches (
  id text primary key,
  batch_type text default 'INSTANT',
  market text default 'CRYPTO',
  pair text,
  side text,
  leverage numeric default 1,
  status text default 'OPEN',
  entry_price numeric,
  entry_price_display text,
  target_type text,
  target_percent numeric default 0,
  min_balance numeric default 0,
  total_margin numeric default 0,
  total_exposure numeric default 0,
  total_pnl numeric default 0,
  applied_count integer default 0,
  skipped_count integer default 0,
  skip_reasons jsonb default '{}'::jsonb,
  note text,
  raw jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  closed_at timestamptz
);

create index if not exists ai_trade_batches_type_idx on public.ai_trade_batches(batch_type);
create index if not exists ai_trade_batches_created_at_idx on public.ai_trade_batches(created_at desc);


-- Phase 5.11 Database-only support
create table if not exists public.app_settings (
  id text primary key default 'main',
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table public.plans add column if not exists raw jsonb default '{}'::jsonb;
alter table public.referrals add column if not exists raw jsonb default '{}'::jsonb;

alter table public.users add column if not exists avatar_url text;
alter table public.users add column if not exists avatar_path text;


-- Phase 5.12.6: Preserve full frontend request payloads for database-only admin views
alter table public.kyc_requests add column if not exists raw jsonb default '{}'::jsonb;
alter table public.payment_methods add column if not exists raw jsonb default '{}'::jsonb;
alter table public.deposit_requests add column if not exists raw jsonb default '{}'::jsonb;
alter table public.withdrawal_requests add column if not exists raw jsonb default '{}'::jsonb;

-- Phase 5.34: Live Sync Lite realtime publication support.
-- Safe to run multiple times; duplicate publication entries are ignored.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'users','payment_methods','kyc_requests','deposit_requests','withdrawal_requests','wallet_ledger','trade_orders','ai_trade_batches','admin_action_logs','notifications','app_settings','plans','subscriptions','referrals','support_tickets'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    exception
      when duplicate_object then null;
      when undefined_table then raise notice 'Realtime table skipped because it does not exist: %', tbl;
      when others then raise notice 'Realtime enable skipped for %. Reason: %', tbl, sqlerrm;
    end;
  end loop;
end $$;


-- Phase 5.16.1: Action-based database runtime compatibility
-- These columns make direct KYC/deposit/withdrawal/admin updates safe across old projects.
alter table public.users add column if not exists last_login_at timestamptz;
alter table public.users add column if not exists updated_at timestamptz default now();
alter table public.kyc_requests add column if not exists admin_note text;
alter table public.kyc_requests add column if not exists reviewed_by text;
alter table public.payment_methods add column if not exists reviewed_at timestamptz;
alter table public.payment_methods add column if not exists reviewed_by text;
alter table public.deposit_requests add column if not exists reviewed_at timestamptz;
alter table public.deposit_requests add column if not exists reviewed_by text;
alter table public.withdrawal_requests add column if not exists reviewed_at timestamptz;
alter table public.withdrawal_requests add column if not exists reviewed_by text;
alter table public.withdrawal_requests add column if not exists rejection_reason text;
alter table public.wallet_ledger add column if not exists raw jsonb default '{}'::jsonb;
alter table public.plans add column if not exists raw jsonb default '{}'::jsonb;
alter table public.subscriptions add column if not exists raw jsonb default '{}'::jsonb;
alter table public.referrals add column if not exists raw jsonb default '{}'::jsonb;
alter table public.notifications add column if not exists raw jsonb default '{}'::jsonb;
alter table public.admin_action_logs add column if not exists raw jsonb default '{}'::jsonb;

create index if not exists users_email_idx on public.users(email);
create index if not exists users_mobile_idx on public.users(mobile);
create index if not exists kyc_requests_user_id_idx on public.kyc_requests(user_id);
create index if not exists deposit_requests_user_id_idx on public.deposit_requests(user_id);
create index if not exists withdrawal_requests_user_id_idx on public.withdrawal_requests(user_id);
create index if not exists wallet_ledger_user_id_idx on public.wallet_ledger(user_id);
create index if not exists notifications_user_id_idx on public.notifications(user_id);

insert into public.app_settings(id, settings, updated_at)
values ('main', jsonb_build_object('databaseRuntimeVersion','6.2.1','mode','action-database'), now())
on conflict (id) do update
set settings = coalesce(public.app_settings.settings, '{}'::jsonb) || jsonb_build_object('databaseRuntimeVersion','6.2.1','mode','action-database'),
    updated_at = now();


-- Phase 5.29: Clean persistence compatibility columns/indexes.
alter table public.users add column if not exists last_login_at timestamptz;
alter table public.users add column if not exists updated_at timestamptz default now();
alter table public.payment_methods add column if not exists raw jsonb default '{}'::jsonb;
alter table public.notifications add column if not exists raw jsonb default '{}'::jsonb;
alter table public.admin_action_logs add column if not exists raw jsonb default '{}'::jsonb;
create index if not exists payment_methods_user_id_idx on public.payment_methods(user_id);
create index if not exists admin_action_logs_created_at_idx on public.admin_action_logs(created_at desc);
create index if not exists notifications_created_at_idx on public.notifications(created_at desc);

insert into public.app_settings(id, settings, updated_at)
values ('main', jsonb_build_object('databaseRuntimeVersion','6.2.1','mode','action-database-clean-persistence'), now())
on conflict (id) do update
set settings = coalesce(public.app_settings.settings, '{}'::jsonb) || jsonb_build_object('databaseRuntimeVersion','6.2.1','mode','action-database-clean-persistence'),
    updated_at = now();


-- Phase 5.29: Final clean audit compatibility.
-- New passwords are stored in password_hash as sha256$salt$hash by the frontend runtime.
-- Existing plain password_hash values are migrated after the next successful login/reset.
alter table public.users add column if not exists password_hash text;
alter table public.notifications add column if not exists raw jsonb default '{}'::jsonb;

insert into public.app_settings(id, settings, updated_at)
values ('main', jsonb_build_object('databaseRuntimeVersion','6.2.1','mode','final-clean-audit-fix','passwordStorage','salted-sha256-runtime'), now())
on conflict (id) do update
set settings = coalesce(public.app_settings.settings, '{}'::jsonb) || jsonb_build_object('databaseRuntimeVersion','6.2.1','mode','final-clean-audit-fix','passwordStorage','salted-sha256-runtime'),
    updated_at = now();


-- Phase 5.29: default control admin + safer ledger uniqueness
alter table public.wallet_ledger drop constraint if exists wallet_ledger_type_reference_id_key;
alter table public.wallet_ledger drop constraint if exists wallet_ledger_user_id_account_type_type_reference_id_key;
alter table public.wallet_ledger add constraint wallet_ledger_user_id_account_type_type_reference_id_key unique(user_id, account_type, type, reference_id);

insert into public.users (id, name, email, mobile, role, status, referral_code, password_hash, ai_trade_on, ai_trade_percent, created_at, updated_at)
values ('control_root', 'AITradeX Control', 'control@aitradex.com', '', 'admin', 'ACTIVE', 'CONTROL', 'sha256$control_root$4777731d2f274363db7e3be6b9f78af08f0210a102cf2b137445d4daf9b13c02', false, 0, now(), now())
on conflict (id) do update set
  name=excluded.name,
  email=excluded.email,
  role=excluded.role,
  status=excluded.status,
  referral_code=excluded.referral_code,
  password_hash=coalesce(public.users.password_hash, excluded.password_hash),
  updated_at=now();


-- Phase 5.29 security note:
-- This schema is suitable for controlled testing. For real public money/users, move admin/funds/trading actions to a private backend/service-role API and tighten RLS policies per role.


-- Phase 5.29: final deep consistency marker
insert into public.app_settings(id, settings, updated_at)
values ('main', jsonb_build_object('databaseRuntimeVersion','6.2.1','mode','final-deep-consistency-fix','passwordStorage','salted-sha256-runtime'), now())
on conflict (id) do update
set settings = coalesce(public.app_settings.settings, '{}'::jsonb) || jsonb_build_object('databaseRuntimeVersion','6.2.1','mode','final-deep-consistency-fix','passwordStorage','salted-sha256-runtime'),
    updated_at = now();


-- Phase 5.29: TESTING RLS POLICIES FOR CURRENT FRONTEND-ONLY BUILD
-- These policies keep RLS enabled while allowing the current anon-key frontend prototype to function.
-- They are NOT sufficient for real public money/users because custom frontend login is not available to PostgreSQL RLS.
-- For real launch, move writes to backend/Edge Functions or Supabase Auth and then adapt supabase-production-rls-template.sql.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'users','wallet_ledger','deposit_requests','withdrawal_requests','payment_methods','kyc_requests',
    'notifications','admin_action_logs','trade_orders','ai_trade_batches','app_settings','plans','subscriptions',
    'referrals','support_tickets','app_state_snapshots'
  ]
  loop
    begin
      execute format('alter table public.%I enable row level security', tbl);
      execute format('drop policy if exists "AITradeX testing anon all %s" on public.%I', tbl, tbl);
      execute format('drop policy if exists "AITradeX anon all %s" on public.%I', tbl, tbl);
      execute format('create policy "AITradeX testing anon all %s" on public.%I for all to anon using (true) with check (true)', tbl, tbl);
    exception
      when undefined_table then raise notice 'Testing RLS policy skipped, table missing: %', tbl;
      when others then raise notice 'Testing RLS policy setup skipped for %. Reason: %', tbl, sqlerrm;
    end;
  end loop;
end $$;

insert into public.app_settings(id, settings, updated_at)
values ('main', jsonb_build_object('databaseRuntimeVersion','6.2.1','mode','rls-safety-pack','rlsMode','testing-frontend-compatible'), now())
on conflict (id) do update
set settings = coalesce(public.app_settings.settings, '{}'::jsonb) || jsonb_build_object('databaseRuntimeVersion','6.2.1','mode','rls-safety-pack','rlsMode','testing-frontend-compatible'),
    updated_at = now();


-- Phase 5.34: Live Sync Lite marker.
insert into public.app_settings (id, settings, updated_at)
values ('main', jsonb_build_object('databaseRuntimeVersion','6.2.1','mode','live-sync-lite','liveSync','supabase-realtime-silent-ui'), now())
on conflict (id) do update
set settings = coalesce(public.app_settings.settings, '{}'::jsonb) || jsonb_build_object('databaseRuntimeVersion','6.2.1','mode','live-sync-lite','liveSync','supabase-realtime-silent-ui'),
    updated_at = now();


-- Phase 6.2.1 Deposit Backend Security SQL Grant Fix + Secure Auth Foundation (safe, non-breaking)
-- These columns/tables prepare the project for Supabase Auth + backend Edge Functions without breaking the current Phase5 UI.
alter table public.users add column if not exists auth_user_id uuid unique;
alter table public.users add column if not exists password_updated_at timestamptz;
alter table public.users add column if not exists password_updated_by text;

create table if not exists public.admin_roles (
  id text primary key,
  user_id text references public.users(id) on delete cascade,
  auth_user_id uuid,
  role text not null default 'admin',
  permissions jsonb not null default '{}'::jsonb,
  status text not null default 'ACTIVE',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.backend_action_queue (
  id text primary key,
  action_type text not null,
  status text not null default 'PENDING',
  requested_by text,
  target_user_id text,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz default now(),
  processed_at timestamptz
);

create index if not exists users_auth_user_id_idx on public.users(auth_user_id);
create index if not exists admin_roles_user_id_idx on public.admin_roles(user_id);
create index if not exists backend_action_queue_status_idx on public.backend_action_queue(status, created_at desc);

insert into public.app_settings(id, settings, updated_at)
values ('main', jsonb_build_object('databaseRuntimeVersion','6.2.1','mode','phase6-secure-auth-foundation','authMode','legacy-testing'), now())
on conflict (id) do update
set settings = coalesce(public.app_settings.settings, '{}'::jsonb) || jsonb_build_object('databaseRuntimeVersion','6.2.1','mode','phase6-secure-auth-foundation','authMode','legacy-testing'),
    updated_at = now();

-- Phase 6.2.1 Deposit Backend Security SQL Grant Fix
-- Centralizes deposit approve/reject in PostgreSQL RPC functions.
-- This is a safe migration step before full Edge Function/service-role migration.

create or replace function public.aitradex_validate_admin(p_admin_user_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = p_admin_user_id
      and lower(coalesce(role,'')) = 'admin'
      and upper(coalesce(status,'ACTIVE')) = 'ACTIVE'
  );
$$;

create or replace function public.aitradex_approve_deposit(
  p_request_id text,
  p_admin_user_id text default 'control_root',
  p_admin_email text default '',
  p_admin_name text default 'Admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  dep public.deposit_requests%rowtype;
  ledger_applied boolean := false;
  ledger_inserted integer := 0;
  duplicate_count integer := 0;
  ledger_id text;
  notif_id text;
  log_id text;
  queue_id text;
begin
  if not public.aitradex_validate_admin(p_admin_user_id) then
    raise exception 'Admin permission required for deposit approval.';
  end if;

  select * into dep from public.deposit_requests where id = p_request_id for update;
  if not found then
    raise exception 'Deposit request not found.';
  end if;

  if upper(coalesce(dep.status,'PENDING')) <> 'PENDING' then
    return jsonb_build_object('ok', true, 'alreadyCompleted', true, 'status', dep.status, 'ledgerApplied', false);
  end if;

  if coalesce(dep.amount,0) <= 0 then
    raise exception 'Invalid deposit amount.';
  end if;

  if nullif(trim(coalesce(dep.utr,'')), '') is not null then
    select count(*) into duplicate_count
    from public.deposit_requests
    where id <> dep.id
      and utr = dep.utr
      and upper(coalesce(status,'')) = 'APPROVED';
    if duplicate_count > 0 then
      raise exception 'Duplicate approved UTR found. Approval blocked.';
    end if;
  end if;

  ledger_id := 'ledger_dep_' || dep.id;
  insert into public.wallet_ledger(id, user_id, account_type, type, amount, reference_id, note, created_at, raw)
  values (
    ledger_id,
    dep.user_id,
    'REAL',
    'DEPOSIT',
    dep.amount,
    dep.id,
    'SECURE_DEPOSIT_APPROVED · UTR ' || coalesce(dep.utr,'-'),
    now(),
    jsonb_build_object('secureDepositApprove', true, 'approvedBy', p_admin_user_id, 'approvedByEmail', p_admin_email, 'approvedAt', now())
  )
  on conflict on constraint wallet_ledger_user_id_account_type_type_reference_id_key do nothing;
  get diagnostics ledger_inserted = row_count;
  ledger_applied := ledger_inserted > 0;

  update public.deposit_requests
  set status = 'APPROVED',
      balance_applied = true,
      reviewed_at = now(),
      reviewed_by = p_admin_user_id,
      admin_note = case when duplicate_count > 0 then 'Checked duplicate UTR warning: ' || duplicate_count::text || ' similar approved request(s).' else 'Approved by secure backend function.' end,
      raw = coalesce(raw, '{}'::jsonb) || jsonb_build_object('secureDepositApprove', true, 'approvedBy', p_admin_user_id, 'approvedByEmail', p_admin_email, 'approvedAt', now(), 'ledgerApplied', ledger_applied)
  where id = dep.id;

  notif_id := 'notif_dep_ok_' || dep.id;
  insert into public.notifications(id, audience, user_id, title, message, type, link_page, reference_id, read, created_at, raw)
  values (notif_id, 'USER', dep.user_id, 'Deposit approved', 'Deposit ' || dep.amount::text || ' approved and credited to your wallet.', 'DEPOSIT', 'wallet', 'dep_ok_' || dep.id, false, now(), jsonb_build_object('secureDepositApprove', true))
  on conflict (id) do update set
    audience=excluded.audience, user_id=excluded.user_id, title=excluded.title, message=excluded.message, type=excluded.type, link_page=excluded.link_page, reference_id=excluded.reference_id, raw=excluded.raw;

  log_id := 'adminlog_dep_approve_' || dep.id;
  insert into public.admin_action_logs(id, admin_user_id, action, target_type, target_id, meta, created_at)
  values (log_id, p_admin_user_id, 'DEPOSIT_APPROVE_SECURE', 'DEPOSIT', dep.id, jsonb_build_object('userId', dep.user_id, 'amount', dep.amount, 'utr', dep.utr, 'ledgerApplied', ledger_applied, 'adminEmail', p_admin_email, 'adminName', p_admin_name), now())
  on conflict (id) do update set meta=excluded.meta, created_at=excluded.created_at;

  queue_id := 'backend_deposit_approve_' || dep.id;
  insert into public.backend_action_queue(id, action_type, status, requested_by, target_user_id, payload, result, created_at, processed_at)
  values (queue_id, 'DEPOSIT_APPROVE', 'COMPLETED', p_admin_user_id, dep.user_id, jsonb_build_object('requestId', dep.id, 'amount', dep.amount), jsonb_build_object('ledgerApplied', ledger_applied, 'status', 'APPROVED'), now(), now())
  on conflict (id) do update set status='COMPLETED', result=excluded.result, processed_at=now();

  return jsonb_build_object('ok', true, 'requestId', dep.id, 'userId', dep.user_id, 'amount', dep.amount, 'ledgerApplied', ledger_applied, 'status', 'APPROVED');
end;
$$;

create or replace function public.aitradex_reject_deposit(
  p_request_id text,
  p_reason text default 'Rejected by admin.',
  p_admin_user_id text default 'control_root',
  p_admin_email text default '',
  p_admin_name text default 'Admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  dep public.deposit_requests%rowtype;
  notif_id text;
  log_id text;
  queue_id text;
  clean_reason text := coalesce(nullif(trim(p_reason), ''), 'Rejected by admin.');
begin
  if not public.aitradex_validate_admin(p_admin_user_id) then
    raise exception 'Admin permission required for deposit rejection.';
  end if;

  select * into dep from public.deposit_requests where id = p_request_id for update;
  if not found then
    raise exception 'Deposit request not found.';
  end if;

  if upper(coalesce(dep.status,'PENDING')) <> 'PENDING' then
    return jsonb_build_object('ok', true, 'alreadyCompleted', true, 'status', dep.status);
  end if;

  update public.deposit_requests
  set status = 'REJECTED',
      reviewed_at = now(),
      reviewed_by = p_admin_user_id,
      admin_note = clean_reason,
      raw = coalesce(raw, '{}'::jsonb) || jsonb_build_object('secureDepositReject', true, 'rejectedBy', p_admin_user_id, 'rejectedByEmail', p_admin_email, 'rejectedAt', now(), 'rejectReason', clean_reason, 'rejectReasonUser', clean_reason)
  where id = dep.id;

  notif_id := 'notif_dep_rej_' || dep.id;
  insert into public.notifications(id, audience, user_id, title, message, type, link_page, reference_id, read, created_at, raw)
  values (notif_id, 'USER', dep.user_id, 'Deposit rejected', 'Deposit request ' || coalesce(dep.amount,0)::text || ' was rejected. ' || clean_reason, 'DEPOSIT', 'wallet', 'dep_rej_' || dep.id, false, now(), jsonb_build_object('secureDepositReject', true, 'reason', clean_reason))
  on conflict (id) do update set
    audience=excluded.audience, user_id=excluded.user_id, title=excluded.title, message=excluded.message, type=excluded.type, link_page=excluded.link_page, reference_id=excluded.reference_id, raw=excluded.raw;

  log_id := 'adminlog_dep_reject_' || dep.id;
  insert into public.admin_action_logs(id, admin_user_id, action, target_type, target_id, meta, created_at)
  values (log_id, p_admin_user_id, 'DEPOSIT_REJECT_SECURE', 'DEPOSIT', dep.id, jsonb_build_object('userId', dep.user_id, 'amount', dep.amount, 'utr', dep.utr, 'reason', clean_reason, 'adminEmail', p_admin_email, 'adminName', p_admin_name), now())
  on conflict (id) do update set meta=excluded.meta, created_at=excluded.created_at;

  queue_id := 'backend_deposit_reject_' || dep.id;
  insert into public.backend_action_queue(id, action_type, status, requested_by, target_user_id, payload, result, created_at, processed_at)
  values (queue_id, 'DEPOSIT_REJECT', 'COMPLETED', p_admin_user_id, dep.user_id, jsonb_build_object('requestId', dep.id, 'reason', clean_reason), jsonb_build_object('status', 'REJECTED'), now(), now())
  on conflict (id) do update set status='COMPLETED', result=excluded.result, processed_at=now();

  return jsonb_build_object('ok', true, 'requestId', dep.id, 'userId', dep.user_id, 'status', 'REJECTED', 'reason', clean_reason);
end;
$$;



create or replace function public.aitradex_approve_withdrawal(
  p_request_id text,
  p_admin_user_id text default 'control_root',
  p_admin_email text default '',
  p_admin_name text default 'Admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  wd public.withdrawal_requests%rowtype;
  wallet_balance numeric := 0;
  ledger_applied boolean := false;
  ledger_inserted integer := 0;
  ledger_id text;
  notif_id text;
  log_id text;
  queue_id text;
begin
  if not public.aitradex_validate_admin(p_admin_user_id) then
    raise exception 'Admin permission required for withdrawal approval.';
  end if;

  select * into wd from public.withdrawal_requests where id = p_request_id for update;
  if not found then
    raise exception 'Withdrawal request not found.';
  end if;

  if upper(coalesce(wd.status,'PENDING')) <> 'PENDING' then
    return jsonb_build_object('ok', true, 'alreadyCompleted', true, 'status', wd.status, 'ledgerApplied', false);
  end if;

  if coalesce(wd.amount,0) <= 0 then
    raise exception 'Invalid withdrawal amount.';
  end if;

  if exists (select 1 from public.users where id = wd.user_id and upper(coalesce(status,'ACTIVE')) <> 'ACTIVE') then
    raise exception 'User account is not active.';
  end if;

  select coalesce(sum(amount),0) into wallet_balance
  from public.wallet_ledger
  where user_id = wd.user_id
    and upper(coalesce(account_type,'REAL')) = 'REAL';

  if not exists (
    select 1 from public.wallet_ledger
    where user_id = wd.user_id
      and upper(coalesce(account_type,'REAL')) = 'REAL'
      and type = 'WITHDRAWAL'
      and reference_id = wd.id
  ) and wallet_balance < wd.amount then
    raise exception 'Insufficient real balance for withdrawal.';
  end if;

  ledger_id := 'ledger_wd_' || wd.id;
  insert into public.wallet_ledger(id, user_id, account_type, type, amount, reference_id, note, created_at, raw)
  values (
    ledger_id,
    wd.user_id,
    'REAL',
    'WITHDRAWAL',
    -wd.amount,
    wd.id,
    'SECURE_WITHDRAWAL_APPROVED · Admin payout confirmed',
    now(),
    jsonb_build_object('secureWithdrawalApprove', true, 'approvedBy', p_admin_user_id, 'approvedByEmail', p_admin_email, 'approvedAt', now())
  )
  on conflict on constraint wallet_ledger_user_id_account_type_type_reference_id_key do nothing;
  get diagnostics ledger_inserted = row_count;
  ledger_applied := ledger_inserted > 0;

  update public.withdrawal_requests
  set status = 'APPROVED',
      reviewed_at = now(),
      reviewed_by = p_admin_user_id,
      admin_note = 'Approved payout by secure backend function.',
      raw = coalesce(raw, '{}'::jsonb) || jsonb_build_object('secureWithdrawalApprove', true, 'approvedBy', p_admin_user_id, 'approvedByEmail', p_admin_email, 'approvedAt', now(), 'ledgerApplied', ledger_applied, 'balanceBefore', wallet_balance)
  where id = wd.id;

  notif_id := 'notif_wd_ok_' || wd.id;
  insert into public.notifications(id, audience, user_id, title, message, type, link_page, reference_id, read, created_at, raw)
  values (notif_id, 'USER', wd.user_id, 'Withdrawal approved', 'Withdrawal ' || wd.amount::text || ' payout approved.', 'WITHDRAWAL', 'wallet', 'wd_ok_' || wd.id, false, now(), jsonb_build_object('secureWithdrawalApprove', true))
  on conflict (id) do update set
    audience=excluded.audience, user_id=excluded.user_id, title=excluded.title, message=excluded.message, type=excluded.type, link_page=excluded.link_page, reference_id=excluded.reference_id, raw=excluded.raw;

  log_id := 'adminlog_wd_approve_' || wd.id;
  insert into public.admin_action_logs(id, admin_user_id, action, target_type, target_id, meta, created_at)
  values (log_id, p_admin_user_id, 'WITHDRAWAL_APPROVE_SECURE', 'WITHDRAWAL', wd.id, jsonb_build_object('userId', wd.user_id, 'amount', wd.amount, 'ledgerApplied', ledger_applied, 'balanceBefore', wallet_balance, 'adminEmail', p_admin_email, 'adminName', p_admin_name), now())
  on conflict (id) do update set meta=excluded.meta, created_at=excluded.created_at;

  queue_id := 'backend_withdrawal_approve_' || wd.id;
  insert into public.backend_action_queue(id, action_type, status, requested_by, target_user_id, payload, result, created_at, processed_at)
  values (queue_id, 'WITHDRAWAL_APPROVE', 'COMPLETED', p_admin_user_id, wd.user_id, jsonb_build_object('requestId', wd.id, 'amount', wd.amount), jsonb_build_object('ledgerApplied', ledger_applied, 'status', 'APPROVED'), now(), now())
  on conflict (id) do update set status='COMPLETED', result=excluded.result, processed_at=now();

  return jsonb_build_object('ok', true, 'requestId', wd.id, 'userId', wd.user_id, 'amount', wd.amount, 'ledgerApplied', ledger_applied, 'status', 'APPROVED');
end;
$$;

create or replace function public.aitradex_reject_withdrawal(
  p_request_id text,
  p_reason text default 'Rejected by admin.',
  p_admin_user_id text default 'control_root',
  p_admin_email text default '',
  p_admin_name text default 'Admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  wd public.withdrawal_requests%rowtype;
  notif_id text;
  log_id text;
  queue_id text;
  clean_reason text := coalesce(nullif(trim(p_reason), ''), 'Rejected by admin.');
begin
  if not public.aitradex_validate_admin(p_admin_user_id) then
    raise exception 'Admin permission required for withdrawal rejection.';
  end if;

  select * into wd from public.withdrawal_requests where id = p_request_id for update;
  if not found then
    raise exception 'Withdrawal request not found.';
  end if;

  if upper(coalesce(wd.status,'PENDING')) <> 'PENDING' then
    return jsonb_build_object('ok', true, 'alreadyCompleted', true, 'status', wd.status);
  end if;

  update public.withdrawal_requests
  set status = 'REJECTED',
      reviewed_at = now(),
      reviewed_by = p_admin_user_id,
      admin_note = clean_reason,
      rejection_reason = clean_reason,
      raw = coalesce(raw, '{}'::jsonb) || jsonb_build_object('secureWithdrawalReject', true, 'rejectedBy', p_admin_user_id, 'rejectedByEmail', p_admin_email, 'rejectedAt', now(), 'rejectReason', clean_reason)
  where id = wd.id;

  notif_id := 'notif_wd_rej_' || wd.id;
  insert into public.notifications(id, audience, user_id, title, message, type, link_page, reference_id, read, created_at, raw)
  values (notif_id, 'USER', wd.user_id, 'Withdrawal rejected', clean_reason, 'WITHDRAWAL', 'wallet', 'wd_no_' || wd.id, false, now(), jsonb_build_object('secureWithdrawalReject', true, 'reason', clean_reason))
  on conflict (id) do update set
    audience=excluded.audience, user_id=excluded.user_id, title=excluded.title, message=excluded.message, type=excluded.type, link_page=excluded.link_page, reference_id=excluded.reference_id, raw=excluded.raw;

  log_id := 'adminlog_wd_reject_' || wd.id;
  insert into public.admin_action_logs(id, admin_user_id, action, target_type, target_id, meta, created_at)
  values (log_id, p_admin_user_id, 'WITHDRAWAL_REJECT_SECURE', 'WITHDRAWAL', wd.id, jsonb_build_object('userId', wd.user_id, 'amount', wd.amount, 'reason', clean_reason, 'adminEmail', p_admin_email, 'adminName', p_admin_name), now())
  on conflict (id) do update set meta=excluded.meta, created_at=excluded.created_at;

  queue_id := 'backend_withdrawal_reject_' || wd.id;
  insert into public.backend_action_queue(id, action_type, status, requested_by, target_user_id, payload, result, created_at, processed_at)
  values (queue_id, 'WITHDRAWAL_REJECT', 'COMPLETED', p_admin_user_id, wd.user_id, jsonb_build_object('requestId', wd.id, 'reason', clean_reason), jsonb_build_object('status', 'REJECTED'), now(), now())
  on conflict (id) do update set status='COMPLETED', result=excluded.result, processed_at=now();

  return jsonb_build_object('ok', true, 'requestId', wd.id, 'userId', wd.user_id, 'status', 'REJECTED', 'reason', clean_reason);
end;
$$;

grant execute on function public.aitradex_validate_admin(text) to anon, authenticated;


-- Phase 6.6: Backend-secure KYC approval/rejection
create or replace function public.aitradex_approve_kyc(
  p_kyc_id text,
  p_admin_user_id text default 'control_root',
  p_admin_email text default '',
  p_admin_name text default 'Admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  kyc public.kyc_requests%rowtype;
  notif_id text;
  log_id text;
  queue_id text;
begin
  if not public.aitradex_validate_admin(p_admin_user_id) then
    raise exception 'Admin permission required for KYC approval.';
  end if;

  select * into kyc from public.kyc_requests where id = p_kyc_id for update;
  if not found then
    raise exception 'KYC request not found.';
  end if;

  if upper(coalesce(kyc.status,'PENDING')) <> 'PENDING' then
    return jsonb_build_object('ok', true, 'alreadyCompleted', true, 'status', kyc.status);
  end if;

  update public.kyc_requests
  set status = 'APPROVED',
      reviewed_at = now(),
      reviewed_by = p_admin_user_id,
      admin_note = 'Approved by secure backend function.',
      raw = coalesce(raw, '{}'::jsonb) || jsonb_build_object(
        'status','APPROVED',
        'secureKycApprove', true,
        'approvedBy', p_admin_user_id,
        'approvedByEmail', p_admin_email,
        'approvedByName', p_admin_name,
        'approvedAt', now(),
        'rejectedAt', '',
        'rejectReason', ''
      )
  where id = kyc.id;

  notif_id := 'notif_kyc_ok_' || kyc.id;
  insert into public.notifications(id, audience, user_id, title, message, type, link_page, reference_id, read, created_at, raw)
  values (notif_id, 'USER', kyc.user_id, 'KYC approved', 'Your KYC verification has been approved.', 'KYC', 'kyc', 'kyc_ok_' || kyc.id, false, now(), jsonb_build_object('secureKycApprove', true))
  on conflict (id) do update set
    audience=excluded.audience, user_id=excluded.user_id, title=excluded.title, message=excluded.message, type=excluded.type, link_page=excluded.link_page, reference_id=excluded.reference_id, raw=excluded.raw;

  log_id := 'adminlog_kyc_approve_' || kyc.id;
  insert into public.admin_action_logs(id, admin_user_id, action, target_type, target_id, meta, created_at)
  values (log_id, p_admin_user_id, 'KYC_APPROVE_SECURE', 'KYC', kyc.id, jsonb_build_object('userId', kyc.user_id, 'userEmail', kyc.user_email, 'adminEmail', p_admin_email, 'adminName', p_admin_name), now())
  on conflict (id) do update set meta=excluded.meta, created_at=excluded.created_at;

  queue_id := 'backend_kyc_approve_' || kyc.id;
  insert into public.backend_action_queue(id, action_type, status, requested_by, target_user_id, payload, result, created_at, processed_at)
  values (queue_id, 'KYC_APPROVE', 'COMPLETED', p_admin_user_id, kyc.user_id, jsonb_build_object('kycId', kyc.id), jsonb_build_object('status', 'APPROVED'), now(), now())
  on conflict (id) do update set status='COMPLETED', result=excluded.result, processed_at=now();

  return jsonb_build_object('ok', true, 'kycId', kyc.id, 'userId', kyc.user_id, 'status', 'APPROVED');
end;
$$;

create or replace function public.aitradex_reject_kyc(
  p_kyc_id text,
  p_reason text default 'Rejected by admin.',
  p_admin_user_id text default 'control_root',
  p_admin_email text default '',
  p_admin_name text default 'Admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  kyc public.kyc_requests%rowtype;
  notif_id text;
  log_id text;
  queue_id text;
  clean_reason text := coalesce(nullif(trim(p_reason), ''), 'Rejected by admin.');
begin
  if not public.aitradex_validate_admin(p_admin_user_id) then
    raise exception 'Admin permission required for KYC rejection.';
  end if;

  select * into kyc from public.kyc_requests where id = p_kyc_id for update;
  if not found then
    raise exception 'KYC request not found.';
  end if;

  if upper(coalesce(kyc.status,'PENDING')) <> 'PENDING' then
    return jsonb_build_object('ok', true, 'alreadyCompleted', true, 'status', kyc.status);
  end if;

  update public.kyc_requests
  set status = 'REJECTED',
      reviewed_at = now(),
      reviewed_by = p_admin_user_id,
      admin_note = clean_reason,
      raw = coalesce(raw, '{}'::jsonb) || jsonb_build_object(
        'status','REJECTED',
        'secureKycReject', true,
        'rejectedBy', p_admin_user_id,
        'rejectedByEmail', p_admin_email,
        'rejectedByName', p_admin_name,
        'rejectedAt', now(),
        'approvedAt', '',
        'rejectReason', clean_reason
      )
  where id = kyc.id;

  notif_id := 'notif_kyc_rej_' || kyc.id;
  insert into public.notifications(id, audience, user_id, title, message, type, link_page, reference_id, read, created_at, raw)
  values (notif_id, 'USER', kyc.user_id, 'KYC rejected', clean_reason, 'KYC', 'kyc', 'kyc_no_' || kyc.id, false, now(), jsonb_build_object('secureKycReject', true, 'reason', clean_reason))
  on conflict (id) do update set
    audience=excluded.audience, user_id=excluded.user_id, title=excluded.title, message=excluded.message, type=excluded.type, link_page=excluded.link_page, reference_id=excluded.reference_id, raw=excluded.raw;

  log_id := 'adminlog_kyc_reject_' || kyc.id;
  insert into public.admin_action_logs(id, admin_user_id, action, target_type, target_id, meta, created_at)
  values (log_id, p_admin_user_id, 'KYC_REJECT_SECURE', 'KYC', kyc.id, jsonb_build_object('userId', kyc.user_id, 'userEmail', kyc.user_email, 'reason', clean_reason, 'adminEmail', p_admin_email, 'adminName', p_admin_name), now())
  on conflict (id) do update set meta=excluded.meta, created_at=excluded.created_at;

  queue_id := 'backend_kyc_reject_' || kyc.id;
  insert into public.backend_action_queue(id, action_type, status, requested_by, target_user_id, payload, result, created_at, processed_at)
  values (queue_id, 'KYC_REJECT', 'COMPLETED', p_admin_user_id, kyc.user_id, jsonb_build_object('kycId', kyc.id, 'reason', clean_reason), jsonb_build_object('status', 'REJECTED'), now(), now())
  on conflict (id) do update set status='COMPLETED', result=excluded.result, processed_at=now();

  return jsonb_build_object('ok', true, 'kycId', kyc.id, 'userId', kyc.user_id, 'status', 'REJECTED', 'reason', clean_reason);
end;
$$;

-- Phase 6.6: Backend-secure payment method approval/rejection
create or replace function public.aitradex_approve_payment_method(
  p_method_id text,
  p_admin_user_id text default 'control_root',
  p_admin_email text default '',
  p_admin_name text default 'Admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  method public.payment_methods%rowtype;
  notif_id text;
  log_id text;
  queue_id text;
  masked_tail text;
begin
  if not public.aitradex_validate_admin(p_admin_user_id) then
    raise exception 'Admin permission required for payment method approval.';
  end if;

  select * into method from public.payment_methods where id = p_method_id for update;
  if not found then
    raise exception 'Payment method not found.';
  end if;

  if upper(coalesce(method.status,'PENDING')) <> 'PENDING' then
    return jsonb_build_object('ok', true, 'alreadyCompleted', true, 'status', method.status);
  end if;

  masked_tail := right(coalesce(method.account_number,''), 4);

  update public.payment_methods
  set status = 'APPROVED',
      rejection_reason = '',
      reviewed_at = now(),
      reviewed_by = p_admin_user_id,
      raw = coalesce(raw, '{}'::jsonb) || jsonb_build_object(
        'status','APPROVED',
        'securePaymentMethodApprove', true,
        'approvedBy', p_admin_user_id,
        'approvedByEmail', p_admin_email,
        'approvedByName', p_admin_name,
        'approvedAt', now(),
        'rejectedAt', '',
        'rejectReason', ''
      )
  where id = method.id;

  notif_id := 'notif_pm_ok_' || method.id;
  insert into public.notifications(id, audience, user_id, title, message, type, link_page, reference_id, read, created_at, raw)
  values (notif_id, 'USER', method.user_id, 'Bank account approved', coalesce(method.bank_name, 'Bank account') || ' ending ' || coalesce(nullif(masked_tail,''), '-') || ' has been approved for withdrawals.', 'PAYMENT_METHOD', 'payments', 'pm_ok_' || method.id, false, now(), jsonb_build_object('securePaymentMethodApprove', true))
  on conflict (id) do update set
    audience=excluded.audience, user_id=excluded.user_id, title=excluded.title, message=excluded.message, type=excluded.type, link_page=excluded.link_page, reference_id=excluded.reference_id, raw=excluded.raw;

  log_id := 'adminlog_pm_approve_' || method.id;
  insert into public.admin_action_logs(id, admin_user_id, action, target_type, target_id, meta, created_at)
  values (log_id, p_admin_user_id, 'PAYMENT_METHOD_APPROVE_SECURE', 'PAYMENT_METHOD', method.id, jsonb_build_object('userId', method.user_id, 'bankName', method.bank_name, 'type', method.type, 'adminEmail', p_admin_email, 'adminName', p_admin_name), now())
  on conflict (id) do update set meta=excluded.meta, created_at=excluded.created_at;

  queue_id := 'backend_pm_approve_' || method.id;
  insert into public.backend_action_queue(id, action_type, status, requested_by, target_user_id, payload, result, created_at, processed_at)
  values (queue_id, 'PAYMENT_METHOD_APPROVE', 'COMPLETED', p_admin_user_id, method.user_id, jsonb_build_object('methodId', method.id), jsonb_build_object('status', 'APPROVED'), now(), now())
  on conflict (id) do update set status='COMPLETED', result=excluded.result, processed_at=now();

  return jsonb_build_object('ok', true, 'methodId', method.id, 'userId', method.user_id, 'status', 'APPROVED');
end;
$$;

create or replace function public.aitradex_reject_payment_method(
  p_method_id text,
  p_reason text default 'Rejected by admin.',
  p_admin_user_id text default 'control_root',
  p_admin_email text default '',
  p_admin_name text default 'Admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  method public.payment_methods%rowtype;
  notif_id text;
  log_id text;
  queue_id text;
  clean_reason text := coalesce(nullif(trim(p_reason), ''), 'Rejected by admin.');
begin
  if not public.aitradex_validate_admin(p_admin_user_id) then
    raise exception 'Admin permission required for payment method rejection.';
  end if;

  select * into method from public.payment_methods where id = p_method_id for update;
  if not found then
    raise exception 'Payment method not found.';
  end if;

  if upper(coalesce(method.status,'PENDING')) <> 'PENDING' then
    return jsonb_build_object('ok', true, 'alreadyCompleted', true, 'status', method.status);
  end if;

  update public.payment_methods
  set status = 'REJECTED',
      rejection_reason = clean_reason,
      reviewed_at = now(),
      reviewed_by = p_admin_user_id,
      raw = coalesce(raw, '{}'::jsonb) || jsonb_build_object(
        'status','REJECTED',
        'securePaymentMethodReject', true,
        'rejectedBy', p_admin_user_id,
        'rejectedByEmail', p_admin_email,
        'rejectedByName', p_admin_name,
        'rejectedAt', now(),
        'approvedAt', '',
        'rejectReason', clean_reason
      )
  where id = method.id;

  notif_id := 'notif_pm_rej_' || method.id;
  insert into public.notifications(id, audience, user_id, title, message, type, link_page, reference_id, read, created_at, raw)
  values (notif_id, 'USER', method.user_id, 'Bank account rejected', clean_reason, 'PAYMENT_METHOD', 'payments', 'pm_no_' || method.id, false, now(), jsonb_build_object('securePaymentMethodReject', true, 'reason', clean_reason))
  on conflict (id) do update set
    audience=excluded.audience, user_id=excluded.user_id, title=excluded.title, message=excluded.message, type=excluded.type, link_page=excluded.link_page, reference_id=excluded.reference_id, raw=excluded.raw;

  log_id := 'adminlog_pm_reject_' || method.id;
  insert into public.admin_action_logs(id, admin_user_id, action, target_type, target_id, meta, created_at)
  values (log_id, p_admin_user_id, 'PAYMENT_METHOD_REJECT_SECURE', 'PAYMENT_METHOD', method.id, jsonb_build_object('userId', method.user_id, 'bankName', method.bank_name, 'type', method.type, 'reason', clean_reason, 'adminEmail', p_admin_email, 'adminName', p_admin_name), now())
  on conflict (id) do update set meta=excluded.meta, created_at=excluded.created_at;

  queue_id := 'backend_pm_reject_' || method.id;
  insert into public.backend_action_queue(id, action_type, status, requested_by, target_user_id, payload, result, created_at, processed_at)
  values (queue_id, 'PAYMENT_METHOD_REJECT', 'COMPLETED', p_admin_user_id, method.user_id, jsonb_build_object('methodId', method.id, 'reason', clean_reason), jsonb_build_object('status', 'REJECTED'), now(), now())
  on conflict (id) do update set status='COMPLETED', result=excluded.result, processed_at=now();

  return jsonb_build_object('ok', true, 'methodId', method.id, 'userId', method.user_id, 'status', 'REJECTED', 'reason', clean_reason);
end;
$$;

grant execute on function public.aitradex_approve_kyc(text,text,text,text) to anon, authenticated;
grant execute on function public.aitradex_reject_kyc(text,text,text,text,text) to anon, authenticated;
grant execute on function public.aitradex_approve_payment_method(text,text,text,text) to anon, authenticated;
grant execute on function public.aitradex_reject_payment_method(text,text,text,text,text) to anon, authenticated;
grant execute on function public.aitradex_approve_deposit(text,text,text,text) to anon, authenticated;
grant execute on function public.aitradex_reject_deposit(text,text,text,text,text) to anon, authenticated;
grant execute on function public.aitradex_approve_withdrawal(text,text,text,text) to anon, authenticated;
grant execute on function public.aitradex_reject_withdrawal(text,text,text,text,text) to anon, authenticated;

insert into public.app_settings(id, settings, updated_at)
values ('main', jsonb_build_object('databaseRuntimeVersion','6.3','mode','phase6-withdrawal-backend-security','depositBackend','rpc-secure-function','withdrawalBackend','rpc-secure-function'), now())
on conflict (id) do update
set settings = coalesce(public.app_settings.settings, '{}'::jsonb) || jsonb_build_object('databaseRuntimeVersion','6.3','mode','phase6-withdrawal-backend-security','depositBackend','rpc-secure-function','withdrawalBackend','rpc-secure-function'),
    updated_at = now();

-- Phase 6.4: AI Live backend batch settlement.
-- Moves admin/manual AI Live close settlement into a single database-side action.
create or replace function public.aitradex_close_ai_live_batch(
  p_batch_id text,
  p_reason text default 'ADMIN_BATCH_CLOSE',
  p_exit_price numeric default 0,
  p_exit_price_display text default '',
  p_exit_price_source text default 'Admin close',
  p_admin_user_id text default 'control_root',
  p_admin_email text default '',
  p_admin_name text default 'Admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pos public.trade_orders%rowtype;
  batch public.ai_trade_batches%rowtype;
  v_exit_price numeric := coalesce(nullif(p_exit_price,0),0);
  entry_price numeric;
  margin numeric;
  leverage_value numeric;
  exposure numeric;
  raw_pnl numeric;
  final_pnl numeric;
  target_pnl numeric;
  target_type_clean text;
  direction numeric;
  settlement numeric;
  closed_count integer := 0;
  total_positions integer := 0;
  v_total_pnl numeric := 0;
  total_settlement numeric := 0;
  ledger_id text;
  notif_id text;
  log_id text;
  queue_id text;
  effective_reason text := coalesce(nullif(trim(p_reason), ''), 'ADMIN_BATCH_CLOSE');
  display_price text;
begin
  if not public.aitradex_validate_admin(p_admin_user_id) then
    raise exception 'Admin permission required for AI live close.';
  end if;

  select * into batch from public.ai_trade_batches where id = p_batch_id for update;

  select count(*) into total_positions
  from public.trade_orders
  where batch_id = p_batch_id
    and upper(coalesce(trade_type,'')) = 'AI_LIVE'
    and upper(coalesce(status,'OPEN')) = 'OPEN';

  if total_positions = 0 then
    return jsonb_build_object('ok', true, 'batchId', p_batch_id, 'closed', 0, 'message', 'No open AI live positions found.');
  end if;

  for pos in
    select * from public.trade_orders
    where batch_id = p_batch_id
      and upper(coalesce(trade_type,'')) = 'AI_LIVE'
      and upper(coalesce(status,'OPEN')) = 'OPEN'
    for update
  loop
    entry_price := coalesce(nullif(pos.entry_price,0), nullif(batch.entry_price,0), v_exit_price, 0);
    if v_exit_price <= 0 then
      v_exit_price := coalesce(nullif(pos.exit_price,0), entry_price, 0);
    end if;
    display_price := coalesce(nullif(p_exit_price_display,''), v_exit_price::text);

    margin := greatest(coalesce(pos.margin_amount,0),0);
    leverage_value := greatest(coalesce(pos.leverage,1),1);
    exposure := greatest(margin * leverage_value, coalesce(pos.position_size,0), 0);
    direction := case when upper(coalesce(pos.side,'BUY')) = 'SELL' then -1 else 1 end;

    if entry_price > 0 and v_exit_price > 0 and exposure > 0 then
      raw_pnl := exposure * ((v_exit_price - entry_price) / entry_price) * direction;
    else
      raw_pnl := 0;
    end if;

    target_pnl := greatest(coalesce(pos.target_percent,0),0) * exposure / 100;
    target_type_clean := upper(coalesce(pos.target_type,'PROFIT'));
    final_pnl := raw_pnl;

    if target_pnl > 0 then
      if target_type_clean = 'LOSS' then
        final_pnl := greatest(final_pnl, -least(coalesce(nullif(margin,0), target_pnl), target_pnl));
      else
        final_pnl := least(final_pnl, target_pnl);
      end if;
    end if;

    if final_pnl < 0 then
      final_pnl := greatest(final_pnl, -margin);
    end if;

    final_pnl := round(final_pnl::numeric, 2);
    if coalesce(pos.margin_locked,false) then
      settlement := greatest(0, margin + final_pnl);
    else
      settlement := final_pnl;
    end if;
    settlement := round(settlement::numeric, 2);

    ledger_id := 'ledger_ai_live_settle_' || pos.id;
    insert into public.wallet_ledger(id, user_id, account_type, type, amount, reference_id, note, balance_after, created_at, raw)
    values (
      ledger_id,
      pos.user_id,
      'REAL',
      'AI_LIVE_SETTLEMENT',
      settlement,
      pos.id,
      coalesce(pos.pair,'AI') || ' AI live ' || coalesce(pos.side,'') || ' closed by backend · AI amount ' || margin::text || ' · P/L ' || final_pnl::text,
      null,
      now(),
      jsonb_build_object('secureAiLiveClose', true, 'batchId', p_batch_id, 'reason', effective_reason, 'exitPrice', v_exit_price, 'pnl', final_pnl, 'settlement', settlement, 'adminUserId', p_admin_user_id)
    )
    on conflict on constraint wallet_ledger_user_id_account_type_type_reference_id_key do nothing;

    update public.trade_orders
    set status = 'CLOSED',
        trade_type = 'AI_LIVE',
        exit_price = v_exit_price,
        exit_price_display = display_price,
        pnl = final_pnl,
        settlement_amount = settlement,
        close_reason = effective_reason,
        closed_by = p_admin_user_id,
        source = 'ADMIN_AI_LIVE_CLOSE_BACKEND',
        closed_at = now(),
        raw = coalesce(raw, '{}'::jsonb) || jsonb_build_object(
          'secureAiLiveClose', true,
          'closedBy', p_admin_user_id,
          'closedByEmail', p_admin_email,
          'closedByName', p_admin_name,
          'closedAt', now(),
          'exitPrice', v_exit_price,
          'exitPriceDisplay', display_price,
          'exitPriceSource', p_exit_price_source,
          'rawPnl', round(raw_pnl::numeric,2),
          'pnl', final_pnl,
          'settlementAmount', settlement,
          'safeFormula', 'margin * leverage * priceMovePercent, capped by target and margin risk'
        )
    where id = pos.id;

    notif_id := 'notif_ai_live_close_' || pos.id;
    insert into public.notifications(id, audience, user_id, title, message, type, link_page, reference_id, read, created_at, raw)
    values (
      notif_id,
      'USER',
      pos.user_id,
      'AI live position closed',
      coalesce(pos.pair,'AI') || ' ' || coalesce(pos.side,'') || ' closed. P/L ' || final_pnl::text || '. Settlement ' || settlement::text || '.',
      'AI',
      'orders',
      'ai_close_' || pos.id,
      false,
      now(),
      jsonb_build_object('secureAiLiveClose', true, 'batchId', p_batch_id, 'pnl', final_pnl, 'settlement', settlement)
    )
    on conflict (id) do update set
      audience=excluded.audience, user_id=excluded.user_id, title=excluded.title, message=excluded.message, type=excluded.type, link_page=excluded.link_page, reference_id=excluded.reference_id, raw=excluded.raw, created_at=excluded.created_at;

    closed_count := closed_count + 1;
    v_total_pnl := v_total_pnl + final_pnl;
    total_settlement := total_settlement + settlement;
  end loop;

  update public.ai_trade_batches
  set status = 'CLOSED',
      total_pnl = round(v_total_pnl::numeric,2),
      closed_at = now(),
      raw = coalesce(raw, '{}'::jsonb) || jsonb_build_object(
        'secureAiLiveClose', true,
        'closedBy', p_admin_user_id,
        'closedByEmail', p_admin_email,
        'closedAt', now(),
        'closeReason', effective_reason,
        'exitPrice', v_exit_price,
        'exitPriceDisplay', display_price,
        'exitPriceSource', p_exit_price_source,
        'closedCount', closed_count,
        'totalSettlement', round(total_settlement::numeric,2)
      )
  where id = p_batch_id;

  log_id := 'adminlog_ai_live_close_' || p_batch_id || '_' || replace(effective_reason,' ','_');
  insert into public.admin_action_logs(id, admin_user_id, action, target_type, target_id, meta, created_at)
  values (log_id, p_admin_user_id, 'AI_LIVE_CLOSE_SECURE', 'AI_BATCH', p_batch_id, jsonb_build_object('closed', closed_count, 'totalPositions', total_positions, 'reason', effective_reason, 'exitPrice', v_exit_price, 'totalPnl', round(v_total_pnl::numeric,2), 'totalSettlement', round(total_settlement::numeric,2), 'adminEmail', p_admin_email, 'adminName', p_admin_name), now())
  on conflict (id) do update set meta=excluded.meta, created_at=excluded.created_at;

  queue_id := 'backend_ai_live_close_' || p_batch_id || '_' || replace(effective_reason,' ','_');
  insert into public.backend_action_queue(id, action_type, status, requested_by, target_user_id, payload, result, created_at, processed_at)
  values (queue_id, 'AI_LIVE_CLOSE', 'COMPLETED', p_admin_user_id, null, jsonb_build_object('batchId', p_batch_id, 'reason', effective_reason, 'exitPrice', v_exit_price), jsonb_build_object('closed', closed_count, 'totalPnl', round(v_total_pnl::numeric,2), 'totalSettlement', round(total_settlement::numeric,2)), now(), now())
  on conflict (id) do update set status='COMPLETED', result=excluded.result, processed_at=now();

  return jsonb_build_object('ok', true, 'batchId', p_batch_id, 'closed', closed_count, 'totalPositions', total_positions, 'exitPrice', v_exit_price, 'totalPnl', round(v_total_pnl::numeric,2), 'totalSettlement', round(total_settlement::numeric,2), 'status', 'CLOSED');
end;
$$;

grant execute on function public.aitradex_close_ai_live_batch(text,text,numeric,text,text,text,text,text) to anon, authenticated;

insert into public.app_settings(id, settings, updated_at)
values ('main', jsonb_build_object('databaseRuntimeVersion','6.4','mode','phase6-ai-backend-settlement','aiLiveBackend','rpc-secure-function'), now())
on conflict (id) do update
set settings = coalesce(public.app_settings.settings, '{}'::jsonb) || jsonb_build_object('databaseRuntimeVersion','6.4','mode','phase6-ai-backend-settlement','aiLiveBackend','rpc-secure-function'),
    updated_at = now();


-- Phase 6.5.5: Manual price unit cleanup.
-- All manual trade prices are stored and settled in raw quote units (USDT/USD/etc.).
-- INR is display-only. This helper guards old/new rows from INR-vs-raw mismatches.
create or replace function public.aitradex_trade_raw_price(
  p_pair text,
  p_price numeric,
  p_display text default ''
)
returns numeric
language plpgsql
stable
set search_path = public
as $$
declare
  n numeric := coalesce(p_price,0);
  rate numeric := 95;
  base_symbol text := upper(split_part(coalesce(p_pair,''), '/', 1));
  ceiling numeric := 1000;
  s jsonb;
begin
  if n <= 0 then
    return 0;
  end if;
  if upper(coalesce(p_pair,'')) not like '%/USDT' then
    return n;
  end if;
  select settings into s from public.app_settings where id='main';
  rate := greatest(coalesce((s->>'usdtInrRate')::numeric, 95), 1);
  ceiling := case base_symbol
    when 'BTC' then 200000
    when 'ETH' then 20000
    when 'BNB' then 5000
    when 'SOL' then 3000
    else 1000
  end;
  -- If numeric value is already in the normal raw range for the asset, keep it raw.
  -- Frontend sends raw entry/limit price plus INR display text for readability.
  if n <= ceiling then
    return n;
  end if;
  if position('₹' in coalesce(p_display,'')) > 0 or upper(coalesce(p_display,'')) like '%INR%' or n > ceiling then
    return round((n / rate)::numeric, 8);
  end if;
  return n;
end;
$$;

-- Phase 6.5.1: Limit order validation fix.
-- Limit orders are pending-only: BUY limit must be below current price; SELL limit must be above current price.
-- Triggered limit orders fill at the user's limit price, not at the current market price.
-- Phase 6.5: Manual trade backend settlement.
-- Moves manual market/limit open, manual close settlement, and limit cancel margin release into controlled database-side actions.
create or replace function public.aitradex_open_manual_trade(
  p_trade_id text,
  p_user_id text,
  p_account_type text default 'REAL',
  p_order_type text default 'MARKET',
  p_market text default 'CRYPTO',
  p_pair text default '',
  p_side text default 'BUY',
  p_margin numeric default 0,
  p_leverage numeric default 1,
  p_entry_price numeric default 0,
  p_entry_price_display text default '',
  p_limit_price numeric default 0,
  p_limit_price_display text default '',
  p_price_source text default 'Live price cache'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users%rowtype;
  v_balance numeric := 0;
  v_account text := upper(coalesce(nullif(trim(p_account_type),''),'REAL'));
  v_order text := upper(coalesce(nullif(trim(p_order_type),''),'MARKET'));
  v_side text := case when upper(coalesce(p_side,'BUY')) = 'SELL' then 'SELL' else 'BUY' end;
  v_status text;
  v_trade_type text := 'MANUAL';
  v_margin numeric := greatest(coalesce(p_margin,0),0);
  v_leverage numeric := greatest(coalesce(p_leverage,1),1);
  v_position_size numeric := 0;
  v_entry_price numeric := 0;
  v_limit_price numeric := 0;
  v_ledger_type text;
  v_ledger_id text;
  v_now timestamptz := now();
begin
  if coalesce(trim(p_trade_id),'') = '' then
    raise exception 'Trade ID is required.';
  end if;
  if coalesce(trim(p_user_id),'') = '' then
    raise exception 'User ID is required.';
  end if;
  if v_margin <= 0 then
    raise exception 'Manual trade margin must be greater than zero.';
  end if;
  v_entry_price := public.aitradex_trade_raw_price(p_pair, coalesce(p_entry_price,0), p_entry_price_display);
  v_limit_price := public.aitradex_trade_raw_price(p_pair, coalesce(p_limit_price,0), p_limit_price_display);

  if v_order = 'LIMIT' then
    if v_limit_price <= 0 then
      raise exception 'Valid limit price is required.';
    end if;
    if v_entry_price > 0 and v_side = 'BUY' and v_limit_price >= v_entry_price then
      raise exception 'BUY limit price must be below current price. Use Market order for instant buy.';
    end if;
    if v_entry_price > 0 and v_side = 'SELL' and v_limit_price <= v_entry_price then
      raise exception 'SELL limit price must be above current price. Use Market order for instant sell.';
    end if;
  else
    if v_entry_price <= 0 then
      raise exception 'Valid market entry price is required.';
    end if;
  end if;

  select * into v_user from public.users where id = p_user_id for update;
  if not found then
    raise exception 'User not found.';
  end if;
  if upper(coalesce(v_user.status,'ACTIVE')) not in ('ACTIVE','VERIFIED') then
    raise exception 'User account is not active.';
  end if;
  if exists (select 1 from public.trade_orders where id = p_trade_id) then
    raise exception 'This trade already exists.';
  end if;

  select coalesce(sum(amount),0) into v_balance
  from public.wallet_ledger
  where user_id = p_user_id and upper(coalesce(account_type,'REAL')) = v_account;

  if v_balance < v_margin then
    raise exception 'Insufficient % balance for this manual trade.', v_account;
  end if;

  v_status := case when v_order = 'LIMIT' then 'LIMIT_PENDING' else 'OPEN' end;
  v_ledger_type := case when v_order = 'LIMIT' then 'MANUAL_LIMIT_MARGIN_LOCK' else 'MANUAL_TRADE_MARGIN_LOCK' end;
  v_position_size := round((v_margin * v_leverage)::numeric, 2);
  v_ledger_id := 'ledger_manual_lock_' || p_trade_id;

  insert into public.wallet_ledger(id, user_id, account_type, type, amount, reference_id, note, balance_after, created_at, raw)
  values (
    v_ledger_id,
    p_user_id,
    v_account,
    v_ledger_type,
    -v_margin,
    p_trade_id,
    coalesce(p_pair,'Manual') || ' manual ' || v_side || ' ' || lower(v_order) || ' margin locked by backend',
    null,
    v_now,
    jsonb_build_object('secureManualOpen', true, 'orderType', v_order, 'margin', v_margin, 'leverage', v_leverage, 'positionSize', v_position_size)
  );

  insert into public.trade_orders(
    id,user_id,batch_id,trade_type,account_type,order_type,market,pair,side,status,source,
    entry_price,entry_price_display,limit_price,limit_price_display,leverage,margin_amount,margin_locked,position_size,pnl,settlement_amount,
    note,raw,created_at,opened_at
  ) values (
    p_trade_id,p_user_id,null,v_trade_type,v_account,v_order,p_market,p_pair,v_side,v_status,'USER_MANUAL_BACKEND',
    v_entry_price,
    coalesce(nullif(p_entry_price_display,''), v_entry_price::text),
    case when v_order = 'LIMIT' then v_limit_price else 0 end,
    case when v_order = 'LIMIT' then coalesce(nullif(p_limit_price_display,''), v_limit_price::text) else '' end,
    v_leverage,v_margin,true,v_position_size,0,0,
    'Manual trade opened through backend settlement function',
    jsonb_build_object('secureManualOpen', true, 'priceSource', p_price_source, 'createdBy', p_user_id, 'openedAt', v_now),
    v_now,
    case when v_order = 'LIMIT' then null else v_now end
  );

  return jsonb_build_object('ok', true, 'tradeId', p_trade_id, 'status', v_status, 'margin', v_margin, 'leverage', v_leverage, 'positionSize', v_position_size);
end;
$$;

create or replace function public.aitradex_close_manual_trade(
  p_trade_id text,
  p_user_id text,
  p_exit_price numeric default 0,
  p_exit_price_display text default '',
  p_exit_price_source text default 'Live price cache',
  p_reason text default 'USER_CLOSE'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pos public.trade_orders%rowtype;
  entry_price numeric;
  v_exit_price numeric := coalesce(p_exit_price,0);
  margin numeric;
  leverage_value numeric;
  exposure numeric;
  direction numeric;
  raw_pnl numeric;
  final_pnl numeric;
  settlement numeric;
  v_account text;
  v_ledger_id text;
  v_reason text := coalesce(nullif(trim(p_reason),''),'USER_CLOSE');
  v_now timestamptz := now();
begin
  select * into pos from public.trade_orders where id = p_trade_id for update;
  if not found then
    raise exception 'Manual position not found.';
  end if;
  if pos.user_id <> p_user_id then
    raise exception 'Manual position does not belong to this user.';
  end if;
  if upper(coalesce(pos.trade_type,'')) <> 'MANUAL' then
    raise exception 'Only manual positions can be closed here.';
  end if;
  if upper(coalesce(pos.status,'')) <> 'OPEN' then
    return jsonb_build_object('ok', true, 'tradeId', p_trade_id, 'status', pos.status, 'message', 'Position is not open.');
  end if;
  if v_exit_price <= 0 then
    raise exception 'Valid exit price is required.';
  end if;

  entry_price := public.aitradex_trade_raw_price(pos.pair, coalesce(nullif(pos.entry_price,0), v_exit_price), coalesce(pos.entry_price_display,''));
  v_exit_price := public.aitradex_trade_raw_price(pos.pair, v_exit_price, p_exit_price_display);
  if entry_price > 0 and v_exit_price > 0 then
    if v_exit_price / entry_price > 20 then
      v_exit_price := public.aitradex_trade_raw_price(pos.pair, v_exit_price, '₹');
    elsif entry_price / v_exit_price > 20 then
      entry_price := public.aitradex_trade_raw_price(pos.pair, entry_price, '₹');
    end if;
  end if;
  margin := greatest(coalesce(pos.margin_amount,0),0);
  leverage_value := greatest(coalesce(pos.leverage,1),1);
  exposure := greatest(margin * leverage_value, coalesce(pos.position_size,0), 0);
  direction := case when upper(coalesce(pos.side,'BUY')) = 'SELL' then -1 else 1 end;

  if entry_price > 0 and v_exit_price > 0 and exposure > 0 then
    raw_pnl := exposure * ((v_exit_price - entry_price) / entry_price) * direction;
  else
    raw_pnl := 0;
  end if;

  final_pnl := round(greatest(raw_pnl, -margin)::numeric, 2);
  if coalesce(pos.margin_locked,false) then
    settlement := greatest(0, margin + final_pnl);
  else
    settlement := final_pnl;
  end if;
  settlement := round(settlement::numeric, 2);
  v_account := upper(coalesce(pos.account_type,'REAL'));
  v_ledger_id := 'ledger_manual_settle_' || p_trade_id;

  insert into public.wallet_ledger(id,user_id,account_type,type,amount,reference_id,note,balance_after,created_at,raw)
  values (
    v_ledger_id,
    pos.user_id,
    v_account,
    'MANUAL_TRADE_SETTLEMENT',
    settlement,
    pos.id,
    coalesce(pos.pair,'Manual') || ' manual ' || coalesce(pos.side,'') || ' closed by backend · margin ' || margin::text || ' · P/L ' || final_pnl::text,
    null,
    v_now,
    jsonb_build_object('secureManualClose', true, 'reason', v_reason, 'entryPrice', entry_price, 'exitPrice', v_exit_price, 'rawPnl', round(raw_pnl::numeric,2), 'pnl', final_pnl, 'settlement', settlement)
  )
  on conflict on constraint wallet_ledger_user_id_account_type_type_reference_id_key do nothing;

  update public.trade_orders
  set status='CLOSED',
      exit_price=v_exit_price,
      exit_price_display=coalesce(nullif(p_exit_price_display,''), v_exit_price::text),
      pnl=final_pnl,
      settlement_amount=settlement,
      close_reason=v_reason,
      closed_by=p_user_id,
      source='USER_MANUAL_CLOSE_BACKEND',
      closed_at=v_now,
      raw=coalesce(raw,'{}'::jsonb) || jsonb_build_object('secureManualClose', true, 'exitPriceSource', p_exit_price_source, 'rawPnl', round(raw_pnl::numeric,2), 'pnl', final_pnl, 'settlementAmount', settlement, 'safeFormula', 'margin * leverage * priceMovePercent, capped at margin loss')
  where id = pos.id;

  insert into public.notifications(id,audience,user_id,title,message,type,link_page,reference_id,read,created_at,raw)
  values ('notif_manual_close_' || pos.id, 'USER', pos.user_id, 'Manual position closed', coalesce(pos.pair,'Manual') || ' ' || coalesce(pos.side,'') || ' closed. P/L ' || final_pnl::text || '. Settlement ' || settlement::text || '.', 'TRADE', 'orders', 'manual_close_' || pos.id, false, v_now, jsonb_build_object('secureManualClose', true, 'tradeId', pos.id, 'pnl', final_pnl, 'settlement', settlement))
  on conflict (id) do update set message=excluded.message, raw=excluded.raw, created_at=excluded.created_at;

  return jsonb_build_object('ok', true, 'tradeId', pos.id, 'status', 'CLOSED', 'pnl', final_pnl, 'settlement', settlement);
end;
$$;

create or replace function public.aitradex_cancel_manual_limit(
  p_trade_id text,
  p_user_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pos public.trade_orders%rowtype;
  margin numeric;
  v_account text;
  v_ledger_id text;
  v_now timestamptz := now();
begin
  select * into pos from public.trade_orders where id = p_trade_id for update;
  if not found then
    raise exception 'Pending manual order not found.';
  end if;
  if pos.user_id <> p_user_id then
    raise exception 'Pending order does not belong to this user.';
  end if;
  if upper(coalesce(pos.trade_type,'')) <> 'MANUAL' or upper(coalesce(pos.status,'')) not in ('PENDING','LIMIT_PENDING') then
    raise exception 'Only pending manual limit orders can be cancelled.';
  end if;

  margin := greatest(coalesce(pos.margin_amount,0),0);
  v_account := upper(coalesce(pos.account_type,'REAL'));
  v_ledger_id := 'ledger_manual_limit_release_' || pos.id;

  if coalesce(pos.margin_locked,false) and margin > 0 then
    insert into public.wallet_ledger(id,user_id,account_type,type,amount,reference_id,note,balance_after,created_at,raw)
    values (v_ledger_id, pos.user_id, v_account, 'MANUAL_LIMIT_MARGIN_RELEASE', margin, pos.id, coalesce(pos.pair,'Manual') || ' manual limit order cancelled · margin released by backend', null, v_now, jsonb_build_object('secureManualCancel', true, 'margin', margin))
    on conflict on constraint wallet_ledger_user_id_account_type_type_reference_id_key do nothing;
  end if;

  update public.trade_orders
  set status='CANCELLED',
      close_reason='LIMIT_CANCELLED',
      closed_at=v_now,
      source='USER_MANUAL_LIMIT_CANCEL_BACKEND',
      raw=coalesce(raw,'{}'::jsonb) || jsonb_build_object('secureManualCancel', true, 'cancelledAt', v_now, 'marginReleased', margin)
  where id = pos.id;

  return jsonb_build_object('ok', true, 'tradeId', pos.id, 'status', 'CANCELLED', 'released', margin);
end;
$$;

grant execute on function public.aitradex_open_manual_trade(text,text,text,text,text,text,text,numeric,numeric,numeric,text,numeric,text,text) to anon, authenticated;
grant execute on function public.aitradex_close_manual_trade(text,text,numeric,text,text,text) to anon, authenticated;
grant execute on function public.aitradex_cancel_manual_limit(text,text) to anon, authenticated;

insert into public.app_settings(id, settings, updated_at)
values ('main', jsonb_build_object('databaseRuntimeVersion','6.8','mode','phase6-subscription-backend','manualTradeBackend','rpc-secure-function','kycBackend','rpc-secure-function','paymentMethodBackend','rpc-secure-function','manualPriceUnit','raw-storage-display-only-inr-fixed'), now())
on conflict (id) do update
set settings = coalesce(public.app_settings.settings, '{}'::jsonb) || jsonb_build_object('databaseRuntimeVersion','6.8','mode','phase6-subscription-backend','manualTradeBackend','rpc-secure-function','kycBackend','rpc-secure-function','paymentMethodBackend','rpc-secure-function','manualPriceUnit','raw-storage-display-only-inr-fixed'),
    updated_at = now();


-- Phase 6.7: Backend-secure plan/subscription purchase and admin plan change.
create or replace function public.aitradex_purchase_plan(
  p_subscription_id text,
  p_user_id text,
  p_plan_id text,
  p_source text default 'USER_PURCHASE'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users%rowtype;
  v_plan public.plans%rowtype;
  v_price numeric := 0;
  v_balance numeric := 0;
  v_days integer := 30;
  v_starts timestamptz := now();
  v_expires timestamptz;
  v_ledger_id text;
  v_sub_id text := coalesce(nullif(trim(p_subscription_id),''), 'sub_' || md5(random()::text || clock_timestamp()::text));
  v_raw jsonb;
begin
  select * into v_user from public.users where id = p_user_id for update;
  if not found then raise exception 'User not found.'; end if;
  if upper(coalesce(v_user.status,'ACTIVE')) <> 'ACTIVE' then raise exception 'User is not active.'; end if;

  select * into v_plan from public.plans where id = p_plan_id;
  if not found then raise exception 'Plan not found.'; end if;
  if coalesce(v_plan.is_active,true) = false or upper(coalesce(v_plan.status,'ACTIVE')) <> 'ACTIVE' then raise exception 'Plan is not active.'; end if;
  if v_plan.id = 'free' then raise exception 'Free plan does not require purchase.'; end if;

  v_price := greatest(coalesce(v_plan.price,0),0);
  if v_price <= 0 then raise exception 'Invalid plan price.'; end if;

  select coalesce(sum(amount),0) into v_balance from public.wallet_ledger where user_id=p_user_id and upper(coalesce(account_type,'REAL'))='REAL';
  if v_balance < v_price then raise exception 'Insufficient real wallet balance.'; end if;

  v_ledger_id := 'ledger_subscription_' || v_sub_id;
  if exists(select 1 from public.wallet_ledger where user_id=p_user_id and account_type='REAL' and type='SUBSCRIPTION_PURCHASE' and reference_id=v_sub_id) then
    return jsonb_build_object('ok', true, 'alreadyCompleted', true, 'subscriptionId', v_sub_id);
  end if;

  update public.subscriptions
  set status='REPLACED',
      raw=coalesce(raw,'{}'::jsonb) || jsonb_build_object('replacedAt', now(), 'replacedBySubscription', v_sub_id, 'secureSubscriptionPurchase', true)
  where user_id=p_user_id and status='ACTIVE';

  v_days := greatest(coalesce(nullif(v_plan.raw->>'durationDays','')::integer, coalesce(v_plan.duration_days,30), 30), 1);
  v_expires := v_starts + make_interval(days => v_days);
  v_raw := coalesce(v_plan.raw,'{}'::jsonb) || jsonb_build_object(
    'id', v_sub_id,
    'userId', p_user_id,
    'planId', v_plan.id,
    'planName', v_plan.name,
    'price', v_price,
    'amount', v_price,
    'aiTradeLimit', coalesce(v_plan.signals,0),
    'signals', coalesce(v_plan.signals,0),
    'durationDays', v_days,
    'status', 'ACTIVE',
    'source', coalesce(p_source,'USER_PURCHASE_BACKEND'),
    'createdAt', v_starts,
    'startsAt', v_starts,
    'expiresAt', v_expires,
    'ledgerReferenceId', v_sub_id,
    'secureSubscriptionPurchase', true
  );

  insert into public.wallet_ledger(id,user_id,account_type,type,amount,reference_id,note,balance_after,created_at,raw)
  values (v_ledger_id,p_user_id,'REAL','SUBSCRIPTION_PURCHASE',-v_price,v_sub_id,coalesce(v_plan.name,'Plan') || ' subscription purchased by backend',null,v_starts,jsonb_build_object('secureSubscriptionPurchase',true,'planId',v_plan.id,'planName',v_plan.name,'amount',v_price))
  on conflict on constraint wallet_ledger_user_id_account_type_type_reference_id_key do nothing;

  insert into public.subscriptions(id,user_id,plan_id,plan_name,amount,status,starts_at,expires_at,created_at,raw)
  values (v_sub_id,p_user_id,v_plan.id,v_plan.name,v_price,'ACTIVE',v_starts,v_expires,v_starts,v_raw)
  on conflict (id) do update set user_id=excluded.user_id, plan_id=excluded.plan_id, plan_name=excluded.plan_name, amount=excluded.amount, status='ACTIVE', starts_at=excluded.starts_at, expires_at=excluded.expires_at, raw=excluded.raw;

  insert into public.notifications(id,audience,user_id,title,message,type,link_page,reference_id,read,created_at,raw)
  values ('notif_sub_ok_' || v_sub_id,'USER',p_user_id,'Subscription activated',coalesce(v_plan.name,'Plan') || ' activated successfully.','PLAN','subscription','sub_ok_' || v_sub_id,false,v_starts,jsonb_build_object('secureSubscriptionPurchase',true,'planId',v_plan.id))
  on conflict (id) do update set message=excluded.message, raw=excluded.raw, created_at=excluded.created_at;

  insert into public.backend_action_queue(id, action_type, status, requested_by, target_user_id, payload, result, created_at, processed_at)
  values ('backend_sub_purchase_' || v_sub_id, 'SUBSCRIPTION_PURCHASE', 'COMPLETED', p_user_id, p_user_id, jsonb_build_object('subscriptionId', v_sub_id, 'planId', v_plan.id), jsonb_build_object('status','ACTIVE','amount',v_price), v_starts, v_starts)
  on conflict (id) do update set status='COMPLETED', result=excluded.result, processed_at=now();

  return jsonb_build_object('ok', true, 'subscriptionId', v_sub_id, 'userId', p_user_id, 'planId', v_plan.id, 'status', 'ACTIVE', 'amount', v_price);
end;
$$;

create or replace function public.aitradex_change_user_plan(
  p_user_id text,
  p_plan_id text,
  p_admin_user_id text default 'control_root',
  p_admin_email text default '',
  p_admin_name text default 'Admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users%rowtype;
  v_plan public.plans%rowtype;
  v_days integer := 30;
  v_starts timestamptz := now();
  v_expires timestamptz;
  v_sub_id text := 'sub_admin_' || md5(random()::text || clock_timestamp()::text);
  v_raw jsonb;
begin
  if not public.aitradex_validate_admin(p_admin_user_id) then
    raise exception 'Admin permission required for plan change.';
  end if;
  select * into v_user from public.users where id=p_user_id for update;
  if not found then raise exception 'User not found.'; end if;
  select * into v_plan from public.plans where id=p_plan_id;
  if not found then raise exception 'Plan not found.'; end if;

  update public.subscriptions
  set status='ADMIN_REPLACED',
      raw=coalesce(raw,'{}'::jsonb) || jsonb_build_object('replacedAt', now(), 'replacedByAdmin', p_admin_user_id, 'secureAdminPlanChange', true)
  where user_id=p_user_id and status='ACTIVE';

  if v_plan.id <> 'free' then
    v_days := greatest(coalesce(nullif(v_plan.raw->>'durationDays','')::integer, coalesce(v_plan.duration_days,30), 30), 1);
    v_expires := v_starts + make_interval(days => v_days);
    v_raw := coalesce(v_plan.raw,'{}'::jsonb) || jsonb_build_object(
      'id', v_sub_id,
      'userId', p_user_id,
      'planId', v_plan.id,
      'planName', v_plan.name,
      'price', coalesce(v_plan.price,0),
      'amount', coalesce(v_plan.price,0),
      'aiTradeLimit', coalesce(v_plan.signals,0),
      'signals', coalesce(v_plan.signals,0),
      'durationDays', v_days,
      'status', 'ACTIVE',
      'source', 'ADMIN_PLAN_CHANGE_BACKEND',
      'createdAt', v_starts,
      'startsAt', v_starts,
      'expiresAt', v_expires,
      'secureAdminPlanChange', true,
      'changedBy', p_admin_user_id
    );
    insert into public.subscriptions(id,user_id,plan_id,plan_name,amount,status,starts_at,expires_at,created_at,raw)
    values (v_sub_id,p_user_id,v_plan.id,v_plan.name,coalesce(v_plan.price,0),'ACTIVE',v_starts,v_expires,v_starts,v_raw);
  end if;

  update public.users
  set plan_changed_at = v_starts,
      plan_changed_by = p_admin_user_id,
      updated_at = v_starts
  where id=p_user_id;

  insert into public.notifications(id,audience,user_id,title,message,type,link_page,reference_id,read,created_at,raw)
  values ('notif_plan_change_' || p_user_id || '_' || replace(v_starts::text,' ','_'),'USER',p_user_id,'Subscription plan updated','Your plan was changed to ' || coalesce(v_plan.name,'Free') || ' by admin.','PLAN','subscription','plan_' || p_user_id || '_' || extract(epoch from v_starts)::bigint,false,v_starts,jsonb_build_object('secureAdminPlanChange',true,'planId',v_plan.id))
  on conflict (id) do nothing;

  insert into public.admin_action_logs(id,admin_user_id,action,target_type,target_id,meta,created_at)
  values ('adminlog_plan_change_' || p_user_id || '_' || extract(epoch from v_starts)::bigint,p_admin_user_id,'PLAN_CHANGE_SECURE','USER',p_user_id,jsonb_build_object('planId',v_plan.id,'planName',v_plan.name,'adminEmail',p_admin_email,'adminName',p_admin_name),v_starts)
  on conflict (id) do nothing;

  insert into public.backend_action_queue(id, action_type, status, requested_by, target_user_id, payload, result, created_at, processed_at)
  values ('backend_plan_change_' || p_user_id || '_' || extract(epoch from v_starts)::bigint, 'PLAN_CHANGE', 'COMPLETED', p_admin_user_id, p_user_id, jsonb_build_object('planId', v_plan.id), jsonb_build_object('status','ACTIVE','subscriptionId',case when v_plan.id='free' then null else v_sub_id end), v_starts, v_starts)
  on conflict (id) do nothing;

  return jsonb_build_object('ok', true, 'userId', p_user_id, 'planId', v_plan.id, 'subscriptionId', case when v_plan.id='free' then null else v_sub_id end);
end;
$$;

grant execute on function public.aitradex_purchase_plan(text,text,text,text) to anon, authenticated;
grant execute on function public.aitradex_change_user_plan(text,text,text,text,text) to anon, authenticated;

insert into public.app_settings(id, settings, updated_at)
values ('main', jsonb_build_object('databaseRuntimeVersion','6.8','mode','phase6-subscription-backend','subscriptionBackend','rpc-secure-function'), now())
on conflict (id) do update
set settings = coalesce(public.app_settings.settings, '{}'::jsonb) || jsonb_build_object('databaseRuntimeVersion','6.8','mode','phase6-subscription-backend','subscriptionBackend','rpc-secure-function'),
    updated_at = now();



-- Phase 6.8: Admin Wallet Adjustment + Telegram backend audit foundation.
create table if not exists public.telegram_alert_logs (
  id text primary key,
  status text not null default 'PENDING',
  source text,
  message text,
  error text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  processed_at timestamptz
);
create index if not exists telegram_alert_logs_created_at_idx on public.telegram_alert_logs(created_at desc);
create index if not exists telegram_alert_logs_status_idx on public.telegram_alert_logs(status, created_at desc);

create or replace function public.aitradex_admin_wallet_adjust(
  p_user_id text,
  p_action text,
  p_amount numeric,
  p_note text default '',
  p_reference_id text default '',
  p_admin_user_id text default 'control_root',
  p_admin_email text default '',
  p_admin_name text default 'Admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users%rowtype;
  v_action text := upper(coalesce(p_action,'ADD'));
  v_amount numeric := abs(coalesce(p_amount,0));
  v_signed numeric;
  v_balance numeric := 0;
  v_after numeric := 0;
  v_ref text := coalesce(nullif(trim(p_reference_id),''),'admin_wallet_' || md5(random()::text || clock_timestamp()::text));
  v_type text;
  v_note text;
  v_now timestamptz := now();
begin
  if not public.aitradex_validate_admin(p_admin_user_id) then
    raise exception 'Admin permission required for wallet adjustment.';
  end if;
  if v_action not in ('ADD','DEDUCT') then
    raise exception 'Invalid wallet action.';
  end if;
  if v_amount <= 0 then
    raise exception 'Wallet amount must be greater than zero.';
  end if;
  select * into v_user from public.users where id=p_user_id for update;
  if not found then raise exception 'User not found.'; end if;
  select coalesce(sum(amount),0) into v_balance from public.wallet_ledger where user_id=p_user_id and upper(coalesce(account_type,'REAL'))='REAL';
  v_signed := case when v_action='DEDUCT' then -v_amount else v_amount end;
  v_after := v_balance + v_signed;
  if v_after < 0 then raise exception 'Insufficient user real wallet balance.'; end if;
  v_type := case when v_action='DEDUCT' then 'ADMIN_WALLET_DEBIT' else 'ADMIN_WALLET_CREDIT' end;
  v_note := coalesce(nullif(trim(p_note),''),'Admin wallet ' || lower(v_action));

  if exists(select 1 from public.wallet_ledger where user_id=p_user_id and account_type='REAL' and type=v_type and reference_id=v_ref) then
    return jsonb_build_object('ok', true, 'alreadyCompleted', true, 'referenceId', v_ref, 'balanceAfter', v_balance);
  end if;

  insert into public.wallet_ledger(id,user_id,account_type,type,amount,reference_id,note,balance_after,created_at,raw)
  values ('ledger_' || v_ref,p_user_id,'REAL',v_type,v_signed,v_ref,v_note,v_after,v_now,jsonb_build_object('secureAdminWalletAdjust',true,'action',v_action,'adminUserId',p_admin_user_id,'adminEmail',p_admin_email,'adminName',p_admin_name))
  on conflict on constraint wallet_ledger_user_id_account_type_type_reference_id_key do nothing;

  insert into public.notifications(id,audience,user_id,title,message,type,link_page,reference_id,read,created_at,raw)
  values ('notif_wallet_' || v_ref,'USER',p_user_id,case when v_action='DEDUCT' then 'Wallet debited by admin' else 'Wallet credited by admin' end,
          v_amount::text || case when v_action='DEDUCT' then ' deducted from' else ' added to' end || ' your real wallet.' || case when length(v_note)>0 then ' Note: ' || v_note else '' end,
          'WALLET','wallet',v_ref,false,v_now,jsonb_build_object('secureAdminWalletAdjust',true,'action',v_action))
  on conflict (id) do update set message=excluded.message, raw=excluded.raw, created_at=excluded.created_at;

  insert into public.admin_action_logs(id,admin_user_id,action,target_type,target_id,meta,created_at)
  values ('adminlog_wallet_' || v_ref,p_admin_user_id,case when v_action='DEDUCT' then 'WALLET_DEBIT_SECURE' else 'WALLET_CREDIT_SECURE' end,'USER',p_user_id,jsonb_build_object('amount',v_amount,'signedAmount',v_signed,'balanceBefore',v_balance,'balanceAfter',v_after,'note',v_note,'adminEmail',p_admin_email,'adminName',p_admin_name),v_now)
  on conflict (id) do update set meta=excluded.meta, created_at=excluded.created_at;

  insert into public.backend_action_queue(id, action_type, status, requested_by, target_user_id, payload, result, created_at, processed_at)
  values ('backend_wallet_' || v_ref,'ADMIN_WALLET_ADJUST','COMPLETED',p_admin_user_id,p_user_id,jsonb_build_object('action',v_action,'amount',v_amount,'note',v_note),jsonb_build_object('balanceAfter',v_after,'ledgerType',v_type),v_now,v_now)
  on conflict (id) do update set status='COMPLETED', result=excluded.result, processed_at=now();

  return jsonb_build_object('ok', true, 'userId', p_user_id, 'action', v_action, 'amount', v_amount, 'signedAmount', v_signed, 'referenceId', v_ref, 'balanceAfter', v_after);
end;
$$;

grant execute on function public.aitradex_admin_wallet_adjust(text,text,numeric,text,text,text,text,text) to anon, authenticated;

insert into public.app_settings(id, settings, updated_at)
values ('main', jsonb_build_object('databaseRuntimeVersion','6.8','mode','phase6-wallet-telegram-backend','adminWalletBackend','rpc-secure-function','telegramBackend','edge-template-plus-db-audit'), now())
on conflict (id) do update
set settings = coalesce(public.app_settings.settings, '{}'::jsonb) || jsonb_build_object('databaseRuntimeVersion','6.8','mode','phase6-wallet-telegram-backend','adminWalletBackend','rpc-secure-function','telegramBackend','edge-template-plus-db-audit'),
    updated_at = now();

-- =============================================================
-- Phase 6.9 RLS readiness runtime marker
-- This does not enable strict production RLS. It only marks the current DB/runtime mode.
-- =============================================================
insert into public.app_settings (id, settings, updated_at)
values ('main', jsonb_build_object(
  'databaseRuntimeVersion','6.9',
  'mode','phase6-rls-readiness-pack',
  'rlsReadiness','audit-plus-final-lock-template',
  'strictRlsActive','false'
), now())
on conflict (id) do update
set settings = coalesce(public.app_settings.settings, '{}'::jsonb) || jsonb_build_object(
  'databaseRuntimeVersion','6.9',
  'mode','phase6-rls-readiness-pack',
  'rlsReadiness','audit-plus-final-lock-template',
  'strictRlsActive','false'
),
updated_at = now();
