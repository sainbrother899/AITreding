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


AI Control Home Only Final Fix:
- Removed previous AI control moving/visibility blocks.
- Original Trade page AI percentage card is force-hidden.
- Only one Home AI Control card is created and kept visible.
- Duplicate Home AI Control cards are removed automatically.
- Modern toggle retained.
- No SQL required.
- JS syntax check: OK


AI Control Old Code Removed:
- Removed old AI Control HTML card from index.html.
- Removed old AI Control JS blocks and CSS blocks.
- Added one clean Home-only AI Control implementation.
- Old aiTradePercentGrid in index: False
- app aiTradePercentGrid references: 1 (only defensive cleanup expected)
- app homeAiTradeControlCard refs: 4
- Removed HTML blocks count: 1
- No SQL required.
- JS syntax check: OK


Old UI Code Cleaned:
- Removed old useless UI patch blocks from app.js.
- Removed old AI Control HTML/card from index.html if present.
- Removed obsolete CSS patch blocks.
- Kept core logic, Supabase, trade, wallet, deposit, admin features untouched.
- Kept one clean Home-only AI Control implementation.
- Verification: {'index_has_old_ai_grid': False, 'app_old_ai_grid_refs': 1, 'app_old_ui_markers_left': [], 'css_old_markers_left': [], 'removed_js_blocks': ['Admin mass trade advanced field bridge', 'Admin page guest/demo guard'], 'removed_css_blocks': ['ADMIN BULK LEVERAGE FORCE VISIBLE UI'], 'removed_func_count': 0, 'removed_html_count': 0}
- No SQL required.
- JS syntax check: OK


AI Control Blink Root Fix:
- Root cause found: cleanHomeShell was being rebuilt every 1.5s using innerHTML.
- That rebuild was deleting the AI Control card and recreating it, causing blinking.
- Stopped repeated home shell rebuild interval.
- AI Control card is now appended outside cleanHomeShell, so it remains stable.
- Added guard to move card out if cached/old render puts it inside rebuilt shell.
- interval_replaced=True
- ctarget_replaced=True
- No SQL required.
- JS syntax check: OK


Home Rate Live + Static Shell Fix:
- Home shell now builds once and does not rebuild with innerHTML repeatedly.
- Home rate cards update values every 1 second.
- Old ticker/rate strip outside cleanHomeShell is hidden, including rate strip between AI Signal and Live Position.
- Demo/Real balances, Today PnL, Signal fields update without rebuilding cards.
- AI Control remains stable outside rebuilt shell.
- No SQL required.
- JS syntax check: OK


Floating Live Position Bar:
- One-line floating manual position bar added above bottom nav.
- Shows only when user has open manual/live trade.
- Shows coin, BUY/SELL, leverage, total live PnL, and Close button.
- Profit is green everywhere; loss is red everywhere.
- Multiple open trades show Positions count and total PnL.
- AI/admin trades are not user-closeable from this bar.
- No SQL required.
- JS syntax check: OK


Global Profit/Loss Color Fix:
- Profit / positive PnL is green across the app.
- Loss / negative PnL is red across the app.
- Applies to Home, PnL page, History, Wallet/ledger records, Open Positions, Floating live position bar, and admin/user tables.
- Runs after render so dynamic values also update color.
- No SQL required.
- JS syntax check: OK


Floating Bar Size Polish:
- Floating live position bar width/height increased slightly.
- Text, PnL amount, and Close button are larger and more readable.
- Still remains one-line compact bar above bottom navigation.
- No logic changes.
- No SQL required.
- JS syntax check: OK


Manual History Stability Fix:
- Manual closed trade PnL is now frozen at close time.
- updateTradePnl() no longer recalculates CLOSED trade PnL.
- closeTrade() now stores close price/current price and pnlFrozen=true.
- Manual closed trades are backed up separately in localStorage per user + mode.
- render()/saveState()/history restore from backup if state gets overwritten.
- Manual history should no longer disappear after a short time/render refresh.
- Patched updateTradePnl: True
- Patched closeTrade: True
- Patched renderHistory: True
- No SQL required.
- JS syntax check: OK


