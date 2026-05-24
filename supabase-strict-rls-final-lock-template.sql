-- AITradeX Phase 6.9 - Strict RLS Final Lock TEMPLATE
-- DO NOT RUN on the current frontend-only legacy-testing app.
-- Run only after Supabase Auth roles / Edge Functions are fully implemented and tested.
-- This file is a production-lock template, not a testing policy.

begin;

-- 0) Recommended production assumptions:
-- - All sensitive writes are done by Edge Functions/service-role, not browser JS.
-- - Users are linked by public.users.auth_user_id = auth.uid().
-- - Admin permissions are checked server-side or by admin_roles mapped to auth.uid().

-- 1) Enable RLS on core tables.
alter table if exists public.users enable row level security;
alter table if exists public.wallet_ledger enable row level security;
alter table if exists public.trade_orders enable row level security;
alter table if exists public.ai_trade_batches enable row level security;
alter table if exists public.subscriptions enable row level security;
alter table if exists public.referrals enable row level security;
alter table if exists public.deposit_requests enable row level security;
alter table if exists public.withdrawal_requests enable row level security;
alter table if exists public.kyc_requests enable row level security;
alter table if exists public.payment_methods enable row level security;
alter table if exists public.support_tickets enable row level security;
alter table if exists public.notifications enable row level security;
alter table if exists public.admin_action_logs enable row level security;
alter table if exists public.backend_action_queue enable row level security;
alter table if exists public.telegram_alert_logs enable row level security;
alter table if exists public.app_settings enable row level security;

-- 2) Helper predicates for production Auth mode.
create or replace function public.aitradex_current_user_id()
returns text
language sql
stable
as $$
  select u.id
  from public.users u
  where u.auth_user_id = auth.uid()
  limit 1
$$;

create or replace function public.aitradex_is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.admin_roles ar
    join public.users u on u.id = ar.user_id
    where u.auth_user_id = auth.uid()
      and coalesce(ar.is_active, true) = true
  )
$$;

-- 3) Example user-owned read policies.
-- Drop/recreate names carefully in production if you already have custom policies.
drop policy if exists users_read_own on public.users;
create policy users_read_own on public.users
for select to authenticated
using (id = public.aitradex_current_user_id() or public.aitradex_is_admin());

drop policy if exists wallet_read_own on public.wallet_ledger;
create policy wallet_read_own on public.wallet_ledger
for select to authenticated
using (user_id = public.aitradex_current_user_id() or public.aitradex_is_admin());

drop policy if exists trades_read_own on public.trade_orders;
create policy trades_read_own on public.trade_orders
for select to authenticated
using (user_id = public.aitradex_current_user_id() or public.aitradex_is_admin());

drop policy if exists deposits_read_own on public.deposit_requests;
create policy deposits_read_own on public.deposit_requests
for select to authenticated
using (user_id = public.aitradex_current_user_id() or public.aitradex_is_admin());

drop policy if exists withdrawals_read_own on public.withdrawal_requests;
create policy withdrawals_read_own on public.withdrawal_requests
for select to authenticated
using (user_id = public.aitradex_current_user_id() or public.aitradex_is_admin());

drop policy if exists kyc_read_own on public.kyc_requests;
create policy kyc_read_own on public.kyc_requests
for select to authenticated
using (user_id = public.aitradex_current_user_id() or public.aitradex_is_admin());

drop policy if exists payment_methods_read_own on public.payment_methods;
create policy payment_methods_read_own on public.payment_methods
for select to authenticated
using (user_id = public.aitradex_current_user_id() or public.aitradex_is_admin());

drop policy if exists subscriptions_read_own on public.subscriptions;
create policy subscriptions_read_own on public.subscriptions
for select to authenticated
using (user_id = public.aitradex_current_user_id() or public.aitradex_is_admin());

drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications
for select to authenticated
using (user_id = public.aitradex_current_user_id() or public.aitradex_is_admin() or audience = 'ADMIN' and public.aitradex_is_admin());

-- 4) Plans can be public read-only.
drop policy if exists plans_public_read on public.plans;
create policy plans_public_read on public.plans
for select to anon, authenticated
using (true);

-- 5) Sensitive writes should be denied from browser clients.
-- Edge Functions/service-role bypass RLS. Do not add broad INSERT/UPDATE/DELETE policies here.

-- 6) Once Edge Functions replace direct RPC grants, revoke public execution for sensitive functions.
-- Uncomment after frontend no longer calls these RPCs directly.
-- revoke execute on function public.aitradex_approve_deposit(text,text,text,text) from anon, authenticated;
-- revoke execute on function public.aitradex_reject_deposit(text,text,text,text,text) from anon, authenticated;
-- revoke execute on function public.aitradex_approve_withdrawal(text,text,text,text) from anon, authenticated;
-- revoke execute on function public.aitradex_reject_withdrawal(text,text,text,text,text) from anon, authenticated;
-- revoke execute on function public.aitradex_close_ai_live_batch(text,numeric,text,text,text,text) from anon, authenticated;
-- revoke execute on function public.aitradex_open_manual_trade(jsonb) from anon, authenticated;
-- revoke execute on function public.aitradex_close_manual_trade(text,numeric,text) from anon, authenticated;
-- revoke execute on function public.aitradex_cancel_manual_limit(text,text) from anon, authenticated;
-- revoke execute on function public.aitradex_approve_kyc(text,text,text,text) from anon, authenticated;
-- revoke execute on function public.aitradex_reject_kyc(text,text,text,text,text) from anon, authenticated;
-- revoke execute on function public.aitradex_approve_payment_method(text,text,text,text) from anon, authenticated;
-- revoke execute on function public.aitradex_reject_payment_method(text,text,text,text,text) from anon, authenticated;
-- revoke execute on function public.aitradex_purchase_plan(text,text) from anon, authenticated;
-- revoke execute on function public.aitradex_change_user_plan(text,text,text,text,text) from anon, authenticated;
-- revoke execute on function public.aitradex_admin_wallet_adjust(text,numeric,text,text,text,text,text) from anon, authenticated;

rollback;
-- This template ends with rollback intentionally. Remove rollback and use commit only after production review.
