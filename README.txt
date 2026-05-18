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


Admin Refresh Session Fix:
- admin.html is hard-marked with window.FORCE_ADMIN_PAGE = true.
- Admin page refresh now restores ai_admin_session_v1.
- Admin page will not open user/demo dashboard after refresh.
- Guest/demo login blocked on admin page.
- User session is separated from admin session.
- No SQL required.
- JS syntax check: OK


AI Trade Text + Placement Fix:
- User-facing Admin Trade wording changed to AI Trade.
- Auto Admin Trade changed to Auto AI Trade.
- AI percentage settings card is placed only inside Trade page.
- Dashboard/landing visibility is hidden for AI percentage card if duplicated by old HTML.
- Logic untouched.
- JS syntax check: OK


Admin Bulk/Open Only Update:
- Admin trade area simplified to only two options:
  1) Bulk AI Trade
  2) Open AI Trades
- Generic Trades tab hidden.
- Old Single/Managed trade form hidden.
- Bulk panel close block hidden; close/cancel is handled in Open AI Trades.
- User side untouched.
- No SQL required.
- JS syntax check: OK


Bulk Leverage + Close All AI Trades Update:
- Bulk AI Trade panel now shows Order Type and Leverage 1x to 2000x.
- Open AI Trades panel now has Close All Open AI Trades.
- Open AI Trades panel now has Cancel All Open AI Trades.
- Close All uses typed close price, or live market price if blank.
- PnL calculation includes leverage.
- No SQL required.
- JS syntax check: OK


Admin Leverage Force Fix:
- Leverage field is now force-injected into Bulk AI Trade panel by JavaScript.
- Order Type and Leverage are visible even if HTML placement fails.
- Open Bulk AI Trade bridges selected leverage/order type into existing trade logic.
- No SQL required.
- JS syntax check: OK


Direct Admin Leverage Fix:
- Leverage and Order Type are now directly written inside admin.html Bulk AI Trade form.
- Removed unreliable force-injection block.
- Bulk trade click stores selected leverage/order type before opening trade.
- No SQL required.
- JS syntax check: OK


Admin Users Panel Update:
- Added Users tab to admin panel.
- User list includes name/email, plan, wallet, deposits, P/L+bonus, AI %, AI used/limit, status.
- User detail card with wallet summary.
- Admin can change plan, AI trade percent, AI ON/OFF, Active/Blocked.
- Admin can Add/Deduct wallet balance with ledger note.
- SQL patch included for optional columns.
- JS syntax check: OK


Admin Users Force Visible Fix:
- Users tab and panel are now created by JavaScript if missing from admin.html.
- This fixes issue where Users option did not appear on admin panel.
- User list, wallet, plan, AI %, status, AI ON/OFF, and wallet adjustment included.
- Cache-busted admin app.js.
- SQL patch included for optional columns.
- JS syntax check: OK


Admin Users Hard Insert:
- Users tab is directly inserted into admin.html inside the existing admin tabs.
- Users panel is directly inserted before existing admin panels and active by default.
- Previous force panel JS removed.
- Includes user list, wallet, plan, AI %, AI ON/OFF, active/block, wallet adjustment.
- Cache bust added.
- SQL optional patch included.
- JS syntax check: OK


Admin Users Menu Exact Fix:
- Fixed previous mistake: Users tab was inserted above login page, not inside real admin controls.
- Users tab is now inserted inside .admin-menu before Overview.
- Wrong top-level Users tab removed.
- Users panel exists inside admin-content.
- Alias bridge supports old/new Users panel element IDs.
- Verification: has_in_menu=True, has_top_wrong=False, has_panel=True
- JS syntax check: OK


Premium Mobile UI Polish:
- Home ticker converted to clean coin cards.
- Account mode redesigned: clickable Demo/Real cards, duplicate old switch hidden.
- AI trades today gets progress bar.
- Wallet/history tables get mobile card layout to remove horizontal scrollbars.
- Wallet note shortened.
- PnL page gets performance overview card and mini trend chart.
- Bottom navigation safe padding/overlap fix.
- Global premium dark card polish.
- Logic/Supabase/Admin functionality untouched.
- No SQL required.
- JS syntax check: OK


Premium UI Stable Layout Fix:
- Removed previous dynamic UI insertion that caused layout jumping/shifting.
- Added stable CSS-only polish.
- Fixed page width and overflow-x.
- Bottom nav fixed safely without overlap.
- Tables scroll only inside their own container.
- Cards have stable spacing and no layout animation.
- Ticker grid stable.
- No logic/Supabase changes.
- No SQL required.
- JS syntax check: OK


Home Header + Account Cleanup:
- Logout button is forced visible in user header.
- Hello/Welcome card moves to top of dashboard.
- Duplicate Demo/Real switch buttons and Switch Account text hidden.
- Demo/Real balance cards become clickable.
- AI/AI Trades Today card hidden.
- Ticker cards get readable line spacing.
- Wallet long note shortened.
- No logic/Supabase changes.
- No SQL required.
- JS syntax check: OK


User UI Structure Clean Rebuild:
- Removed previous dynamic patch blocks that caused duplicate/moving layout.
- User home now gets a fixed clean shell:
  Header + direct Logout, Hello/Account Mode, clean ticker cards, stat cards, AI signal card.
- Original home clutter is hidden only in dashboard area.
- Demo/Real duplicate buttons removed from visible UI; account cards are clickable.
- AI/AI Trades Today card removed from home view.
- Wallet note shortened.
- Tables converted to mobile card lists for history/deposit/withdrawal while keeping desktop tables.
- Admin/Supabase/trade/deposit logic untouched.
- No SQL required.
- JS syntax check: OK


Trade Page Positions + Chart Fix:
- Manual/user live trades now render in Trade page under Open Positions.
- Each open manual trade card shows coin, side, leverage, amount, entry, live price, live PnL, and Close Trade button.
- AI Trade Settings/percentage control is moved to bottom of Home page.
- Trade page chart is enlarged.
- AI/Bulk trades remain admin-managed; manual trades remain user-closeable.
- No SQL required.
- JS syntax check: OK


Home AI Control Visible Fix:
- AI Trade Control card is force-rendered at bottom of Home/cleanHomeShell.
- Old trade-page AI control card remains hidden.
- Percent buttons 25/50/75/100 update user setting.
- Auto AI Trade toggle updates user setting.
- No SQL required.
- JS syntax check: OK


Home AI Control No-Blink + Modern Toggle:
- Removed blinking force-render block.
- AI Control card is created/mounted once only.
- Updates are value-only every 3 seconds, no DOM rebuild.
- Auto AI Trade checkbox replaced with modern toggle switch UI.
- 25/50/75/100 buttons remain functional.
- No SQL required.
- JS syntax check: OK


AI Control Permanent Fix:
- Removed old Trade Page Positions + Home AI Settings block that was repeatedly moving/hiding AI Control.
- Re-added only manual open positions and big chart logic, without touching AI Control.
- Added visibility guard so Home AI Control cannot be hidden by old classes.
- Fixes AI Control appearing/disappearing repeatedly.
- Previous old block removed: True
- No SQL required.
- JS syntax check: OK
