-- AITradeX Phase 6.9.2 Final Money + Security Compatibility Pack
-- Run this in Supabase SQL Editor AFTER deploying the updated ZIP.
-- Safe to run multiple times. It does not delete existing data.
-- Strict RLS is intentionally NOT enabled here because the current app still uses legacy/testing frontend auth.

-- 1) Required columns for stable refresh + admin audit
alter table if exists public.kyc_requests add column if not exists raw jsonb default '{}'::jsonb;
alter table if exists public.kyc_requests add column if not exists admin_note text;
alter table if exists public.kyc_requests add column if not exists reviewed_by text;
alter table if exists public.kyc_requests add column if not exists reviewed_at timestamptz;

alter table if exists public.deposit_requests add column if not exists raw jsonb default '{}'::jsonb;
alter table if exists public.deposit_requests add column if not exists admin_note text;
alter table if exists public.deposit_requests add column if not exists reviewed_by text;
alter table if exists public.deposit_requests add column if not exists reviewed_at timestamptz;
alter table if exists public.deposit_requests add column if not exists proof_image text;
alter table if exists public.deposit_requests add column if not exists balance_applied boolean default false;
alter table if exists public.deposit_requests add column if not exists first_deposit_referral_checked boolean default false;

alter table if exists public.withdrawal_requests add column if not exists raw jsonb default '{}'::jsonb;
alter table if exists public.withdrawal_requests add column if not exists admin_note text;
alter table if exists public.withdrawal_requests add column if not exists rejection_reason text;
alter table if exists public.withdrawal_requests add column if not exists reviewed_by text;
alter table if exists public.withdrawal_requests add column if not exists reviewed_at timestamptz;
alter table if exists public.withdrawal_requests add column if not exists hold_applied boolean default true;

alter table if exists public.wallet_ledger add column if not exists raw jsonb default '{}'::jsonb;
alter table if exists public.wallet_ledger add column if not exists balance_after numeric;
alter table if exists public.notifications add column if not exists raw jsonb default '{}'::jsonb;
alter table if exists public.admin_action_logs add column if not exists raw jsonb default '{}'::jsonb;
alter table if exists public.trade_orders add column if not exists raw jsonb default '{}'::jsonb;
alter table if exists public.ai_trade_batches add column if not exists raw jsonb default '{}'::jsonb;

-- 2) Required compatibility tables
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

create table if not exists public.telegram_alert_logs (
  id text primary key,
  status text default 'PENDING',
  source text default 'edge-function',
  message text,
  error text,
  result jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  processed_at timestamptz
);

-- 3) Idempotency indexes
create unique index if not exists wallet_ledger_once_idx on public.wallet_ledger(user_id, account_type, type, reference_id);
create index if not exists deposit_requests_status_idx on public.deposit_requests(status, created_at desc);
create index if not exists withdrawal_requests_status_idx on public.withdrawal_requests(status, created_at desc);
create index if not exists kyc_requests_status_idx on public.kyc_requests(status, created_at desc);
create index if not exists trade_orders_batch_status_idx on public.trade_orders(batch_id, status, trade_type);
create index if not exists backend_action_queue_status_idx on public.backend_action_queue(status, created_at desc);
create index if not exists telegram_alert_logs_status_idx on public.telegram_alert_logs(status, created_at desc);

-- 4) Replace stable backend RPC functions
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
  on conflict (user_id, account_type, type, reference_id) do nothing;
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
  on conflict (user_id, account_type, type, reference_id) do nothing;
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
  on conflict (user_id, account_type, type, reference_id) do nothing;

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
    on conflict (user_id, account_type, type, reference_id) do nothing;

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

-- 5) Grants needed by current legacy/testing frontend runtime.
-- Later, after Supabase Auth migration, move these to authenticated-only/service-role edge functions.
grant execute on function public.aitradex_validate_admin(text) to anon, authenticated;
grant execute on function public.aitradex_approve_kyc(text,text,text,text) to anon, authenticated;
grant execute on function public.aitradex_reject_kyc(text,text,text,text,text) to anon, authenticated;
grant execute on function public.aitradex_approve_deposit(text,text,text,text) to anon, authenticated;
grant execute on function public.aitradex_reject_deposit(text,text,text,text,text) to anon, authenticated;
grant execute on function public.aitradex_approve_withdrawal(text,text,text,text) to anon, authenticated;
grant execute on function public.aitradex_reject_withdrawal(text,text,text,text,text) to anon, authenticated;
grant execute on function public.aitradex_admin_wallet_adjust(text,text,numeric,text,text,text,text,text) to anon, authenticated;
grant execute on function public.aitradex_close_ai_live_batch(text,text,numeric,text,text,text,text,text) to anon, authenticated;

-- 6) Runtime marker
insert into public.app_settings(id, settings, updated_at)
values (
  'main',
  jsonb_build_object(
    'databaseRuntimeVersion','6.9.2',
    'mode','final-money-security-compatibility-pack',
    'kycBackend','rpc-stable',
    'depositBackend','rpc-idempotent-ledger',
    'withdrawalBackend','rpc-idempotent-ledger',
    'aiLiveBackend','rpc-idempotent-close',
    'adminWalletBackend','rpc-ledger-audited',
    'telegramBackend','edge-function-required',
    'rlsMode','legacy-compatible-soft-hardening'
  ),
  now()
)
on conflict (id) do update
set settings = coalesce(public.app_settings.settings, '{}'::jsonb) || jsonb_build_object(
      'databaseRuntimeVersion','6.9.2',
      'mode','final-money-security-compatibility-pack',
      'kycBackend','rpc-stable',
      'depositBackend','rpc-idempotent-ledger',
      'withdrawalBackend','rpc-idempotent-ledger',
      'aiLiveBackend','rpc-idempotent-close',
      'adminWalletBackend','rpc-ledger-audited',
      'telegramBackend','edge-function-required',
      'rlsMode','legacy-compatible-soft-hardening'
    ),
    updated_at = now();
