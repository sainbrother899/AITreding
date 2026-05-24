-- AITradeX Phase 6.9.5 Referral Backend Secure Fix
-- Run this in Supabase SQL Editor.
-- Purpose:
-- 1) Deposit approval credits referral bonus inside backend RPC.
-- 2) Subscription purchase credits referral bonus inside backend RPC.
-- 3) Duplicate bonus is blocked with wallet_ledger unique reference.
-- 4) Repair function can safely backfill missed referral bonuses.
-- Safe to run multiple times. It does not delete data.

begin;

alter table public.referrals add column if not exists raw jsonb default '{}'::jsonb;
alter table public.referrals add column if not exists commission_paid boolean default false;
alter table public.referrals add column if not exists commission_amount numeric default 0;
alter table public.referrals add column if not exists created_at timestamptz default now();

alter table public.wallet_ledger add column if not exists raw jsonb default '{}'::jsonb;
alter table public.deposit_requests add column if not exists first_deposit_referral_checked boolean default false;
alter table public.deposit_requests add column if not exists reviewed_at timestamptz;
alter table public.deposit_requests add column if not exists reviewed_by text;
alter table public.deposit_requests add column if not exists admin_note text;
alter table public.deposit_requests add column if not exists raw jsonb default '{}'::jsonb;
alter table public.subscriptions add column if not exists raw jsonb default '{}'::jsonb;
alter table public.plans add column if not exists status text default 'ACTIVE';
alter table public.plans add column if not exists duration_days integer default 30;
alter table public.plans add column if not exists raw jsonb default '{}'::jsonb;

create unique index if not exists wallet_ledger_user_account_type_ref_idx
on public.wallet_ledger(user_id, account_type, type, reference_id);

create index if not exists referrals_referred_user_idx on public.referrals(referred_user_id);
create index if not exists referrals_referrer_user_idx on public.referrals(referrer_user_id);

