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


Demo Navigation Restriction:
- Demo Account now shows only Home and PnL/Analytics navigation.
- Wallet, KYC, Plans and Referral are hidden in Demo Account.
- Real Account shows all user sections.


Premium User UI Update:
- Compact bottom navigation with icon-style labels.
- Header live BTC ticker and profile badge.
- Market insight cards: Today PnL, Win Rate, Market Mood, Active Signal.
- Improved signal card with entry, target, stop loss and expiry.
- Real account risk notice.
- Larger chart layout on desktop.
- Order book depth bars and smoother recent fill effect.
- User side keeps admin wording removed.


Chart Bottom Feed Update:
- Order Book moved directly below chart.
- Recent Trade Feed moved directly below chart.
- Removed separate lower order book/feed block to reduce empty space.
- Chart height optimized so lower area looks filled.


Merged Mockup + Working Build:
- Based on working chart-bottom-feed build.
- Keeps existing functional files and JS logic.
- Adds mockup-style mobile dashboard look.
- Keeps Supabase/config/admin/deposit/KYC/plans files from working build.


Full User Dashboard Rebuild:
- index.html user dashboard fully rebuilt, not just CSS patched.
- Mockup-style home panel + trading chart panel.
- New bottom nav with center AI Signal button.
- Working IDs preserved for app.js logic.
- Admin remains separate in admin.html.


FINAL REBUILD V2 ZIP:
- Full premium mockup-style user dashboard polish.
- Center AI bottom-nav button added.
- Desktop: left dashboard + right chart/orderbook panel.
- Mobile-first responsive design.
- Existing working JS IDs preserved.
- Admin files remain separate.


PC Mobile Frame Update:
- Desktop/PC view now also stays in centered mobile-app width.
- Dashboard no longer stretches full desktop width.
- Useful for PC editing/testing while keeping mobile UI look.


Trade Page Fix:
- BUY/SELL order ticket moved from Home to Trade page.
- Trade page chart container fixed back to crypto_live_chart so TradingView works.
- Order Book and Recent Fills IDs restored so existing JS works.
- Trade tab now re-initializes chart/feed when opened.


Auto Pair Chart Update:
- Trade page pair selector now changes TradingView chart automatically.
- BTC/ETH/SOL/BNB selection updates chart symbol.
- Pair title and selected price text also update.


Fast Chart Fix:
- Removed heavy repeated chart reload.
- Chart now reloads only on pair change.
- Added stable loader.
- Improved chart container height and border.
- Reduced TradingView side toolbar for cleaner mobile look.


Withdrawal Flow Update:
- User wallet now has Withdraw button.
- User can submit withdrawal amount + UPI/Bank details.
- User withdrawal history added.
- Admin panel has Withdrawal Management tab.
- Admin can approve/reject withdrawal requests.
- Approved withdrawal creates wallet_ledger negative entry.
- Latest SQL includes withdrawal_requests table and policies.


Withdrawal Rule Fix:
- Withdrawal now checks eligible withdrawable amount.
- Approved deposit unlocks only up to Real Account trade volume.
- Positive profit is also withdrawable.
- Pending/approved withdrawals reduce withdrawable amount.
- Admin approval no longer deducts admin's local wallet by mistake.
- User balance is reduced through wallet_ledger negative entry after approval.


Minimum Amount Update:
- Minimum deposit set to ₹1000.
- Minimum withdrawal set to ₹1000.
- Requests below ₹1000 are blocked on user side.


Final Withdrawal Balance Fix:
- Real trade volume and profit are now saved cumulatively.
- Withdrawable amount no longer resets just because trade history changes.
- Admin approval immediately deducts Real Account balance in shared local state.
- Approved withdrawal will not double-deduct if clicked twice.
- Withdrawable = unlocked deposit based on trade volume + profit - pending/approved withdrawals.


