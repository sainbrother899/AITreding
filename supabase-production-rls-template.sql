-- AITradeX Phase 5.28 Production RLS Template
-- IMPORTANT: Do NOT run this on the current frontend-only build unless you have already migrated to Supabase Auth / backend Edge Functions.
-- Running this now can block the website because custom frontend login cannot be verified by PostgreSQL RLS.

-- Recommended production architecture:
-- 1. Use Supabase Auth. Store public.users.id = auth.uid()::text.
-- 2. Give admin users role='admin' in public.users.
-- 3. Move wallet, approval, trade, AI batch and referral writes to Edge Functions/service-role backend.
-- 4. Keep service-role key private on backend only. Never put it in frontend config.js.

create or replace function public.aitradex_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid()::text
      and u.role = 'admin'
      and coalesce(u.status, 'ACTIVE') = 'ACTIVE'
  );
$$;

create or replace function public.aitradex_is_self(target_user_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_user_id = auth.uid()::text;
$$;

-- Enable RLS on all runtime tables.
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
    exception when undefined_table then null;
    end;
  end loop;
end $$;

-- Remove old testing-open anon policies.
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and (policyname ilike '%anon all%' or policyname ilike '%testing anon all%' or policyname ilike 'Allow anon%')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Public read-only reference tables.
drop policy if exists "plans readable by authenticated" on public.plans;
create policy "plans readable by authenticated" on public.plans for select to authenticated using (true);

drop policy if exists "app settings admin only" on public.app_settings;
create policy "app settings admin only" on public.app_settings for all to authenticated using (public.aitradex_is_admin()) with check (public.aitradex_is_admin());

-- Users: users can read/update themselves; admin can manage all.
drop policy if exists "users self read" on public.users;
create policy "users self read" on public.users for select to authenticated using (id = auth.uid()::text or public.aitradex_is_admin());
drop policy if exists "users self update" on public.users;
create policy "users self update" on public.users for update to authenticated using (id = auth.uid()::text or public.aitradex_is_admin()) with check (id = auth.uid()::text or public.aitradex_is_admin());
drop policy if exists "users admin insert" on public.users;
create policy "users admin insert" on public.users for insert to authenticated with check (id = auth.uid()::text or public.aitradex_is_admin());

-- User-owned tables: self read/insert/update where safe; admin can manage all.
do $$
declare
  tbl text;
begin
  foreach tbl in array array['payment_methods','kyc_requests','deposit_requests','withdrawal_requests','support_tickets','notifications','trade_orders']
  loop
    execute format('drop policy if exists "%s self/admin select" on public.%I', tbl, tbl);
    execute format('create policy "%s self/admin select" on public.%I for select to authenticated using (user_id = auth.uid()::text or public.aitradex_is_admin())', tbl, tbl);
    execute format('drop policy if exists "%s self/admin insert" on public.%I', tbl, tbl);
    execute format('create policy "%s self/admin insert" on public.%I for insert to authenticated with check (user_id = auth.uid()::text or public.aitradex_is_admin())', tbl, tbl);
    execute format('drop policy if exists "%s self/admin update" on public.%I', tbl, tbl);
    execute format('create policy "%s self/admin update" on public.%I for update to authenticated using (user_id = auth.uid()::text or public.aitradex_is_admin()) with check (user_id = auth.uid()::text or public.aitradex_is_admin())', tbl, tbl);
    execute format('drop policy if exists "%s admin delete" on public.%I', tbl, tbl);
    execute format('create policy "%s admin delete" on public.%I for delete to authenticated using (public.aitradex_is_admin())', tbl, tbl);
  end loop;
end $$;

-- Ledger is read-only for users; writes should happen via backend/admin functions.
drop policy if exists "wallet ledger self/admin select" on public.wallet_ledger;
create policy "wallet ledger self/admin select" on public.wallet_ledger for select to authenticated using (user_id = auth.uid()::text or public.aitradex_is_admin());
drop policy if exists "wallet ledger admin write" on public.wallet_ledger;
create policy "wallet ledger admin write" on public.wallet_ledger for all to authenticated using (public.aitradex_is_admin()) with check (public.aitradex_is_admin());

-- Admin-only operational tables.
do $$
declare
  tbl text;
begin
  foreach tbl in array array['admin_action_logs','ai_trade_batches','app_state_snapshots','referrals','subscriptions']
  loop
    execute format('drop policy if exists "%s admin only" on public.%I', tbl, tbl);
    execute format('create policy "%s admin only" on public.%I for all to authenticated using (public.aitradex_is_admin()) with check (public.aitradex_is_admin())', tbl, tbl);
  end loop;
end $$;
