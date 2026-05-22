AITradeX Stable Base — Phase 4.89

This ZIP is the cleaned stable base built from Phase 4.86 Admin Text Contrast Fix.

Main files
- index.html: user app entry
- admin.html: admin/control panel entry
- styles.css: shared user/admin styling
- user-app.js: user-side app logic
- admin-app.js: admin-side app logic
- core.js: shared state/helpers
- auth.js: auth/session helpers
- config.js: configuration placeholder
- supabase-schema.sql: database planning/schema reference

Default control center login
Email: control@aitradex.com
Password: admin123

Clean-base notes
- No separate temporary, duplicate, backup, or hotfix files are included.
- Old phase history notes were removed from this README.
- CSS phase comments were removed while preserving the existing rule order.
- User/admin JavaScript logic is kept in the main working files.

Important
This build is a frontend/static prototype baseline. Before real public use, move authentication, wallet ledger, deposits, withdrawals, trade settlement, and admin permissions to a secure backend such as Supabase/Firebase or a custom server.


Stable display setting:
- Crypto prices are shown to users in INR-only mode.
- Default USDT-INR conversion rate is ₹95 per USDT.
- Admin can change this anytime from Payment Settings > USDT to INR Rate.
- Internal trade P/L still uses raw crypto movement percentage, so wallet P/L remains INR-based.


Phase 4.91 update:
- Added premium read-only USDT-INR rate chip on user Trade page.
- Added premium read-only USDT-INR rate chip on user Wallet hero.
- Rate is controlled from Admin Payment Settings and defaults to ₹95 per USDT.