Trade PnL Wallet Fix:
- Open trade PnL now reflects in wallet equity live.
- Closing a trade returns margin + profit/loss to account balance.
- Profit increases wallet, loss reduces returned margin.
- Demo and Real wallet equity remain separate.


Withdrawal Reserved Balance Fix:
- Pending withdrawal now reduces displayed Real wallet total/equity immediately.
- Admin approval deducts actual Real balance, without visual double deduction.
- Rejected withdrawal restores displayed wallet total because pending reserve is removed.
- Wallet now shows Pending Withdrawal amount.


Trade Close Double Balance Fix:
- Fixed bug where closing a trade added margin + profit and doubled wallet balance.
- Trade open no longer deducts simulation margin from wallet.
- Trade close now applies only net PnL:
  100000 wallet + 18 profit = 100018 wallet.


Wallet Ledger Persist Fix:
- Closed Real Account trade PnL now saves into Supabase wallet_ledger as TRADE_PNL.
- Approved withdrawal saves negative ledger entry.
- Refresh now recalculates Real balance from wallet_ledger.
- Wallet should no longer reset after page refresh.


Total Wallet Balance Fix:
- Fixed Real Wallet Equity display.
- Total wallet now uses the same stable calculation source:
  Approved Deposit + Profit/Loss - Approved Withdrawal - Pending Withdrawal.
- Withdrawable amount calculation was not touched.
- This specifically fixes total balance staying same while withdrawal/eligible amounts changed.


WebSocket Live PnL Update:
- Added Binance public WebSocket live stream for BTC/ETH/SOL/BNB.
- Price and PnL update almost instantly.
- Wallet equity updates live with open PnL.
- Falls back to normal API polling if WebSocket disconnects.
- No SQL required for this update.


Reverted:
- Removed Fast Load Optimization / lazy-load update.
- Restored previous working live WebSocket PnL version.


Admin/AI Trade Daily Limit Update:
- User manual trades are unlimited.
- Admin/AI trades have daily plan-based limit.
- Free default = 5 Admin/AI trades per day.
- Plan Editor now has AI/Admin Trades Per Day field.
- User dashboard shows AI/Admin trade usage.
- User can toggle Allow AI/Admin Auto Trade ON/OFF.
- Admin panel has Mass Trade tab for eligible users.
- SQL updated with subscription_plans.ai_trade_limit column.


Managed Trade Control Update:
- Admin panel has Managed Trade tab.
- Admin can open trade manually with coin, side, risk, amount, entry price.
- Admin can close managed trade with manual close price.
- PnL calculates automatically from entry/close price.
- PnL is added/deducted in wallet ledger as MANAGED_TRADE_PNL.
- User dashboard can show managed trade as Admin Managed source.


Premium Admin UI Update:
- Rebuilt admin layout visually to match user panel style.
- Added Admin Command Center hero.
- Improved sidebar tabs with icon-style labels.
- Added mobile-app style responsive layout.
- Kept existing IDs/data-admin-tab logic intact.
- Existing admin features/logic remain same.


Admin PC Layout Fix:
- PC admin now uses proper desktop dashboard width.
- Left sidebar fixed/sticky.
- Right content full-width.
- Tables and cards expand properly on PC.
- Mobile admin compact style remains unchanged.


Admin Users View Removed:
- Removed Users/User Management tab from admin panel.
- Removed adminUsers panel from admin.html.
- Other admin features remain unchanged.


Admin Stable PC Fix:
- Removed sidebar sticky movement.
- Removed hover transform movement.
- Removed admin fade/jump animation on PC.
- Fixed admin grid width and content overflow.
- Tables stay inside right panel with horizontal scroll if needed.
- PC admin panel should no longer shake/move.


Managed Trade User History Fix:
- Added Supabase managed_trades table.
- Admin open managed trade now saves to managed_trades.
- Admin close managed trade updates managed_trades and wallet_ledger.
- User dashboard now shows AI/Admin Managed Trade History.
- User can see entry, close, PnL and status after refresh.
- Latest SQL must be run once for managed_trades table.


