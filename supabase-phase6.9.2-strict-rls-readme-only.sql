-- AITradeX Optional Strict RLS Notes
-- DO NOT RUN this while the app is still using AUTH_MODE=legacy-testing.
-- This file is a checklist/template only.
-- Strict RLS needs Supabase Auth user mapping, service-role Edge Functions for admin actions,
-- and authenticated-only policies. Running strict RLS too early can make user/admin dashboards blank.

-- Safe current step: run supabase-phase6.9.2-final-money-security.sql only.
-- Next production step: migrate login to Supabase Auth, then replace anon grants with authenticated/service-role flows.
