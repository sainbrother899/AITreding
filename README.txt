AI Trading Clean Core Rebuild

UI/design same rakha gaya hai.
app.js clean rebuild hai, duplicate/old patch logic remove kiya gaya hai.

Core tested logic:
- Login/Register
- Demo/Real mode
- Deposit submit with 12 digit UTR + duplicate check
- Admin deposit approve/reject
- Real wallet ledger
- Withdrawal request + approve
- Manual trade unlimited
- Admin managed trade
- Mass trade
- Closed trade history
- AI/Admin daily plan limit
- First approved deposit referral bonus = 10%
- KYC basic submit
- Plan editor

SQL:
Run supabase-schema.sql once in Supabase SQL Editor.


DB Compatibility Fix:
- Fixed bigint id error by not sending string IDs to deposit_requests/withdrawal_requests when inserting.
- Added fallback for other tables: if bigint id error happens, insert is retried without id.
- Added SQL compatibility patch for missing metadata columns.
- Keep UI/design same.
- JS syntax check: OK


Deposit Bigint Hard Fix:
- Deposit submit now captures click before old handlers.
- Supabase insert never sends id to deposit_requests.
- Old submitDeposit/submitDepositFinal/createDepositRequest aliases overridden.
- 12 digit UTR validation and duplicate check kept.
- If same error appears, browser is still serving old cached app.js.
- JS syntax check: OK


No dep_ ID + Cache Fix:
- Removed remaining dep_ ID generation from app.js.
- Added Supabase deposit_requests insert monkey patch: it strips id before insert even if old handler runs.
- index/admin now load app.js?v=clean20260518a to avoid old cache.
- Added no-cache meta tags.
- JS syntax check: OK


Stable Restore:
- Removed chart/withdrawal patch that caused blank balance/history/live rates.
- Restored last stable working core.
- Added cache-bust app.js?v=stableRestore20260518.
- No SQL required.
- JS syntax check: OK


Targeted Fix:
- Added internal live chart renderer for crypto_live_chart/tradingViewChart/chartContainer.
- Added orderBook renderer.
- Added recentFills/tradeFeed renderer.
- Added missing openHistoryPageFinal function.
- Deposit/wallet/trade core logic untouched.
- No SQL required.
- JS syntax check: OK


Real Chart + Fast PnL Fix:
- Removed fallback chart.
- Chart area now loads real TradingView iframe immediately.
- Pair change reloads TradingView symbol.
- Price/PnL/wallet/history refresh runs every 1 second.
- Order book and trade feed still populate, but chart is real TradingView.
- No SQL required.
- JS syntax check: OK


Leverage 2000x Update:
- Leverage dropdown now includes 1x, 5x, 10x, 25x, 50x, 100x, 250x, 500x, 1000x, 1500x, 2000x.
- Trade PnL calculation uses selected leverage.
- Safety max leverage set to 2000x.
- No SQL required.
- JS syntax check: OK


Auto Liquidation Update:
- Open manual trades are checked every 1 second.
- If loss reaches trade amount, trade auto closes as LIQUIDATED.
- Final PnL is capped at -trade amount.
- Extra negative wallet balance is prevented.
- REAL liquidation loss is saved into wallet_ledger as TRADE_PNL.
- DEMO liquidation also moves trade to history.
- No SQL required.
- JS syntax check: OK


Admin Trade Advanced Options Update:
- Admin managed trade now has Order Type: Market / Limit.
- Market order auto-fills live market price.
- Limit order allows custom entry price.
- Admin managed trade now has leverage 1x to 2000x.
- Selected user's wallet/available amount is shown before trade.
- Trade amount cannot exceed selected user's wallet.
- Admin managed PnL calculation now supports leverage.
- No SQL required.
- JS syntax check: OK


Plan Buy From Wallet Update:
- User plan purchase now deducts plan price from Real Wallet.
- If wallet balance is insufficient, plan purchase is blocked.
- Plan becomes active immediately after wallet deduction.
- wallet_ledger entry type = PLAN_PURCHASE with negative amount.
- payment_requests history is saved as PAID/WALLET.
- User profile plan is updated in Supabase.
- SQL patch included for missing columns.
- JS syntax check: OK


Admin Stability Fix:
- Admin page body marked as data-admin-page.
- Admin tabs/panels stable render.
- Deposit/withdrawal logs render safely.
- Managed/mass trade logs and selectors render safely.
- User wallet preview renders safely.
- Plan, referral, payment, KYC logs render safely if their table bodies exist.
- Admin desktop layout fixed to prevent shifting.
- SQL optional columns added for admin tables if missing.
- JS syntax check: OK


User Wallet Percent AI Trade Update:
- User side AI Trade Settings added: 25%, 50%, 75%, 100%.
- User can turn Auto Admin Trade ON/OFF.
- Admin Bulk/Mass trade can use each user's selected wallet percentage.
- Default bulk mode: Use user selected wallet %.
- Each user's trade amount = user's Real Wallet * selected percentage.
- Users are skipped if auto OFF, AI daily limit complete, wallet low, or amount below ₹100.
- SQL patch adds profiles.ai_trade_percent and profiles.auto_trade_permission.
- JS syntax check: OK