Managed Trade User Sync Fix:
- Admin user list now loads from Supabase profiles.
- User managed trade history matches by user_id OR user_email.
- User dashboard auto-refreshes managed trade history every 10 seconds.
- Closing managed trade reloads remote data and updates history.
- Fixes issue where admin-managed trade did not show on user dashboard.


Managed Trade Cancel Update:
- Admin can cancel open managed trades.
- Cancelled trade applies no profit/loss.
- Cancelled trade is removed from open positions.
- Cancelled trade does not count in AI/Admin daily trade limit.
- User history shows status CANCELLED with PnL 0.


User AI History Button Update:
- Added View AI/Admin Trade History button on user dashboard.
- Added separate aiHistory page.
- Managed/cancelled/closed admin trades show there.


History Nav + Top More Update:
- Bottom nav More replaced with History.
- Top header has 3-dot More button.
- History page now includes AI/Admin Trade History and User Manual Trade History.


Top More Button Fix:
- 3-dot top More button now opens morepage.
- Added direct data-page click handler for shortcut buttons.
- Ensured More page exists with KYC, Plans, Referral, Profile cards.


User History Closed Only Update:
- User AI/Admin trade history now shows only CLOSED trades.
- CANCELLED managed trades are hidden from user history.
- Admin panel still keeps cancelled trades visible for admin tracking.


Managed PnL Count Fix:
- CLOSED AI/Admin managed trades now count in user's PnL analytics.
- Total PnL, Total Trades and Win Rate include managed closed trades.
- Cancelled trades remain hidden and do not count.


Final PnL Analytics Fix:
- Manual user trades now count in Total Trades and Total PnL.
- CLOSED AI/Admin managed trades count in Total Trades and Total PnL.
- Cancelled managed trades do not count.
- Analytics refreshes automatically every second.
- No SQL required.


AI/Admin Trade Limit Count Fix:
- AI/Admin trades used today now displays correctly on user dashboard.
- Plan-wise AI/Admin trade daily limit now reads from aiTradeLimit/ai_trade_limit.
- Free plan fallback remains 5/day.
- Managed/Mass admin trades increment user AI trade usage.
- Cancelled managed trade decrements usage.
- No SQL required if ai_trade_limit column already exists.


AI Limit Skip Users Fix:
- If a user's AI/Admin daily limit is complete, admin AI trade will skip that user.
- Other eligible users still receive the trade.
- Applies to Mass Trade and Managed Trade.
- Admin eligibility preview now shows Used, Limit, Left and Status.
- No SQL required.


AI Mass Trade Close Update:
- Added Close AI Mass Trade controls in admin Mass Trade tab.
- Admin can close selected mass trade or all open mass trades using close price.
- Mass trade PnL is calculated and saved to managed_trades + wallet_ledger.
- User history will show closed AI Mass trades as CLOSED.
- No new SQL needed if managed_trades table already exists.


More Buttons Fix:
- More page internal buttons now open KYC, Plans, Referral and Profile.
- Added Profile page.
- Added direct navigation handler for More page buttons.


Referral 5% Auto Bonus Update:
- Referral bonus = 5% of referred user's approved deposit.
- Bonus applies automatically when admin approves deposit.
- No separate referral approval needed.
- Bonus saved in referrals table and wallet_ledger as REFERRAL_BONUS.
- Bonus is paid only once per deposit.
- If you use Supabase, run latest referral SQL columns once.


Login Restore + Safe More Fix:
- Rebuilt from stable working version to restore login/register.
- Added 3-dot More dropdown without touching login/register code.
- Removed hard CSS/JS page-switch rules that could break auth screen.
- JS syntax check: OK



Final History Icon Fix:
- Bottom History icon now directly opens aiHistory page.
- History page rebuilt with AI/Admin closed history + manual history.
- Cancelled AI/Admin trades hidden.
- History auto-refreshes every 1.5 seconds.
- No SQL required.


