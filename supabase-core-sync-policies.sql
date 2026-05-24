-- AITradeX Phase 5.29 Testing RLS Policies
-- Run this only for the current frontend-only testing build.
-- It enables RLS but allows anon access because the current app uses custom frontend login, not Supabase Auth.
-- For public real-money launch, migrate writes to backend/Edge Functions/Supabase Auth and adapt supabase-production-rls-template.sql instead.

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