Safe Old Code Cleanup:
- Removed obsolete UI-only patch blocks and old duplicate AI-control code.
- Kept active stable user UI, live rates, home-only AI control, floating bar, manual positions, global P/L color, and manual history stability.
- Core logic, Supabase, trade, wallet, deposit, admin users, and bulk trade functions are untouched.
- Cleanup summary: {"app_js_removed_chars": 10194, "css_removed_chars": 3303, "removed_js_blocks": ["ADMIN USERS HARD INSERT LOGIC"], "removed_css_blocks": ["ADMIN USERS FORCE VISIBLE PANEL UI", "ADMIN USERS HARD INSERT UI"], "removed_old_ai_html": 0, "removed_orphan_functions": 0, "required_active_blocks": {"USER UI STRUCTURE CLEAN REBUILD": true, "HOME RATE LIVE + STATIC SHELL FIX": true, "CLEAN HOME AI CONTROL ONLY": true, "TRADE PAGE OPEN POSITIONS + BIG CHART ONLY": true, "FLOATING LIVE POSITION BAR": true, "GLOBAL PROFIT LOSS COLOR FIX": true, "MANUAL TRADE HISTORY PERMANENT BACKUP": true}, "syntax": "OK"}


Final Stability Pack:
- Manual trade history now has local backup + optional Supabase manual_trades permanent save/load.
- Closed manual trade PnL remains frozen; it will not keep changing with live price.
- closeTrade wrapper saves closed REAL manual trades to Supabase manual_trades when table exists.
- Demo manual history stays local only.
- Global P/L color scanner throttled to reduce load.
- Floating bar refresh reduced slightly to reduce mobile lag while staying live.
- Current UI and admin features kept.
- SQL patch included for manual_trades table. Run it once in Supabase for permanent cross-device manual history.
- setInterval count after pack: 21
- Markers: {"final_pack": true, "manual_table_sql": true, "global_color": true, "floating_bar": true, "home_static": true}
- JS syntax check: OK


Old UI Flash Safe Fix:
- Non-destructive fix: old Home HTML was NOT removed.
- App is hidden briefly during refresh until Clean Home UI is ready, preventing old UI flash.
- Clean UI renderer is triggered early after load.
- Safety fallback shows app after 2.5 seconds even if clean UI fails, so no blank page.
- Existing logic/UI/features untouched.
- No SQL required.
- Summary: {"boot_script_added": true, "boot_style_added": true, "runtime_guard_added": true, "syntax": "OK"}


Duplicate Home Header Removed:
- Removed the duplicate clean Home header from the generated Home shell.
- Top/original app header remains visible.
- Only red-circled duplicate "AI Trading Assistant + Logout" inside Home content is removed.
- Home cards, account cards, rate cards, AI Control, floating bar, trade/wallet/admin logic untouched.
- No SQL required.
- Summary: {"removed_exact_header_blocks": 0, "removed_fallback_header_blocks": 2, "syntax": "OK"}


Clean Top Header Menu:
- Top header changed to: ☰  AI Trading Assistant  Sain Brother.
- Confusing 3-dot button removed/replaced by clear menu icon.
- Menu opens Home, Trade, Wallet, PnL, History, Logout.
- Duplicate Home header remains removed.
- No SQL required.
- JS syntax check: OK


Trade Chart Bigger Fix:
- Trade chart height increased.
- Mobile chart height around 495-510px.
- Desktop/tablet chart height around 540px.
- Chart card spacing optimized.
- No trade logic changes.
- No SQL required.
- JS syntax check: OK


Trade Cards Wider Fix:
- Trade page cards widened by reducing side padding.
- Chart card and order ticket use more screen width.
- Inputs/selects/buttons remain full-width and balanced.
- Home/Wallet/Admin unchanged.
- No SQL required.
- JS syntax check: OK


