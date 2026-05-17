AI Trading Assistant Pro Update

Added:
- Login/Register UI
- Local admin login: admin@aitrade.local / admin123
- Supabase-ready config and SQL schema
- Real crypto prices using Binance public ticker API
- Manual payment gateway, UTR and screenshot input
- Admin payment approval
- User referral code and referral link
- PnL analytics dashboard
- AI-style indicator engine using live BTC 24h movement
- Mobile app style UI
- Dark neon animated background

Not Added:
- Razorpay subscription
- Telegram signal bot

Files:
- index.html
- styles.css
- app.js
- config.js
- supabase-schema.sql

How to upload:
1. Extract ZIP.
2. Upload all files to GitHub repo root or Hostinger public_html.
3. Open index.html / website URL.
4. For Supabase:
   - Create Supabase project
   - Run supabase-schema.sql in SQL editor
   - Copy Project URL + anon public key into config.js

Important:
This is still a frontend/static + Supabase-ready build. For production you should add:
- Secure server-side admin verification
- Proper Supabase Auth
- Storage bucket for payment screenshots
- Legal disclaimers and compliance
- Exchange API only if licensed/allowed


Separate Admin Login Added:
- User website: index.html
- Admin website: admin.html
- Admin credentials: admin@aitrade.local / admin123
- User side no longer shows Admin tab.
- Admin cannot login from index.html.
- Normal users cannot login from admin.html.


Configured:
- Supabase URL added
- Supabase publishable/anon key added

Before going live:
- Replace manual gateway details in config.js with your real UPI/Bank details.
- Run supabase-schema.sql in Supabase SQL Editor.


Final Stable Update:
- Supabase Auth signup/login added for normal users.
- Local separate admin login kept on admin.html.
- User side blocks admin login.
- Admin side blocks normal user login.
- Payment requests now save to Supabase payment_requests table.
- Admin approval updates payment status and user plan in Supabase profiles table.
- Referral save/fetch improved.
- setup.html added with simple checklist.
- SQL updated with drop-policy safety so re-running SQL does not fail.

Important:
- Admin is still local fallback: admin@aitrade.local / admin123
- For production, create a secure server-side admin/auth system.
- Screenshot upload stores filename only in this static version. Real file upload needs Supabase Storage bucket.


Real-Feel Simulation Update:
- Added BUY / SELL separate buttons
- Added coin selector: BTC, ETH, SOL, BNB
- Added Market / Limit UI
- Added leverage selector
- Added TP/SL input fields
- Open positions now update live PnL
- Close position button added
- Closing position returns margin + PnL to balance
- Added simulated order book panel
- Added recent fills feed
- Added trade open animation


Deposit Flow Update:
- User side Wallet page added.
- Deposit Funds button added on dashboard and wallet page.
- Manual deposit modal added with amount, UTR and screenshot.
- Admin panel now has Deposit Requests approval table.
- Admin approval adds approved amount to user's Real UI balance through wallet_ledger.
- Latest SQL includes deposit_requests and wallet_ledger tables.


Admin Panel Update:
- Removed from scope: Admin password, Website name/logo, Maintenance mode.
- Added admin overview metrics.
- Added user management with plan change and block/unblock UI.
- Added deposit management with approve/reject.
- Added advanced signal management: coin, entry, target, stop loss, confidence, risk, expiry.
- Added subscription plan approval/rejection.
- Added trade monitoring table.
- Added referral management with approve/hold.


Fixed:
- admin.html now includes the new full admin dashboard layout.
- If changes are not visible, hard refresh browser with Ctrl + F5.


Plans + KYC Update:
- Admin Plan Editor added: create/edit/hide/delete plans.
- User subscription page now shows plans from admin-created plan list.
- User KYC page added.
- Admin KYC approval/rejection added.
- Latest SQL includes subscription_plans and kyc_requests.
- Still not included: admin password change, website name/logo edit, maintenance mode.


User/Admin Separation Fix:
- Removed admin panel from index.html user dashboard.
- Admin panel remains only in admin.html.
- User dashboard keeps only user-facing items:
  plans, KYC, deposit status, signal details, wallet, trades, referrals.


Separate Session Fix:
- User session now saves in ai_trading_user_session_v1.
- Admin session now saves in ai_trading_admin_session_v1.
- Admin login will not logout user dashboard.
- User login will not logout admin dashboard.
- Use index.html for user and admin.html for admin in separate tabs/windows.


User Side Text Cleanup:
- Removed admin/admin.html wording from user login page and dashboard.
- Admin access still remains in admin.html, but user side does not mention it.


Demo/Real Account Separation Update:
- Demo Account and Real Account are now fully separated.
- Demo balance, signals, open positions, closed trades and recent fills are separate.
- Real balance, signals, open positions, closed trades and recent fills are separate.
- Using demo signals will not reduce real account signals.
- Using real signals will not reduce demo account signals.
- Switching account mode shows only that account's data.
