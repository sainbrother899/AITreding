-- AITradeX Phase 6.9 - RLS Readiness Audit
-- Safe to run. This does not change permissions or data.
-- Purpose: inspect whether tables/functions are ready before strict production RLS.

-- 1) Table RLS status
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'users','wallet_ledger','trade_orders','ai_trade_batches','plans','subscriptions','referrals',
    'deposit_requests','withdrawal_requests','kyc_requests','payment_methods','support_tickets',
    'notifications','admin_action_logs','backend_action_queue','telegram_alert_logs','app_settings'
  )
order by c.relname;

-- 2) Existing public policies summary
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 3) Sensitive RPC execute grants check
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname like 'aitradex_%'
order by p.proname, args;

-- 4) App settings runtime marker
select id, settings->>'databaseRuntimeVersion' as database_runtime_version, settings->>'mode' as mode
from public.app_settings
where id = 'main';