create or replace function public.aitradex_credit_referral_bonus(
  p_referred_user_id text,
  p_event_type text,
  p_base_amount numeric,
  p_reference_id text,
  p_source_label text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings jsonb := '{}'::jsonb;
  v_referral public.referrals%rowtype;
  v_referrer_id text;
  v_key text;
  v_percent numeric := 0;
  v_bonus numeric := 0;
  v_ledger_id text;
  v_ledger_ref text;
  v_inserted integer := 0;
  v_now timestamptz := now();
  v_type text;
  v_status text;
  v_bonus_json jsonb;
  v_existing_bonus numeric := 0;
begin
  if coalesce(p_base_amount,0) <= 0 then
    return jsonb_build_object('ok', true, 'credited', false, 'reason', 'Base amount is zero');
  end if;

  v_key := case when upper(coalesce(p_event_type,'')) = 'SUBSCRIPTION' then 'subscription' else 'deposit' end;

  select coalesce(settings,'{}'::jsonb) into v_settings
  from public.app_settings
  where id = 'main';

  if v_key = 'deposit' and coalesce((v_settings->>'referralDepositEnabled')::boolean, true) = false then
    return jsonb_build_object('ok', true, 'credited', false, 'reason', 'Deposit referral disabled');
  end if;

  if v_key = 'subscription' and coalesce((v_settings->>'referralSubscriptionEnabled')::boolean, true) = false then
    return jsonb_build_object('ok', true, 'credited', false, 'reason', 'Subscription referral disabled');
  end if;

  select * into v_referral
  from public.referrals
  where referred_user_id = p_referred_user_id
  order by created_at asc
  limit 1
  for update;

  if not found then
    select referred_by into v_referrer_id
    from public.users
    where id = p_referred_user_id;

    if nullif(trim(coalesce(v_referrer_id,'')), '') is null then
      return jsonb_build_object('ok', true, 'credited', false, 'reason', 'No referrer');
    end if;

    insert into public.referrals(id, referrer_user_id, referred_user_id, status, commission_paid, commission_amount, raw, created_at)
    values (
      'ref_' || md5(v_referrer_id || '_' || p_referred_user_id),
      v_referrer_id,
      p_referred_user_id,
      'REGISTERED',
      false,
      0,
      jsonb_build_object('createdByBackendRepair', true, 'createdAt', v_now),
      v_now
    )
    on conflict (id) do update set
      referrer_user_id = excluded.referrer_user_id,
      referred_user_id = excluded.referred_user_id
    returning * into v_referral;
  end if;

  if v_referral.referrer_user_id is null or v_referral.referred_user_id is null then
    return jsonb_build_object('ok', true, 'credited', false, 'reason', 'Referral row incomplete');
  end if;

  if v_referral.referrer_user_id = v_referral.referred_user_id then
    return jsonb_build_object('ok', true, 'credited', false, 'reason', 'Self referral blocked');
  end if;

  if coalesce(v_referral.raw->'bonuses'->v_key->>'credited','false')::boolean = true then
    return jsonb_build_object('ok', true, 'credited', false, 'alreadyCredited', true, 'reason', 'Bonus already credited');
  end if;

  if v_key = 'subscription' then
    v_percent := coalesce(nullif(v_settings->>'referralSubscriptionPercent','')::numeric, 10);
    v_type := 'REFERRAL_SUBSCRIPTION_BONUS';
  else
    v_percent := coalesce(nullif(v_settings->>'referralDepositPercent','')::numeric, nullif(v_settings->>'referralFirstDepositPercent','')::numeric, 10);
    v_type := 'REFERRAL_DEPOSIT_BONUS';
  end if;

  v_bonus := round((p_base_amount * greatest(v_percent,0) / 100)::numeric, 2);
  if v_bonus <= 0 then
    return jsonb_build_object('ok', true, 'credited', false, 'reason', 'Bonus percent is zero');
  end if;

  v_ledger_ref := 'ref_' || v_key || '_' || v_referral.id || '_' || coalesce(nullif(trim(p_reference_id),''), extract(epoch from v_now)::text);
  v_ledger_id := 'ledger_' || md5(v_ledger_ref);

  insert into public.wallet_ledger(id, user_id, account_type, type, amount, reference_id, note, balance_after, created_at, raw)
  values (
    v_ledger_id,
    v_referral.referrer_user_id,
    'REAL',
    v_type,
    v_bonus,
    v_ledger_ref,
    'Referral ' || v_key || ' bonus · ' || v_percent::text || '% of ' || p_base_amount::text || case when coalesce(p_source_label,'') <> '' then ' · ' || p_source_label else '' end,
    null,
    v_now,
    jsonb_build_object('referralBackendSecure', true, 'referralId', v_referral.id, 'referredUserId', p_referred_user_id, 'eventType', upper(v_key), 'baseAmount', p_base_amount, 'percent', v_percent, 'referenceId', p_reference_id, 'sourceLabel', p_source_label)
  )
  on conflict (user_id, account_type, type, reference_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted <= 0 then
    -- Ledger already exists. Mark raw as credited to keep referral page consistent.
    v_existing_bonus := coalesce((v_referral.raw->'bonuses'->v_key->>'amount')::numeric, v_bonus);
  end if;

  v_bonus_json := jsonb_build_object(
    'credited', true,
    'amount', case when v_inserted > 0 then v_bonus else v_existing_bonus end,
    'percent', v_percent,
    'baseAmount', p_base_amount,
    'referenceId', p_reference_id,
    'ledgerReferenceId', v_ledger_ref,
    'creditedAt', v_now,
    'eventType', upper(v_key),
    'backendSecure', true
  );

  v_status := case
    when v_key = 'deposit' then 'DEPOSIT_BONUS_CREDITED'
    when v_key = 'subscription' then 'SUBSCRIPTION_BONUS_CREDITED'
    else 'BONUS_CREDITED'
  end;

  update public.referrals
  set raw = jsonb_set(
              jsonb_set(coalesce(raw,'{}'::jsonb), '{bonuses}', coalesce(raw->'bonuses','{}'::jsonb), true),
              array['bonuses', v_key],
              v_bonus_json,
              true
            ),
      status = v_status,
      commission_paid = true,
      commission_amount = coalesce(commission_amount,0) + case when v_inserted > 0 then v_bonus else 0 end
  where id = v_referral.id;

  return jsonb_build_object('ok', true, 'credited', v_inserted > 0, 'referralId', v_referral.id, 'referrerUserId', v_referral.referrer_user_id, 'referredUserId', p_referred_user_id, 'eventType', upper(v_key), 'amount', v_bonus, 'percent', v_percent, 'ledgerReferenceId', v_ledger_ref, 'alreadyHadLedger', v_inserted <= 0);
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
  v_referral_result jsonb := '{}'::jsonb;
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

  if ledger_applied then
    v_referral_result := public.aitradex_credit_referral_bonus(dep.user_id, 'DEPOSIT', dep.amount, dep.id, 'Deposit UTR ' || coalesce(dep.utr,'-'));
  end if;

  update public.deposit_requests
  set status = 'APPROVED',
      balance_applied = true,
      first_deposit_referral_checked = true,
      reviewed_at = now(),
      reviewed_by = p_admin_user_id,
      admin_note = case when duplicate_count > 0 then 'Checked duplicate UTR warning: ' || duplicate_count::text || ' similar approved request(s).' else 'Approved by secure backend function.' end,
      raw = coalesce(raw, '{}'::jsonb) || jsonb_build_object('secureDepositApprove', true, 'approvedBy', p_admin_user_id, 'approvedByEmail', p_admin_email, 'approvedAt', now(), 'ledgerApplied', ledger_applied, 'referralResult', v_referral_result)
  where id = dep.id;

  notif_id := 'notif_dep_ok_' || dep.id;
  insert into public.notifications(id, audience, user_id, title, message, type, link_page, reference_id, read, created_at, raw)
  values (notif_id, 'USER', dep.user_id, 'Deposit approved', 'Deposit ' || dep.amount::text || ' approved and credited to your wallet.', 'DEPOSIT', 'wallet', 'dep_ok_' || dep.id, false, now(), jsonb_build_object('secureDepositApprove', true))
  on conflict (id) do update set
    audience=excluded.audience, user_id=excluded.user_id, title=excluded.title, message=excluded.message, type=excluded.type, link_page=excluded.link_page, reference_id=excluded.reference_id, raw=excluded.raw;

  log_id := 'adminlog_dep_approve_' || dep.id;
  insert into public.admin_action_logs(id, admin_user_id, action, target_type, target_id, meta, created_at)
  values (log_id, p_admin_user_id, 'DEPOSIT_APPROVE_SECURE', 'DEPOSIT', dep.id, jsonb_build_object('userId', dep.user_id, 'amount', dep.amount, 'utr', dep.utr, 'ledgerApplied', ledger_applied, 'referralResult', v_referral_result, 'adminEmail', p_admin_email, 'adminName', p_admin_name), now())
  on conflict (id) do update set meta=excluded.meta, created_at=excluded.created_at;

  queue_id := 'backend_deposit_approve_' || dep.id;
  insert into public.backend_action_queue(id, action_type, status, requested_by, target_user_id, payload, result, created_at, processed_at)
  values (queue_id, 'DEPOSIT_APPROVE', 'COMPLETED', p_admin_user_id, dep.user_id, jsonb_build_object('requestId', dep.id, 'amount', dep.amount), jsonb_build_object('ledgerApplied', ledger_applied, 'status', 'APPROVED', 'referralResult', v_referral_result), now(), now())
  on conflict (id) do update set status='COMPLETED', result=excluded.result, processed_at=now();

  return jsonb_build_object('ok', true, 'requestId', dep.id, 'userId', dep.user_id, 'amount', dep.amount, 'ledgerApplied', ledger_applied, 'referralResult', v_referral_result, 'status', 'APPROVED');
end;
$$;

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
  v_referral_result jsonb := '{}'::jsonb;
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
  if v_balance < v_price then raise exception 'Insufficient wallet balance.'; end if;

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

  v_ledger_id := 'ledger_subscription_' || v_sub_id;
  insert into public.wallet_ledger(id,user_id,account_type,type,amount,reference_id,note,balance_after,created_at,raw)
  values (v_ledger_id,p_user_id,'REAL','SUBSCRIPTION_PURCHASE',-v_price,v_sub_id,coalesce(v_plan.name,'Plan') || ' subscription purchased by backend',null,v_starts,jsonb_build_object('secureSubscriptionPurchase',true,'planId',v_plan.id,'planName',v_plan.name,'amount',v_price))
  on conflict (user_id, account_type, type, reference_id) do nothing;

  insert into public.subscriptions(id,user_id,plan_id,plan_name,amount,status,starts_at,expires_at,created_at,raw)
  values (v_sub_id,p_user_id,v_plan.id,v_plan.name,v_price,'ACTIVE',v_starts,v_expires,v_starts,v_raw)
  on conflict (id) do update set user_id=excluded.user_id, plan_id=excluded.plan_id, plan_name=excluded.plan_name, amount=excluded.amount, status='ACTIVE', starts_at=excluded.starts_at, expires_at=excluded.expires_at, raw=excluded.raw;

  v_referral_result := public.aitradex_credit_referral_bonus(p_user_id, 'SUBSCRIPTION', v_price, v_sub_id, coalesce(v_plan.name,'Plan'));

  insert into public.notifications(id,audience,user_id,title,message,type,link_page,reference_id,read,created_at,raw)
  values ('notif_sub_ok_' || v_sub_id,'USER',p_user_id,'Subscription activated',coalesce(v_plan.name,'Plan') || ' activated successfully.','PLAN','subscription','sub_ok_' || v_sub_id,false,v_starts,jsonb_build_object('secureSubscriptionPurchase',true,'planId',v_plan.id))
  on conflict (id) do update set message=excluded.message, raw=excluded.raw, created_at=excluded.created_at;

  insert into public.backend_action_queue(id, action_type, status, requested_by, target_user_id, payload, result, created_at, processed_at)
  values ('backend_sub_purchase_' || v_sub_id, 'SUBSCRIPTION_PURCHASE', 'COMPLETED', p_user_id, p_user_id, jsonb_build_object('subscriptionId', v_sub_id, 'planId', v_plan.id), jsonb_build_object('status','ACTIVE','amount',v_price,'referralResult',v_referral_result), v_starts, v_starts)
  on conflict (id) do update set status='COMPLETED', result=excluded.result, processed_at=now();

  return jsonb_build_object('ok', true, 'subscriptionId', v_sub_id, 'userId', p_user_id, 'planId', v_plan.id, 'status', 'ACTIVE', 'amount', v_price, 'referralResult', v_referral_result);
end;
$$;

create or replace function public.aitradex_repair_referral_bonuses(
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
  r public.referrals%rowtype;
  dep record;
  sub record;
  res jsonb;
  deposit_count integer := 0;
  sub_count integer := 0;
  checked_count integer := 0;
begin
  if not public.aitradex_validate_admin(p_admin_user_id) then
    raise exception 'Admin permission required for referral repair.';
  end if;

  for r in select * from public.referrals order by created_at asc loop
    checked_count := checked_count + 1;

    if coalesce(r.raw->'bonuses'->'deposit'->>'credited','false')::boolean = false then
      select id, amount, utr
      into dep
      from public.deposit_requests
      where user_id = r.referred_user_id
        and upper(coalesce(status,'')) = 'APPROVED'
        and coalesce(amount,0) > 0
      order by created_at asc
      limit 1;

      if found then
        res := public.aitradex_credit_referral_bonus(r.referred_user_id, 'DEPOSIT', dep.amount, dep.id, 'Repair · Deposit UTR ' || coalesce(dep.utr,'-'));
        if coalesce((res->>'credited')::boolean,false) then deposit_count := deposit_count + 1; end if;
      end if;
    end if;

    if coalesce(r.raw->'bonuses'->'subscription'->>'credited','false')::boolean = false then
      select id, amount, plan_name
      into sub
      from public.subscriptions
      where user_id = r.referred_user_id
        and coalesce(amount,0) > 0
        and upper(coalesce(status,'')) in ('ACTIVE','REPLACED','ADMIN_REPLACED')
      order by created_at asc
      limit 1;

      if found then
        res := public.aitradex_credit_referral_bonus(r.referred_user_id, 'SUBSCRIPTION', sub.amount, sub.id, 'Repair · ' || coalesce(sub.plan_name,'Plan'));
        if coalesce((res->>'credited')::boolean,false) then sub_count := sub_count + 1; end if;
      end if;
    end if;
  end loop;

  insert into public.admin_action_logs(id, admin_user_id, action, target_type, target_id, meta, created_at)
  values ('adminlog_referral_repair_' || extract(epoch from now())::bigint, p_admin_user_id, 'REFERRAL_REPAIR_BACKEND', 'REFERRAL', 'all', jsonb_build_object('checked', checked_count, 'depositCredited', deposit_count, 'subscriptionCredited', sub_count, 'adminEmail', p_admin_email, 'adminName', p_admin_name), now())
  on conflict (id) do nothing;

  return jsonb_build_object('ok', true, 'checked', checked_count, 'depositCredited', deposit_count, 'subscriptionCredited', sub_count);
end;
$$;

grant execute on function public.aitradex_credit_referral_bonus(text,text,numeric,text,text) to anon, authenticated;
grant execute on function public.aitradex_approve_deposit(text,text,text,text) to anon, authenticated;
grant execute on function public.aitradex_purchase_plan(text,text,text,text) to anon, authenticated;
grant execute on function public.aitradex_repair_referral_bonuses(text,text,text) to anon, authenticated;

insert into public.app_settings(id, settings, updated_at)
values (
  'main',
  jsonb_build_object('referralBackend','secure-rpc-v1','referralBackendUpdatedAt',now(),'databaseRuntimeVersion','6.9.5-referral-secure'),
  now()
)
on conflict (id) do update
set settings = coalesce(public.app_settings.settings,'{}'::jsonb) || jsonb_build_object('referralBackend','secure-rpc-v1','referralBackendUpdatedAt',now(),'databaseRuntimeVersion','6.9.5-referral-secure'),
    updated_at = now();

commit;