Trade Page Clean Chart + Order:
- Removed/hid duplicate custom timeframe row above chart.
- Removed/hid duplicate outer live price/rate above chart.
- Chart uses freed space and is larger.
- "Place Simulation Order" changed to "Place Buy/Sell Order".
- SIM badge hidden.
- Removed "Simulation only. Real exchange order/API is not connected." warning.
- Order ticket spacing compacted.
- No SQL required.
- JS syntax check: /mnt/data/AI-Trading-Trade-Page-Clean-Chart-Order/app.js:4399
        if (/^Place Buy/Sell Order$/i.test(txt)) {
            ^

SyntaxError: Invalid regular expression flags
[90m    at wrapSafe (node:internal/modules/cjs/loader:1662:18)[39m
[90m    at checkSyntax (node:internal/main/check_syntax:


Syntax Fix:
- Fixed regex escape for Buy/Sell order title.
- JS syntax check: OK


Order Book + Trade Feed Restore Fix:
- Restored Order Book and Trade Feed sections if previous cleanup hid them.
- Removed overly broad CSS that hid generic chart card rows.
- Only exact duplicate timeframe buttons stay hidden.
- Chart cleanup, order title, SIM warning removal remain.
- No SQL required.
- JS syntax check: OK


Trade Page Visibility Fix:
- Fixes issue where full Trade page appears on Home/Wallet/PnL/History.
- Trade page is now visible only when Trade tab/page is active.
- Home, Wallet, PnL, History, Plans, More remain separate pages.
- Floating live position bar still works across pages.
- No SQL required.
- JS syntax check: OK


Trade Exact Structure Fix:
- Read actual Trade page structure before patching.
- Removed duplicate pro-pair-line live price row from index.
- Removed duplicate pro-time-tabs timeframe row from index.
- Replaced TradingView renderer to remove extra chart header/price above iframe.
- Runtime moves Order Ticket and Order Book/Trade Feed outside chart card as separate cards.
- Chart card now contains only compact title + actual chart.
- Order Book and Trade Feed forced visible.
- Place Buy/Sell Order remains.
- No SQL required.
- Removed blocks: {"pro_pair_line": 1, "pro_time_tabs": 1}
- Replaced chart function: True
- JS syntax check: OK


TradingView Chart Height Responsive Fix:
- Fixes chart bottom getting cut off.
- Chart parent/card and iframe now use the same responsive viewport-based height.
- Uses visualViewport where available to handle mobile browser address bars.
- Removes max-height/clipping and sets overflow visible on chart card/host.
- Overrides older fixed height CSS that could crop the bottom toolbar/price scale.
- Order Ticket, Order Book, Trade Feed untouched.
- No SQL required.
- JS syntax check: OK


TradingView Chart Bigger Box Fix:
- Reverted the previous viewport-shrink height logic that made the chart box smaller.
- Chart box is now bigger: mobile 620px, tablet 660px, desktop 700px.
- Parent card, chart host, and iframe all use the same height to prevent bottom cut-off.
- Order Ticket, Order Book, Trade Feed untouched.
- No SQL required.
- JS syntax check: OK


TradingView Responsive Chart Fix:
- Removed fixed px chart box logic that made the box too big.
- Added responsive chart height using clamp() + dvh/vh.
- Chart host and iframe use matched responsive height.
- Mobile height is balanced around 410-540px depending on screen.
- Desktop/tablet can grow to 680px.
- Order Ticket, Order Book, Trade Feed untouched.
- No SQL required.
- JS syntax check: OK


TradingView Full Fit Final:
- Removed conflicting previous chart sizing blocks: ['TRADINGVIEW RESPONSIVE CHART FIX', 'TRADE PAGE CLEAN CHART + ORDER TEXT']
- Final hierarchy fixed: card auto height, chart host responsive height, iframe 100% height.
- Chart height is responsive via visualViewport/window size, not fixed px.
- Prevents giant empty box while keeping TradingView bottom axis/controls visible.
- Duplicate outer rate/timeframe/header hidden.
- Order Ticket, Order Book, Trade Feed untouched.
- No SQL required.
- JS syntax check: OK


Chart CSS Conflict Cleanup Final:
- Removed old conflicting chart sizing blocks: ['TRADINGVIEW FULL FIT FINAL']
- Added one final chart sizing system that controls card/host/iframe together.
- Neutralizes old 330/360/520/fixed-height chart rules with final selectors.
- Chart card: auto height + overflow visible.
- Chart host: responsive height + no max-height clipping.
- iframe: exact same height as host.
- Duplicate outer chart controls hidden; TradingView internal controls remain visible.
- Order Ticket / Order Book / Trade Feed untouched.
- No SQL required.
- Diagnostics: {"removed_blocks": ["TRADINGVIEW FULL FIT FINAL"], "remaining_crypto_live_chart_mentions": 21, "remaining_520px_mentions": 21, "remaining_330px_mentions": 10, "remaining_360px_mentions": 7, "syntax": "OK"}


Chart Important Override Fix:
- Previous fix did not apply because older !important chart heights were still winning.
- Removed earlier chart sizing blocks and added a stronger final override.
- Final CSS no longer depends on body[data-active-page="trade"].
- JS uses style.setProperty(..., "important") to override old CSS !important.
- #crypto_live_chart, its iframe, and parent card now receive the same final responsive height.
- Duplicate outer timeframe/live price rows remain hidden.
- Order Ticket / Order Book / Trade Feed untouched.
- No SQL required.
- Diagnostics: {"syntax": "OK", "styles_crypto_mentions": 23, "app_has_important_fix": true, "css_has_important_fix": true}


PC Same As Mobile Layout:
- Uses the uploaded mobile-working base.
- PC/Desktop no longer uses separate desktop grid layout.
- On screens 900px+, the app is shown in a centered mobile-width shell.
- Mobile below 900px is untouched.
- This keeps the same layout that works on mobile and prevents PC desktop grid issues.
- Chart logic untouched.
- Wallet/Trade/Home/History all use same mobile-style structure on PC.
- No SQL required.
- JS syntax check: OK


Wallet Safe Minimal Fix:
- Built from the last stable mobile/PC same-as-mobile base, not the broken Wallet Clean Update.
- No duplicate Wallet Overview card added.
- Existing wallet card remains.
- walletPageBalance now shows Real Wallet + Open PnL.
- Withdrawal history colspan fixed to 5 columns and account/UPI column included.
- Adds only a small Available for Withdrawal note in existing wallet card.
- Adds withdrawal modal available amount note if modal exists.
- Adds deposit screenshot note only.
- Existing deposit/withdrawal history tables remain working.
- No SQL required.
- Patched balance line: True
- Patched withdrawal log: True
- JS syntax check: OK


Wallet History Big Cards:
- Deposit and Withdrawal history now render as full-width big mobile cards.
- Uses correct app sources: state.depositRequests / state.withdrawalRequests, with fallback to state.deposits / state.withdrawals.
- Old tiny table/mobile cards are hidden on mobile and PC-same-mobile shell.
- Card layout matches Trade history style: large amount, status badge, details rows.
- Existing wallet balance/withdrawable minimal fix remains untouched.
- No SQL required.
- JS syntax check: OK


Wallet History Only New Cards:
- Keeps the new big Deposit/Withdrawal history cards visible.
- Hides old wallet history tables and old generated small cards.
- Existing wallet balance/withdrawable logic untouched.
- Mobile layout untouched except old duplicate history hidden.
- No SQL required.
- JS syntax check: OK


Menu KYC Profile Referral Fix:
- Top header menu no longer repeats bottom nav options.
- Menu options are now: Profile, KYC Verification, Referral, My Payment Methods, Support, Logout.
- Added lightweight menu detail panels for these items.
- Bottom nav remains for Home, Trade, Wallet, PnL, History.
- No SQL required.
- JS syntax check: OK
- Replaced existing menu HTML: True


Menu Full Pages Fix:
- Menu options now open full-page views, not small popups.
- Added full pages for Profile, KYC, Referral, My Payment Methods, and Support.
- My Payment Methods includes Add Method form with UPI/Bank fields and Pending status.
- KYC page has basic submit form and pending status handling.
- Referral page has copy link button.
- Back button closes the full page.
- Bottom nav remains separate for Home/Trade/Wallet/PnL/History.
- No SQL required for this UI/local-state version.
- JS syntax check: OK


Menu Real Pages Final:
- Removed temporary injected full-page panel behavior.
- Added real HTML sections in index.html:
  profilePage, kycPage, referralPage, paymentMethodsPage, supportPage.
- Menu click now opens actual page sections, similar to bottom nav pages.
- Pages are mobile-friendly and match app card style.
- Profile/KYC/Referral/Payment Methods/Support each has proper page content.
- My Payment Methods supports UPI/Bank add form with Pending status in local state.
- Bottom nav pages remain Home/Trade/Wallet/PnL/History.
- No SQL required for this local/UI version.
- JS syntax check: OK


Menu Pages Stay + Header Flash Fix:
- Fixes menu real pages closing immediately and returning to Home.
- Page visibility logic now respects Profile/KYC/Referral/Payment Methods/Support pages.
- Menu pages stay open until Back or bottom nav is clicked.
- Added early header boot hide so old top header does not flash on refresh.
- Clean header becomes visible after JS applies the clean header.
- No SQL required.
- JS syntax check: OK


Payment KYC Admin Approval Final:
- Payment method add now requires KYC Approved.
- Account holder name is auto-filled from KYC/name and locked.
- User-added payout method saves as PENDING.
- Withdrawal UI is blocked unless user has an APPROVED payout method.
- Withdrawal form shows only approved payout methods where possible.
- Admin section added: Payout Method Requests.
- Admin can Approve/Reject payout methods.
- Admin request card shows Holder Name, KYC Name, and Name Match warning.
- Admin section added: Payment Settings for deposit UPI/Bank details.
- User wallet shows admin deposit payment settings where possible.
- Data is local-state/localStorage for now; no SQL required in this UI version.
- JS syntax check: OK


Admin PC Layout Restore:
- Fixes admin panel being affected by user PC same-as-mobile layout.
- User side PC/mobile layout remains unchanged.
- Admin page on PC uses full-width dashboard layout again.
- Admin sidebar/content grid restored where available.
- Admin cards/tables no longer forced to 430px mobile width.
- Admin Payment Settings and Payout Method Requests layout improved for desktop.
- Bottom nav/floating user bar hidden on admin PC.
- No SQL required.
- JS syntax check: OK


Admin Payment Tabs Fix:
- Payment Settings and Payout Method Requests no longer stay appended at bottom.
- Added admin menu/sidebar buttons:
  - Payout Method Requests
  - Payment Settings
- Clicking these buttons opens their section like other admin options.
- New payment sections stay hidden until clicked.
- Clicking any normal admin option hides payment sections again.
- Existing admin layout restore remains included.
- No SQL required.
- JS syntax check: OK


Admin Payment Menu Force Fix:
- Stronger injection for admin menu/sidebar buttons.
- Adds buttons:
  - Payout Method Requests
  - Payment Settings
- If sidebar selector fails, creates Admin Payment Quick Menu at top as fallback.
- Payment sections remain hidden until button click.
- Normal admin menu click hides payment sections again.
- Existing admin/payment logic retained.
- No SQL required.
- JS syntax check: OK


Admin Payment Sections Stay Fix:
- Fixes Payment Settings / Payout Method Requests opening then disappearing after a few seconds.
- Keeps the selected payment admin section locked open until another normal admin option is clicked.
- Uses localStorage/adminActiveSection to survive old admin render intervals.
- Payment panels stay hidden by default until clicked.
- Payout Method Requests and Payment Settings inner content remains visible.
- No SQL required.
- JS syntax check: OK
