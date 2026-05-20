AITradeX Phase 1 Base

Brand: AITradeX

User side:
index.html + js/user-app.js

Control center:
admin.html + js/admin-app.js

User panel rule:
Do not use Admin wording in user panel. Use AI / Control-neutral wording only.

Default control center login:
Email: control@aitradex.com
Password: admin123

Phase 1 includes:
- Professional landing page
- User login/register
- User dashboard shell
- Separate control center login
- Separate control center dashboard shell
- Clean files, no old code, no patches

Next phases:
Phase 2: KYC + payment methods
Phase 3: wallet deposit/withdrawal
Phase 4: trading page with TradingView + buy/sell + real/demo
Phase 5: subscriptions + referral first deposit 10%


Root Files Version:
- Removed js/ folder.
- core.js, auth.js, user-app.js, admin-app.js are now in root.
- index.html and admin.html script paths updated.

Phase 1.1: user-app.js and styles.css fully replaced. Leverage up to 2000x. Responsive full-height chart area. No old-code patching.


Phase 1.2 Premium User Polish:
- user-app.js fully replaced.
- styles.css fully replaced.
- Real/Demo switch changed to clear segmented switch.
- Real account selection fixed and visible.
- User dashboard polished with premium trading app style.
- Chart remains responsive with viewport-based height.
- Admin files untouched.


Phase 1.3 Real App User Polish:
- user-app.js fully replaced.
- styles.css fully replaced.
- No patch blocks added.
- Header now shows selected account and balance.
- Home is more compact and trading-app-like.
- Market cards use swipe ticker style on mobile.
- Wallet shell includes professional deposit step preview.
- Trade page made more exchange-style.
- P/L and History pages no longer feel empty.
- Admin side untouched.


Phase 1.4 Selected Account + Compact Polish:
- user-app.js updated by replacing the relevant full UI blocks.
- styles.css updated for compact premium real-app feel.
- Home now shows only selected account balance.
- If Demo is selected, Real balance is not shown on Home selected account card.
- If Real is selected, Demo balance is not shown on Home selected account card.
- Trade page account switch removed from order ticket to avoid confusion.
- Account switch remains in the top header/Home account card.
- UI spacing/cards reduced for less bulky feel.
- Admin side untouched.


Phase 1.5 Nav + History + Profit/Loss Color:
- user-app.js fully replaced.
- styles.css fully replaced.
- Header now has only menu, AITradeX brand and avatar.
- Header account switch/balance removed.
- Wallet page account switch removed.
- History page now contains AI Trade History and Manual Trade History only.
- Wallet history is not shown in History page.
- Profit values use green styling.
- Loss values use red styling.
- Bottom nav and top header made compact.
- Admin side untouched.


Phase 1.6 Avatar + Profile Edit:
- user-app.js updated for header avatar/name and profile editor.
- styles.css updated for avatar/profile UI.
- Header shows round avatar and user name on right side.
- Profile page includes avatar upload and display name edit.
- Avatar and display name currently save in browser localStorage.
- Supabase Storage can be connected later for production avatar upload.
- Admin side untouched.


Phase 1.7 Crypto + Forex Markets:
- user-app.js fully updated for market support.
- styles.css updated for market selector and history layout.
- Trade page now has Crypto / Forex market selector.
- Pair list changes based on selected market.
- TradingView symbol mapping is prepared for crypto and forex.
- Home trending markets include crypto and forex cards.
- History tables include Market column.
- User balance and P/L remain INR-based.
- Admin side untouched.


Phase 1.8 Professional Trade Section:
- user-app.js fully updated for trade page improvements.
- styles.css updated for trade page layout.
- Market + pair selector moved into compact top bar.
- Real/Demo mode notice added.
- Available balance shown on trade page.
- Position size preview added: amount x leverage.
- Market Feed replaces static crypto-only order book.
- TradingView symbol area improved.
- Buy/Sell confirmation summary shell added.
- Admin side untouched.


Phase 1.9 All Popular Market Rates:
- user-app.js updated with final popular crypto and forex pairs.
- Home now shows all selected popular crypto + forex rates in market ticker.
- Trade page shows selected market pair-rate list.
- Positive percentage values are green.
- Negative percentage values are red.
- Pair-rate list changes with Crypto / Forex market selector.
- Admin side untouched.


Phase 2.0 App-Style Selectors:
- user-app.js updated for app-style pair/leverage selectors.
- styles.css updated for selector bottom sheets.
- Native large pair dropdown removed.
- Native large leverage dropdown removed.
- Pair opens in compact app-style bottom sheet.
- Leverage opens in compact chips bottom sheet.
- Rate percentage on top selected pair card/header uses green for plus and red for minus.
- Trade section made cleaner and less browser-default.
- Admin side untouched.


Phase 2.1 TradingView Chart:
- index.html now loads TradingView tv.js for user side chart.
- user-app.js renders actual TradingView widget in Trade page.
- Selected crypto/forex pair maps to TradingView symbol.
- Pair or market change reloads the chart automatically.
- Chart is dark theme and responsive.
- Chart uses viewport-based height and is not cut into a small fixed box.
- Admin side untouched.


Phase 2.2 Chart Controls:
- user-app.js updated with working timeframe controls.
- styles.css updated for bigger chart and settings UI.
- 1m, 5m, 15m, 30m, 1h, 4h, 1D buttons reload TradingView chart.
- Selected timeframe gets active highlight.
- Settings button opens chart settings bottom sheet.
- Settings support Candles / Line / Area chart style.
- Settings support Dark / Light theme.
- Settings support TradingView toolbar Show / Hide.
- Chart area is larger with reduced side padding.
- Admin side untouched.


Phase 2.3 TradingView Loader/Flicker Fix:
- user-app.js updated so TradingView chart shows a dark loading state before widget mount.
- styles.css updated to disable old fake chart pseudo background on TradingView container.
- White loading flash reduced by forcing dark chart container background.
- Old placeholder chart effect no longer appears on TradingView chart frame.
- Admin side untouched.


Phase 2.4 Black Chart Loading:
- user-app.js updated to hide TradingView iframe until it is mounted.
- styles.css updated to keep chart area black/dark during loading.
- White flash is covered by dark loader overlay.
- iframe fades in after TradingView loads.
- Admin side untouched.


Phase 2.5 Trade Header Cleanup:
- user-app.js updated to remove developer-facing TradingView symbol text from top trade card.
- Top pair card now has Change Pair button.
- Scrollable pair-rate cards remain visible.
- Real/Demo notice removed from above chart.
- Account mode and available balance moved inside Order Ticket.
- Market switch remains compact.
- Admin side untouched.


Phase 2.6 Dynamic Trade Feed:
- user-app.js updated with dynamic Trade Feed.
- Trade Feed changes automatically when user switches Crypto / Forex market.
- Selected pair is highlighted in Trade Feed if present.
- No separate user action is needed for Trade Feed.
- styles.css updated for Trade Feed cards.
- Admin side untouched.


Phase 2.7 Pair-Based Feeds:
- user-app.js updated so Market Feed changes by selected pair.
- Trade Feed now generates rows based on selected pair, not just market.
- Crypto pairs show crypto-specific feed text.
- Forex pairs show forex-specific feed text.
- XAU/USD and XAG/USD show metals-specific feed text.
- Selected pair is highlighted in Trade Feed.
- styles.css updated for pair-based feed polish.
- Admin side untouched.
