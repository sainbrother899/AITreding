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
