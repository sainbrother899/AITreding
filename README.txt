AITradeX Phase6.9 - RLS Readiness Pack

PHASE 6.9.1 CLEAN BASELINE NOTE
- KYC approve/reject request-id bug fixed.
- Telegram alerts now expect Supabase Edge Function URL; frontend bot-token fallback is disabled.
- Fake TP/SL inputs removed from user trade form until full TP/SL backend logic is added.
- Default admin DB auto-create fallback is disabled in config.


Base: Phase6.8 Wallet Telegram Backend.
This build keeps the same UI/design and working flows, but adds RLS readiness files and clearer production-lock guidance.

What is included:
- Deposit approve/reject backend RPC from previous phases.
- Withdrawal approve/reject backend RPC from previous phases.
- AI Live backend settlement from previous phases.
- Manual trade backend settlement and price-unit cleanup from previous phases.
- KYC + payment method backend approval from previous phases.
- Subscription backend control from previous phases.
- Admin wallet adjustment backend RPC and Telegram audit logs from Phase6.8.
- New safe audit file: supabase-rls-readiness-audit.sql
- New production template: supabase-strict-rls-final-lock-template.sql

Important deployment notes:
1. For normal testing/deploy, run supabase-schema.sql only if you have not already applied Phase6.8 schema or if you want the latest runtime marker.
2. You may safely run supabase-rls-readiness-audit.sql. It only reports RLS/function status and does not change data.
3. Do NOT run supabase-strict-rls-final-lock-template.sql on the current legacy-testing app. It is a future production template only.
4. Upload the ZIP files to hosting.
5. Hard refresh browser with Ctrl + Shift + R.

Why strict RLS is not enabled directly:
The current app still supports legacy frontend testing mode. If strict production RLS is enabled before Supabase Auth/Edge Functions are fully active, user/admin panels can lose DB access. Strict RLS should be the last production-lock step.

Current build:
Phase6.9-RLSReadinessPack
Cache version: phase695-dbfirst-finalcheck-20260524


Phase 6.9.2 update notes:
- Run supabase-phase6.9.2-final-money-security.sql after deployment.
- Use supabase/functions/telegram-alert/index.ts for Telegram alerts.
- Do not run strict RLS lock files until Supabase Auth + service-role admin functions are ready.
- See PHASE6.9.2-FINAL-MONEY-SECURITY-PACK.txt for the test checklist.


Phase 6.9.3 update notes:
- Final UI polish layer added to styles.css.
- Dashboard cards, spacing, mobile layout, action rows and visible focus/hover states polished.
- No new SQL is required if Phase 6.9.2 SQL is already run.
- See PHASE6.9.3-FINAL-UI-POLISH-PACK.txt for the final test checklist.