Mobile History Fix:
- History page now shows table rows as mobile-friendly cards on small screens.
- PC/tablet view stays as table.
- AI/Admin and Manual history both improved on mobile.
- No SQL required.


PC Wallet Nav Fix:
- Wallet bottom-nav button now appears on PC for Real account.
- Demo account still hides Wallet.
- Mobile behavior remains unchanged.
- No SQL required.


Wallet Nav Restore:
- Bottom nav restored to 5 buttons: Home, Trade, Wallet, PnL, History.
- Wallet button is visible on PC and mobile.
- Wallet is no longer hidden by demo/real mode CSS.
- No SQL required.


Referral Bonus Percentage Fix:
- Fixed incorrect 5% calculation bug.
- ₹100000 deposit now correctly gives ₹5000 referral bonus.
- Added safer numeric parsing for approved deposit amount.
- No SQL required.


Final Referral Auto 5% Fix:
- Referral bonus is automatic after admin approves the referred user's deposit.
- No separate referral approval needed.
- Every approved deposit pays 5% to the referrer.
- ₹100000 deposit pays ₹5000 bonus.
- Prevents duplicate bonus for same deposit.
- Uses referrals table + wallet_ledger REFERRAL_BONUS.
- Run referral SQL once if columns are missing.


Referral Fixed ₹500 Bonus Update:
- Referral bonus changed from 5% to fixed ₹500.
- Bonus is paid automatically after the referred user's first approved deposit.
- No separate admin approval required for referral bonus.
- Bonus is paid only once per referred user.
- Uses referrals table and wallet_ledger REFERRAL_BONUS.
- No SQL required if referral columns already exist.


Referral 500 DB Final Fix:
- Added database-backed referral_code and referred_by support.
- Deposit approval finds referrer from profiles.referred_by.
- Referrer gets fixed 500 automatically after referred user's first approved deposit.
- No referral approval needed.
- Run the new SQL for profiles referral_code/referred_by columns.


Referral 500 Wallet Hard Fix:
- Removed old 5%/50 logic conflicts.
- Referral bonus is fixed 500, not 50.
- Bonus goes to referrer's wallet_ledger as REFERRAL_BONUS +500.
- Bonus is paid after referred user's first approved deposit.
- No separate referral approval.
- Run the SQL if profiles.referral_code/referred_by columns are missing.
- JS syntax check: OK


Referral First Deposit 10% Update:
- Referral bonus = referred user's first approved deposit amount ka 10%.
- Bonus automatic wallet_ledger me add hoga; referral approval nahi chahiye.
- Sirf first approved deposit par bonus milega; next deposits par nahi.
- Example: first deposit ₹100000 => referrer bonus ₹10000.
- SQL same referral_code/referred_by columns use karta hai.
- JS syntax check: OK


Referral Admin Auto 10% Fix:
- Admin referral page no longer shows old ₹50 JOINED approval rows.
- Removed referral Approve/Hold action UI.
- Admin referral page now shows only PAID automatic bonus records.
- Columns: Referrer, Joined User, Deposit, Bonus, Status.
- Rule: First approved deposit ka 10% automatic wallet_ledger me add hota hai.
- No SQL required if latest referral SQL already run.
- JS syntax check: OK


User Referral 10% Hard Fix:
- Removed remaining hardcoded ₹50 referral display/defaults.
- User referral total now reads bonus_amount from paid referral records.
- Referral page/list shows joined user, deposit amount, actual 10% bonus, status.
- If old ₹50 test rows exist in Supabase, delete old referral/REFERRAL_BONUS rows before fresh test.
- JS syntax check: OK


Referral Working Final Fix:
- Referral code/referred_by is saved to profiles.
- URL ?ref=CODE and register referral input both supported.
- On first approved deposit, referrer gets 10% automatically in wallet_ledger.
- No referral approval needed.
- If nothing adds, verify referred user's profiles.referred_by has referrer's referral_code.
- JS syntax check: OK
