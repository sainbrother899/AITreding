(() => {
  const App = window.AITradeX;
  const Auth = window.AITradeXAuth;
  const root = document.getElementById("app");

  let page = localStorage.getItem("AITradeX_ACTIVE_PAGE") || "home";
  let authMode = "login";
  const referralParam = new URLSearchParams(window.location.search).get("ref") || "";
  let accountMode = "REAL";
  localStorage.setItem("AITradeX_ACCOUNT_MODE", "REAL");
  let drawerOpen = false;
  let autoPercent = 75;
  let autoTradeOn = true;
  let selectedMarket = localStorage.getItem("AITradeX_SELECTED_MARKET") || "CRYPTO";
  let selectedPair = localStorage.getItem("AITradeX_SELECTED_PAIR") || "BTC/USDT";
  let tradeAmountPreview = Number(localStorage.getItem("AITradeX_TRADE_AMOUNT_PREVIEW") || 1000);
  let tradeLeveragePreview = Number(localStorage.getItem("AITradeX_TRADE_LEVERAGE_PREVIEW") || 10);
  let tradeOrderType = localStorage.getItem("AITradeX_TRADE_ORDER_TYPE") || "MARKET";
  let tradeLimitPrice = localStorage.getItem("AITradeX_TRADE_LIMIT_PRICE") || "";
  let tradeOrderNotice = null;
  let selectorSheet = null;
  let chartInterval = localStorage.getItem("AITradeX_CHART_INTERVAL") || "15";
  let chartStyle = localStorage.getItem("AITradeX_CHART_STYLE") || "1";
  let chartTheme = localStorage.getItem("AITradeX_CHART_THEME") || "dark";
  let chartToolbar = false; // Force native clean chart by default; ignore old cached toolbar preference.
  let kycStep = Number(localStorage.getItem("AITradeX_KYC_STEP") || 1);
    let walletMode = localStorage.getItem("AITradeX_WALLET_MODE") || "DEPOSIT";
  let walletRequestPage = Number(localStorage.getItem("AITradeX_WALLET_REQUEST_PAGE") || 0);
  let walletLedgerPage = Number(localStorage.getItem("AITradeX_WALLET_LEDGER_PAGE") || 0);
  let walletHistoryFilter = localStorage.getItem("AITradeX_WALLET_HISTORY_FILTER") || "ALL";
  let walletRecordsTab = localStorage.getItem("AITradeX_WALLET_RECORDS_TAB") || "REQUESTS";
  let depositStep = Number(localStorage.getItem("AITradeX_DEPOSIT_STEP") || 1);
  let withdrawalStep = Number(localStorage.getItem("AITradeX_WITHDRAWAL_STEP") || 1);
  let depositDraft = readJson("AITradeX_DEPOSIT_DRAFT", { amount: "", type: "UPI", utr: "" });
  let withdrawalDraft = readJson("AITradeX_WITHDRAWAL_DRAFT", { amount: "", methodId: "" });
  let priceRefreshTimer = null;
  let manualRiskCloseLock = false;
  let manualCloseSelectorOpen = false;
  let manualHistoryPageIndex = Number(localStorage.getItem("AITradeX_MANUAL_HISTORY_PAGE") || 0);
  let aiHistoryPageIndex = Number(localStorage.getItem("AITradeX_AI_HISTORY_PAGE") || 0);
  let historyViewTab = localStorage.getItem("AITradeX_HISTORY_VIEW_TAB") || "ALL";
  let historySearch = localStorage.getItem("AITradeX_HISTORY_SEARCH") || "";
  let historyPageIndex = Number(localStorage.getItem("AITradeX_HISTORY_PAGE") || 0);
  let historyExpandedId = localStorage.getItem("AITradeX_HISTORY_EXPANDED") || "";
  let orderViewTab = localStorage.getItem("AITradeX_ORDER_VIEW_TAB") || "ALL";
  let aiOffConfirmOpen = false;

  const marketPairs = App.marketPairs || { CRYPTO: [], FOREX: [] };
  const activeMarket = "CRYPTO";
  function normalizedAccountMode(value = accountMode) {
    return "REAL";
  }
  function sameAccountType(rowAccountType, selected = accountMode) {
    return String(rowAccountType || "REAL").toUpperCase() !== "DEMO";
  }
  function normalizeTradeRowForDisplay(t) {
    if (!t) return t;
    t.tradeType = String(t.tradeType || t.trade_type || "").toUpperCase();
    t.status = String(t.status || "").toUpperCase();
    t.accountType = normalizedAccountMode(t.accountType || t.account_type || accountMode);
    return t;
  }
  function isTradeActivePair(pair) {
    return App.isCryptoPair ? App.isCryptoPair(pair) : (marketPairs.CRYPTO || []).some(item => item.pair === pair);
  }
  function isUpcomingPair(pair) {
    return !!pair && !isTradeActivePair(pair);
  }
  function pairsForMarket() {
    return marketPairs[selectedMarket] || marketPairs.CRYPTO;
  }

  function usdtRateValue() {
    const rate = Number(App.usdtInrRate ? App.usdtInrRate() : (App.state?.settings?.usdtInrRate || 95));
    return Number.isFinite(rate) && rate > 0 ? rate : 95;
  }

  function usdtRateChip(extraClass = "") {
    const rate = usdtRateValue();
    return `<span class="usdt-rate-chip ${App.escapeHtml(extraClass)}"><i>₮</i><b>1 USDT = ${App.money(rate)}</b></span>`;
  }

  function allTrendingPairs() {
    return [...marketPairs.CRYPTO, ...marketPairs.FOREX];
  }

  function upcomingPairView(item) {
    return {
      ...item,
      price: "Coming Soon",
      rawPrice: 0,
      change: "Upcoming",
      mood: "upcoming",
      signal: "SOON",
      priceSource: item?.pair === "XAU/USD" || item?.pair === "XAG/USD" ? "Metals Market" : "Forex Market"
    };
  }

  function marketFeedForPair() {
    const pair = selectedPairData();
    if (isUpcomingPair(pair.pair)) {
      return [
        { left: "Market Status", mid: "Coming Soon", right: "Upcoming", mood: "upcoming" },
        { left: "Trading Access", mid: "Disabled", right: "Soon", mood: "upcoming" },
        { left: "Data Feed", mid: "Premium API", right: "Planned", mood: "upcoming" },
        { left: "Current Active", mid: "Crypto", right: "Live", mood: "up" }
      ];
    }

    return [
      { left: "Bid", mid: pair.price, right: "0.02%", mood: "up" },
      { left: "Ask", mid: pair.price, right: "0.03%", mood: "up" },
      { left: "Volume", mid: "Rising", right: pair.change, mood: pair.mood },
      { left: "Depth", mid: "Active", right: pair.signal, mood: pair.signal === "SELL" ? "down" : "up" }
    ];
  }

  function tradeFeedForMarket() {
    const pair = selectedPairData();
    if (isUpcomingPair(pair.pair)) {
      return [
        { pair: pair.pair, action: "Market launch preparation", size: "Coming Soon", lev: "Soon", change: "Upcoming", mood: "upcoming", time: "Soon" },
        { pair: pair.pair, action: "Premium data feed integration", size: "Planned", lev: "Soon", change: "Upcoming", mood: "upcoming", time: "Soon" },
        { pair: pair.pair, action: "Trading access disabled for now", size: "Crypto Active", lev: "Live", change: "Active", mood: "up", time: "Now" }
      ];
    }

    return [
      { pair: pair.pair, action: `${pair.signal} signal detected`, size: "₹22,000", lev: "20x", change: pair.change, mood: pair.mood, time: "Now" },
      { pair: pair.pair, action: "Volume movement watch", size: "₹14,000", lev: "10x", change: pair.mood === "up" ? "+0.42%" : "-0.42%", mood: pair.mood, time: "1m" },
      { pair: pair.pair, action: "Breakout zone active", size: "₹9,500", lev: "50x", change: pair.mood === "up" ? "+0.27%" : "-0.27%", mood: pair.mood, time: "2m" },
      { pair: pair.pair, action: "AI risk monitor", size: "₹5,000", lev: "100x", change: pair.mood === "up" ? "+0.16%" : "-0.16%", mood: pair.mood, time: "4m" }
    ];
  }

  const leverageOptions = [1, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];

  function user() {
    return App.currentUser();
  }

  function currentBalance() {
    const u = user();
    if (!u) return 0;
    return App.realBalance(u.id);
  }

  function manualOpenPositions() {
    const u = user();
    if (!u) return [];
    return (App.state.trades || [])
      .map(normalizeTradeRowForDisplay)
      .filter(t =>
        t.userId === u.id &&
        String(t.tradeType || "").toUpperCase() === "MANUAL" &&
        String(t.status || "").toUpperCase() === "OPEN" &&
        sameAccountType(t.accountType, accountMode)
      );
  }



  function aiTradeTypeOf(row) {
    return String(row?.tradeType || row?.trade_type || "").toUpperCase();
  }

  function tradeStatusOf(row) {
    return String(row?.status || "").toUpperCase();
  }

  function aiTradeRows({ status = "", liveOnly = false, instantOnly = false } = {}) {
    const u = user();
    if (!u) return [];
    const wantedStatus = String(status || "").toUpperCase();
    return (App.state.trades || [])
      .map(normalizeTradeRowForDisplay)
      .filter(t => {
        if (t.userId !== u.id) return false;
        const type = aiTradeTypeOf(t);
        if (liveOnly && type !== "AI_LIVE") return false;
        if (instantOnly && type !== "AI_AUTO") return false;
        if (!liveOnly && !instantOnly && !["AI_AUTO", "AI_LIVE"].includes(type)) return false;
        if (wantedStatus && tradeStatusOf(t) !== wantedStatus) return false;
        return true;
      })
      .sort((a, b) => Date.parse(b.closedAt || b.createdAt || b.openedAt || 0) - Date.parse(a.closedAt || a.createdAt || a.openedAt || 0));
  }

  function aiOpenPositions() {
    return aiTradeRows({ status: "OPEN", liveOnly: true });
  }

  function aiLiveMarginLockExists(position) {
    return !!(position && App.hasLedgerEntry && App.hasLedgerEntry({
      userId: position.userId,
      accountType: "REAL",
      type: "AI_LIVE_MARGIN_LOCK",
      referenceId: position.id
    }));
  }

  async function reconcileUserAiLiveMarginLocks() {
    const u = user();
    if (!u) return 0;
    let fixed = 0;
    for (const position of aiOpenPositions()) {
      if (aiLiveMarginLockExists(position)) {
        position.marginLocked = true;
        continue;
      }
      const margin = Number(Number(position.marginAmount || 0).toFixed(2));
      if (!Number.isFinite(margin) || margin <= 0) continue;
      try {
        const before = App.realBalance(u.id);
        const added = App.addLedgerAsync ? await App.addLedgerAsync({
          userId: u.id,
          accountType: "REAL",
          type: "AI_LIVE_MARGIN_LOCK",
          amount: -margin,
          referenceId: position.id,
          note: `${position.pair} AI live ${position.side || "BUY"} amount locked`
        }) : App.addLedger({
          userId: u.id,
          accountType: "REAL",
          type: "AI_LIVE_MARGIN_LOCK",
          amount: -margin,
          referenceId: position.id,
          note: `${position.pair} AI live ${position.side || "BUY"} amount locked`
        });
        if (added === false && !aiLiveMarginLockExists(position)) throw new Error("AI amount lock was not applied");
        position.marginLocked = true;
        position.balanceBefore = Number(before.toFixed(2));
        position.balanceAfterOpen = Number(App.realBalance(u.id).toFixed(2));
        position.marginLockedAt = position.marginLockedAt || new Date().toISOString();
        if (App.isDatabaseMode?.() && window.AITradeXDB?.writeTrade) {
          await window.AITradeXDB.writeTrade(position);
        }
        fixed += 1;
      } catch (error) {
        position.marginLockError = error.message || "AI amount lock failed";
      }
    }
    if (fixed) App.saveState();
    return fixed;
  }

  function pendingManualOrders() {
    const u = user();
    if (!u) return [];
    return (App.state.trades || [])
      .map(normalizeTradeRowForDisplay)
      .filter(t =>
        t.userId === u.id &&
        String(t.tradeType || "").toUpperCase() === "MANUAL" &&
        ["PENDING", "LIMIT_PENDING"].includes(String(t.status || "").toUpperCase()) &&
        sameAccountType(t.accountType, accountMode)
      );
  }

  function numericPriceFromText(value) {
    const cleaned = String(value || "").replace(/,/g, "").match(/[-+]?\d*\.?\d+/);
    const num = cleaned ? Number(cleaned[0]) : 0;
    return Number.isFinite(num) && num > 0 ? num : 0;
  }

  function tradeRawPrice(pair, value, opts = {}) {
    if (App.tradeRawPrice) return App.tradeRawPrice(pair, value, opts);
    const n = Number(value || 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function normalizeTradePriceRow(pair, row, reference = 0) {
    if (!row) return null;
    const cleanPair = pair || row.pair || selectedPair;
    // If a data row already has rawPrice or came from a live API/cache, trust row.price as raw.
    // Display text can be INR, so passing raw+INR display into tradeRawPrice would double-convert.
    const trustedRaw = Number(row.rawPrice || 0) || (row.sourceType || row.source || row.fetchedAt ? Number(row.price || 0) : 0);
    const raw = trustedRaw > 0
      ? tradeRawPrice(cleanPair, trustedRaw, { raw: true })
      : tradeRawPrice(cleanPair, row.price, { display: row.display || "", reference });
    if (!Number.isFinite(raw) || raw <= 0) return null;
    return { ...row, price: raw, rawPrice: raw };
  }

  function visiblePairCardPrice(pair) {
    const clean = String(pair || "").toUpperCase();
    if (!clean || typeof document === "undefined") return null;
    const escapedPair = window.CSS && CSS.escape ? CSS.escape(pair) : String(pair).replace(/"/g, '\"');
    const node = document.querySelector(`[data-price-card="true"][data-live-pair="${escapedPair}"]`);
    if (!node) return null;
    const displayText = node.dataset.displayPrice || node.textContent.trim() || "";
    const datasetRaw = Number(node.dataset.rawPrice || 0);
    const rawCandidate = datasetRaw || numericPriceFromText(displayText);
    const raw = datasetRaw ? tradeRawPrice(pair, rawCandidate, { raw: true }) : tradeRawPrice(pair, rawCandidate, { display: displayText });
    if (!Number.isFinite(raw) || raw <= 0) return null;
    const meta = [...marketPairs.CRYPTO, ...marketPairs.FOREX].find(item => item.pair === pair);
    return {
      ok: true,
      pair,
      price: raw,
      rawPrice: raw,
      display: displayText || formatPairPrice(pair, raw),
      change: node.dataset.priceChange || "Card",
      mood: node.dataset.priceMood || meta?.mood || "up",
      source: node.dataset.priceSource || "Price Card",
      sourceType: "PRICE_CARD",
      fetchedAt: node.dataset.fetchedAt || new Date().toISOString(),
      fetchedMs: Date.now()
    };
  }

  function normalizeManualPositionPriceRow(position, row) {
    if (!position || !row) return row || null;
    const pair = position.pair || row.pair || selectedPair;
    const reference = Number(position.entryPrice || position.currentPriceAtOrder || position.limitPrice || 0);
    return normalizeTradePriceRow(pair, row, reference);
  }

  function positionPriceRow(position) {
    const visible = visiblePairCardPrice(position.pair);
    if (visible) return normalizeManualPositionPriceRow(position, visible);
    const fresh = App.getCachedPairPrice ? App.getCachedPairPrice(position.pair) : null;
    if (fresh) return normalizeManualPositionPriceRow(position, fresh);
    const last = App.getLastPairPrice ? App.getLastPairPrice(position.pair) : null;
    return last ? normalizeManualPositionPriceRow(position, last) : null;
  }

  function positionCurrentPrice(position) {
    const cached = positionPriceRow(position);
    const fallback = Number(position.entryPrice || 0);
    const current = Number(cached?.price || fallback);
    return Number.isFinite(current) && current > 0 ? current : fallback;
  }

  function normalizeLimitComparisonPrice(order, row) {
    if (!order || !row) return null;
    const pair = order.pair || row.pair || selectedPair;
    const reference = Math.max(
      Number(order.limitPrice || 0),
      Number(order.currentPriceAtOrder || 0),
      Number(order.entryPrice || 0)
    );
    return normalizeTradePriceRow(pair, row, reference);
  }

  function pendingOrderPriceRow(order) {
    // Limit orders must only trigger from an actual live/cached market price.
    // Never fall back to the order limit price, otherwise a SELL limit can self-trigger
    // when the user navigates away from the orders page and no price card is visible.
    const row = positionPriceRow({ pair: order?.pair });
    return normalizeLimitComparisonPrice(order, row);
  }

  function pendingOrderLiveDisplay(order) {
    const row = pendingOrderPriceRow(order);
    return row?.display || "Waiting live price";
  }

  function positionCurrentDisplay(position) {
    const cached = positionPriceRow(position);
    if (cached?.display) return cached.display;
    const current = positionCurrentPrice(position);
    return current ? String(current) : "--";
  }

  function manualPositionRawPnl(position) {
    const entry = Number(position.entryPrice || 0);
    const current = positionCurrentPrice(position);
    const exposure = Number(position.positionSize || 0);
    if (!entry || !current || !exposure) return 0;
    const direction = String(position.side || "BUY").toUpperCase() === "SELL" ? -1 : 1;
    return exposure * ((current - entry) / entry) * direction;
  }

  function manualPositionMaxLoss(position) {
    const margin = Math.max(0, Number(position.marginAmount || 0));
    if (position.marginLocked) return margin;
    const balanceNow = Math.max(0, positionBalance(position));
    if (!margin && !balanceNow) return 0;
    if (!margin) return balanceNow;
    if (!balanceNow) return margin;
    return Math.min(margin, balanceNow);
  }

  function manualPositionPnl(position) {
    const raw = manualPositionRawPnl(position);
    if (raw < 0) return Math.max(raw, -manualPositionMaxLoss(position));
    return raw;
  }



  function aiLiveMarginAmount(position) {
    const margin = Math.max(0, Number(position?.marginAmount || position?.amount || 0));
    return Number.isFinite(margin) ? margin : 0;
  }

  function aiLiveLeverageAmount(position) {
    const lev = Math.max(1, Number(position?.leverage || 1));
    return Number.isFinite(lev) ? lev : 1;
  }

  function aiLiveSafeExposure(position) {
    const margin = aiLiveMarginAmount(position);
    const leverage = aiLiveLeverageAmount(position);
    const formulaExposure = margin * leverage;
    const storedExposure = Math.max(0, Number(position?.positionSize || 0));
    if (formulaExposure > 0) return Number(formulaExposure.toFixed(2));
    return Number(storedExposure.toFixed(2));
  }

  function aiPositionRawPnl(position) {
    const entry = Number(position.entryPrice || 0);
    const current = positionCurrentPrice(position);
    const exposure = aiLiveSafeExposure(position);
    if (!entry || !current || !exposure) return 0;
    const direction = String(position.side || "BUY").toUpperCase() === "SELL" ? -1 : 1;
    return exposure * ((current - entry) / entry) * direction;
  }

  function aiPositionTargetAmount(position) {
    return Math.max(0, aiLiveSafeExposure(position) * Number(position.targetPercent || 0) / 100);
  }

  function aiPositionPnl(position) {
    let pnl = aiPositionRawPnl(position);
    const target = aiPositionTargetAmount(position);
    const targetType = String(position.targetType || "PROFIT").toUpperCase();
    if (target > 0) {
      if (targetType === "LOSS") pnl = Math.max(pnl, -Math.min(aiLiveMarginAmount(position) || target, target));
      else pnl = Math.min(pnl, target);
    }
    if (pnl < 0) {
      const margin = aiLiveMarginAmount(position);
      // Hard safety cap: AI live loss display can never exceed the locked AI amount/margin.
      const maxLoss = Math.max(0, margin);
      return Number(Math.max(pnl, -maxLoss).toFixed(2));
    }
    return Number(pnl.toFixed(2));
  }

  async function settleAiLivePosition(position, reason = "TARGET_HIT") {
    console.warn("User-side AI live auto settlement is disabled. Admin batch close is required.");
    return false;
  }


  async function autoCloseAiLivePositions() {
    // AI Live positions are batch-controlled from admin side only.
    // User-side auto-close caused same-batch positions to close for one user while remaining open for others.
    return 0;
  }



  function manualReservedMargin(account = accountMode) {
    return manualOpenPositions()
      .filter(position => (position.accountType || accountMode) === account)
      .reduce((sum, position) => sum + Math.max(0, Number(position.marginAmount || 0)), 0);
  }

  function availableForNewManualTrade() {
    return Math.max(0, currentBalance());
  }

  function formatPairPrice(pair, value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0) return "--";
    if (App.priceDisplayFor) return App.priceDisplayFor(pair, n);
    const item = [...marketPairs.CRYPTO, ...marketPairs.FOREX].find(p => p.pair === pair);
    const prefix = item?.prefix || (String(pair || "").includes("INR") ? "₹" : "$");
    const decimals = String(pair || "").includes("JPY") || String(pair || "").includes("INR") ? 3 : 2;
    return `${prefix}${n.toLocaleString(undefined, { maximumFractionDigits: decimals })}`;
  }

  function displayPair(pair) {
    return App.displayPairLabel ? App.displayPairLabel(pair) : String(pair || "");
  }

  function limitInputToRaw(pair, value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return App.isCryptoPair?.(pair) ? tradeRawPrice(pair, n, { display: `₹${n}` }) : n;
  }

  function totalManualLivePnl() {
    return manualOpenPositions().reduce((sum, position) => sum + manualPositionPnl(position), 0);
  }

  function positionBalance(position) {
    const u = user();
    if (!u) return 0;
    return App.realBalance(u.id);
  }

  async function settleManualPosition(position, reason = "USER_CLOSE") {
    const u = user();
    if (!u || !position || position.status !== "OPEN") return false;
    if (App.isDatabaseMode?.() && window.AITradeXDB?.closeManualTradeSecure) {
      const current = positionCurrentPrice(position);
      const display = positionCurrentDisplay(position);
      const source = (App.getCachedPairPrice && App.getCachedPairPrice(position.pair)?.source) || position.priceSource || "Live price cache";
      await window.AITradeXDB.closeManualTradeSecure({
        tradeId: position.id,
        userId: u.id,
        exitPrice: current,
        exitPriceDisplay: display,
        exitPriceSource: source,
        reason
      });
      try { await window.AITradeXDB.loadAll?.(); } catch {}
      return true;
    }
    const original = { ...position };
    const current = positionCurrentPrice(position);
    let pnl = manualPositionPnl(position);
    const margin = Math.max(0, Number(position.marginAmount || 0));
    if (pnl < -margin) pnl = -margin;
    if (!position.marginLocked) {
      const balanceNow = positionBalance(position);
      if (balanceNow + pnl < 0) pnl = -balanceNow;
    }
    const settlementAmount = position.marginLocked ? Math.max(0, margin + pnl) : pnl;
    position.exitPrice = current;
    position.exitPriceDisplay = positionCurrentDisplay(position);
    position.exitPriceSource = (App.getCachedPairPrice && App.getCachedPairPrice(position.pair)?.source) || position.priceSource || "Live price cache";
    position.closedAt = new Date().toISOString();
    position.pnl = pnl;
    position.settlementAmount = settlementAmount;
    position.closeReason = reason;
    position.status = "CLOSED";
    let settlementAdded = false;
    try {
      if (settlementAmount !== 0) {
        const row = App.addLedgerAsync ? await App.addLedgerAsync({
          userId: u.id,
          accountType: normalizedAccountMode(position.accountType || accountMode),
          type: position.marginLocked ? "MANUAL_TRADE_SETTLEMENT" : (pnl >= 0 ? "MANUAL_TRADE_PROFIT" : "MANUAL_TRADE_LOSS"),
          amount: settlementAmount,
          referenceId: position.id,
          note: position.marginLocked ? `${position.pair} manual ${position.side} closed · margin ${App.money(margin)} · P/L ${pnl >= 0 ? "+" : ""}${App.money(pnl)}` : `${position.pair} manual ${position.side} closed`
        }) : App.addLedger({
          userId: u.id,
          accountType: normalizedAccountMode(position.accountType || accountMode),
          type: position.marginLocked ? "MANUAL_TRADE_SETTLEMENT" : (pnl >= 0 ? "MANUAL_TRADE_PROFIT" : "MANUAL_TRADE_LOSS"),
          amount: settlementAmount,
          referenceId: position.id,
          note: position.marginLocked ? `${position.pair} manual ${position.side} closed · margin ${App.money(margin)} · P/L ${pnl >= 0 ? "+" : ""}${App.money(pnl)}` : `${position.pair} manual ${position.side} closed`
        });
        settlementAdded = !!row;
      }
      if (App.isDatabaseMode?.() && window.AITradeXDB?.writeTrade) await window.AITradeXDB.writeTrade(position);
      App.saveState();
      return true;
    } catch (err) {
      if (settlementAdded && settlementAmount) {
        try { await (App.addLedgerAsync ? App.addLedgerAsync({ userId: u.id, accountType: normalizedAccountMode(position.accountType || accountMode), type: "MANUAL_TRADE_SETTLEMENT_ROLLBACK", amount: -settlementAmount, referenceId: `${position.id}_close_rollback`, note: "Rollback: manual close save failed" }) : App.addLedger({ userId: u.id, accountType: normalizedAccountMode(position.accountType || accountMode), type: "MANUAL_TRADE_SETTLEMENT_ROLLBACK", amount: -settlementAmount, referenceId: `${position.id}_close_rollback`, note: "Rollback: manual close save failed" })); } catch {}
      }
      Object.assign(position, original);
      throw err;
    }
  }

  async function autoCloseRiskPositions() {
    if (manualRiskCloseLock) return 0;
    manualRiskCloseLock = true;
    let closed = 0;
    try {
      for (const position of manualOpenPositions()) {
        const rawPnl = manualPositionRawPnl(position);
        const maxLoss = manualPositionMaxLoss(position);
        if (rawPnl < 0 && maxLoss > 0 && Math.abs(rawPnl) >= maxLoss) {
          try { if (await settleManualPosition(position, "AUTO_RISK_CLOSE")) closed += 1; } catch (err) { console.warn("manual auto close failed", err); }
        }
      }
    } finally {
      manualRiskCloseLock = false;
    }
    if (closed) {
      App.toast(`${closed} manual position auto-closed to protect balance.`);
      setTimeout(() => render(), 0);
    }
    return closed;
  }

  function limitOrderDirectionError(side, limitPrice, currentPrice) {
    const normalizedSide = String(side || "BUY").toUpperCase() === "SELL" ? "SELL" : "BUY";
    const limit = Number(limitPrice || 0);
    const current = Number(currentPrice || 0);
    if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(current) || current <= 0) return "";
    if (normalizedSide === "BUY" && limit >= current) {
      return `BUY limit price must be below current price (${formatPairPrice(selectedPair, current)}). Use Market order for instant buy.`;
    }
    if (normalizedSide === "SELL" && limit <= current) {
      return `SELL limit price must be above current price (${formatPairPrice(selectedPair, current)}). Use Market order for instant sell.`;
    }
    return "";
  }

  async function openPositionFromPendingOrder(order, currentPrice, currentDisplay) {
    if (!order || !["PENDING", "LIMIT_PENDING"].includes(String(order.status || "").toUpperCase())) return false;
    const current = Number(currentPrice || 0);
    if (!Number.isFinite(current) || current <= 0) return false;
    const fillPrice = Number(order.limitPrice || current);
    if (!Number.isFinite(fillPrice) || fillPrice <= 0) return false;
    order.status = "OPEN";
    order.entryPrice = fillPrice;
    order.entryPriceDisplay = order.limitPriceDisplay || formatPairPrice(order.pair, fillPrice);
    order.triggerPrice = current;
    order.triggerPriceDisplay = currentDisplay || formatPairPrice(order.pair, current);
    order.priceSource = (App.getCachedPairPrice && App.getCachedPairPrice(order.pair)?.source) || order.priceSource || "Live price cache";
    order.priceSourceType = (App.getCachedPairPrice && App.getCachedPairPrice(order.pair)?.sourceType) || order.priceSourceType || "LIVE_PRICE";
    order.priceLockedAt = new Date().toISOString();
    order.triggeredAt = new Date().toISOString();
    order.orderTriggered = true;
    order.pnl = 0;
    if (App.isDatabaseMode?.() && window.AITradeXDB?.writeTrade) {
      await window.AITradeXDB.writeTrade(order);
    }
    return true;
  }

  async function checkPendingLimitOrders() {
    const pending = pendingManualOrders();
    if (!pending.length) return 0;
    let triggered = 0;
    for (const order of pending) {
      const liveRow = pendingOrderPriceRow(order);
      const current = Number(liveRow?.price || 0);
      const limit = Number(order.limitPrice || 0);
      if (!Number.isFinite(current) || current <= 0 || !Number.isFinite(limit) || limit <= 0) continue;
      const side = String(order.side || "BUY").toUpperCase() === "SELL" ? "SELL" : "BUY";
      const shouldTrigger = side === "BUY" ? current <= limit : current >= limit;
      if (!shouldTrigger) continue;
      const display = liveRow?.display || formatPairPrice(order.pair, current);
      try { if (await openPositionFromPendingOrder(order, current, display)) triggered += 1; } catch (err) { console.warn("limit order trigger DB sync failed", err); }
    }
    if (triggered) {
      App.saveState();
      App.toast(`${triggered} limit ${triggered === 1 ? "order" : "orders"} triggered.`);
      setTimeout(() => render(), 0);
    }
    return triggered;
  }

  function manualLiveBarHtml() {
    const positions = manualOpenPositions();
    if (!positions.length) return "";
    const pnl = totalManualLivePnl();
    const label = pnl >= 0 ? "Profit" : "Loss";
    const countText = positions.length === 1 ? "1 Active Position" : `${positions.length} Active Positions`;
    const locked = positions.reduce((sum, position) => sum + Number(position.marginAmount || 0), 0);
    return `
      <section class="top-live-position-bar manual-live-position-bar premium-active-bar ${pnl >= 0 ? "profit" : "loss"}" id="manualLivePositionBar">
        <div class="active-bar-main">
          <i>📈</i>
          <div>
            <b id="manualLivePositionText">Manual · ${countText}</b>
            <span id="manualLivePositionMeta">Locked ${App.money(locked)} · Live <em class="${pnl >= 0 ? "profit-text" : "loss-text"}">${pnl >= 0 ? "+" : ""}${App.money(pnl)}</em> ${label}</span>
          </div>
        </div>
        <button onclick="AITradeXUser.closeManualLivePositions()">Close</button>
      </section>`;
  }

  function aiLiveBarHtml() {
    const positions = aiOpenPositions();
    if (!positions.length) return "";
    const pnl = positions.reduce((sum, position) => sum + aiPositionPnl(position), 0);
    const label = pnl >= 0 ? "Profit" : "Loss";
    const countText = positions.length === 1 ? "1 AI Active Position" : `${positions.length} AI Active Positions`;
    const locked = positions.reduce((sum, position) => sum + Number(position.marginAmount || position.amount || 0), 0);
    const stacked = manualOpenPositions().length ? "stacked" : "";
    return `
      <section class="top-live-position-bar ai-live-position-bar premium-active-bar ${stacked} ${pnl >= 0 ? "profit" : "loss"}" id="aiLivePositionBar">
        <div class="active-bar-main">
          <i>🤖</i>
          <div>
            <b id="aiLivePositionText">AI · ${countText}</b>
            <span id="aiLivePositionMeta">Locked ${App.money(locked)} · Live <em class="${pnl >= 0 ? "profit-text" : "loss-text"}">${pnl >= 0 ? "+" : ""}${App.money(pnl)}</em> ${label}</span>
          </div>
        </div>
        <button onclick="AITradeXUser.go('positions')">View</button>
      </section>`;
  }

  function manualCloseSelectorHtml() {
    if (!manualCloseSelectorOpen) return "";
    const positions = manualOpenPositions();
    if (!positions.length) return "";
    return `
      <div class="manual-close-backdrop" onclick="AITradeXUser.cancelManualCloseSelector()"></div>
      <section class="manual-close-modal">
        <div class="manual-close-head">
          <div>
            <b>Select position to close</b>
            <span>${positions.length} active manual ${positions.length === 1 ? "position" : "positions"}</span>
          </div>
          <button onclick="AITradeXUser.cancelManualCloseSelector()">×</button>
        </div>
        <div class="manual-close-list">
          ${positions.map(position => {
            const pnl = manualPositionPnl(position);
            const cls = pnl >= 0 ? "profit-text" : "loss-text";
            return `
              <article>
                <div>
                  <b>${App.escapeHtml(position.pair)} ${App.escapeHtml(position.side)}</b>
                  <span>${Number(position.leverage || 1)}x · Margin ${App.money(position.marginAmount || 0)} · Live ${App.escapeHtml(positionCurrentDisplay(position))}</span>
                </div>
                <strong class="${cls}">${pnl >= 0 ? "+" : ""}${App.money(pnl)}</strong>
                <button onclick="AITradeXUser.closeManualPositionById('${position.id}')">Close</button>
              </article>`;
          }).join("")}
        </div>
      </section>`;
  }

  function aiOffConfirmHtml() {
    if (!aiOffConfirmOpen) return "";
    return `
      <div class="ai-confirm-backdrop" onclick="AITradeXUser.cancelAiOffConfirm()"></div>
      <section class="ai-confirm-modal" role="dialog" aria-modal="true" aria-label="Turn off AI Auto Trading">
        <div class="ai-confirm-icon">AI</div>
        <h2>Turn off AI Auto Trading?</h2>
        <p>If you turn off AI Auto Trading, you will stop receiving AI-managed trades from the system. Your daily AI trade limit will remain available, but no AI trades will be applied until you turn it on again.</p>
        <div class="ai-confirm-actions">
          <button class="keep-ai-btn" onclick="AITradeXUser.cancelAiOffConfirm()">Keep AI ON</button>
          <button class="turn-off-ai-btn" onclick="AITradeXUser.confirmAiOff()">Turn OFF</button>
        </div>
      </section>`;
  }

  function updateManualLiveViews() {
    Promise.resolve(checkPendingLimitOrders()).then(triggered => { if (triggered) render(); });
    Promise.resolve(autoCloseRiskPositions()).then(closed => { if (closed) render(); });
    const positions = manualOpenPositions();
    const pnl = positions.reduce((sum, position) => sum + manualPositionPnl(position), 0);
    const label = pnl >= 0 ? "Profit" : "Loss";
    const countText = positions.length === 1 ? "1 Active Position" : `${positions.length} Active Positions`;

    const bar = document.getElementById("manualLivePositionBar");
    if (bar) {
      if (!positions.length) {
        bar.remove();
      } else {
        bar.classList.toggle("profit", pnl >= 0);
        bar.classList.toggle("loss", pnl < 0);
        const text = document.getElementById("manualLivePositionText");
        const meta = document.getElementById("manualLivePositionMeta");
        const locked = positions.reduce((sum, position) => sum + Number(position.marginAmount || 0), 0);
        if (text) text.textContent = `Manual · ${countText}`;
        if (meta) meta.innerHTML = `Locked ${App.money(locked)} · Live <em class="${pnl >= 0 ? "profit-text" : "loss-text"}">${pnl >= 0 ? "+" : ""}${App.money(pnl)}</em> ${label}`;
      }
    }

    positions.forEach(position => {
      const currentEl = document.querySelector(`[data-manual-current="${position.id}"]`);
      const pnlEl = document.querySelector(`[data-manual-pnl="${position.id}"]`);
      const pnlValue = manualPositionPnl(position);
      if (currentEl) currentEl.textContent = positionCurrentDisplay(position);
      if (pnlEl) {
        pnlEl.textContent = `${pnlValue >= 0 ? "+" : ""}${App.money(pnlValue)}`;
        pnlEl.classList.toggle("profit-text", pnlValue >= 0);
        pnlEl.classList.toggle("loss-text", pnlValue < 0);
      }
    });
  }

  function updateAiLiveViews() {
    const positions = aiOpenPositions();
    const pnl = positions.reduce((sum, position) => sum + aiPositionPnl(position), 0);
    const label = pnl >= 0 ? "Profit" : "Loss";
    const countText = positions.length === 1 ? "1 AI Active Position" : `${positions.length} AI Active Positions`;

    const bar = document.getElementById("aiLivePositionBar");
    if (bar) {
      if (!positions.length) {
        bar.remove();
      } else {
        bar.classList.toggle("profit", pnl >= 0);
        bar.classList.toggle("loss", pnl < 0);
        bar.classList.toggle("stacked", manualOpenPositions().length > 0);
        const text = document.getElementById("aiLivePositionText");
        const meta = document.getElementById("aiLivePositionMeta");
        const locked = positions.reduce((sum, position) => sum + Number(position.marginAmount || position.amount || 0), 0);
        if (text) text.textContent = `AI · ${countText}`;
        if (meta) meta.innerHTML = `Locked ${App.money(locked)} · Live <em class="${pnl >= 0 ? "profit-text" : "loss-text"}">${pnl >= 0 ? "+" : ""}${App.money(pnl)}</em> ${label}`;
      }
    }

    positions.forEach(position => {
      const currentEl = document.querySelector(`[data-ai-current="${position.id}"]`);
      const pnlEl = document.querySelector(`[data-ai-pnl="${position.id}"]`);
      const pnlValue = aiPositionPnl(position);
      if (currentEl) currentEl.textContent = positionCurrentDisplay(position);
      if (pnlEl) {
        pnlEl.textContent = `${pnlValue >= 0 ? "+" : ""}${App.money(pnlValue)}`;
        pnlEl.classList.toggle("profit-text", pnlValue >= 0);
        pnlEl.classList.toggle("loss-text", pnlValue < 0);
      }
    });
  }

  function updateManualLiveBar() {
    updateManualLiveViews();
    updateAiLiveViews();
    // User side only updates live P/L display. AI Live settlement is handled from admin batch close.
  }

  function updateTradeAmountPreviewDom() {
    const margin = Math.max(0, Number(tradeAmountPreview || 0));
    const leverage = Math.max(1, Number(tradeLeveragePreview || 1));
    const positionSize = margin * leverage;
    const marginEl = document.querySelector("[data-trade-preview-margin]");
    const positionEl = document.querySelector("[data-trade-preview-position]");
    const summaryEl = document.querySelector("[data-trade-preview-summary]");
    if (marginEl) marginEl.textContent = App.money(margin);
    if (positionEl) positionEl.textContent = App.money(positionSize);
    if (summaryEl) summaryEl.textContent = `${selectedMarket} · ${selectedPair} · ${accountMode} · Margin ${App.money(margin)} · Position ${App.money(positionSize)}`;
  }

  function clearTradeOrderNotice() {
    tradeOrderNotice = null;
  }

  function resetTradeTicketAfterOrder(message, detail = "") {
    tradeAmountPreview = "";
    tradeLeveragePreview = 1;
    tradeLimitPrice = "";
    localStorage.removeItem("AITradeX_TRADE_AMOUNT_PREVIEW");
    localStorage.setItem("AITradeX_TRADE_LEVERAGE_PREVIEW", "1");
    localStorage.removeItem("AITradeX_TRADE_LIMIT_PRICE");
    tradeOrderNotice = {
      title: message || "Order placed successfully",
      detail: detail || "Your order has been moved to Positions. Fill fresh details to place another trade."
    };
  }

  function realBalance() {
    const u = user();
    return u ? App.realBalance(u.id) : 0;
  }

  function demoBalance() {
    const u = user();
    return u ? App.demoBalance(u.id) : 0;
  }

  function currentAiSettings() {
    const u = user();
    if (!u) return { enabled: autoTradeOn, percent: autoPercent };
    // DB-first AI settings: values come from users.ai_trade_on / users.ai_trade_percent.
    // localStorage is no longer used as the source of truth for AI auto-trade settings.
    if (typeof u.aiTradeOn === "undefined") u.aiTradeOn = true;
    const pct = Number(u.aiTradePercent);
    if (![25, 50, 75, 100].includes(pct)) u.aiTradePercent = 75;
    autoTradeOn = !!u.aiTradeOn;
    autoPercent = Number(u.aiTradePercent || 75);
    return { enabled: autoTradeOn, percent: autoPercent };
  }

  function aiDailyUsage() {
    const u = user();
    if (!u) return { used: 0, limit: 5 };
    return { used: App.aiTradesToday(u.id), limit: App.aiDailyLimit(u.id) };
  }

  function aiRemainingTrades() {
    const usage = aiDailyUsage();
    return Math.max(0, Number(usage.limit || 0) - Number(usage.used || 0));
  }

  function totalAiOpenPnl() {
    return aiOpenPositions().reduce((sum, position) => sum + aiPositionPnl(position), 0);
  }

  function aiClosedRows() {
    return aiTradeRows({ status: "CLOSED" });
  }

  function todayAiClosedPnl() {
    const today = App.todayKey ? App.todayKey() : new Date().toISOString().slice(0, 10);
    return aiClosedRows()
      .filter(t => String(t.closedAt || t.createdAt || t.createdDate || "").slice(0, 10) === today)
      .reduce((sum, t) => sum + Number(t.pnl || 0), 0);
  }

  function totalAiClosedPnl() {
    return aiClosedRows().reduce((sum, t) => sum + Number(t.pnl || 0), 0);
  }

  function isAiLimitComplete() {
    const usage = aiDailyUsage();
    return Number(usage.limit || 0) > 0 && Number(usage.used || 0) >= Number(usage.limit || 0);
  }

  function latestAiAutoTrade() {
    return aiTradeRows()[0] || null;
  }


  function aiTradingSummaryCard() {
    const ai = currentAiSettings();
    const usage = aiDailyUsage();
    const remaining = aiRemainingTrades();
    const activePositions = aiOpenPositions();
    const activePnl = totalAiOpenPnl();
    const todayPnl = todayAiClosedPnl();
    const totalPnl = totalAiClosedPnl();
    const plan = currentPlan();
    const pool = accountMode === "REAL" ? App.realBalance(user()?.id) * Number(ai.percent || 0) / 100 : 0;
    return `
      <section class="premium-card ai-trading-summary-card">
        <div class="card-row">
          <div>
            <p>AI TRADING SUMMARY</p>
            <h2>${App.escapeHtml(plan.name || "Free")} · ${ai.enabled ? "AI Active" : "AI OFF"}</h2>
            <h4>Daily limit, live AI positions and profit/loss in one place.</h4>
          </div>
          <button class="change-pair-btn" onclick="AITradeXUser.go('positions')">View Positions</button>
        </div>
        <div class="compact-grid ai-summary-grid">
          <article><span>Used Today</span><b>${usage.used}/${usage.limit}</b><small>${remaining} remaining</small></article>
          <article><span>AI Trade Pool</span><b>${App.money(pool)}</b><small>${Number(ai.percent || 0)}% allocation</small></article>
          <article><span>Active AI Position</span><b>${activePositions.length}</b><small class="${activePnl >= 0 ? "profit-text" : "loss-text"}">${activePnl >= 0 ? "+" : ""}${App.money(activePnl)} live P/L</small></article>
          <article><span>Today AI P/L</span><b class="${todayPnl >= 0 ? "profit-text" : "loss-text"}">${todayPnl >= 0 ? "+" : ""}${App.money(todayPnl)}</b><small>Total ${totalPnl >= 0 ? "+" : ""}${App.money(totalPnl)}</small></article>
        </div>
      </section>`;
  }

  function aiActivityCard() {
    const ai = currentAiSettings();
    const usage = aiDailyUsage();
    const latest = latestAiAutoTrade();
    const limitDone = isAiLimitComplete();
    const plan = currentPlan();
    if (!ai.enabled) {
      return `
        <section class="premium-card ai-activity-card off">
          <div class="card-row">
            <div>
              <p>AI TRADING ACTIVITY</p>
              <h2>AI Auto Trading is OFF</h2>
              <h4>Turn it ON from AI Trade Control to receive AI auto trades.</h4>
            </div>
            <span class="activity-pill muted">Paused</span>
          </div>
        </section>`;
    }
    if (limitDone) {
      return `
        <section class="premium-card ai-activity-card limit">
          <div class="card-row">
            <div>
              <p>AI TRADING ACTIVITY</p>
              <h2>Daily AI trade limit completed</h2>
              <h4>${usage.used}/${usage.limit} AI auto trades used today on ${App.escapeHtml(plan.name || "current plan")}.</h4>
            </div>
            <button class="change-pair-btn" onclick="AITradeXUser.go('subscription')">Upgrade Plan</button>
          </div>
        </section>`;
    }
    if (!latest) {
      return `
        <section class="premium-card ai-activity-card">
          <div class="card-row">
            <div>
              <p>AI TRADING ACTIVITY</p>
              <h2>No AI trades yet today</h2>
              <h4>AI Auto Trading is active. Keep your allocation ready to receive AI auto trades.</h4>
            </div>
            <span class="activity-pill live">Active</span>
          </div>
          <div class="activity-grid">
            <article><span>Status</span><b>Ready</b></article>
            <article><span>Daily AI Trades</span><b>${usage.used}/${usage.limit}</b></article>
          </div>
        </section>`;
    }
    const pnl = Number(latest.pnl || 0);
    const resultLabel = pnl >= 0 ? "Profit" : "Loss";
    return `
      <section class="premium-card ai-activity-card ${pnl >= 0 ? "profit" : "loss"}">
        <div class="card-row">
          <div>
            <p>AI TRADING ACTIVITY</p>
            <h2>${App.escapeHtml(latest.pair || "AI Trade")} · ${App.escapeHtml(latest.side || "")}</h2>
            <h4>Latest AI auto trade completed ${formatHistoryDate(latest.createdAt)}.</h4>
          </div>
          <span class="activity-pill ${pnl >= 0 ? "profit" : "loss"}">${resultLabel}</span>
        </div>
        <div class="activity-grid">
          <article><span>Result</span><b class="${pnl >= 0 ? "profit-text" : "loss-text"}">${App.money(pnl)}</b></article>
          <article><span>Daily AI Trades</span><b>${usage.used}/${usage.limit}</b></article>
          <article><span>Leverage</span><b>${Number(latest.leverage || 1)}x</b></article>
          <article><span>Entry Price</span><b>${App.escapeHtml(latest.entryPriceDisplay || latest.entryPrice || "Locked")}</b></article>
        </div>
      </section>`;
  }

  function activeSubscription() {
    const u = user();
    return u ? App.activeSubscription(u.id) : null;
  }

  function freeTrialInfo() {
    const u = user();
    return u ? App.freeTrialInfo(u.id) : { active: false, expired: false, trialDays: 7, daysLeft: 0 };
  }

  function freeAccessText() {
    const info = freeTrialInfo();
    const postLimit = Number(App.state.settings?.postTrialFreeAiTradesPerDay || 1);
    if (info.active) return `Trial ends in ${info.daysLeft} day${info.daysLeft === 1 ? "" : "s"}`;
    return `Free access: ${postLimit}/day`;
  }

  function currentPlan() {
    const u = user();
    return u ? App.currentPlan(u.id) : (App.planById("free") || { name: "Free", price: 0, signals: 5 });
  }

  function subscriptionExpiryText(sub) {
    if (!sub) return freeAccessText();
    if (!sub.expiresAt) return "No expiry";
    const date = new Date(sub.expiresAt);
    if (Number.isNaN(date.getTime())) return "No expiry";
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  function planBenefits(plan) {
    if (Array.isArray(plan?.benefits) && plan.benefits.length) return plan.benefits;
    return [
      `${Number(plan?.signals || 0)} daily AI trades`,
      `${plan?.aiAccess || "AI"} access`,
      "Manual trading access"
    ];
  }

  function planCard(plan) {
    const sub = activeSubscription();
    const current = currentPlan();
    const isCurrent = current?.id === plan.id;
    const disabled = String(plan.status || "ACTIVE").toUpperCase() !== "ACTIVE";
    const price = Number(plan.price || 0);
    const duration = Number(plan.durationDays || 0);
    return `
      <article class="subscription-plan-card ${isCurrent ? "current" : ""} ${disabled ? "inactive" : ""}">
        <div class="plan-card-top">
          <div><p>${isCurrent ? "CURRENT PLAN" : "SUBSCRIPTION"}</p><h3>${App.escapeHtml(plan.name)}</h3></div>
          <strong>${price ? App.money(price) : "Free"}</strong>
        </div>
        <div class="plan-limit-row">
          <span>AI Trades / Day</span><b>${Number(plan.signals || 0)}</b>
        </div>
        <div class="plan-limit-row">
          <span>Active AI Today</span><b>${aiDailyUsage().used}/${aiDailyUsage().limit}</b>
        </div>
        <ul class="plan-benefits">${planBenefits(plan).map(item => `<li>${App.escapeHtml(item)}</li>`).join("")}</ul>
        ${isCurrent ? `<button class="save-profile-btn muted" disabled>Active Plan</button>` : `<button class="save-profile-btn" ${disabled ? "disabled" : ""} onclick="AITradeXUser.buyPlan('${plan.id}')">${disabled ? "Unavailable" : `Upgrade for ${price ? App.money(price) : "Free"}`}</button>`}
        ${sub && isCurrent ? `<small class="plan-expiry-note">Expires: ${subscriptionExpiryText(sub)}</small>` : ""}
      </article>`;
  }

  function subscriptionHistory() {
    const u = user();
    if (!u) return [];
    return (App.state.subscriptions || [])
      .filter(x => x.userId === u.id)
      .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
  }

  function tradeRows(type) {
    const u = user();
    const cleanType = String(type || "").toUpperCase();
    if (!u) return [];
    return (App.state.trades || [])
      .map(normalizeTradeRowForDisplay)
      .filter(t => t.userId === u.id && sameAccountType(t.accountType, accountMode) && String(t.tradeType || "").toUpperCase() === cleanType)
      .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
  }

  function pnlValue() {
    const u = user();
    if (!u) return 0;
    return (App.state.trades || [])
      .map(normalizeTradeRowForDisplay)
      .filter(t => t.userId === u.id && sameAccountType(t.accountType, accountMode) && String(t.status || "").toUpperCase() === "CLOSED")
      .reduce((sum, t) => sum + Number(t.pnl || 0), 0);
  }

  function selectedPairData() {
    const row = pairsForMarket().find(p => p.pair === selectedPair) || pairsForMarket()[0];
    return App.pairLiveView ? App.pairLiveView(row) : row;
  }

  function ensurePairForMarket() {
    const list = pairsForMarket();
    if (!list.some(p => p.pair === selectedPair)) {
      selectedPair = list[0].pair;
      localStorage.setItem("AITradeX_SELECTED_PAIR", selectedPair);
    }
  }

  function changeClass(value) {
    return String(value || "").trim().startsWith("-") ? "loss-text" : "profit-text";
  }

  function pairView(item) {
    if (!item) return item;
    if (isUpcomingPair(item.pair)) return upcomingPairView(item);
    return App.pairLiveView ? App.pairLiveView(item) : item;
  }

  function liveAttr(pair) {
    return `data-live-pair="${App.escapeHtml(pair)}"`;
  }

  function applyLivePriceRow(row) {
    if (!row || !row.ok || isUpcomingPair(row.pair)) return;
    document.querySelectorAll(`[data-live-pair="${CSS.escape(row.pair)}"]`).forEach(el => {
      const type = el.getAttribute("data-live-type") || "price";
      if (type === "price") {
        el.textContent = row.display;
        el.dataset.rawPrice = String(row.price || "");
        el.dataset.displayPrice = row.display || "";
        el.dataset.priceSource = row.source || "Live API";
        el.dataset.priceChange = row.change || "Live";
        el.dataset.priceMood = row.mood || "up";
        el.dataset.fetchedAt = row.fetchedAt || new Date().toISOString();
        el.classList.add("live-price-tick");
        setTimeout(() => el.classList.remove("live-price-tick"), 350);
      }
      if (type === "change") {
        el.textContent = row.change || "Live";
        el.classList.toggle("profit-text", row.mood !== "down");
        el.classList.toggle("loss-text", row.mood === "down");
      }
      if (type === "line") {
        el.innerHTML = `${row.display} · <em class="${row.mood === "down" ? "loss-text" : "profit-text"}">${row.change || "Live"}</em>`;
        el.dataset.rawPrice = String(row.price || "");
        el.dataset.displayPrice = row.display || "";
        el.dataset.priceSource = row.source || "Live API";
        el.dataset.priceChange = row.change || "Live";
        el.dataset.priceMood = row.mood || "up";
        el.dataset.fetchedAt = row.fetchedAt || new Date().toISOString();
      }
      if (type === "source") el.textContent = row.source || "Live API";
    });
    updateManualLiveBar();
  }

  function refreshVisiblePrices(items) {
    const baseList = (items || []).map(p => typeof p === "string" ? p : p.pair).filter(Boolean);
    const openList = manualOpenPositions().map(position => position.pair).filter(Boolean);
    const aiList = aiOpenPositions().map(position => position.pair).filter(Boolean);
    const pendingList = pendingManualOrders().map(order => order.pair).filter(Boolean);
    const list = [...new Set([...baseList, ...openList, ...aiList, ...pendingList])].filter(isTradeActivePair);
    if (!list.length) return;

    if (App.refreshLivePrices) App.refreshLivePrices(list, applyLivePriceRow);
    if (App.startCryptoLiveTicker) App.startCryptoLiveTicker(list, applyLivePriceRow);

    if (priceRefreshTimer) clearInterval(priceRefreshTimer);
    priceRefreshTimer = setInterval(() => {
      const activePairs = list.filter(isTradeActivePair);
      if (App.refreshLivePrices && activePairs.length) App.refreshLivePrices(activePairs, applyLivePriceRow);
    }, 30000);
  }

  function selectorSheetHtml() {
    if (!selectorSheet) return "";

    if (selectorSheet === "pair") {
      return `
        <div class="sheet-backdrop" onclick="AITradeXUser.closeSheet()"></div>
        <section class="selector-sheet">
          <div class="sheet-handle"></div>
          <div class="sheet-title">
            <div><p>${selectedMarket}</p><h3>Select Pair</h3></div>
            <button onclick="AITradeXUser.closeSheet()">×</button>
          </div>
          <div class="sheet-grid pair-sheet-grid">
            ${pairsForMarket().map(raw => { const p = pairView(raw); return `
              <button class="${selectedPair === p.pair ? "active" : ""} ${isUpcomingPair(p.pair) ? "upcoming-pair" : ""}" onclick="AITradeXUser.selectPair('${p.pair}')">
                <b>${p.pair}</b>
                <span data-price-card="${isTradeActivePair(p.pair) ? "true" : "false"}" data-live-pair="${p.pair}" data-live-type="price">${p.price}</span>
                <em data-live-pair="${p.pair}" data-live-type="change" class="${isUpcomingPair(p.pair) ? "upcoming-text" : changeClass(p.change)}">${p.change}</em>
              </button>
            `; }).join("")}
          </div>
        </section>`;
    }

    if (selectorSheet === "leverage") {
      return `
        <div class="sheet-backdrop" onclick="AITradeXUser.closeSheet()"></div>
        <section class="selector-sheet compact-sheet">
          <div class="sheet-handle"></div>
          <div class="sheet-title">
            <div><p>LEVERAGE</p><h3>Select Leverage</h3></div>
            <button onclick="AITradeXUser.closeSheet()">×</button>
          </div>
          <div class="sheet-grid leverage-sheet-grid">
            ${leverageOptions.map(x => `
              <button class="${tradeLeveragePreview === x ? "active" : ""}" onclick="AITradeXUser.setTradeLeverage(${x});AITradeXUser.closeSheet();">${x}x</button>
            `).join("")}
          </div>
        </section>`;
    }

    if (selectorSheet === "chart-settings") {
      return `
        <div class="sheet-backdrop" onclick="AITradeXUser.closeSheet()"></div>
        <section class="selector-sheet compact-sheet chart-settings-sheet">
          <div class="sheet-handle"></div>
          <div class="sheet-title">
            <div><p>CHART</p><h3>Chart Settings</h3></div>
            <button onclick="AITradeXUser.closeSheet()">×</button>
          </div>

          <div class="settings-block">
            <span>Chart Type</span>
            <div class="settings-chips">
              <button class="${chartStyle === "1" ? "active" : ""}" onclick="AITradeXUser.setChartStyle('1')">Candles</button>
              <button class="${chartStyle === "2" ? "active" : ""}" onclick="AITradeXUser.setChartStyle('2')">Line</button>
              <button class="${chartStyle === "3" ? "active" : ""}" onclick="AITradeXUser.setChartStyle('3')">Area</button>
            </div>
          </div>

          <div class="settings-block">
            <span>Theme</span>
            <div class="settings-chips">
              <button class="${chartTheme === "dark" ? "active" : ""}" onclick="AITradeXUser.setChartTheme('dark')">Dark</button>
              <button class="${chartTheme === "light" ? "active" : ""}" onclick="AITradeXUser.setChartTheme('light')">Light</button>
            </div>
          </div>

          <div class="settings-block">
            <span>TradingView Toolbar</span>
            <div class="settings-chips">
              <button class="disabled" disabled>App Clean</button>
              <button class="active" onclick="AITradeXUser.setChartToolbar(false)">Active</button>
            </div>
          </div>
        </section>`;
    }

    return "";
  }

  function renderTradingViewChart(symbol) {
    const container = document.getElementById("tradingview_chart_container");
    if (!container) return;

    container.innerHTML = `
      <div class="chart-loading-state" id="aitx_chart_loader">
        <div class="chart-spinner"></div>
        <b>${symbol}</b>
        <span>Loading TradingView chart...</span>
      </div>`;

    if (!window.TradingView || !window.TradingView.widget) {
      setTimeout(() => renderTradingViewChart(symbol), 800);
      return;
    }

    setTimeout(() => {
      const freshContainer = document.getElementById("tradingview_chart_container");
      if (!freshContainer) return;

      freshContainer.innerHTML = `
        <div class="chart-loading-state" id="aitx_chart_loader">
          <div class="chart-spinner"></div>
          <b>${symbol}</b>
          <span>Loading TradingView chart...</span>
        </div>`;

      new window.TradingView.widget({
        autosize: true,
        symbol,
        interval: chartInterval,
        timezone: "Asia/Kolkata",
        theme: chartTheme,
        style: chartStyle,
        locale: "en",
        toolbar_bg: chartTheme === "dark" ? "#050814" : "#ffffff",
        enable_publishing: false,
        hide_top_toolbar: true,
        hide_side_toolbar: true,
        hide_legend: true,
        allow_symbol_change: false,
        save_image: false,
        withdateranges: false,
        details: false,
        hotlist: false,
        calendar: false,
        disabled_features: [
          "header_widget",
          "left_toolbar",
          "timeframes_toolbar",
          "legend_widget",
          "header_symbol_search",
          "header_compare",
          "header_saveload",
          "header_fullscreen_button",
          "header_screenshot",
          "use_localstorage_for_settings"
        ],
        enabled_features: ["hide_left_toolbar_by_default"],
        support_host: "https://www.tradingview.com",
        container_id: "tradingview_chart_container"
      });

      const revealChart = () => {
        const frame = freshContainer.querySelector("iframe");
        const loader = document.getElementById("aitx_chart_loader");
        if (frame) {
          frame.classList.add("aitx-tv-ready");
          if (loader) loader.classList.add("hide-loader");
          setTimeout(() => loader?.remove(), 450);
          return true;
        }
        return false;
      };

      const watch = setInterval(() => {
        if (revealChart()) clearInterval(watch);
      }, 120);

      setTimeout(() => {
        clearInterval(watch);
        revealChart();
      }, 4500);
    }, 80);
  }

  function scheduleTradingViewChart() {
    const pair = selectedPairData();
    setTimeout(() => renderTradingViewChart(pair.symbol), 80);
  }

  function avatar(name) {
    const u = user();
    const avatarData = u ? (u.avatarUrl || "") : "";
    if (avatarData) {
      return `<span class="avatar image-avatar"><img src="${App.escapeHtml(avatarData)}" alt="Avatar"/></span>`;
    }
    return `<span class="avatar">${String(name || "A").trim().charAt(0).toUpperCase()}</span>`;
  }

  function storageReady() {
    return !!(window.AITradeXDB && window.AITradeXDB.ready && window.AITradeXDB.uploadUserFile);
  }

  async function uploadStorageFile({ bucket, folder, label, file }) {
    const u = user();
    if (!u) throw new Error("Login required.");
    if (!storageReady()) throw new Error("Supabase storage is not ready. Check config.js and storage policies.");
    return await window.AITradeXDB.uploadUserFile({ bucket, folder, label, file, userId: u.id });
  }

  function uploadStatusText(meta, fallbackName) {
    const name = meta?.name || fallbackName || "-";
    const stored = meta?.path ? " · Storage saved" : "";
    return `${name}${stored}`;
  }

  function fileViewLink(meta, label = "View") {
    const url = meta?.url || "";
    if (!url) return "";
    return `<a class="kyc-file-link" href="${App.escapeHtml(url)}" target="_blank" rel="noopener">${App.escapeHtml(label)}</a>`;
  }

  function displayName() {
    const u = user();
    if (!u) return "User";
    return u.name || "User";
  }

  function profileNameChip() {
    return `<button class="profile-chip visible-profile" onclick="AITradeXUser.go('profile')"><b>${App.escapeHtml(displayName())}</b>${avatar(displayName())}</button>`;
  }

  function userKey(name) {
    const u = user();
    return u ? `AITradeX_${name}_${u.id}` : "";
  }

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || "") || fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function platformSettings() {
    const defaults = {
      minDeposit: 500,
      minWithdrawal: 1000,
      depositUpiId: "aitradex@upi",
      depositQrImage: "",
      depositUpiEnabled: true,
      depositBankEnabled: true,
      depositBankName: "AITradeX Bank",
      depositAccountName: "AITradeX Private Wallet",
      depositAccountNumber: "123456789012",
      depositIfsc: "AITX0001234",
      depositEnabled: true,
      withdrawalEnabled: true,
      manualTradingEnabled: true,
      aiTradingEnabled: true,
      maintenanceMode: false,
      maxDeposit: 1000000,
      maxWithdrawal: 500000,
      minManualTrade: 100,
      maxManualTrade: 250000,
      minAiTrade: 100,
      maxAiTrade: 250000,
      maxLeverage: 2000,
      maxOpenPositionsPerUser: 10
    };
    App.state.settings = { ...defaults, ...(App.state.settings || {}) };
    return App.state.settings;
  }

  function jsArg(value) {
    return JSON.stringify(String(value ?? ""));
  }

  function kycRecordTime(row) {
    return new Date(row?.updatedAt || row?.approvedAt || row?.rejectedAt || row?.submittedAt || row?.createdAt || 0).getTime() || 0;
  }

  function kycStatusRank(row) {
    const status = String(row?.status || "").toUpperCase();
    if (status === "APPROVED") return 4;
    if (status === "PENDING") return 3;
    if (status === "REJECTED") return 2;
    return 1;
  }

  function bestKycRowFor(userId) {
    const rows = (App.state.kycRequests || []).filter(x => x.userId === userId);
    if (!rows.length) return {};
    return rows.sort((a, b) => {
      const rankDiff = kycStatusRank(b) - kycStatusRank(a);
      if (rankDiff) return rankDiff;
      return kycRecordTime(b) - kycRecordTime(a);
    })[0] || {};
  }

  function currentKyc() {
    const u = user();
    if (!u) return null;
    const saved = bestKycRowFor(u.id);
    const personal = {
      fullName: saved.personal?.fullName || displayName(),
      mobile: u.mobile || saved.personal?.mobile || "",
      email: u.email || saved.personal?.email || "",
      dob: saved.personal?.dob || "",
      gender: saved.personal?.gender || "",
      city: saved.personal?.city || "",
      state: saved.personal?.state || "",
      pincode: saved.personal?.pincode || ""
    };
    const idDetails = (saved.idDetails && typeof saved.idDetails === "object")
      ? saved.idDetails
      : (saved.id && typeof saved.id === "object")
        ? saved.id
        : { type: "Aadhaar Card", number: saved.id_number || "" };
    const id = { type: "Aadhaar Card", number: idDetails.number || "" };
    const uploads = {
      frontName: saved.uploads?.frontName || "", frontPath: saved.uploads?.frontPath || "", frontBucket: saved.uploads?.frontBucket || "", frontUrl: saved.uploads?.frontUrl || "", frontSize: saved.uploads?.frontSize || 0, frontType: saved.uploads?.frontType || "",
      backName: saved.uploads?.backName || "", backPath: saved.uploads?.backPath || "", backBucket: saved.uploads?.backBucket || "", backUrl: saved.uploads?.backUrl || "", backSize: saved.uploads?.backSize || 0, backType: saved.uploads?.backType || "",
      selfieName: saved.uploads?.selfieName || "", selfiePath: saved.uploads?.selfiePath || "", selfieBucket: saved.uploads?.selfieBucket || "", selfieUrl: saved.uploads?.selfieUrl || "", selfieSize: saved.uploads?.selfieSize || 0, selfieType: saved.uploads?.selfieType || ""
    };
    return { requestId: typeof saved.id === "string" ? saved.id : "", status: saved.status || "NOT_SUBMITTED", personal, id, uploads, declarationAccepted: !!saved.declarationAccepted, finalAccepted: !!saved.finalAccepted, submittedAt: saved.submittedAt || "", approvedAt: saved.approvedAt || "", rejectedAt: saved.rejectedAt || "", rejectReason: saved.rejectReason || "" };
  }

  async function saveKycData(data) {
    return syncKycToState(data);
  }

  async function syncKycToState(data) {
    const u = user();
    if (!u || !App.state.kycRequests) return null;

    const existing = App.state.kycRequests.find(x => x.userId === u.id);
    const row = {
      id: existing?.id || App.uid("kyc"),
      userId: u.id,
      status: data.status,
      personal: data.personal,
      idDetails: data.id,
      uploads: data.uploads,
      submittedAt: data.submittedAt || "",
      approvedAt: data.approvedAt || "",
      rejectedAt: data.rejectedAt || "",
      rejectReason: data.rejectReason || "",
      declarationAccepted: !!data.declarationAccepted,
      finalAccepted: !!data.finalAccepted,
      updatedAt: App.now()
    };

    if (App.isDatabaseMode?.() && window.AITradeXDB?.writeKycRequest) {
      await window.AITradeXDB.writeKycRequest(row);
    }
    if (existing) Object.assign(existing, row);
    else App.state.kycRequests.push(row);
    App.saveState();
    return row;
  }

  async function syncPaymentMethodsToState(methods) {
    const u = user();
    if (!u || !App.state.paymentMethods) return [];

    const rows = methods.filter(m => m.type === "BANK").map(m => ({ ...m, userId: u.id, userEmail: u.email, source: "USER_BANK_ACCOUNT" }));
    if (App.isDatabaseMode?.() && window.AITradeXDB?.writePaymentMethod) {
      for (const row of rows) await window.AITradeXDB.writePaymentMethod(row);
    }
    App.state.paymentMethods = App.state.paymentMethods.filter(m => m.userId !== u.id);
    rows.forEach(row => App.state.paymentMethods.push(row));
    App.saveState();
    return rows;
  }

  function verifiedKycName() {
    const kyc = currentKyc();
    return kyc?.personal?.fullName || displayName();
  }

  function paymentMethods() {
    const u = user();
    return (App.state.paymentMethods || []).filter(m => m.userId === u?.id).map(m => ({ ...m }));
  }

  async function savePaymentMethods(methods) {
    return syncPaymentMethodsToState(methods);
  }

  function paymentCounts() {
    const methods = paymentMethods();
    return {
      BANK: methods.filter(m => m.type === "BANK" && m.status !== "REJECTED").length
    };
  }

  function approvedPaymentMethods() {
    return paymentMethods().filter(m => m.type === "BANK" && m.status === "APPROVED");
  }

  function depositRequests() {
    const u = user();
    return (App.state.depositRequests || []).filter(r => r.userId === u?.id).sort((a,b)=>Date.parse(b.createdAt||0)-Date.parse(a.createdAt||0));
  }

  function normalizeUtr(value) {
    return String(value || "").replace(/\D/g, "").slice(0, 12);
  }

  function isDuplicateDepositUtr(utr) {
    const cleanUtr = normalizeUtr(utr);
    if (!cleanUtr) return false;

    const localDuplicate = depositRequests().some(r => normalizeUtr(r.utr) === cleanUtr);
    const stateDuplicate = (App.state.depositRequests || []).some(r => normalizeUtr(r.utr) === cleanUtr);

    return localDuplicate || stateDuplicate;
  }

  async function saveDepositRequests(requests) {
    return syncDepositRequestsToState(requests);
  }

  function withdrawalRequests() {
    const u = user();
    return (App.state.withdrawalRequests || []).filter(r => r.userId === u?.id).sort((a,b)=>Date.parse(b.createdAt||0)-Date.parse(a.createdAt||0));
  }

  async function saveWithdrawalRequests(requests) {
    return syncWithdrawalRequestsToState(requests);
  }

  async function syncDepositRequestsToState(requests) {
    const u = user();
    if (!u || !App.state.depositRequests) return [];

    const rows = requests.map(r => ({ ...r, userId: u.id, userEmail: u.email }));
    if (App.isDatabaseMode?.() && window.AITradeXDB?.writeDepositRequest) {
      for (const row of rows) await window.AITradeXDB.writeDepositRequest(row);
    }
    App.state.depositRequests = App.state.depositRequests.filter(r => r.userId !== u.id);
    rows.forEach(row => App.state.depositRequests.push(row));
    App.saveState();
    return rows;
  }

  async function syncWithdrawalRequestsToState(requests) {
    const u = user();
    if (!u || !App.state.withdrawalRequests) return [];

    const rows = requests.map(r => ({ ...r, userId: u.id, userEmail: u.email }));
    if (App.isDatabaseMode?.() && window.AITradeXDB?.writeWithdrawalRequest) {
      for (const row of rows) await window.AITradeXDB.writeWithdrawalRequest(row);
    }
    App.state.withdrawalRequests = App.state.withdrawalRequests.filter(r => r.userId !== u.id);
    rows.forEach(row => App.state.withdrawalRequests.push(row));
    App.saveState();
    return rows;
  }

  function pendingDepositAmount() {
    return depositRequests()
      .filter(r => r.status === "PENDING")
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  }

  function pendingWithdrawalAmount() {
    return withdrawalRequests()
      .filter(r => r.status === "PENDING")
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  }

  function availableRealBalance() {
    return Math.max(0, realBalance() - pendingWithdrawalAmount());
  }

  function methodLabel(method) {
    if (!method) return "-";
    return `${method.bankName || "Bank"} · ****${String(method.accountNumber || "").slice(-4)} · ${method.holderName || "-"}`;
  }

  function statusPill(status) {
    const clean = String(status || "NOT_SUBMITTED").replaceAll("_", " ");
    const cls = String(status || "").toLowerCase().replaceAll("_", "-");
    return `<span class="status-pill ${cls}">${clean}</span>`;
  }

  function maskDocNumber(value) {
    const text = String(value || "");
    if (text.length <= 4) return text || "-";
    return "XXXXXX" + text.slice(-4);
  }


  const INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
  ];

  function stateOptions(value) {
    return `<option value="">Select state</option>${INDIAN_STATES.map(st => `<option value="${App.escapeHtml(st)}" ${value === st ? "selected" : ""}>${App.escapeHtml(st)}</option>`).join("")}`;
  }

  function digitsOnly(value, max) {
    return String(value || "").replace(/\D/g, "").slice(0, max);
  }

  function maskAadhaar(value) {
    const digits = digitsOnly(value, 12);
    if (!digits) return "-";
    return `XXXX XXXX ${digits.slice(-4)}`;
  }

  function isDuplicateAadhaar(aadhaar) {
    const digits = digitsOnly(aadhaar, 12);
    const u = user();
    if (!digits || !u) return false;
    return (App.state.kycRequests || []).some(row => {
      if (row.userId === u.id) return false;
      const status = String(row.status || "").toUpperCase();
      if (!["PENDING", "APPROVED"].includes(status)) return false;
      const saved = digitsOnly(row.idDetails?.number || row.id?.number, 12);
      return saved === digits;
    });
  }

  function kycDetailsGrid(kyc, title = "Verified Details") {
    return `
      <section class="premium-card kyc-result-details">
        <p>${title}</p>
        <h2>${App.escapeHtml(kyc.personal.fullName || "-")}</h2>
        <div class="review-grid">
          <article><span>Full Name</span><b>${App.escapeHtml(kyc.personal.fullName || "-")}</b></article>
          <article><span>DOB</span><b>${App.escapeHtml(kyc.personal.dob || "-")}</b></article>
          <article><span>Gender</span><b>${App.escapeHtml(kyc.personal.gender || "-")}</b></article>
          <article><span>Mobile</span><b>${App.escapeHtml(kyc.personal.mobile || "-")}</b></article>
          <article><span>Email</span><b>${App.escapeHtml(kyc.personal.email || "-")}</b></article>
          <article><span>City</span><b>${App.escapeHtml(kyc.personal.city || "-")}</b></article>
          <article><span>State</span><b>${App.escapeHtml(kyc.personal.state || "-")}</b></article>
          <article><span>Pincode</span><b>${App.escapeHtml(kyc.personal.pincode || "-")}</b></article>
          <article><span>Document</span><b>Aadhaar Card</b></article>
          <article><span>Aadhaar No.</span><b>${App.escapeHtml(maskAadhaar(kyc.id.number))}</b></article>
          <article><span>Aadhaar Front</span><b>${App.escapeHtml(uploadStatusText({ name: kyc.uploads.frontName, path: kyc.uploads.frontPath }, "-"))}</b>${fileViewLink({ url: kyc.uploads.frontUrl }, "View")}</article>
          <article><span>Aadhaar Back</span><b>${App.escapeHtml(uploadStatusText({ name: kyc.uploads.backName, path: kyc.uploads.backPath }, "-"))}</b>${fileViewLink({ url: kyc.uploads.backUrl }, "View")}</article>
          <article><span>Selfie</span><b>${App.escapeHtml(uploadStatusText({ name: kyc.uploads.selfieName, path: kyc.uploads.selfiePath }, "-"))}</b>${fileViewLink({ url: kyc.uploads.selfieUrl }, "View")}</article>
          ${kyc.submittedAt ? `<article><span>Submitted On</span><b>${new Date(kyc.submittedAt).toLocaleString()}</b></article>` : ""}
          ${kyc.approvedAt ? `<article><span>Approved On</span><b>${new Date(kyc.approvedAt).toLocaleString()}</b></article>` : ""}
          ${kyc.rejectedAt ? `<article><span>Rejected On</span><b>${new Date(kyc.rejectedAt).toLocaleString()}</b></article>` : ""}
        </div>
      </section>`;
  }

  function accountSwitch(compact = false) {
    return "";
  }

  function userNotifications() {
    const u = user();
    return App.notificationsFor ? App.notificationsFor({ audience: "USER", userId: u?.id || "" }) : [];
  }

  function userUnreadNotifications() {
    const u = user();
    return App.unreadNotificationCount ? App.unreadNotificationCount({ audience: "USER", userId: u?.id || "" }) : 0;
  }

  function notificationBadgeHtml() {
    const unread = userUnreadNotifications();
    return unread ? `<span class="notification-badge">${unread > 99 ? "99+" : unread}</span>` : "";
  }

  function appHeader() {
    const u = user();
    return `
      <header class="app-topbar compact-header">
        <button class="menu-btn" onclick="AITradeXUser.toggleDrawer()">☰</button>
        <div class="app-brand header-brand-text" aria-label="AITradeX">
          <b>AITradeX</b>
          <small>Smart trading workspace</small>
        </div>
        <div class="header-actions">
          <button class="notification-bell" onclick="AITradeXUser.openNotifications()" aria-label="Notifications">🔔${notificationBadgeHtml()}</button>
          ${profileNameChip()}
        </div>
      </header>
      ${drawerOpen ? menuDrawer() : ""}`;
  }

  function drawerStatusBadge(label, tone = "neutral") {
    return `<em class="drawer-status ${tone}">${App.escapeHtml(label)}</em>`;
  }

  function drawerItem({ pageKey, icon, title, subtitle, badge, tone = "neutral" }) {
    const active = page === pageKey ? "active" : "";
    const badgeHtml = badge ? drawerStatusBadge(badge.label, badge.tone || tone) : "";
    return `
      <button onclick="AITradeXUser.go('${pageKey}')" class="drawer-item rich ${active}">
        <i>${icon}</i>
        <span><b>${App.escapeHtml(title)}</b><small>${App.escapeHtml(subtitle)}</small></span>
        ${badgeHtml}
      </button>`;
  }

  function menuDrawer() {
    const u = user();
    const plan = currentPlan();
    const kyc = currentKyc();
    const bankApproved = approvedPaymentMethods().length;
    const openTickets = supportTicketsForUser().filter(ticket => String(ticket.status || "OPEN").toUpperCase() !== "CLOSED").length;
    const unread = userUnreadNotifications();
    const wallet = App.realBalance(u?.id || "");
    const kycBadge = kyc.status === "APPROVED" ? { label: "Approved", tone: "good" } : kyc.status === "PENDING" ? { label: "Pending", tone: "warn" } : kyc.status === "REJECTED" ? { label: "Rejected", tone: "bad" } : { label: "Start", tone: "warn" };
    const bankBadge = bankApproved ? { label: `${bankApproved} Ready`, tone: "good" } : { label: "Add", tone: "warn" };
    const planBadge = { label: plan?.name || "Free", tone: activeSubscription() ? "good" : "neutral" };

    return `
      <div class="drawer-backdrop" onclick="AITradeXUser.toggleDrawer(false)"></div>
      <aside class="side-drawer premium-drawer refined-drawer">
        <div class="drawer-profile-card">
          <div class="drawer-profile-top">
            ${avatar(displayName())}
            <div>
              <b>${App.escapeHtml(displayName() || "AITradeX User")}</b>
              <span>${App.escapeHtml(u?.email || u?.mobile || "User account")}</span>
            </div>
          </div>
          <div class="drawer-mini-grid">
            <article><span>Mode</span><b>${App.escapeHtml(accountMode)}</b></article>
            <article><span>Plan</span><b>${App.escapeHtml(plan?.name || "Free")}</b></article>
            <article><span>Wallet</span><b>${App.money(wallet)}</b></article>
          </div>
        </div>

        <div class="drawer-group rich-group">
          <span>Account</span>
          ${drawerItem({ pageKey: "profile", icon: "👤", title: "Profile", subtitle: "Name, avatar and account details" })}
          ${drawerItem({ pageKey: "kyc", icon: "🛡️", title: "KYC Verification", subtitle: "Required for verified withdrawals", badge: kycBadge })}
          ${drawerItem({ pageKey: "payments", icon: "🏦", title: "Bank Accounts", subtitle: "Approved payout methods", badge: bankBadge })}
          ${drawerItem({ pageKey: "notifications", icon: "🔔", title: "Notifications", subtitle: "Wallet, AI and support updates", badge: unread ? { label: `${unread} New`, tone: "warn" } : { label: "Clear", tone: "good" } })}
          ${drawerItem({ pageKey: "security", icon: "🔐", title: "Security", subtitle: "Session, password and login safety", badge: { label: "Protected", tone: "good" } })}
        </div>

        <div class="drawer-group rich-group">
          <span>Growth</span>
          ${drawerItem({ pageKey: "subscription", icon: "⭐", title: "Subscription", subtitle: "AI trade limit and plan control", badge: planBadge })}
          ${drawerItem({ pageKey: "ai-settings", icon: "🤖", title: "AI Settings", subtitle: "Auto trade amount and AI controls" })}
          ${drawerItem({ pageKey: "referral", icon: "🎁", title: "Referral", subtitle: "Invite friends and earn credits" })}
        </div>

        <div class="drawer-group rich-group">
          <span>Help</span>
          ${drawerItem({ pageKey: "support", icon: "🎧", title: "Support", subtitle: "Raise tickets and check replies", badge: openTickets ? { label: `${openTickets} Open`, tone: "warn" } : { label: "Ready", tone: "good" } })}
        </div>

        <div class="drawer-bottom-zone">
          <button onclick="AITradeXUser.logout()" class="drawer-item danger rich"><i>🚪</i><span><b>Logout</b><small>Sign out from this device</small></span></button>
        </div>
      </aside>`;
  }

  function navIcon(key) {
    const icons = {
      home: `<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 11.2 12 4.7l7.5 6.5v7.6a1.7 1.7 0 0 1-1.7 1.7h-3.4v-5.8H9.6v5.8H6.2a1.7 1.7 0 0 1-1.7-1.7v-7.6Z"/><path d="M3 12.4 12 4l9 8.4"/></svg>`,
      trade: `<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14"/><path d="M4.5 7.5 7 5l2.5 2.5"/><path d="M4.5 16.5 7 19l2.5-2.5"/><path d="M17 5v14"/><path d="M14.5 7.5 17 5l2.5 2.5"/><path d="M14.5 16.5 17 19l2.5-2.5"/></svg>`,
      orders: `<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5h10a2 2 0 0 1 2 2v13H5v-13a2 2 0 0 1 2-2Z"/><path d="M9 3h6v4H9V3Z"/><path d="M8 11h8"/><path d="M8 15h8"/></svg>`,
      positions: `<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 6.8h15"/><path d="M7 4v5.5"/><path d="M17 4v5.5"/><path d="M4.5 17.2h15"/><path d="M10 14.5V20"/><path d="M14 14.5V20"/><path d="M8 12h8"/></svg>`,
      wallet: `<svg class="nav-svg wallet-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.7h15.2a2 2 0 0 1 2 2v8.1a2 2 0 0 1-2 2H4.8a2 2 0 0 1-2-2V6.9c0-1 .7-1.8 1.7-2l10.7-1.7c1-.2 1.9.6 1.9 1.6v2.9"/><path d="M16.1 12.2h5.1v4.3h-5.1a2.1 2.1 0 1 1 0-4.3Z"/><path d="M16.3 14.4h.1"/><path d="M6.4 7.5 15.1 6"/></svg>`,
      history: `<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.6 11.2a7.6 7.6 0 1 1 2.2 6.1"/><path d="M4 6.5v4.9h4.9"/><path d="M12 8v4.4l3 1.8"/></svg>`
    };
    return icons[key] || "";
  }

  function bottomNav() {
    const nav = [
      ["home", "Home"],
      ["trade", "Trade"],
      ["positions", "Positions"],
      ["wallet", "Wallet"],
      ["history", "History"]
    ];
    return `
      <nav class="bottom-nav">
        ${nav.map(([key, label]) => `
          <button class="${page === key ? "active" : ""}" onclick="AITradeXUser.go('${key}')">
            <i>${navIcon(key)}</i><span>${label}</span>
          </button>`).join("")}
      </nav>`;
  }

  function shell(content) {
    root.innerHTML = `
      <div class="aitx-app">
        ${appHeader()}
        <main class="app-content">${content}</main>
        ${selectorSheetHtml()}
        ${manualLiveBarHtml()}
        ${aiLiveBarHtml()}
        ${manualCloseSelectorHtml()}
        ${aiOffConfirmHtml()}
        ${bottomNav()}
      </div>`;
    updateManualLiveBar();
  }

  function renderLandingTradingViewChart() {
    const container = document.getElementById("landing_tradingview_chart_container");
    if (!container) return;

    container.innerHTML = `
      <div class="chart-loading-state" id="aitx_landing_chart_loader">
        <div class="chart-spinner"></div>
        <b>BTC/USDT</b>
        <span>Loading live chart...</span>
      </div>`;

    if (!window.TradingView || !window.TradingView.widget) {
      setTimeout(renderLandingTradingViewChart, 800);
      return;
    }

    setTimeout(() => {
      const freshContainer = document.getElementById("landing_tradingview_chart_container");
      if (!freshContainer) return;

      freshContainer.innerHTML = `
        <div class="chart-loading-state" id="aitx_landing_chart_loader">
          <div class="chart-spinner"></div>
          <b>BTC/USDT</b>
          <span>Loading live chart...</span>
        </div>`;

      new window.TradingView.widget({
        autosize: true,
        symbol: "BINANCE:BTCUSDT",
        interval: "15",
        timezone: "Asia/Kolkata",
        theme: "dark",
        style: "1",
        locale: "en",
        toolbar_bg: "#050814",
        enable_publishing: false,
        hide_top_toolbar: true,
        hide_side_toolbar: true,
        allow_symbol_change: false,
        save_image: false,
        withdateranges: false,
        calendar: false,
        support_host: "https://www.tradingview.com",
        container_id: "landing_tradingview_chart_container"
      });

      const revealChart = () => {
        const frame = freshContainer.querySelector("iframe");
        const loader = document.getElementById("aitx_landing_chart_loader");
        if (frame) {
          frame.classList.add("aitx-tv-ready");
          if (loader) loader.classList.add("hide-loader");
          setTimeout(() => loader?.remove(), 450);
          return true;
        }
        return false;
      };

      if (!revealChart()) {
        const timer = setInterval(() => {
          if (revealChart()) clearInterval(timer);
        }, 250);
        setTimeout(() => clearInterval(timer), 5000);
      }
    }, 120);
  }

  function landing() {
    const activePlans = (App.state.plans || []).filter(p => String(p.status || "ACTIVE").toUpperCase() === "ACTIVE").slice(0, 4);
    const planCards = activePlans.map(plan => `
      <article class="landing-plan-card">
        <div><p>${App.escapeHtml(plan.name || "Plan")}</p><h3>${Number(plan.price || 0) ? App.money(plan.price) : "Free"}</h3></div>
        <span>${Number(plan.signals || 0)} AI trades/day</span>
      </article>`).join("");
    root.innerHTML = `
      <main class="public-wrap landing-premium">
        <nav class="public-nav landing-nav">
          <div class="brand aitx-public-logo">${App.logoHtml("full", "aitx-logo-full")}</div>
          <div class="public-actions">
            <a href="#how">How it works</a>
            <a href="#plans">Plans</a>
            <a href="#security">Security</a>
            <button onclick="AITradeXUser.scrollAuth()" class="btn small">Get Started</button>
          </div>
        </nav>

        <section class="hero-section landing-hero-v2">
          <div class="hero-copy">
            <p class="eyebrow">AI Powered Trading Dashboard</p>
            <h1>Trade crypto smarter with AI auto trading, live prices and INR wallet.</h1>
            <p class="hero-text">AITradeX brings live crypto trading, market/limit orders, AI auto trades, subscriptions, referrals, Aadhaar KYC, verified bank withdrawals and support tickets into one premium dashboard. Forex, Gold and Silver markets are coming soon.</p>
            <div class="hero-buttons">
              <button onclick="AITradeXUser.scrollAuth()" class="btn">Create Account</button>
              <button onclick="AITradeXUser.setAuthMode('login')" class="btn ghost">User Login</button>
            </div>
            <div class="trust-pills"><span>Crypto Live Now</span><span>Forex / Metals Coming Soon</span><span>Bank-only Withdrawals</span></div>
          </div>

          <div class="hero-terminal landing-terminal-v2 landing-tv-card">
            <div class="terminal-head"><div><span>Live Market Preview</span><strong>BTC/USDT</strong></div><em>TradingView · Binance</em></div>
            <div class="landing-tv-frame">
              <div id="landing_tradingview_chart_container" class="landing-tradingview-chart-container">
                <div class="chart-loading-state">
                  <div class="chart-spinner"></div>
                  <b>BTC/USDT</b>
                  <span>Loading live chart...</span>
                </div>
              </div>
            </div>
            <div class="terminal-grid"><div><span>Order Types</span><b>Market / Limit</b></div><div><span>AI Trades</span><b>Trial + Plans</b></div><div><span>Wallet</span><b>INR Ledger</b></div></div>
          </div>
        </section>

        <section class="landing-grid landing-feature-grid">
          <article><i>📈</i><h3>Manual Trading</h3><p>Place market or limit orders, lock entry price, track live P/L and close positions from the Positions flow.</p></article>
          <article><i>🤖</i><h3>AI Auto Trading</h3><p>AI trading starts ON with 75% allocation by default. Users can change allocation anytime.</p></article>
          <article><i>💳</i><h3>INR Wallet</h3><p>Deposit requests, bank-only withdrawals, wallet ledger and admin approval flow are built in.</p></article>
        </section>

        <section id="how" class="landing-section-card">
          <div class="landing-section-head"><p class="eyebrow">How It Works</p><h2>Start in four clean steps</h2></div>
          <div class="landing-steps-grid">
            <article><b>01</b><h3>Create Account</h3><p>Register with email, mobile and optional referral code.</p></article>
            <article><b>02</b><h3>Complete KYC</h3><p>Submit Aadhaar, selfie and personal details for review.</p></article>
            <article><b>03</b><h3>Add Funds</h3><p>Use INR wallet deposits and verified bank withdrawals.</p></article>
            <article><b>04</b><h3>Trade Crypto</h3><p>Use crypto manual orders or AI auto trading with daily plan limits. Forex and metals are coming soon.</p></article>
          </div>
        </section>

        <section id="plans" class="landing-section-card landing-plans-preview">
          <div class="landing-section-head"><p class="eyebrow">Subscription Plans</p><h2>Unlock more daily AI trades</h2></div>
          <div class="landing-plan-grid">${planCards || `<article class="landing-plan-card"><div><p>Free Trial</p><h3>Free</h3></div><span>5 AI trades/day</span></article>`}</div>
          <button onclick="AITradeXUser.scrollAuth()" class="btn small">Create Account to View Plans</button>
        </section>

        <section class="landing-grid landing-feature-grid">
          <article><i>🛡️</i><h3>KYC Security</h3><p>Required Aadhaar KYC, selfie verification and admin review help reduce account misuse.</p></article>
          <article><i>🤝</i><h3>Referral Rewards</h3><p>Earn rewards when invited users complete their first approved deposit or paid plan purchase.</p></article>
          <article><i>💬</i><h3>Support + WhatsApp</h3><p>Raise support tickets inside the app and use WhatsApp quick help for urgent issues.</p></article>
        </section>

        <section id="authBox" class="auth-section landing-auth-v2">
          <div class="auth-copy"><div class="auth-logo-box">${App.logoHtml("full", "aitx-logo-full")}</div><p class="eyebrow">User Access</p><h2>${authMode === "login" ? "Login to AITradeX" : "Create AITradeX account"}</h2><p>Start with AI auto trading enabled, complete KYC, add funds and manage trades from a clean mobile-first dashboard.</p></div>
          <div class="auth-card">
            <div class="auth-tabs"><button class="${authMode === "login" ? "active" : ""}" onclick="AITradeXUser.setAuthMode('login')">Login</button><button class="${authMode === "register" ? "active" : ""}" onclick="AITradeXUser.setAuthMode('register')">Register</button></div>
            ${authMode === "login" ? loginForm() : registerForm()}
          </div>
        </section>

        <section id="security" class="landing-security-band">
          <div><b>Security-first trading flow</b><span>Aadhaar KYC · Verified bank accounts · Deposit proof review · Ticket records · AI Control Center</span></div>
          <button onclick="AITradeXUser.scrollAuth()" class="btn ghost small">Join Now</button>
        </section>

        <footer class="landing-footer">
          <div>${App.logoHtml("full", "aitx-logo-full")}</div>
          <p>AITradeX is a crypto-first trading dashboard experience with wallet, KYC, subscription, referral and support modules. Forex, Gold and Silver are planned as upcoming markets.</p>
          <span>© ${new Date().getFullYear()} AITradeX. All rights reserved.</span>
        </footer>
      </main>`;
    setTimeout(renderLandingTradingViewChart, 120);
  }

  function loginForm() {
    return `<form onsubmit="AITradeXUser.login(event)" class="form-grid"><label>Email<input id="loginEmail" type="email" required placeholder="you@example.com"/></label><label>Password<input id="loginPassword" type="password" required placeholder="Password"/></label><button class="btn">Login</button></form>`;
  }

  function registerForm() {
    return `<form onsubmit="AITradeXUser.register(event)" class="form-grid"><label>Full Name<input id="regName" required placeholder="Your name"/></label><label>Email<input id="regEmail" type="email" required placeholder="you@example.com"/></label><label>Mobile<input id="regMobile" required placeholder="10 digit mobile"/></label><label>Password<input id="regPassword" type="password" required placeholder="Create password"/></label><label>Referral Code <small>Optional</small><input id="regReferral" value="${App.escapeHtml(referralParam)}" placeholder="Referral code"/></label><button class="btn">Create Account</button></form>`;
  }


  function dashboardUserName() {
    return String(displayName() || "Trader").split(" ")[0] || "Trader";
  }

  function userWalletLedger(limit = 4) {
    const u = user();
    if (!u) return [];
    return (App.state.walletLedger || [])
      .filter(row => row.userId === u.id)
      .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0))
      .slice(0, limit);
  }

  function latestUserActivity(limit = 5) {
    const u = user();
    if (!u) return [];
    const rows = [];
    userNotifications().slice(0, 4).forEach(n => rows.push({
      icon: notificationIcon(n.type),
      title: n.title || "Notification",
      detail: n.message || "Account update",
      time: n.createdAt,
      page: n.linkPage || "notifications"
    }));
    userWalletLedger(4).forEach(row => rows.push({
      icon: Number(row.amount || 0) >= 0 ? "➕" : "➖",
      title: row.type || "Wallet Entry",
      detail: `${Number(row.amount || 0) >= 0 ? "+" : ""}${App.money(Number(row.amount || 0))} · Balance ${App.money(Number(row.balanceAfter || 0))}`,
      time: row.createdAt,
      page: "wallet"
    }));
    (App.state.trades || [])
      .filter(t => t.userId === u.id)
      .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0))
      .slice(0, 4)
      .forEach(t => {
        const type = aiTradeTypeOf(t);
        const label = type === "AI_AUTO" ? "AI Instant" : type === "AI_LIVE" ? "AI Live" : "Manual";
        rows.push({
          icon: type.startsWith("AI_") ? "🤖" : "📈",
          title: `${label} ${t.status || "Trade"}`,
          detail: `${t.pair || "Trade"} · ${Number(t.pnl || 0) >= 0 ? "+" : ""}${App.money(Number(t.pnl || 0))}`,
          time: t.createdAt || t.openedAt || t.closedAt,
          page: "positions"
        });
      });
    return rows
      .sort((a, b) => Date.parse(b.time || 0) - Date.parse(a.time || 0))
      .slice(0, limit);
  }

  function accountReadinessItems() {
    const kycStatus = App.kycStatus(user()?.id || "");
    const bankCount = approvedPaymentMethods().length;
    const ai = currentAiSettings();
    const balance = realBalance();
    return [
      {
        icon: "🛡️",
        title: "KYC",
        value: String(kycStatus || "NOT_SUBMITTED").replaceAll("_", " "),
        ok: kycStatus === "APPROVED",
        page: "kyc"
      },
      {
        icon: "🏦",
        title: "Bank",
        value: bankCount ? `${bankCount} approved` : "Add bank",
        ok: bankCount > 0,
        page: "payments"
      },
      {
        icon: "💳",
        title: "Wallet",
        value: App.money(balance),
        ok: balance > 0,
        page: "wallet"
      },
      {
        icon: "🤖",
        title: "AI Auto",
        value: ai.enabled ? "Active" : "OFF",
        ok: !!ai.enabled,
        page: "ai-settings"
      }
    ];
  }

  function dashboardHeroCard({ balance, pnl, activeManualCount, activeAiCount }) {
    const unread = userUnreadNotifications();
    const totalActive = Number(activeManualCount || 0) + Number(activeAiCount || 0);
    const modeLabel = "Account";
    const modeHint = "Wallet ready";
    return `
      <section class="user-command-hero clean-home-hero real">
        <div class="hero-glow-orb"></div>
        <div class="hero-mode-row">
          <span class="hero-mode-chip">${modeLabel}</span>
          ${accountSwitch(true)}
        </div>
        <div class="user-command-copy">
          <p>USER DASHBOARD</p>
          <h1>Welcome back, ${App.escapeHtml(dashboardUserName())}</h1>
          <span>${modeHint} · ${totalActive ? `${totalActive} active position${totalActive > 1 ? "s" : ""}` : "No active positions"}</span>
          <div class="hero-wallet-line">
            <b>${App.money(balance)}</b>
            <em class="${pnl >= 0 ? "profit-text" : "loss-text"}">${pnl >= 0 ? "+" : ""}${App.money(pnl)} today</em>
          </div>
        </div>
        <div class="user-command-meta clean-home-meta">
          <article><span>Manual</span><b>${activeManualCount}</b></article>
          <article><span>AI Positions</span><b>${activeAiCount}</b></article>
          <article><span>Unread</span><b>${unread}</b></article>
        </div>
      </section>`;
  }

  function readinessCard() {
    return `
      <section class="premium-card readiness-card">
        <div class="card-row">
          <div><p>ACCOUNT READINESS</p><h2>Setup Status</h2><h4>Complete these items for smoother deposit, trade and withdrawal flow.</h4></div>
        </div>
        <div class="readiness-grid">
          ${accountReadinessItems().map(item => `
            <button class="readiness-item ${item.ok ? "done" : "todo"}" onclick="AITradeXUser.go('${item.page}')">
              <i>${item.icon}</i>
              <span>${item.title}</span>
              <b>${App.escapeHtml(item.value)}</b>
            </button>`).join("")}
        </div>
      </section>`;
  }

  function actionCenterCard() {
    const kycStatus = App.kycStatus(user()?.id || "");
    const bankReady = approvedPaymentMethods().length > 0;
    const ai = currentAiSettings();
    const usage = aiDailyUsage();
    const action = kycStatus !== "APPROVED"
      ? { title: "Complete KYC", detail: "KYC approval is required for withdrawals.", page: "kyc", cta: "Start KYC" }
      : !bankReady
        ? { title: "Add bank account", detail: "Approved bank account is required for payout requests.", page: "payments", cta: "Add Bank" }
        : !ai.enabled
          ? { title: "Turn on AI Auto Trading", detail: "AI is OFF. Turn it ON from AI Settings.", page: "ai-settings", cta: "AI Settings" }
          : { title: "Ready for trading", detail: `${usage.used}/${usage.limit} AI trades used today.`, page: "trade", cta: "Open Trade" };
    return `
      <section class="premium-card dashboard-action-center">
        <div>
          <p>NEXT BEST ACTION</p>
          <h2>${App.escapeHtml(action.title)}</h2>
          <h4>${App.escapeHtml(action.detail)}</h4>
        </div>
        <button class="change-pair-btn" onclick="AITradeXUser.go('${action.page}')">${App.escapeHtml(action.cta)}</button>
      </section>`;
  }

  function recentActivityCard() {
    const rows = latestUserActivity(5);
    return `
      <section class="premium-card user-recent-activity-card">
        <div class="card-row">
          <div><p>RECENT ACTIVITY</p><h2>Latest account updates</h2><h4>Wallet, AI trades and notification activity in one place.</h4></div>
          <button class="ghost-action" onclick="AITradeXUser.go('notifications')">All Notifications</button>
        </div>
        <div class="user-activity-list">
          ${rows.length ? rows.map(row => `
            <button class="user-activity-row" onclick="AITradeXUser.go('${row.page}')">
              <i>${row.icon}</i>
              <span><b>${App.escapeHtml(row.title)}</b><em>${App.escapeHtml(row.detail)}</em></span>
              <small>${row.time ? formatHistoryDate(row.time) : "Now"}</small>
            </button>`).join("") : `<div class="empty-state">No recent activity yet.</div>`}
        </div>
      </section>`;
  }

  function homePage() {
    const balance = currentBalance();
    const real = realBalance();
    const pnl = pnlValue();
    const ai = currentAiSettings();
    const usage = aiDailyUsage();
    const tradeAmount = accountMode === "REAL" ? real * Number(ai.percent || 0) / 100 : 0;
    const pair = selectedPairData();
    const activeManualCount = manualOpenPositions().length;
    const activeAiCount = aiOpenPositions().length;
    const activeTotal = activeManualCount + activeAiCount;

    shell(`
      ${dashboardHeroCard({ balance, pnl, activeManualCount, activeAiCount })}

      <section class="compact-grid home-summary-grid polished-home-summary clean-home-summary">
        <article><span>AI Status</span><b>${ai.enabled ? "Active" : "OFF"}</b><small>${usage.used}/${usage.limit} AI trades today</small></article>
        <article><span>Active Positions</span><b>${activeTotal}</b><small>${activeManualCount} manual · ${activeAiCount} AI</small></article>
        <article><span>Wallet</span><b>${App.money(real)}</b><small>Available balance</small></article>
        <article><span>Selected Pair</span><b>${selectedPair}</b><small>${pair.signal} bias</small></article>
      </section>

      ${aiTradingSummaryCard()}

      <section class="premium-card quick-action-card polished-quick-actions clean-quick-actions">
        <div class="quick-action-head">
          <div>
            <p>QUICK ACTIONS</p>
            <h2>Everything in one tap</h2>
            <span>Trade, track positions, manage wallet or raise support quickly.</span>
          </div>
        </div>
        <div class="quick-action-grid">
          <button onclick="AITradeXUser.go('trade')"><i>📈</i><b>Trade</b><span>Crypto market</span></button>
          <button onclick="AITradeXUser.go('positions')"><i>📊</i><b>Positions</b><span>Open trades</span></button>
          <button onclick="AITradeXUser.go('wallet')"><i>💳</i><b>Wallet</b><span>Deposit / Withdraw</span></button>
          <button onclick="AITradeXUser.go('support')"><i>🎧</i><b>Support</b><span>Tickets</span></button>
        </div>
      </section>

      <section class="premium-card subscription-mini-card polished-plan-card clean-plan-card">
        <div class="card-row">
          <div>
            <p>CURRENT PLAN</p>
            <h2>${App.escapeHtml(currentPlan().name || "Free")}</h2>
            <h4>${usage.used}/${usage.limit} AI auto trades used today · Expires ${subscriptionExpiryText(activeSubscription())}</h4>
            ${isAiLimitComplete() ? `<span class="upgrade-inline-note">Daily AI trade limit completed. Upgrade your plan to unlock more AI auto trades.</span>` : ""}
          </div>
          <button class="change-pair-btn" onclick="AITradeXUser.go('subscription')">${isAiLimitComplete() ? "Upgrade Plan" : "View Plan"}</button>
        </div>
      </section>

      <section class="premium-card ai-settings-mini-card clean-ai-settings-summary">
        <div class="card-row">
          <div><p>AI SETTINGS</p><h2>${ai.enabled ? "AI Auto Trading ON" : "AI Auto Trading OFF"}</h2><h4>${usage.used}/${usage.limit} AI auto trades used today · Allocation ${ai.percent}% · Pool ${App.money(tradeAmount)}</h4></div>
          <button class="change-pair-btn" onclick="AITradeXUser.go('ai-settings')">Manage</button>
        </div>
      </section>
    `);
    refreshVisiblePrices([selectedPair]);
  }

  function aiSettingsPage() {
    const ai = currentAiSettings();
    const usage = aiDailyUsage();
    const balance = realBalance();
    const tradeAmount = balance * Number(ai.percent || 0) / 100;

    shell(`
      <section class="premium-card auto-card polished-auto-card clean-ai-control-card ai-settings-page-card">
        <div class="card-row">
          <div>
            <p>AI SETTINGS</p>
            <h2>Auto Trade Control</h2>
            <h4>Manage AI auto trading and choose how much wallet balance AI can use for future automatic trades.</h4>
          </div>
          <button class="ai-power ${ai.enabled ? "on" : ""}" onclick="AITradeXUser.toggleAutoTrade()">${ai.enabled ? "ON" : "OFF"}</button>
        </div>
        <div class="percent-grid">
          ${[25, 50, 75, 100].map(v => `<button class="${ai.percent === v ? "active" : ""}" onclick="AITradeXUser.setAutoPercent(${v})">${v}%</button>`).join("")}
        </div>
        <div class="auto-summary">
          <article><span>Selected</span><b>${ai.percent}%</b></article>
          <article><span>AI Trade Pool</span><b>${App.money(tradeAmount)}</b></article>
          <article><span>Daily AI Trades</span><b>${usage.used}/${usage.limit}</b></article>
        </div>
        ${!ai.enabled ? `<div class="ai-status-banner off"><b>AI Auto Trading is OFF.</b><span>Turn it ON to receive AI auto trades.</span></div>` : ""}
        ${ai.enabled && isAiLimitComplete() ? `<div class="ai-status-banner limit"><b>Daily AI trade limit completed.</b><span>Upgrade your plan to unlock more AI auto trades.</span><button onclick="AITradeXUser.go('subscription')">Upgrade Plan</button></div>` : ""}
      </section>

      <section class="premium-card dashboard-action-center ai-settings-help-card">
        <div>
          <p>AI CONTROL NOTE</p>
          <h2>Home stays clean now</h2>
          <h4>AI settings are kept here, while Home shows only account summary and quick actions.</h4>
        </div>
        <button class="ghost-action" onclick="AITradeXUser.go('home')">Back Home</button>
      </section>
    `);
  }

  function tradePage() {
    const pair = selectedPairData();
    const balance = currentBalance();
    const marginValue = Number(tradeAmountPreview || 0);
    const leverageValue = Math.max(1, Number(tradeLeveragePreview || 1));
    const positionSize = marginValue * leverageValue;
    const tradeIsActive = isTradeActivePair(pair.pair);
    const marginWarning = tradeIsActive && marginValue > balance;

    shell(`
      <section class="trade-command clean-pair-card trade-hero-premium">
        <div class="trade-hero-main">
          <p>${selectedMarket} MARKET</p>
          <h1>${displayPair(selectedPair)}</h1>
          <span data-price-card="${tradeIsActive ? "true" : "false"}" data-live-pair="${pair.pair}" data-live-type="line">${pair.price} · <em class="${tradeIsActive ? changeClass(pair.change) : "upcoming-text"}">${pair.change}</em></span>
        </div>
        <div class="trade-hero-side">
          <span class="trade-mode-badge account-only">Account</span>
          ${usdtRateChip("trade-rate-chip")}
          <button class="change-pair-btn" onclick="AITradeXUser.openSheet('pair')">Change Pair</button>
        </div>
        <div class="trade-hero-metrics">
          <article><span>Available</span><b>${App.money(balance)}</b></article>
          <article><span>Signal</span><b class="${tradeIsActive ? changeClass(pair.change) : "upcoming-text"}">${tradeIsActive ? pair.signal || "LIVE" : "SOON"}</b></article>
          <article><span>Leverage</span><b>${leverageValue}x</b></article>
        </div>
      </section>

      <section class="trade-select-bar app-selector-bar market-only-bar">
        <div class="market-switch">
          <button class="${selectedMarket === "CRYPTO" ? "active" : ""}" onclick="AITradeXUser.setMarket('CRYPTO')">Crypto</button>
          <button class="${selectedMarket === "FOREX" ? "active" : ""}" onclick="AITradeXUser.setMarket('FOREX')">Forex & Metals <small>Soon</small></button>
        </div>
      </section>

      <section class="pair-rate-list">
        ${pairsForMarket().map(raw => { const p = pairView(raw); return `
          <button class="${selectedPair === p.pair ? "active" : ""} ${isUpcomingPair(p.pair) ? "upcoming-pair" : ""}" onclick="AITradeXUser.selectPair('${p.pair}')">
            <b>${displayPair(p.pair)}</b>
            <span data-price-card="${isTradeActivePair(p.pair) ? "true" : "false"}" data-live-pair="${p.pair}" data-live-type="price">${p.price}</span>
            <em data-live-pair="${p.pair}" data-live-type="change" class="${isUpcomingPair(p.pair) ? "upcoming-text" : changeClass(p.change)}">${p.change}</em>
          </button>
        `; }).join("")}
      </section>

      <section class="chart-shell tradingview-shell premium-native-chart-shell">
        <div class="native-chart-head">
          <div>
            <p>LIVE CHART</p>
            <h3>${displayPair(selectedPair)}</h3>
          </div>
          <span class="native-chart-price" data-price-card="${tradeIsActive ? "true" : "false"}" data-live-pair="${pair.pair}" data-live-type="line">${pair.price} · <em class="${tradeIsActive ? changeClass(pair.change) : "upcoming-text"}">${pair.change}</em></span>
        </div>
        <div class="chart-toolbar working-timeframes native-timeframe-row">
          ${[
            ["1", "1m"],
            ["5", "5m"],
            ["15", "15m"],
            ["30", "30m"],
            ["60", "1h"],
            ["240", "4h"],
            ["D", "1D"]
          ].map(([value, label]) => `<button class="${chartInterval === value ? "active" : ""}" onclick="AITradeXUser.setChartInterval('${value}')">${label}</button>`).join("")}
          <button class="chart-settings-btn" onclick="AITradeXUser.openSheet('chart-settings')">⚙</button>
        </div>
        <div class="responsive-chart tradingview-widget-frame native-chart-frame">
          <div id="tradingview_chart_container" class="tradingview-chart-container"></div>
        </div>
        <div class="native-chart-foot">
          <span>TradingView market chart</span>
          <b>${chartToolbar ? "Tools on" : "Clean mode"}</b>
        </div>
      </section>

      <section class="premium-card order-ticket pro-order-ticket compact-trade-ticket">
        <div class="compact-ticket-head">
          <div>
            <p>ORDER TICKET</p>
            <h2>${displayPair(selectedPair)}</h2>
            <span>${tradeOrderType === "LIMIT" ? "Limit" : "Market"} Order</span>
          </div>
          <span class="ticket-chip">${tradeIsActive ? selectedMarket : "UPCOMING"}</span>
        </div>

        ${tradeOrderNotice ? `<div class="order-success-banner compact"><b>${App.escapeHtml(tradeOrderNotice.title)}</b><span>${App.escapeHtml(tradeOrderNotice.detail)}</span></div>` : ""}

        ${tradeIsActive ? `
          <div class="fast-buy-sell-row priority-actions">
            <button class="sell-btn" onclick="AITradeXUser.placeManualTrade('SELL')">SELL / SHORT</button>
            <button class="buy-btn" onclick="AITradeXUser.placeManualTrade('BUY')">BUY / LONG</button>
          </div>
        ` : `
          <div class="coming-soon-trade-bar compact priority-actions">
            <b>Market Coming Soon</b>
            <span>Forex, Gold and Silver trading will be available after premium market data integration.</span>
          </div>
        `}

        <div class="compact-trade-summary top-action-summary">
          <span><b>Margin</b>${App.money(tradeAmountPreview)}</span>
          <span><b>Position</b>${App.money(positionSize)}</span>
          <span><b>Leverage</b>${leverageValue}x</span>
        </div>

        ${marginWarning ? `<div class="order-warning-bar compact">Insufficient balance. Please reduce the amount or add funds.</div>` : ""}

        <div class="compact-ticket-grid after-action-fields">
          <label>Amount
            <input type="number" value="${App.escapeHtml(String(tradeAmountPreview || ""))}" min="1" oninput="AITradeXUser.setTradeAmount(this.value)" placeholder="Margin INR"/>
          </label>
          <div class="app-field">
            <span>Leverage</span>
            <button class="app-select-btn full compact" onclick="AITradeXUser.openSheet('leverage')">
              <b>${tradeLeveragePreview}x</b>
              <em>Change</em>
            </button>
          </div>
        </div>

        <div class="compact-ticket-grid compact-second-row after-action-fields">
          <label>Order Type
            <select onchange="AITradeXUser.setTradeOrderType(this.value)">
              <option value="MARKET" ${tradeOrderType === "MARKET" ? "selected" : ""}>Market</option>
              <option value="LIMIT" ${tradeOrderType === "LIMIT" ? "selected" : ""}>Limit</option>
            </select>
          </label>
          ${tradeOrderType === "LIMIT" ? `
            <label>Limit Price (INR)
              <input type="number" value="${App.escapeHtml(tradeLimitPrice)}" min="0" step="any" oninput="AITradeXUser.setTradeLimitPrice(this.value)" placeholder="Trigger price in ₹"/>
            </label>
          ` : `
            <div class="compact-account-chip ${accountMode.toLowerCase()}">
              <span>Available</span>
              <b>${App.money(balance)}</b>
            </div>
          `}
        </div>

        <details class="compact-risk-details">
          <summary>Order Risk Note</summary>
          <div class="risk-preset-row compact">
            <span>Manual close</span><span>Admin close</span><span>Live P/L</span><span>Ledger on close</span>
          </div>
          <div class="limit-order-note compact"><b>TP/SL hidden:</b> automatic take-profit/stop-loss is not enabled in this build, so orders remain open until user/admin close or limit cancellation.</div>
          ${tradeOrderType === "LIMIT" ? `<div class="limit-order-note compact"><b>Limit order:</b> BUY triggers at or below your price. SELL triggers at or above your price.</div>` : ""}
        </details>
      </section>

      <section class="premium-card market-feed-card clean-market-insight-card">
        <div class="card-row compact-market-head">
          <div><p>MARKET FEED</p><h2>${tradeIsActive ? "Market Depth" : "Upcoming Market"}</h2></div>
          <span class="mini-live ${tradeIsActive ? "" : "soon"}">${tradeIsActive ? "LIVE" : "SOON"}</span>
        </div>
        <div class="market-insight-row">
          ${marketFeedForPair().slice(0, 3).map(row => `
            <article>
              <span>${row.left}</span>
              <b>${row.mid}</b>
              <em class="${row.mood === "up" ? "profit-text" : "loss-text"}">${row.right}</em>
            </article>
          `).join("")}
        </div>
      </section>

      <section class="premium-card trade-feed-card clean-trade-feed-card">
        <div class="card-row compact-market-head">
          <div><p>TRADE FEED</p><h2>${displayPair(selectedPair)} Activity</h2></div>
          <button class="change-pair-btn small" onclick="AITradeXUser.go('history')">View More</button>
        </div>
        <div class="trade-feed-list compact-trade-feed-list">
          ${tradeFeedForMarket().slice(0, 2).map(item => `
            <article class="${item.pair === selectedPair ? "active" : ""}">
              <div>
                <b>${displayPair(item.pair)}</b>
                <span>${item.action} · ${item.lev} · ${item.time}</span>
              </div>
              <div>
                <strong>${item.size}</strong>
                <em class="${changeClass(item.change)}">${item.change}</em>
              </div>
            </article>
          `).join("")}
        </div>
      </section>

    `);

    refreshVisiblePrices(pairsForMarket());
    scheduleTradingViewChart();
  }
  function walletPage() {
    const kyc = currentKyc();
    const approvedMethods = approvedPaymentMethods();
    const deposits = depositRequests();
    const withdrawals = withdrawalRequests();
    const settings = platformSettings();
    const minDeposit = Number(settings.minDeposit || 500);
    const maxDeposit = Number(settings.maxDeposit || 1000000);
    const minWithdrawal = Number(settings.minWithdrawal || 1000);
    const maxWithdrawal = Number(settings.maxWithdrawal || 500000);
    const selectedWithdrawalMethod = approvedMethods.find(m => m.id === withdrawalDraft.methodId) || approvedMethods[0] || null;
    const platformUpi = settings.depositUpiId || "aitradex@upi";
    const bankDetails = {
      accountName: settings.depositAccountName || "AITradeX Private Wallet",
      bankName: settings.depositBankName || "AITradeX Bank",
      accountNumber: settings.depositAccountNumber || "123456789012",
      ifsc: settings.depositIfsc || "AITX0001234"
    };

    const depositMasterEnabled = settings.depositEnabled !== false && settings.maintenanceMode !== true;
    const withdrawalMasterEnabled = settings.withdrawalEnabled !== false && settings.maintenanceMode !== true;
    const upiDepositEnabled = depositMasterEnabled && settings.depositUpiEnabled !== false;
    const bankDepositEnabled = depositMasterEnabled && settings.depositBankEnabled !== false;
    const enabledDepositTypes = [
      ...(upiDepositEnabled ? ["UPI"] : []),
      ...(bankDepositEnabled ? ["BANK"] : [])
    ];

    if (!enabledDepositTypes.includes(depositDraft.type)) {
      depositDraft.type = enabledDepositTypes[0] || "UPI";
      localStorage.setItem("AITradeX_DEPOSIT_DRAFT", JSON.stringify(depositDraft));
    }

    const depositMethodsAvailable = enabledDepositTypes.length > 0;
    const activePanel = ["DEPOSIT", "WITHDRAWAL", "HISTORY"].includes(walletMode) ? walletMode : "DEPOSIT";
    const recordsTab = walletRecordsTab === "LEDGER" ? "LEDGER" : "REQUESTS";
    const requestRows = [...deposits.map(r => ({ ...r, kind: "Deposit" })), ...withdrawals.map(r => ({ ...r, kind: "Withdraw" }))]
      .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));

    const requestFiltered = requestRows.filter(r => {
      const f = walletHistoryFilter;
      if (f === "ALL") return true;
      if (f === "DEPOSIT") return r.kind === "Deposit";
      if (f === "WITHDRAWAL") return r.kind === "Withdraw";
      return String(r.status || "").toUpperCase() === f;
    });

    const pageSize = 6;
    const requestTotalPages = Math.max(1, Math.ceil(requestFiltered.length / pageSize));
    walletRequestPage = Math.min(walletRequestPage, requestTotalPages - 1);
    const requestPageRows = requestFiltered.slice(walletRequestPage * pageSize, walletRequestPage * pageSize + pageSize);

    const ledgerRows = userWalletLedger(100);
    const ledgerTotalPages = Math.max(1, Math.ceil(ledgerRows.length / pageSize));
    walletLedgerPage = Math.min(walletLedgerPage, ledgerTotalPages - 1);
    const ledgerPageRows = ledgerRows.slice(walletLedgerPage * pageSize, walletLedgerPage * pageSize + pageSize);

    const recentStatus = requestRows[0];
    const depositPanel = `
      <section class="wallet-clean-card wallet-form-card">
        <div class="wallet-clean-head">
          <div>
            <p>DEPOSIT</p>
            <h2>Add funds</h2>
            <span>${App.money(minDeposit)} - ${App.money(maxDeposit)} · Admin approval required</span>
          </div>
          <b>${depositDraft.type || "UPI"}</b>
        </div>

        ${!depositMethodsAvailable ? `
          <div class="kyc-required-box deposit-disabled-box">
            Deposit is temporarily disabled by admin. Please try again later or contact support.
          </div>
          <button class="btn ghost" onclick="AITradeXUser.go('support')">Contact Support</button>
        ` : `
          <div class="wallet-clean-form-grid">
            <label>Amount
              <input id="depositAmountInput" type="number" min="${minDeposit}" max="${maxDeposit}" value="${App.escapeHtml(depositDraft.amount)}" placeholder="Enter deposit amount"/>
            </label>
            <div class="wallet-method-choice wallet-clean-methods">
              ${upiDepositEnabled ? `<button class="${depositDraft.type === "UPI" ? "active" : ""}" onclick="AITradeXUser.setDepositType('UPI')">
                <b>UPI / QR</b>
                <span>Fast payment</span>
              </button>` : ""}
              ${bankDepositEnabled ? `<button class="${depositDraft.type === "BANK" ? "active" : ""}" onclick="AITradeXUser.setDepositType('BANK')">
                <b>Bank Transfer</b>
                <span>NEFT / IMPS</span>
              </button>` : ""}
            </div>
          </div>

          <div class="wallet-payment-box">
            ${depositDraft.type === "UPI" ? `
              <div class="wallet-qr-wrap">
                ${settings.depositQrImage ? `<img src="${App.escapeHtml(settings.depositQrImage)}" alt="Deposit QR"/>` : `<div class="qr-grid-mark">QR</div>`}
              </div>
              <div class="wallet-pay-lines">
                <div class="copy-row"><b>UPI ID</b><span>${platformUpi}</span><button onclick="AITradeXUser.copyText(${jsArg(platformUpi)})">Copy</button></div>
                <div class="copy-row"><b>Amount</b><span>${App.money(depositDraft.amount || 0)}</span><button onclick="AITradeXUser.copyText(${jsArg(depositDraft.amount || 0)})">Copy</button></div>
              </div>
            ` : `
              <div class="wallet-pay-lines bank-lines">
                <div class="copy-row"><b>Account Name</b><span>${bankDetails.accountName}</span><button onclick="AITradeXUser.copyText(${jsArg(bankDetails.accountName)})">Copy</button></div>
                <div class="copy-row"><b>Bank Name</b><span>${bankDetails.bankName}</span><button onclick="AITradeXUser.copyText(${jsArg(bankDetails.bankName)})">Copy</button></div>
                <div class="copy-row"><b>Account Number</b><span>${bankDetails.accountNumber}</span><button onclick="AITradeXUser.copyText(${jsArg(bankDetails.accountNumber)})">Copy</button></div>
                <div class="copy-row"><b>IFSC Code</b><span>${bankDetails.ifsc}</span><button onclick="AITradeXUser.copyText(${jsArg(bankDetails.ifsc)})">Copy</button></div>
                <div class="copy-row"><b>Amount</b><span>${App.money(depositDraft.amount || 0)}</span><button onclick="AITradeXUser.copyText(${jsArg(depositDraft.amount || 0)})">Copy</button></div>
              </div>
            `}
          </div>

          <label class="wallet-clean-utr">UTR / Transaction ID
            <input id="depositUtrInput" type="text" inputmode="numeric" maxlength="12" pattern="[0-9]{12}" value="${App.escapeHtml(normalizeUtr(depositDraft.utr))}" placeholder="Enter 12 digit UTR" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,12)"/>
          </label>

          <div class="wallet-submit-strip">
            <span>Submit after payment. Duplicate UTR will be blocked.</span>
            <button class="btn" onclick="AITradeXUser.submitCleanDepositRequest()">Submit Deposit</button>
          </div>
        `}
      </section>
    `;

    const withdrawalPanel = `
      <section class="wallet-clean-card wallet-form-card">
        <div class="wallet-clean-head">
          <div>
            <p>WITHDRAW</p>
            <h2>Bank payout</h2>
            <span>${App.money(minWithdrawal)} - ${App.money(maxWithdrawal)} · Approved bank required</span>
          </div>
          <b>Bank</b>
        </div>

        ${!withdrawalMasterEnabled ? `
          <div class="kyc-required-box">Withdrawal is temporarily disabled by admin.</div>
          <button class="btn ghost" onclick="AITradeXUser.go('support')">Contact Support</button>
        ` : kyc.status !== "APPROVED" ? `
          <div class="kyc-required-box">KYC approval is required before withdrawal.</div>
          <button class="btn" onclick="AITradeXUser.go('kyc')">Go to KYC</button>
        ` : approvedMethods.length === 0 ? `
          <div class="kyc-required-box">No approved bank account found. Add a bank account and wait for admin approval.</div>
          <button class="btn" onclick="AITradeXUser.go('payments')">Go to Bank Accounts</button>
        ` : `
          <div class="wallet-withdraw-balance">
            <span>Available Balance</span>
            <b>${App.money(availableRealBalance())}</b>
          </div>

          <label>Withdraw Amount
            <input id="withdrawalAmountInput" type="number" min="${minWithdrawal}" max="${maxWithdrawal}" value="${App.escapeHtml(withdrawalDraft.amount)}" placeholder="Enter withdrawal amount"/>
          </label>

          <div class="approved-method-list premium-approved-list wallet-clean-bank-list">
            ${approvedMethods.map(m => `
              <button class="${(withdrawalDraft.methodId || selectedWithdrawalMethod?.id) === m.id ? "active" : ""}" onclick="AITradeXUser.selectWithdrawalMethod('${m.id}')">
                <b>Bank Account</b>
                <span>${App.escapeHtml(methodLabel(m))}</span>
              </button>
            `).join("")}
          </div>

          <div class="wallet-submit-strip">
            <span>Withdrawal remains pending until admin approval.</span>
            <button class="btn" onclick="AITradeXUser.submitCleanWithdrawalRequest()">Submit Withdraw</button>
          </div>
        `}
      </section>
    `;

    const historyPanel = `
      <section class="wallet-clean-card wallet-record-card">
        <div class="wallet-clean-head">
          <div>
            <p>RECORDS</p>
            <h2>Requests & Ledger</h2>
            <span>Track deposit, withdrawal and balance movements.</span>
          </div>
          <b>${recordsTab === "REQUESTS" ? requestFiltered.length : ledgerRows.length}</b>
        </div>

        <div class="wallet-record-tabs">
          <button class="${recordsTab === "REQUESTS" ? "active" : ""}" onclick="AITradeXUser.setWalletRecordsTab('REQUESTS')">Requests</button>
          <button class="${recordsTab === "LEDGER" ? "active" : ""}" onclick="AITradeXUser.setWalletRecordsTab('LEDGER')">Ledger</button>
        </div>

        ${recordsTab === "REQUESTS" ? `
          <div class="wallet-filter-chips wallet-clean-filters">
            ${["ALL", "DEPOSIT", "WITHDRAWAL", "PENDING", "APPROVED", "REJECTED"].map(f => `<button class="${walletHistoryFilter === f ? "active" : ""}" onclick="AITradeXUser.setWalletHistoryFilter('${f}')">${f === "WITHDRAWAL" ? "WITHDRAW" : f}</button>`).join("")}
          </div>

          <div class="wallet-request-list compact-request-list wallet-clean-records">
            ${requestPageRows.map(r => `
              <article class="${String(r.status || "").toLowerCase()}">
                <div>
                  <b>${r.kind} · ${App.money(r.amount)}</b>
                  <span>${r.kind === "Deposit" ? `${r.type} · UTR ${App.escapeHtml(r.utr || "-")}` : App.escapeHtml(methodLabel(r.methodSnapshot))}</span>
                  <small>${r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}</small>
                </div>
                ${statusPill(r.status)}
              </article>
            `).join("") || `<div class="empty-state">No matching wallet requests.</div>`}
          </div>

          <div class="mini-pager"><button onclick="AITradeXUser.walletRequestPage(-1)" ${walletRequestPage <= 0 ? "disabled" : ""}>Prev</button><span>Page ${walletRequestPage + 1}/${requestTotalPages}</span><button onclick="AITradeXUser.walletRequestPage(1)" ${walletRequestPage >= requestTotalPages - 1 ? "disabled" : ""}>Next</button></div>
        ` : `
          <div class="wallet-request-list compact-request-list ledger-list wallet-clean-records">
            ${ledgerPageRows.map(row => `
              <article class="approved">
                <div>
                  <b>${App.escapeHtml(row.type || "Wallet Entry")}</b>
                  <span>${App.escapeHtml(row.note || "Balance update")}</span>
                  <small>${row.createdAt ? new Date(row.createdAt).toLocaleString() : ""}</small>
                </div>
                <b class="${Number(row.amount || 0) < 0 ? "loss-text" : "profit-text"}">${Number(row.amount || 0) < 0 ? "-" : "+"}${App.money(Math.abs(Number(row.amount || 0)))}</b>
              </article>
            `).join("") || `<div class="empty-state">No wallet ledger entries yet.</div>`}
          </div>

          <div class="mini-pager"><button onclick="AITradeXUser.walletLedgerPage(-1)" ${walletLedgerPage <= 0 ? "disabled" : ""}>Prev</button><span>Page ${walletLedgerPage + 1}/${ledgerTotalPages}</span><button onclick="AITradeXUser.walletLedgerPage(1)" ${walletLedgerPage >= ledgerTotalPages - 1 ? "disabled" : ""}>Next</button></div>
        `}
      </section>
    `;

    shell(`
      <section class="wallet-clean-hero">
        <div class="wallet-clean-balance">
          <p>WALLET</p>
          <h1>${App.money(availableRealBalance())}</h1>
          <span>Available Balance · ${statusPill(kyc.status)}</span>
        </div>
        <div class="wallet-clean-stats">
          <article><span>Pending Deposit</span><b>${App.money(pendingDepositAmount())}</b></article>
          <article><span>Pending Withdraw</span><b>${App.money(pendingWithdrawalAmount())}</b></article>
        </div>
        ${recentStatus ? `<div class="wallet-last-status"><span>Latest</span><b>${recentStatus.kind} · ${App.money(recentStatus.amount)}</b>${statusPill(recentStatus.status)}</div>` : ""}
      </section>

      <section class="wallet-clean-tabs">
        <button class="${activePanel === "DEPOSIT" ? "active" : ""}" onclick="AITradeXUser.setWalletMode('DEPOSIT')"><b>Deposit</b><span>Add funds</span></button>
        <button class="${activePanel === "WITHDRAWAL" ? "active" : ""}" onclick="AITradeXUser.setWalletMode('WITHDRAWAL')"><b>Withdraw</b><span>Bank payout</span></button>
        <button class="${activePanel === "HISTORY" ? "active" : ""}" onclick="AITradeXUser.setWalletMode('HISTORY')"><b>Records</b><span>Requests / Ledger</span></button>
      </section>

      ${activePanel === "DEPOSIT" ? depositPanel : activePanel === "WITHDRAWAL" ? withdrawalPanel : historyPanel}
    `);
  }

  function orderSideClass(side) {
    return String(side || "BUY").toUpperCase() === "SELL" ? "sell" : "buy";
  }

  function ordersRowShell({ kind, className = "", pair, side, pnlHtml, metaHtml, priceHtml, amountHtml, badgeHtml, actionHtml }) {
    const sideClass = orderSideClass(side);
    return `
      <article class="orders-app-row ${className}">
        <div class="orders-row-main">
          <div class="orders-row-title">
            <b>${App.escapeHtml(pair || "-")}</b>
            <span class="side-pill ${sideClass}">${App.escapeHtml(String(side || "BUY").toUpperCase())}</span>
            ${badgeHtml || ""}
          </div>
          <div class="orders-row-meta">${metaHtml}</div>
          <div class="orders-row-prices">${priceHtml}</div>
        </div>
        <div class="orders-row-result">
          ${pnlHtml}
          ${amountHtml || ""}
        </div>
        <div class="orders-row-action">${actionHtml || ""}</div>
      </article>`;
  }

  function orderPositionCard(position) {
    const pnl = manualPositionPnl(position);
    return ordersRowShell({
      kind: "MANUAL",
      className: "manual-row",
      pair: position.pair,
      side: position.side || "BUY",
      badgeHtml: `<span class="type-badge manual">Manual</span>`,
      metaHtml: `
        <span>${Number(position.leverage || 1)}x</span>
        <span>Margin ${App.money(position.marginAmount || 0)}</span>
        <span>Position ${App.money(position.positionSize || 0)}</span>`,
      priceHtml: `
        <span>Entry <b>${App.escapeHtml(position.entryPriceDisplay || String(position.entryPrice || "--"))}</b></span>
        <span>Live <b data-manual-current="${position.id}">${App.escapeHtml(positionCurrentDisplay(position))}</b></span>`,
      pnlHtml: `<strong data-manual-pnl="${position.id}" class="${pnl >= 0 ? "profit-text" : "loss-text"}">${pnl >= 0 ? "+" : ""}${App.money(pnl)}</strong>`,
      amountHtml: `<small>Live P/L</small>`,
      actionHtml: `<button class="orders-pill-action close" onclick="AITradeXUser.closeManualPositionById('${position.id}')">Close</button>`
    });
  }

  function aiPositionCard(position) {
    const pnl = aiPositionPnl(position);
    return ordersRowShell({
      kind: "AI",
      className: "ai-row",
      pair: position.pair,
      side: position.side || "BUY",
      badgeHtml: `<span class="type-badge ai">AI Managed</span>`,
      metaHtml: `
        <span>${Number(position.leverage || 1)}x</span>
        <span>AI Amount ${App.money(position.marginAmount || 0)}</span>
        <span>Max Loss ${App.money(aiLiveMarginAmount(position))}</span>
        <span>Position ${App.money(aiLiveSafeExposure(position))}</span>`,
      priceHtml: `
        <span>Entry <b>${App.escapeHtml(position.entryPriceDisplay || String(position.entryPrice || "--"))}</b></span>
        <span>Live <b data-ai-current="${position.id}">${App.escapeHtml(positionCurrentDisplay(position))}</b></span>`,
      pnlHtml: `<strong data-ai-pnl="${position.id}" class="${pnl >= 0 ? "profit-text" : "loss-text"}">${pnl >= 0 ? "+" : ""}${App.money(pnl)}</strong>`,
      amountHtml: `<small>${aiOpenPositions().length}/${aiDailyUsage().limit} active AI</small>`,
      actionHtml: `<button class="orders-pill-action ai" onclick="AITradeXUser.showAiManagedNotice()">AI</button>`
    });
  }

  function pendingOrderCard(order) {
    const side = String(order.side || "BUY").toUpperCase() === "SELL" ? "SELL" : "BUY";
    const rule = side === "BUY" ? "At / below" : "At / above";
    return ordersRowShell({
      kind: "PENDING",
      className: "pending-row",
      pair: order.pair || "-",
      side,
      badgeHtml: `<span class="type-badge pending">Limit Pending</span>`,
      metaHtml: `
        <span>${Number(order.leverage || 1)}x</span>
        <span>Margin ${App.money(order.marginAmount || 0)}</span>
        <span>${rule} ${App.escapeHtml(order.limitPriceDisplay || order.limitPrice || "-")}</span>`,
      priceHtml: `
        <span>Limit <b>${App.escapeHtml(order.limitPriceDisplay || order.limitPrice || "-")}</b></span>
        <span>Live <b data-live-pair="${App.escapeHtml(order.pair || "")}" data-live-type="price">${App.escapeHtml(pendingOrderLiveDisplay(order))}</b></span>`,
      pnlHtml: `<strong class="pending-text">Pending</strong>`,
      amountHtml: `<small>Waiting trigger</small>`,
      actionHtml: `<button class="orders-pill-action cancel" onclick="AITradeXUser.cancelPendingOrder('${order.id}')">Cancel</button>`
    });
  }

  function ordersPage() {
    const positions = manualOpenPositions();
    const pending = pendingManualOrders();
    const aiPositions = aiOpenPositions();
    const livePnl = positions.reduce((sum, position) => sum + manualPositionPnl(position), 0);
    const aiLivePnl = aiPositions.reduce((sum, position) => sum + aiPositionPnl(position), 0);
    const lockedMargin = positions.reduce((sum, position) => sum + Math.max(0, Number(position.marginAmount || 0)), 0);
    const aiLockedMargin = aiPositions.reduce((sum, position) => sum + Math.max(0, Number(position.marginAmount || 0)), 0);
    const rows = [
      ...positions.map(position => ({ type: "MANUAL", time: position.openedAt || position.createdAt || "", html: orderPositionCard(position) })),
      ...aiPositions.map(position => ({ type: "AI", time: position.openedAt || position.createdAt || "", html: aiPositionCard(position) })),
      ...pending.map(order => ({ type: "PENDING", time: order.createdAt || order.openedAt || "", html: pendingOrderCard(order) }))
    ].sort((a, b) => Date.parse(b.time || 0) - Date.parse(a.time || 0));
    const activeTab = ["ALL", "MANUAL", "AI", "PENDING"].includes(orderViewTab) ? orderViewTab : "ALL";
    const filteredRows = activeTab === "ALL" ? rows : rows.filter(row => row.type === activeTab);
    const tabItems = [
      ["ALL", "All", rows.length],
      ["MANUAL", "Manual", positions.length],
      ["AI", "AI", aiPositions.length],
      ["PENDING", "Pending", pending.length]
    ];
    const totalLivePnl = livePnl + aiLivePnl;

    shell(`
      <section class="orders-app-hero positions-app-hero">
        <div>
          <p>POSITIONS</p>
          <h2>Open trades and running positions</h2>
          <span>Manual trades, AI live positions and pending limit orders in one clean view.</span>
        </div>
        <button class="orders-hero-action" onclick="AITradeXUser.go('trade')">New Trade</button>
      </section>

      <section class="orders-stat-strip">
        <article><span>Open</span><b>${positions.length + aiPositions.length}</b></article>
        <article><span>Live P/L</span><b class="${totalLivePnl >= 0 ? "profit-text" : "loss-text"}">${totalLivePnl >= 0 ? "+" : ""}${App.money(totalLivePnl)}</b></article>
        <article><span>Locked</span><b>${App.money(lockedMargin + aiLockedMargin)}</b></article>
        <article><span>Pending</span><b>${pending.length}</b></article>
        <article><span>Mode</span><b>${accountMode}</b></article>
      </section>

      <section class="orders-app-card">
        <div class="orders-app-head">
          <div>
            <p>POSITION BOOK</p>
            <h2>${activeTab === "ALL" ? "All Positions" : `${activeTab.charAt(0)}${activeTab.slice(1).toLowerCase()} Positions`}</h2>
          </div>
          <span>${filteredRows.length} item${filteredRows.length === 1 ? "" : "s"}</span>
        </div>
        <div class="orders-tabs">
          ${tabItems.map(([value, label, count]) => `
            <button class="${activeTab === value ? "active" : ""}" onclick="AITradeXUser.setOrderViewTab('${value}')">
              ${label}<b>${count}</b>
            </button>
          `).join("")}
        </div>
        <div class="orders-app-list">
          ${filteredRows.length ? filteredRows.map(row => row.html).join("") : `<div class="empty-state">No ${activeTab === "ALL" ? "active positions" : activeTab.toLowerCase()} records right now.</div>`}
        </div>
      </section>
    `);
    refreshVisiblePrices([...positions.map(position => position.pair), ...aiPositions.map(position => position.pair), ...pending.map(order => order.pair)]);
  }

  function formatHistoryDate(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  function historyStatus(t) {
    const reason = String(t.closeReason || "").toUpperCase();
    if (reason === "AUTO_RISK_CLOSE") return "Auto Closed";
    return App.escapeHtml(t.status || "Closed").replace(/_/g, " ");
  }

  function tradeResultLabel(t, type) {
    const pnl = Number(t.pnl || 0);
    if (type === "AI") {
      const result = String(t.resultType || (pnl >= 0 ? "PROFIT" : "LOSS")).replace(/_/g, " ");
      const pct = Number(t.resultPercent || 0);
      return `${result}${pct ? ` · ${pct}%` : ""}`;
    }
    return historyStatus(t);
  }

  function normalizeHistoryRow(t, type) {
    const pnl = Number(t.pnl || 0);
    const amount = Number(t.marginAmount || t.amount || 0);
    const leverage = Number(t.leverage || 1);
    const opened = t.openedAt || t.createdAt || "";
    const closed = t.closedAt || t.createdAt || opened;
    return {
      ...t,
      historyType: type,
      historyId: `${type}_${t.id || t.createdAt || Math.random()}`,
      pnl,
      amount,
      leverage,
      opened,
      closed,
      sortTime: Date.parse(closed || opened || 0) || 0,
      entryText: t.entryPriceDisplay || (t.entryPrice ? String(t.entryPrice) : "-"),
      closeText: t.exitPriceDisplay || (t.exitPrice ? String(t.exitPrice) : (type === "AI" ? "Settled" : "-")),
      resultText: tradeResultLabel(t, type),
      exposure: Number(t.positionSize || (amount * leverage))
    };
  }

  function historyFilteredRows() {
    const aiRows = aiClosedRows().map(t => normalizeHistoryRow(t, "AI"));
    const manualRows = tradeRows("MANUAL")
      .filter(t => String(t.status || "").toUpperCase() === "CLOSED")
      .map(t => normalizeHistoryRow(t, "MANUAL"));
    const all = [...aiRows, ...manualRows].sort((a, b) => b.sortTime - a.sortTime);
    const activeTab = ["ALL", "MANUAL", "AI", "PROFIT", "LOSS"].includes(historyViewTab) ? historyViewTab : "ALL";
    const query = String(historySearch || "").trim().toLowerCase();
    return all.filter(row => {
      const pnlMatch = activeTab === "PROFIT" ? row.pnl >= 0 : activeTab === "LOSS" ? row.pnl < 0 : true;
      const typeMatch = activeTab === "MANUAL" || activeTab === "AI" ? row.historyType === activeTab : true;
      const searchText = [row.pair, row.side, row.market, row.historyType, row.resultText, row.status].join(" ").toLowerCase();
      const searchMatch = !query || searchText.includes(query);
      return pnlMatch && typeMatch && searchMatch;
    });
  }

  function historyStats(rows) {
    const totalPnl = rows.reduce((sum, row) => sum + Number(row.pnl || 0), 0);
    const wins = rows.filter(row => Number(row.pnl || 0) >= 0).length;
    const best = rows.reduce((max, row) => Math.max(max, Number(row.pnl || 0)), 0);
    const winRate = rows.length ? Math.round((wins / rows.length) * 100) : 0;
    return { totalPnl, wins, best, winRate };
  }

  function historyStatCard(label, value, sub, tone = "") {
    return `
      <article class="history-stat-card ${tone}">
        <span>${label}</span>
        <b>${value}</b>
        <small>${sub}</small>
      </article>`;
  }

  function historyRow(row) {
    const profit = row.pnl >= 0;
    const expanded = historyExpandedId === row.historyId;
    const side = String(row.side || "-").toUpperCase();
    const typeLabel = row.historyType === "AI" ? "AI Managed" : "Manual Trade";
    const amountLabel = row.historyType === "AI" ? "AI Amount" : "Margin";
    return `
      <article class="history-real-row ${profit ? "profit" : "loss"} ${expanded ? "expanded" : ""}">
        <button class="history-row-main" onclick="AITradeXUser.toggleHistoryDetails('${App.escapeHtml(row.historyId)}')">
          <div class="history-pair-cell">
            <strong>${App.escapeHtml(row.pair || "-")}</strong>
            <span>${App.escapeHtml(side)} · ${App.escapeHtml(typeLabel)}</span>
          </div>
          <div class="history-tags-cell">
            <span class="history-type-tag ${row.historyType.toLowerCase()}">${App.escapeHtml(typeLabel)}</span>
            <span class="history-side-tag ${side.includes("SELL") || side.includes("SHORT") ? "sell" : "buy"}">${App.escapeHtml(side)}</span>
          </div>
          <div class="history-date-cell">
            <span>${formatHistoryDate(row.closed)}</span>
            <small>${App.escapeHtml(row.resultText || "Closed")}</small>
          </div>
          <div class="history-pnl-cell ${profit ? "profit-text" : "loss-text"}">${profit ? "+" : ""}${App.money(row.pnl)}</div>
        </button>
        ${expanded ? `
          <div class="history-expanded-grid">
            <article><span>Entry</span><b>${App.escapeHtml(row.entryText)}</b></article>
            <article><span>${row.historyType === "AI" ? "Settlement" : "Close"}</span><b>${App.escapeHtml(row.closeText)}</b></article>
            <article><span>${amountLabel}</span><b>${App.money(row.amount)}</b></article>
            <article><span>Exposure</span><b>${App.money(row.exposure)}</b></article>
            <article><span>Leverage</span><b>${row.leverage}x</b></article>
            <article><span>Market</span><b>${App.escapeHtml(row.market || "-")}</b></article>
            <article><span>Opened</span><b>${formatHistoryDate(row.opened)}</b></article>
            <article><span>Closed</span><b>${formatHistoryDate(row.closed)}</b></article>
          </div>` : ""}
      </article>`;
  }

  function historyPage() {
    const aiRows = aiClosedRows().map(t => normalizeHistoryRow(t, "AI"));
    const manualRows = tradeRows("MANUAL").filter(t => String(t.status || "").toUpperCase() === "CLOSED").map(t => normalizeHistoryRow(t, "MANUAL"));
    const allRows = [...aiRows, ...manualRows].sort((a, b) => b.sortTime - a.sortTime);
    const filteredRows = historyFilteredRows();
    const stats = historyStats(allRows);
    const pageSize = 5;
    const maxPage = Math.max(0, Math.ceil(filteredRows.length / pageSize) - 1);
    const currentPage = Math.min(Math.max(0, historyPageIndex), maxPage);
    historyPageIndex = currentPage;
    localStorage.setItem("AITradeX_HISTORY_PAGE", String(currentPage));
    const pageRows = filteredRows.slice(currentPage * pageSize, currentPage * pageSize + pageSize);
    const tabs = [
      ["ALL", "All", allRows.length],
      ["MANUAL", "Manual", manualRows.length],
      ["AI", "AI", aiRows.length],
      ["PROFIT", "Profit", allRows.filter(row => row.pnl >= 0).length],
      ["LOSS", "Loss", allRows.filter(row => row.pnl < 0).length]
    ];

    shell(`
      <section class="history-real-hero">
        <div>
          <p>TRADE HISTORY</p>
          <h2>Completed trades</h2>
          <span>Manual and AI results in a searchable, easy-to-review timeline.</span>
        </div>
        <button onclick="AITradeXUser.go('wallet')">View Wallet Ledger</button>
      </section>

      <section class="history-real-stats">
        ${historyStatCard("Total P/L", `${stats.totalPnl >= 0 ? "+" : ""}${App.money(stats.totalPnl)}`, `${allRows.length} closed trades`, stats.totalPnl >= 0 ? "profit" : "loss")}
        ${historyStatCard("Win Rate", `${stats.winRate}%`, `${stats.wins} profit trades`, "")}
        ${historyStatCard("Best Trade", `${stats.best >= 0 ? "+" : ""}${App.money(stats.best)}`, "Highest closed P/L", stats.best >= 0 ? "profit" : "loss")}
        ${historyStatCard("Account", "Active", "Single account", "")}
      </section>

      <section class="history-real-card">
        <div class="history-real-head">
          <div>
            <p>HISTORY BOOK</p>
            <h2>${filteredRows.length} result${filteredRows.length === 1 ? "" : "s"}</h2>
          </div>
          <span>Page ${currentPage + 1} / ${Math.max(1, maxPage + 1)}</span>
        </div>

        <div class="history-filter-bar">
          <div class="history-tab-row">
            ${tabs.map(([value, label, count]) => `
              <button class="${historyViewTab === value ? "active" : ""}" onclick="AITradeXUser.setHistoryTab('${value}')">
                ${label}<b>${count}</b>
              </button>`).join("")}
          </div>
          <label class="history-search-box">
            <span>Search</span>
            <input value="${App.escapeHtml(historySearch)}" placeholder="Search pair, AI, manual, buy or sell" oninput="AITradeXUser.setHistorySearch(this.value)" />
          </label>
        </div>

        <div class="history-real-list">
          ${pageRows.length ? pageRows.map(historyRow).join("") : `<div class="empty-state">No matching trade history found.</div>`}
        </div>

        <div class="history-real-pagination">
          <button ${currentPage <= 0 ? "disabled" : ""} onclick="AITradeXUser.setHistoryPage(${currentPage - 1})">Previous</button>
          <span>${filteredRows.length ? `${currentPage * pageSize + 1}-${Math.min(filteredRows.length, currentPage * pageSize + pageRows.length)} of ${filteredRows.length}` : "0 records"}</span>
          <button ${currentPage >= maxPage ? "disabled" : ""} onclick="AITradeXUser.setHistoryPage(${currentPage + 1})">Next</button>
        </div>
      </section>
    `);
  }

  function kycPage() {
    const kyc = currentKyc();

    if (kyc.status === "APPROVED") {
      shell(`
        <section class="premium-card kyc-result-card approved">
          <div class="result-icon">✓</div>
          <p>KYC APPROVED</p>
          <h2>KYC Approved Successfully</h2>
          <h4>Your identity verification has been approved. You can now add bank accounts and request withdrawals after approval.</h4>
          ${statusPill(kyc.status)}
        </section>
        ${kycDetailsGrid(kyc, "VERIFIED DETAILS")}
      `);
      return;
    }

    if (kyc.status === "PENDING") {
      shell(`
        <section class="premium-card kyc-result-card pending">
          <div class="result-icon">⌛</div>
          <p>KYC SUBMITTED</p>
          <h2>KYC Submitted Successfully</h2>
          <h4>Your KYC is under verification. Admin will review your submitted details shortly.</h4>
          ${statusPill(kyc.status)}
        </section>
        ${kycDetailsGrid(kyc, "SUBMITTED DETAILS")}
      `);
      return;
    }

    if (kyc.status === "REJECTED") {
      shell(`
        <section class="premium-card kyc-result-card rejected">
          <div class="result-icon">!</div>
          <p>KYC REJECTED</p>
          <h2>KYC Verification Rejected</h2>
          <h4>Your KYC was rejected. Please check the reason and resubmit your details.</h4>
          ${statusPill(kyc.status)}
          ${kyc.rejectReason ? `<div class="reject-box">${App.escapeHtml(kyc.rejectReason)}</div>` : ""}
          <button class="save-profile-btn" onclick="AITradeXUser.resubmitKyc()">Resubmit KYC</button>
        </section>
        ${kycDetailsGrid(kyc, "REJECTED DETAILS")}
      `);
      return;
    }

    shell(`
      <section class="premium-card kyc-status-card">
        <div class="card-row">
          <div>
            <p>KYC VERIFICATION</p>
            <h2>Identity Verification</h2>
            <span class="ticket-mode">Complete KYC before verified withdrawals.</span>
          </div>
          ${statusPill(kyc.status)}
        </div>
      </section>

      <section class="kyc-stepper">
        ${[1, 2, 3, 4].map(step => `
          <button class="${kycStep === step ? "active" : ""} ${kycStep > step ? "done" : ""}" onclick="AITradeXUser.setKycStep(${step})">
            <b>${step}</b>
            <span>${["Personal", "Aadhaar", "Selfie", "Review"][step - 1]}</span>
          </button>
        `).join("")}
      </section>

      <section class="premium-card kyc-form-card">
        ${kycStep === 1 ? `
          <p>STEP 1</p>
          <h2>Personal Details</h2>
          <div class="form-grid kyc-grid">
            <label>Full Name as per Document<input id="kycFullName" value="${App.escapeHtml(kyc.personal.fullName || "")}" placeholder="Enter full name"/></label>
            <label>Date of Birth<input id="kycDob" type="date" value="${App.escapeHtml(kyc.personal.dob || "")}"/></label>
            <label>Gender
              <select id="kycGender">
                <option value="">Select gender</option>
                ${["Male", "Female", "Other"].map(g => `<option value="${g}" ${kyc.personal.gender === g ? "selected" : ""}>${g}</option>`).join("")}
              </select>
            </label>
            <label>Mobile Number<input id="kycMobile" class="readonly-input" value="${App.escapeHtml(kyc.personal.mobile || "")}" readonly/></label>
            <label>Email Address<input id="kycEmail" class="readonly-input" value="${App.escapeHtml(kyc.personal.email || "")}" readonly/></label>
            <label>City<input id="kycCity" value="${App.escapeHtml(kyc.personal.city || "")}" placeholder="Enter city"/></label>
            <label>State
              <select id="kycState">${stateOptions(kyc.personal.state || "")}</select>
            </label>
            <label>Pincode<input id="kycPincode" value="${App.escapeHtml(kyc.personal.pincode || "")}" inputmode="numeric" maxlength="6" placeholder="6 digit pincode" oninput="this.value=this.value.replace(/\D/g,'').slice(0,6)"/></label>
          </div>
        ` : ""}

        ${kycStep === 2 ? `
          <p>STEP 2</p>
          <h2>Aadhaar Verification</h2>
          <div class="form-grid kyc-grid">
            <label>Aadhaar Number<input id="kycAadhaar" value="${App.escapeHtml(kyc.id.number || "")}" inputmode="numeric" maxlength="12" placeholder="12 digit Aadhaar number" oninput="this.value=this.value.replace(/\D/g,'').slice(0,12)"/></label>
            <label class="upload-box inline-upload">
              <span>Aadhaar Front Image</span>
              <input id="kycFront" type="file" accept="image/*,.pdf"/>
              <b>${App.escapeHtml(uploadStatusText({ name: kyc.uploads.frontName, path: kyc.uploads.frontPath }, "Upload clear front side"))}</b>
            </label>
            <label class="upload-box inline-upload">
              <span>Aadhaar Back Image</span>
              <input id="kycBack" type="file" accept="image/*,.pdf"/>
              <b>${App.escapeHtml(uploadStatusText({ name: kyc.uploads.backName, path: kyc.uploads.backPath }, "Upload clear back side"))}</b>
            </label>
          </div>
          <div class="profile-note">Aadhaar number must be exactly 12 digits. Front and back images upload to Supabase Storage for admin review.</div>
        ` : ""}

        ${kycStep === 3 ? `
          <p>STEP 3</p>
          <h2>Selfie Verification</h2>
          <div class="upload-grid single-upload-grid">
            <label class="upload-box">
              <span>Selfie Image</span>
              <input id="kycSelfie" type="file" accept="image/*"/>
              <b>${App.escapeHtml(uploadStatusText({ name: kyc.uploads.selfieName, path: kyc.uploads.selfiePath }, "Upload clear selfie"))}</b>
            </label>
          </div>
          <label class="kyc-check-row">
            <input id="kycDeclaration" type="checkbox" ${kyc.declarationAccepted ? "checked" : ""}/>
            <span>I confirm this selfie and Aadhaar belong to me.</span>
          </label>
        ` : ""}

        ${kycStep === 4 ? `
          <p>STEP 4</p>
          <h2>Review & Submit</h2>
          <div class="review-grid">
            <article><span>Full Name</span><b>${App.escapeHtml(kyc.personal.fullName || "-")}</b></article>
            <article><span>DOB</span><b>${App.escapeHtml(kyc.personal.dob || "-")}</b></article>
            <article><span>Gender</span><b>${App.escapeHtml(kyc.personal.gender || "-")}</b></article>
            <article><span>Mobile</span><b>${App.escapeHtml(kyc.personal.mobile || "-")}</b></article>
            <article><span>Email</span><b>${App.escapeHtml(kyc.personal.email || "-")}</b></article>
            <article><span>City</span><b>${App.escapeHtml(kyc.personal.city || "-")}</b></article>
            <article><span>State</span><b>${App.escapeHtml(kyc.personal.state || "-")}</b></article>
            <article><span>Pincode</span><b>${App.escapeHtml(kyc.personal.pincode || "-")}</b></article>
            <article><span>Document</span><b>Aadhaar Card</b></article>
            <article><span>Aadhaar No.</span><b>${App.escapeHtml(maskAadhaar(kyc.id.number))}</b></article>
            <article><span>Aadhaar Front</span><b>${App.escapeHtml(kyc.uploads.frontName || "-")}</b></article>
            <article><span>Aadhaar Back</span><b>${App.escapeHtml(kyc.uploads.backName || "-")}</b></article>
            <article><span>Selfie</span><b>${App.escapeHtml(kyc.uploads.selfieName || "-")}</b></article>
          </div>
          <label class="kyc-check-row review-confirm">
            <input id="kycFinalConfirm" type="checkbox" ${kyc.finalAccepted ? "checked" : ""}/>
            <span>I confirm all KYC details are correct and belong to me.</span>
          </label>
        ` : ""}

        <div class="wizard-actions">
          <button class="btn ghost" onclick="AITradeXUser.prevKycStep()" ${kycStep === 1 ? "disabled" : ""}>Back</button>
          ${kycStep < 4 ? `<button class="btn" onclick="AITradeXUser.saveKycStep()">Save & Next</button>` : `<button class="btn" onclick="AITradeXUser.submitKyc()">Submit KYC</button>`}
        </div>
      </section>
    `);
  }

  function bankMethodCard(m) {
    return `
      <article class="bank-slim-card ${String(m.status || "").toLowerCase()}">
        <div class="bank-icon">${m.status === "APPROVED" ? "✓" : m.status === "REJECTED" ? "!" : "⌛"}</div>
        <div>
          <b>${App.escapeHtml(m.bankName || "Bank Account")} · ****${String(m.accountNumber || "").slice(-4)}</b>
          <span>${App.escapeHtml(m.holderName || "-")} · IFSC ${App.escapeHtml(m.ifsc || "-")}</span>
          <small>${App.escapeHtml(m.accountType || "Savings")} ${m.approvedAt ? `· Approved ${new Date(m.approvedAt).toLocaleDateString("en-IN")}` : ""}${m.rejectedAt ? `· Rejected ${new Date(m.rejectedAt).toLocaleDateString("en-IN")}` : ""}</small>
          ${m.rejectReason ? `<small class="loss-text">Reason: ${App.escapeHtml(m.rejectReason)}</small>` : ""}
        </div>
        ${statusPill(m.status)}
      </article>`;
  }

  function paymentPage() {
    const kyc = currentKyc();
    const methods = paymentMethods().filter(m => m.type === "BANK");
    const approvedCount = methods.filter(m => m.status === "APPROVED").length;
    const pendingCount = methods.filter(m => m.status === "PENDING").length;
    const counts = paymentCounts();
    const kycReady = kyc.status === "APPROVED";
    const holder = verifiedKycName();
    const canAddBank = counts.BANK < 2;

    shell(`
      <section class="inner-hero-card bank-hero-card">
        <div>
          <p>BANK ACCOUNTS</p>
          <h1>Verified payout methods</h1>
          <span>Only approved bank accounts can be used for withdrawal requests.</span>
        </div>
        ${statusPill(kyc.status)}
      </section>

      <section class="inner-status-strip">
        <article><span>KYC</span><b>${String(kyc.status || "NOT_SUBMITTED").replaceAll("_", " ")}</b></article>
        <article><span>Approved Banks</span><b>${approvedCount}</b></article>
        <article><span>Pending Review</span><b>${pendingCount}</b></article>
        <article><span>Limit</span><b>${counts.BANK}/2</b></article>
      </section>

      ${!kycReady ? `
        <section class="premium-card inner-action-card locked">
          <div><p>KYC REQUIRED</p><h2>Complete KYC before adding bank</h2><span>Your verified name is required for safe bank approval.</span></div>
          <button class="save-profile-btn" onclick="AITradeXUser.go('kyc')">Go to KYC</button>
        </section>` : `
        <section class="premium-card inner-action-card bank-form-premium">
          <div class="card-row"><div><p>ADD BANK ACCOUNT</p><h2>Submit bank for approval</h2><span class="ticket-mode">Verified name: ${App.escapeHtml(holder)}</span></div><span class="history-mode">${canAddBank ? "Available" : "Limit Reached"}</span></div>
          <div class="form-grid kyc-grid compact-inner-form">
            <label>Holder Name<input value="${App.escapeHtml(holder)}" disabled/></label>
            <label>Bank Name<input id="bankNameInput" ${!canAddBank ? "disabled" : ""} placeholder="Bank name"/></label>
            <label>Account Number<input id="bankAccInput" ${!canAddBank ? "disabled" : ""} placeholder="Account number"/></label>
            <label>Confirm Account Number<input id="bankAccConfirmInput" ${!canAddBank ? "disabled" : ""} placeholder="Confirm account number"/></label>
            <label>IFSC Code<input id="bankIfscInput" ${!canAddBank ? "disabled" : ""} placeholder="IFSC code"/></label>
            <label>Account Type<select id="bankTypeInput" ${!canAddBank ? "disabled" : ""}><option>Savings</option><option>Current</option></select></label>
          </div>
          <button class="save-profile-btn" onclick="AITradeXUser.addBankMethod()" ${!canAddBank ? "disabled" : ""}>Submit Bank for Verification</button>
          ${!canAddBank ? `<div class="profile-note">Maximum 2 pending/approved bank accounts allowed.</div>` : ""}
        </section>`}

      <section class="premium-card bank-list-card">
        <div class="card-row"><div><p>SAVED BANK ACCOUNTS</p><h2>Your bank list</h2></div><span class="history-mode">${methods.length}</span></div>
        <div class="bank-slim-list">
          ${methods.length ? methods.map(bankMethodCard).join("") : `<div class="empty-state">No bank accounts added yet.</div>`}
        </div>
      </section>
    `);
  }

  function subscriptionPage() {
    const u = user();
    const sub = activeSubscription();
    const plan = currentPlan();
    const plans = App.getPlans().filter(p => p.id !== "free");
    const balance = App.realBalance(u.id);
    const usage = aiDailyUsage();
    const history = subscriptionHistory();
    shell(`
      <section class="subscription-hero-card">
        <div>
          <p>SUBSCRIPTION</p>
          <h1>${App.escapeHtml(plan.name || "Free")}</h1>
          <span>${usage.used}/${usage.limit} AI auto trades used today · Wallet ${App.money(balance)}</span>
        </div>
        <button onclick="AITradeXUser.go('wallet')">Add Balance</button>
      </section>

      <section class="compact-grid subscription-summary-grid">
        <article><span>Current Plan</span><b>${App.escapeHtml(plan.name || "Free")}</b><small>${sub ? "Active" : "Free access"}</small></article>
        <article><span>Daily AI Trades</span><b>${usage.limit}/day</b><small>${activeSubscription() ? "Plan controlled" : freeAccessText()}</small></article>
        <article><span>Used Today</span><b>${usage.used}/${usage.limit}</b><small>AI Auto Trades</small></article>
        <article><span>${sub ? "Expires" : "Free Access"}</span><b>${subscriptionExpiryText(sub)}</b><small>${sub ? "Plan validity" : "Trial + free limit"}</small></article>
      </section>

      <section class="subscription-plan-grid">
        ${plans.map(planCard).join("")}
      </section>

      <section class="premium-card subscription-history-card">
        <div class="card-row"><div><p>SUBSCRIPTION HISTORY</p><h2>Plan Purchases</h2></div><span class="history-mode">Wallet</span></div>
        ${history.length ? `<div class="subscription-history-list">${history.map(row => `
          <article>
            <div><b>${App.escapeHtml(row.planName || row.planId)}</b><span>${new Date(row.createdAt).toLocaleString("en-IN")}</span></div>
            <strong>${App.money(row.price || 0)}</strong>
            <small>${App.escapeHtml(row.status || "ACTIVE")} · Expires ${subscriptionExpiryText(row)}</small>
          </article>`).join("")}</div>` : `<div class="empty-state">No paid subscription purchased yet.</div>`}
      </section>
    `);
  }

  function referralPage() {
    const u = user();
    const settings = App.referralSettings ? App.referralSettings() : (App.state.settings || {});
    const stats = App.referralStats ? App.referralStats(u.id) : { totalInvited: 0, depositBonus: 0, subscriptionBonus: 0, totalBonus: 0, credited: 0 };
    const referrals = (App.state.referrals || []).filter(row => row.referrerUserId === u.id).slice().sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
    const link = `${window.location.origin}${window.location.pathname}?ref=${encodeURIComponent(u.referralCode || "")}`;
    const shareText = encodeURIComponent(`Join AITradeX with my referral code ${u.referralCode || ""}: ${link}`);
    const referredCard = row => {
      const target = (App.state.users || []).find(user => user.id === row.referredUserId) || {};
      const depositBonus = row.bonuses?.deposit;
      const subscriptionBonus = row.bonuses?.subscription;
      return `<article class="referral-user-card">
        <div>
          <b>${App.escapeHtml(target.name || "Referred User")}</b>
          <span>${App.escapeHtml(target.email || "-")}</span>
          <small>Joined ${row.createdAt ? new Date(row.createdAt).toLocaleString("en-IN") : "-"}</small>
        </div>
        <div class="referral-bonus-stack">
          <span class="${depositBonus?.credited ? "profit-text" : "muted-text"}">Deposit: ${depositBonus?.credited ? App.money(depositBonus.amount) : "Pending"}</span>
          <span class="${subscriptionBonus?.credited ? "profit-text" : "muted-text"}">Subscription: ${subscriptionBonus?.credited ? App.money(subscriptionBonus.amount) : "Pending"}</span>
        </div>
      </article>`;
    };

    shell(`
      <section class="referral-hero-card">
        <div>
          <p>REFERRAL REWARDS</p>
          <h1>Invite & Earn Automatically</h1>
          <span>Earn when your referred user completes a first approved deposit or buys a paid subscription.</span>
        </div>
        <button type="button" class="copy-action" onclick="AITradeXUser.copyReferral('link', this)">Copy Link</button>
      </section>

      <section class="premium-card referral-link-card">
        <div class="card-row"><div><p>YOUR REFERRAL LINK</p><h2>${App.escapeHtml(u.referralCode || "-")}</h2></div><span class="history-mode">Auto Bonus</span></div>
        <div class="referral-link-box"><span id="referralLinkText">${App.escapeHtml(link)}</span><button type="button" class="copy-action" onclick="AITradeXUser.copyReferral('link', this)">Copy</button></div>
        <div class="referral-actions">
          <a class="btn" href="https://wa.me/?text=${shareText}" target="_blank" rel="noopener">Share on WhatsApp</a>
          <button type="button" class="btn ghost copy-action" onclick="AITradeXUser.copyReferral('code', this)">Copy Code</button>
        </div>
      </section>

      <section class="compact-grid referral-summary-grid">
        <article><span>Total Invited</span><b>${stats.totalInvited}</b><small>Registered users</small></article>
        <article><span>Deposit Bonus</span><b>${App.money(stats.depositBonus)}</b><small>${settings.referralDepositPercent || 0}% auto credit</small></article>
        <article><span>Subscription Bonus</span><b>${App.money(stats.subscriptionBonus)}</b><small>${settings.referralSubscriptionPercent || 0}% auto credit</small></article>
        <article><span>Total Earned</span><b>${App.money(stats.totalBonus)}</b><small>Wallet credited</small></article>
      </section>

      <section class="premium-card">
        <div class="card-row"><div><p>REFERRAL RULES</p><h2>How rewards work</h2></div></div>
        <div class="profile-info-grid">
          <article><span>First Deposit Bonus</span><b>${settings.referralDepositEnabled === false ? "Disabled" : `${Number(settings.referralDepositPercent || 0)}%`}</b></article>
          <article><span>Subscription Bonus</span><b>${settings.referralSubscriptionEnabled === false ? "Disabled" : `${Number(settings.referralSubscriptionPercent || 0)}%`}</b></article>
          <article><span>Credit Type</span><b>Automatic</b></article>
          <article><span>Wallet</span><b>Available Balance</b></article>
        </div>
      </section>

      <section class="premium-card">
        <div class="card-row"><div><p>REFERRED USERS</p><h2>Your Referral List</h2></div><span class="history-mode">${referrals.length}</span></div>
        <div class="referral-user-list">${referrals.length ? referrals.map(referredCard).join("") : `<div class="empty-state">No referred users yet. Share your link to start earning.</div>`}</div>
      </section>
    `);
  }

  function profilePage() {
    const u = user();
    const savedName = displayName();
    const plan = currentPlan();
    const kyc = currentKyc();
    const bankApproved = approvedPaymentMethods().length;

    shell(`
      <section class="inner-hero-card profile-hero-card">
        <div class="profile-hero-left">
          ${avatar(savedName)}
          <div>
            <p>PROFILE</p>
            <h1>${App.escapeHtml(savedName || "AITradeX User")}</h1>
            <span>${App.escapeHtml(u.email)} · ${App.escapeHtml(u.mobile || "Mobile not added")}</span>
          </div>
        </div>
        <span class="history-mode">${App.escapeHtml(accountMode)} Account</span>
      </section>

      <section class="inner-status-strip profile-status-strip">
        <article><span>KYC</span><b>${String(kyc.status || "NOT_SUBMITTED").replaceAll("_", " ")}</b></article>
        <article><span>Bank</span><b>${bankApproved} Approved</b></article>
        <article><span>Plan</span><b>${App.escapeHtml(plan?.name || "Free")}</b></article>
        <article><span>Wallet</span><b>${App.money(App.realBalance(u.id))}</b></article>
      </section>

      <section class="premium-card profile-editor-card compact-profile-editor">
        <div class="card-row"><div><p>EDIT PROFILE</p><h2>Personal display</h2></div><span class="history-mode">Browser Saved</span></div>
        <div class="profile-preview">
          ${avatar(savedName)}
          <div>
            <b>${App.escapeHtml(savedName)}</b>
            <span>${App.escapeHtml(u.email)}</span>
          </div>
        </div>
        <div class="profile-form compact-inner-form">
          <label>Display Name<input id="profileNameInput" value="${App.escapeHtml(savedName)}" placeholder="Your display name"/></label>
          <label>Avatar Image<input id="profileAvatarInput" type="file" accept="image/*"/><small>Uploads to user-avatars bucket when Supabase Storage is ready.</small></label>
          <button class="save-profile-btn" onclick="AITradeXUser.saveProfile()">Save Profile</button>
        </div>
      </section>

      <section class="premium-card profile-account-card">
        <div class="card-row"><div><p>ACCOUNT DETAILS</p><h2>Basic Information</h2></div><button class="mini-action" onclick="AITradeXUser.copyText('${App.escapeHtml(u.referralCode || "")}', this)">Copy Code</button></div>
        <div class="profile-info-grid compact-info-grid">
          <article><span>Email</span><b>${App.escapeHtml(u.email)}</b></article>
          <article><span>Mobile</span><b>${App.escapeHtml(u.mobile || "-")}</b></article>
          <article><span>Referral Code</span><b>${App.escapeHtml(u.referralCode || "-")}</b></article>
        </div>
      </section>
    `);
  }


  function sessionMinutesLeft() {
    const ms = App.sessionTimeLeft ? App.sessionTimeLeft() : 0;
    return Math.max(0, Math.ceil(ms / 60000));
  }

  function securityTimelineRows() {
    const u = user();
    const rows = [];
    if (u?.createdAt) rows.push({ label: "Account created", value: new Date(u.createdAt).toLocaleString(), tone: "good" });
    if (u?.lastLoginAt) rows.push({ label: "Last login", value: new Date(u.lastLoginAt).toLocaleString(), tone: "good" });
    rows.push({ label: "Session expiry", value: `${sessionMinutesLeft()} min left`, tone: sessionMinutesLeft() <= 30 ? "warn" : "good" });
    rows.push({ label: "Login protection", value: "6 wrong attempts = 10 min lock", tone: "neutral" });
    return rows;
  }

  function securityPage() {
    const u = user();
    const minutes = sessionMinutesLeft();
    const timeline = securityTimelineRows();
    shell(`
      <section class="inner-hero-card security-hero-card">
        <div>
          <p>ACCOUNT SECURITY</p>
          <h1>Keep your AITradeX account safe</h1>
          <span>Session, password and login protection for this device.</span>
        </div>
        <span class="history-mode">${minutes} min left</span>
      </section>

      <section class="inner-status-strip security-status-strip">
        <article><span>Session</span><b>${minutes} min</b></article>
        <article><span>Login Lock</span><b>6 Attempts</b></article>
        <article><span>Account</span><b>${App.escapeHtml(String(u?.status || "ACTIVE"))}</b></article>
      </section>

      <section class="premium-card security-control-card">
        <div class="card-row"><div><p>SESSION CONTROL</p><h2>Current login session</h2></div><button class="mini-action" onclick="AITradeXUser.extendSession()">Extend Session</button></div>
        <div class="profile-info-grid compact-info-grid">
          <article><span>Signed in as</span><b>${App.escapeHtml(u?.email || "-")}</b></article>
          <article><span>Role</span><b>User</b></article>
          <article><span>Session time left</span><b>${minutes} min</b></article>
          <article><span>Auto logout</span><b>After 24 hours</b></article>
        </div>
      </section>

      <section class="premium-card security-password-card">
        <div class="card-row"><div><p>PASSWORD</p><h2>Change password</h2></div><span class="history-mode">Protected</span></div>
        <div class="profile-form compact-inner-form security-form-grid">
          <label>Current Password<input id="securityCurrentPassword" type="password" placeholder="Current password" autocomplete="current-password"/></label>
          <label>New Password<input id="securityNewPassword" type="password" placeholder="Minimum 4 characters" autocomplete="new-password"/></label>
          <label>Confirm New Password<input id="securityConfirmPassword" type="password" placeholder="Repeat new password" autocomplete="new-password"/></label>
          <button class="save-profile-btn" onclick="AITradeXUser.changePassword()">Update Password</button>
        </div>
      </section>

      <section class="premium-card security-timeline-card">
        <div class="card-row"><div><p>SECURITY TIMELINE</p><h2>Recent account safety</h2></div><button class="ghost-action" onclick="AITradeXUser.logout()">Logout</button></div>
        <div class="security-timeline-list">
          ${timeline.map(row => `<article class="security-timeline-row ${row.tone}"><span>${App.escapeHtml(row.label)}</span><b>${App.escapeHtml(row.value)}</b></article>`).join("")}
        </div>
      </section>
    `);
  }

  function supportTicketsForUser() {
    const u = user();
    if (!u) return [];
    App.state.supportTickets = App.state.supportTickets || [];
    return App.state.supportTickets
      .filter(ticket => ticket.userId === u.id)
      .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0));
  }

  function supportStatusBadge(status) {
    const clean = String(status || "OPEN").toUpperCase();
    const label = clean === "REPLIED" ? "Replied" : clean === "CLOSED" ? "Closed" : "Open";
    return `<span class="ticket-status ${clean.toLowerCase()}">${label}</span>`;
  }

  function supportWhatsAppLink() {
    const settings = App.state.settings || {};
    const raw = String(settings.supportWhatsAppNumber || "919999999999").replace(/\D/g, "");
    const message = encodeURIComponent("Hello AITradeX Support, I need help with my account.");
    return `https://wa.me/${raw}?text=${message}`;
  }

  function supportTicketCard(ticket) {
    const replies = Array.isArray(ticket.replies) ? ticket.replies : [];
    const adminReplies = replies.filter(reply => reply.by === "admin").length;
    const lastReply = replies[replies.length - 1];
    return `
      <article class="support-ticket-card">
        <div class="ticket-card-head">
          <div>
            <p>${App.escapeHtml(ticket.category || "Support")}</p>
            <h3>${App.escapeHtml(ticket.subject || "Support request")}</h3>
          </div>
          ${supportStatusBadge(ticket.status)}
        </div>
        <div class="ticket-message-box">${App.escapeHtml(ticket.message || "-")}</div>
        ${lastReply ? `<div class="ticket-reply-preview"><b>${lastReply.by === "admin" ? "Support" : "You"}</b><span>${App.escapeHtml(lastReply.message || "")}</span></div>` : ""}
        <div class="ticket-meta-grid">
          <span>Ticket ID: ${App.escapeHtml(ticket.id)}</span>
          <span>Created: ${App.escapeHtml(ticket.createdAt || "-")}</span>
          <span>Replies: ${adminReplies}</span>
        </div>
        ${replies.length ? `<div class="ticket-thread">${replies.map(reply => `
          <div class="ticket-thread-row ${reply.by === "admin" ? "admin" : "user"}">
            <b>${reply.by === "admin" ? "Support" : "You"}</b>
            <span>${App.escapeHtml(reply.message || "")}</span>
            <small>${App.escapeHtml(reply.createdAt || "")}</small>
          </div>`).join("")}</div>` : ""}
      </article>`;
  }

  function supportPage() {
    const tickets = supportTicketsForUser();
    const openCount = tickets.filter(ticket => String(ticket.status || "OPEN").toUpperCase() !== "CLOSED").length;
    const closedCount = tickets.filter(ticket => String(ticket.status || "OPEN").toUpperCase() === "CLOSED").length;
    shell(`
      <section class="inner-hero-card support-hero-card refined-support-hero">
        <div>
          <p>SUPPORT CENTER</p>
          <h1>Help desk & ticket records</h1>
          <span>Create official tickets for wallet, withdrawal, trade and account issues.</span>
        </div>
        <a class="whatsapp-help-btn" href="${supportWhatsAppLink()}" target="_blank" rel="noopener">WhatsApp Help</a>
      </section>

      <section class="inner-status-strip support-status-strip">
        <article><span>Total Tickets</span><b>${tickets.length}</b></article>
        <article><span>Open</span><b>${openCount}</b></article>
        <article><span>Closed</span><b>${closedCount}</b></article>
        <article><span>Channel</span><b>Ticket + WA</b></article>
      </section>

      <section class="support-grid refined-support-grid">
        <form class="premium-card support-form-card form-grid compact-ticket-form" onsubmit="AITradeXUser.createSupportTicket(event)">
          <div class="card-row"><div><p>NEW TICKET</p><h2>Create Support Ticket</h2></div><span class="history-mode">${openCount} Open</span></div>
          <label>Category
            <select id="supportCategory" required>
              <option value="Deposit">Deposit</option>
              <option value="Withdrawal">Withdrawal</option>
              <option value="Trade">Trade</option>
              <option value="Subscription">Subscription</option>
              <option value="Referral">Referral</option>
              <option value="Account">Account</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label>Subject
            <input id="supportSubject" required maxlength="80" placeholder="Example: Withdrawal request not updated"/>
          </label>
          <label>Message
            <textarea id="supportMessage" required rows="4" maxlength="700" placeholder="Write issue with amount, request ID or transaction detail if available."></textarea>
          </label>
          <button class="save-profile-btn">Submit Ticket</button>
        </form>

        <section class="premium-card support-list-card refined-ticket-list-card">
          <div class="card-row"><div><p>YOUR TICKETS</p><h2>Ticket History</h2></div><span class="history-mode">${tickets.length}</span></div>
          <div class="support-ticket-list compact-ticket-list">
            ${tickets.length ? tickets.map(supportTicketCard).join("") : `<div class="empty-state">No support tickets yet.</div>`}
          </div>
        </section>
      </section>
    `);
  }

  function notificationPage() {
    const rows = userNotifications();
    const unread = rows.filter(n => !n.read).length;
    const typeCount = type => rows.filter(n => String(n.type || "INFO").toUpperCase() === type).length;
    shell(`
      <section class="inner-hero-card notification-hero-card">
        <div>
          <p>NOTIFICATIONS</p>
          <h1>Updates center</h1>
          <span>Wallet, AI trade, support, plan and account updates in one clean list.</span>
        </div>
        <button class="ghost-action" onclick="AITradeXUser.markNotificationsRead()">Mark all read</button>
      </section>

      <section class="notification-filter-strip">
        <span>All ${rows.length}</span>
        <span>Unread ${unread}</span>
        <span>Wallet ${typeCount("WALLET") + typeCount("DEPOSIT") + typeCount("WITHDRAWAL")}</span>
        <span>AI ${typeCount("AI")}</span>
        <span>Support ${typeCount("SUPPORT")}</span>
      </section>

      <section class="premium-card notification-center-card refined-notification-card">
        <div class="section-head">
          <div><h3>Latest Notifications</h3><span>${unread} unread · newest first</span></div>
          <span class="admin-count-pill">${rows.length} total</span>
        </div>
        <div class="notification-list compact-notification-list">
          ${rows.length ? rows.map(n => `
            <article class="notification-row ${n.read ? "read" : "unread"}">
              <div class="notification-icon">${notificationIcon(n.type)}</div>
              <div>
                <b>${App.escapeHtml(n.title || "Notification")}</b>
                <p>${App.escapeHtml(n.message || "")}</p>
                <small>${n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}</small>
              </div>
              ${n.linkPage ? `<button class="mini-action" onclick="AITradeXUser.openNotificationLink('${n.id}', '${n.linkPage}')">Open</button>` : `<button class="ghost-action" onclick="AITradeXUser.markSingleNotification('${n.id}')">Read</button>`}
            </article>`).join("") : `<div class="empty-state">No notifications yet.</div>`}
        </div>
      </section>`);
  }

  function notificationIcon(type) {
    const map = { DEPOSIT: "⬇️", WITHDRAWAL: "⬆️", AI: "🤖", WALLET: "💳", PLAN: "⭐", KYC: "🛡️", SUPPORT: "🎧", USER: "👤" };
    return map[String(type || "INFO").toUpperCase()] || "🔔";
  }

  function render() {
    if (App.reloadState) App.reloadState();
    reconcileUserAiLiveMarginLocks().catch(err => console.warn("User AI live margin reconcile failed", err));
    ensurePairForMarket();
    const u = user();
    if (!u || u.role !== "user") return landing();

    if (page === "home") return homePage();
    if (page === "pnl") {
      page = "positions";
      localStorage.setItem("AITradeX_ACTIVE_PAGE", page);
    }
    if (page === "trade") return tradePage();
    if (page === "positions" || page === "orders") return ordersPage();
    if (page === "wallet") return walletPage();
    if (page === "history") return historyPage();
    if (page === "kyc") return kycPage();
    if (page === "payments") return paymentPage();
    if (page === "subscription") return subscriptionPage();
    if (page === "ai-settings") return aiSettingsPage();
    if (page === "referral") return referralPage();
    if (page === "profile") return profilePage();
    if (page === "security") return securityPage();
    if (page === "support") return supportPage();
    if (page === "notifications") return notificationPage();
    return homePage();
  }

  window.AITradeXUser = {
    setAuthMode(mode) {
      authMode = mode;
      landing();
      setTimeout(() => document.getElementById("authBox")?.scrollIntoView({ behavior: "smooth" }), 50);
    },
    scrollAuth() {
      document.getElementById("authBox")?.scrollIntoView({ behavior: "smooth" });
    },
    async register(event) {
      event.preventDefault();
      try {
        await Auth.registerUser({
          name: regName.value,
          email: regEmail.value,
          mobile: regMobile.value,
          password: regPassword.value,
          referralCode: regReferral.value.trim()
        });
        page = "home";
        localStorage.setItem("AITradeX_ACTIVE_PAGE", page);
        App.addNotification?.({ audience: "ADMIN", title: "New user signup", message: `${regName.value} created a new account.`, type: "USER", linkPage: "users", referenceId: `signup_${regEmail.value}` });
        App.toast("Account created successfully.");
        render();
      } catch (err) {
        App.toast(err.message);
      }
    },
    async login(event) {
      event.preventDefault();
      try {
        await Auth.loginUser({ email: loginEmail.value, password: loginPassword.value });
        page = "home";
        localStorage.setItem("AITradeX_ACTIVE_PAGE", page);
        App.toast("Logged in successfully.");
        render();
      } catch (err) {
        App.toast(err.message);
      }
    },
    go(next) {
      page = next;
      drawerOpen = false;
      localStorage.setItem("AITradeX_ACTIVE_PAGE", page);
      render();
    },
    setOrderViewTab(tab) {
      orderViewTab = ["ALL", "MANUAL", "AI", "PENDING"].includes(tab) ? tab : "ALL";
      localStorage.setItem("AITradeX_ORDER_VIEW_TAB", orderViewTab);
      render();
    },
    openNotifications() {
      page = "notifications";
      drawerOpen = false;
      localStorage.setItem("AITradeX_ACTIVE_PAGE", page);
      render();
    },
    markNotificationsRead() {
      const u = user();
      App.markNotificationsRead?.({ audience: "USER", userId: u?.id || "" });
      App.toast("Notifications marked as read.");
      render();
    },
    markSingleNotification(id) {
      const row = (App.state.notifications || []).find(n => n.id === id);
      if (row) {
        row.read = true;
        App.saveState();
      }
      render();
    },
    openNotificationLink(id, linkPage) {
      const row = (App.state.notifications || []).find(n => n.id === id);
      if (row) {
        row.read = true;
        App.saveState();
      }
      page = linkPage || "notifications";
      localStorage.setItem("AITradeX_ACTIVE_PAGE", page);
      render();
    },
    toggleDrawer(force) {
      drawerOpen = typeof force === "boolean" ? force : !drawerOpen;
      render();
    },
    copyReferral(type, button) {
      const u = user();
      if (!u) return false;
      const link = `${window.location.origin}${window.location.pathname}?ref=${encodeURIComponent(u.referralCode || "")}`;
      const value = type === "code" ? (u.referralCode || "") : link;
      return this.copyText(value, button);
    },
    async copyText(value, button) {
      const text = String(value || "").trim();
      const targetButton = button?.closest ? button.closest("button") : button;
      if (!text) {
        App.toast("Nothing to copy.");
        return false;
      }

      const showCopyFeedback = (success) => {
        if (!targetButton) return;
        const oldText = targetButton.dataset.originalText || targetButton.textContent || "Copy";
        targetButton.dataset.originalText = oldText;
        targetButton.classList.toggle("copy-success", !!success);
        targetButton.classList.toggle("copy-failed", !success);
        targetButton.textContent = success ? "Copied ✓" : "Copy failed";
        targetButton.disabled = true;
        window.clearTimeout(targetButton._copyTimer);
        targetButton._copyTimer = window.setTimeout(() => {
          targetButton.classList.remove("copy-success", "copy-failed");
          targetButton.textContent = oldText;
          targetButton.disabled = false;
        }, 1600);
      };

      const fallbackCopy = () => {
        const input = document.createElement("textarea");
        input.value = text;
        input.setAttribute("readonly", "readonly");
        input.style.position = "fixed";
        input.style.top = "50%";
        input.style.left = "50%";
        input.style.width = "1px";
        input.style.height = "1px";
        input.style.opacity = "0";
        input.style.zIndex = "-1";
        input.style.pointerEvents = "none";
        document.body.appendChild(input);
        input.focus({ preventScroll: true });
        input.select();
        input.setSelectionRange(0, input.value.length);
        let copied = false;
        try {
          copied = document.execCommand("copy");
        } catch (err) {
          copied = false;
        }
        input.remove();
        return copied;
      };

      try {
        let copied = false;
        if (navigator.clipboard?.writeText) {
          try {
            await navigator.clipboard.writeText(text);
            copied = true;
          } catch (err) {
            copied = fallbackCopy();
          }
        } else {
          copied = fallbackCopy();
        }
        if (!copied) throw new Error("Copy failed");
        showCopyFeedback(true);
        App.toast("Copied to clipboard.");
        return true;
      } catch (err) {
        showCopyFeedback(false);
        App.toast("Copy failed. Long press and copy manually.");
        return false;
      }
    },
    setAccountMode(mode) {
      accountMode = "REAL";
      localStorage.setItem("AITradeX_ACCOUNT_MODE", "REAL");
      render();
    },
    setWalletMode(mode) {
      walletMode = ["WITHDRAWAL", "HISTORY"].includes(mode) ? mode : "DEPOSIT";
      walletRequestPage = 0;
      walletLedgerPage = 0;
      localStorage.setItem("AITradeX_WALLET_MODE", walletMode);
      localStorage.setItem("AITradeX_WALLET_REQUEST_PAGE", "0");
      localStorage.setItem("AITradeX_WALLET_LEDGER_PAGE", "0");
      render();
    },
    setWalletHistoryFilter(filter) {
      walletHistoryFilter = ["ALL", "DEPOSIT", "WITHDRAWAL", "PENDING", "APPROVED", "REJECTED"].includes(filter) ? filter : "ALL";
      walletRequestPage = 0;
      localStorage.setItem("AITradeX_WALLET_HISTORY_FILTER", walletHistoryFilter);
      localStorage.setItem("AITradeX_WALLET_REQUEST_PAGE", "0");
      render();
    },
    setWalletRecordsTab(tab) {
      walletRecordsTab = tab === "LEDGER" ? "LEDGER" : "REQUESTS";
      walletRequestPage = 0;
      walletLedgerPage = 0;
      localStorage.setItem("AITradeX_WALLET_RECORDS_TAB", walletRecordsTab);
      localStorage.setItem("AITradeX_WALLET_REQUEST_PAGE", "0");
      localStorage.setItem("AITradeX_WALLET_LEDGER_PAGE", "0");
      render();
    },
    walletRequestPage(delta) {
      walletRequestPage = Math.max(0, walletRequestPage + Number(delta || 0));
      localStorage.setItem("AITradeX_WALLET_REQUEST_PAGE", String(walletRequestPage));
      render();
    },
    walletLedgerPage(delta) {
      walletLedgerPage = Math.max(0, walletLedgerPage + Number(delta || 0));
      localStorage.setItem("AITradeX_WALLET_LEDGER_PAGE", String(walletLedgerPage));
      render();
    },
    async submitCleanDepositRequest() {
      const amount = Number(document.getElementById("depositAmountInput")?.value || 0);
      const utr = normalizeUtr(document.getElementById("depositUtrInput")?.value || "");
      depositDraft.amount = amount;
      depositDraft.utr = utr;
      localStorage.setItem("AITradeX_DEPOSIT_DRAFT", JSON.stringify(depositDraft));
      await this.submitDepositRequest();
    },
    async submitCleanWithdrawalRequest() {
      const approved = approvedPaymentMethods();
      const method = approved.find(m => m.id === withdrawalDraft.methodId) || approved[0];
      withdrawalDraft.amount = Number(document.getElementById("withdrawalAmountInput")?.value || 0);
      withdrawalDraft.methodId = method?.id || "";
      localStorage.setItem("AITradeX_WITHDRAWAL_DRAFT", JSON.stringify(withdrawalDraft));
      await this.submitWithdrawalRequest();
    },
    setDepositType(type) {
      const settings = platformSettings();
      const nextType = type === "BANK" ? "BANK" : "UPI";
      if (nextType === "UPI" && settings.depositUpiEnabled === false) {
        App.toast("UPI / QR deposit is currently disabled.");
        return;
      }
      if (nextType === "BANK" && settings.depositBankEnabled === false) {
        App.toast("Bank transfer deposit is currently disabled.");
        return;
      }
      depositDraft.type = nextType;
      localStorage.setItem("AITradeX_DEPOSIT_DRAFT", JSON.stringify(depositDraft));
      render();
    },
    nextDepositStep() {
      const settings = platformSettings();
      const minDeposit = Number(settings.minDeposit || 500);
      const maxDeposit = Number(settings.maxDeposit || 1000000);
      const depositType = depositDraft.type === "BANK" ? "BANK" : "UPI";
      if (settings.depositEnabled === false || settings.maintenanceMode === true) {
        App.toast("Deposit is temporarily disabled by admin.");
        return;
      }
      if ((depositType === "UPI" && settings.depositUpiEnabled === false) || (depositType === "BANK" && settings.depositBankEnabled === false)) {
        App.toast("Selected deposit method is currently disabled.");
        return;
      }

      if (depositStep === 1) {
        const amount = Number(document.getElementById("depositAmountInput")?.value || 0);
        if (!amount || amount < minDeposit) {
          App.toast(`Minimum deposit is ${App.money(minDeposit)}.`);
          return;
        }
        if (amount > maxDeposit) {
          App.toast(`Maximum deposit is ${App.money(maxDeposit)}.`);
          return;
        }
        depositDraft.amount = amount;
      }

      if (depositStep === 2) {
        const utr = normalizeUtr(document.getElementById("depositUtrInput")?.value || "");
        if (!/^\d{12}$/.test(utr)) {
          App.toast("Enter exactly 12 digit UTR.");
          return;
        }
        if (isDuplicateDepositUtr(utr)) {
          App.toast("This UTR is already submitted. Enter a unique UTR.");
          return;
        }
        depositDraft.utr = utr;
      }

      localStorage.setItem("AITradeX_DEPOSIT_DRAFT", JSON.stringify(depositDraft));
      depositStep = Math.min(3, depositStep + 1);
      localStorage.setItem("AITradeX_DEPOSIT_STEP", String(depositStep));
      render();
    },
    prevDepositStep() {
      depositStep = Math.max(1, depositStep - 1);
      localStorage.setItem("AITradeX_DEPOSIT_STEP", String(depositStep));
      render();
    },
    async submitDepositRequest() {
      const settings = platformSettings();
      const amount = Number(depositDraft.amount || 0);
      const minDeposit = Number(settings.minDeposit || 500);
      const maxDeposit = Number(settings.maxDeposit || 1000000);
      const depositType = depositDraft.type === "BANK" ? "BANK" : "UPI";
      if (settings.depositEnabled === false || settings.maintenanceMode === true) {
        App.toast("Deposit is temporarily disabled by admin.");
        return;
      }
      const utr = normalizeUtr(depositDraft.utr);
      if ((depositType === "UPI" && settings.depositUpiEnabled === false) || (depositType === "BANK" && settings.depositBankEnabled === false)) {
        App.toast("Selected deposit method is currently disabled.");
        return;
      }
      if (!amount || amount < minDeposit || amount > maxDeposit || !/^\d{12}$/.test(utr)) {
        App.toast(`Deposit amount must be between ${App.money(minDeposit)} and ${App.money(maxDeposit)} with exactly 12 digit UTR.`);
        return;
      }
      if (isDuplicateDepositUtr(utr)) {
        App.toast("This UTR is already submitted. Enter a unique UTR.");
        return;
      }

      const requests = depositRequests();
      const requestId = App.uid("dep");
      requests.unshift({
        id: requestId,
        amount,
        type: depositDraft.type || "UPI",
        utr,
        status: "PENDING",
        createdAt: new Date().toISOString(),
        rejectReason: ""
      });
      await saveDepositRequests(requests);
      await App.addNotificationAsync?.({ audience: "ADMIN", title: "New deposit request", message: `${displayName()} requested ${App.money(amount)} deposit. UTR ${utr}.`, type: "DEPOSIT", linkPage: "deposits", referenceId: requestId });

      depositDraft = { amount: "", type: settings.depositUpiEnabled !== false ? "UPI" : "BANK", utr: "" };
      depositStep = 1;
      localStorage.setItem("AITradeX_DEPOSIT_DRAFT", JSON.stringify(depositDraft));
      localStorage.setItem("AITradeX_DEPOSIT_STEP", "1");
      App.toast("Deposit request submitted.");
      render();
    },
    selectWithdrawalMethod(methodId) {
      withdrawalDraft.methodId = methodId;
      localStorage.setItem("AITradeX_WITHDRAWAL_DRAFT", JSON.stringify(withdrawalDraft));
      render();
    },
    nextWithdrawalStep() {
      const settings = platformSettings();
      const minWithdrawal = Number(settings.minWithdrawal || 1000);
      const maxWithdrawal = Number(settings.maxWithdrawal || 500000);
      const approved = approvedPaymentMethods();
      if (settings.withdrawalEnabled === false || settings.maintenanceMode === true) {
        App.toast("Withdrawal is temporarily disabled by admin.");
        return;
      }

      if (currentKyc().status !== "APPROVED") {
        App.toast("KYC approval required.");
        return;
      }

      if (!approved.length) {
        App.toast("Approved bank account required.");
        return;
      }

      if (withdrawalStep === 1) {
        const amount = Number(document.getElementById("withdrawalAmountInput")?.value || 0);
        if (!amount || amount < minWithdrawal) {
          App.toast(`Minimum withdrawal is ${App.money(minWithdrawal)}.`);
          return;
        }
        if (amount > maxWithdrawal) {
          App.toast(`Maximum withdrawal is ${App.money(maxWithdrawal)}.`);
          return;
        }
        if (amount > availableRealBalance()) {
          App.toast("Insufficient available balance.");
          return;
        }
        withdrawalDraft.amount = amount;
      }

      if (withdrawalStep === 2) {
        if (!withdrawalDraft.methodId) withdrawalDraft.methodId = approved[0].id;
        if (!approved.some(m => m.id === withdrawalDraft.methodId)) {
          App.toast("Select an approved method.");
          return;
        }
      }

      localStorage.setItem("AITradeX_WITHDRAWAL_DRAFT", JSON.stringify(withdrawalDraft));
      withdrawalStep = Math.min(3, withdrawalStep + 1);
      localStorage.setItem("AITradeX_WITHDRAWAL_STEP", String(withdrawalStep));
      render();
    },
    prevWithdrawalStep() {
      withdrawalStep = Math.max(1, withdrawalStep - 1);
      localStorage.setItem("AITradeX_WITHDRAWAL_STEP", String(withdrawalStep));
      render();
    },
    async submitWithdrawalRequest() {
      const settings = platformSettings();
      const amount = Number(withdrawalDraft.amount || 0);
      const minWithdrawal = Number(settings.minWithdrawal || 1000);
      const maxWithdrawal = Number(settings.maxWithdrawal || 500000);
      const method = approvedPaymentMethods().find(m => m.id === withdrawalDraft.methodId) || approvedPaymentMethods()[0];
      if (settings.withdrawalEnabled === false || settings.maintenanceMode === true) {
        App.toast("Withdrawal is temporarily disabled by admin.");
        return;
      }
      if (!amount || amount < minWithdrawal || amount > maxWithdrawal || !method) {
        App.toast("Complete withdrawal details first.");
        return;
      }

      if (amount > availableRealBalance()) {
        App.toast("Insufficient available balance.");
        return;
      }

      const requests = withdrawalRequests();
      const requestId = App.uid("wd");
      requests.unshift({
        id: requestId,
        amount,
        methodId: method.id,
        methodSnapshot: method,
        status: "PENDING",
        createdAt: new Date().toISOString(),
        rejectReason: ""
      });
      await saveWithdrawalRequests(requests);
      await App.addNotificationAsync?.({ audience: "ADMIN", title: "New withdrawal request", message: `${displayName()} requested ${App.money(amount)} withdrawal.`, type: "WITHDRAWAL", linkPage: "withdrawals", referenceId: requestId });

      withdrawalDraft = { amount: "", methodId: "" };
      withdrawalStep = 1;
      localStorage.setItem("AITradeX_WITHDRAWAL_DRAFT", JSON.stringify(withdrawalDraft));
      localStorage.setItem("AITradeX_WITHDRAWAL_STEP", "1");
      App.toast("Withdrawal request submitted.");
      render();
    },
    async resubmitKyc() {
      const kyc = currentKyc();
      kyc.status = "NOT_SUBMITTED";
      kyc.rejectReason = "";
      kyc.rejectedAt = "";
      kyc.approvedAt = "";
      await saveKycData(kyc);
      kycStep = 1;
      localStorage.setItem("AITradeX_KYC_STEP", "1");
      App.toast("You can resubmit KYC now.");
      render();
    },
    setKycStep(step) {
      kycStep = Math.min(4, Math.max(1, Number(step || 1)));
      localStorage.setItem("AITradeX_KYC_STEP", String(kycStep));
      render();
    },
    prevKycStep() {
      kycStep = Math.max(1, kycStep - 1);
      localStorage.setItem("AITradeX_KYC_STEP", String(kycStep));
      render();
    },
    async saveKycStep() {
      const kyc = currentKyc();
      if (kyc.status === "PENDING" || kyc.status === "APPROVED") {
        App.toast("KYC already submitted.");
        return;
      }

      if (kycStep === 1) {
        kyc.personal.fullName = document.getElementById("kycFullName")?.value?.trim() || "";
        kyc.personal.mobile = user()?.mobile || kyc.personal.mobile || "";
        kyc.personal.email = user()?.email || kyc.personal.email || "";
        kyc.personal.dob = document.getElementById("kycDob")?.value || "";
        kyc.personal.gender = document.getElementById("kycGender")?.value || "";
        kyc.personal.city = document.getElementById("kycCity")?.value?.trim() || "";
        kyc.personal.state = document.getElementById("kycState")?.value || "";
        kyc.personal.pincode = digitsOnly(document.getElementById("kycPincode")?.value || "", 6);
        if (!kyc.personal.fullName || !kyc.personal.dob || !kyc.personal.gender || !kyc.personal.mobile || !kyc.personal.email || !kyc.personal.city || !kyc.personal.state) {
          App.toast("Complete all personal details.");
          return;
        }
        if (!/^\d{6}$/.test(kyc.personal.pincode)) {
          App.toast("Please enter a valid 6-digit pincode.");
          return;
        }
      }

      if (kycStep === 2) {
        kyc.id.type = "Aadhaar Card";
        kyc.id.number = digitsOnly(document.getElementById("kycAadhaar")?.value || "", 12);
        const front = document.getElementById("kycFront")?.files?.[0];
        const back = document.getElementById("kycBack")?.files?.[0];
        try {
          if (front) {
            App.toast("Uploading Aadhaar front...");
            const uploaded = await uploadStorageFile({ bucket: "kyc-documents", folder: "aadhaar-front", label: "aadhaar-front", file: front });
            kyc.uploads.frontName = uploaded.name;
            kyc.uploads.frontPath = uploaded.path;
            kyc.uploads.frontBucket = uploaded.bucket;
            kyc.uploads.frontUrl = uploaded.url;
            kyc.uploads.frontSize = uploaded.size;
            kyc.uploads.frontType = uploaded.type;
          }
          if (back) {
            App.toast("Uploading Aadhaar back...");
            const uploaded = await uploadStorageFile({ bucket: "kyc-documents", folder: "aadhaar-back", label: "aadhaar-back", file: back });
            kyc.uploads.backName = uploaded.name;
            kyc.uploads.backPath = uploaded.path;
            kyc.uploads.backBucket = uploaded.bucket;
            kyc.uploads.backUrl = uploaded.url;
            kyc.uploads.backSize = uploaded.size;
            kyc.uploads.backType = uploaded.type;
          }
        } catch (err) {
          App.toast(`KYC document upload failed: ${err.message || err}`);
          return;
        }
        if (!/^\d{12}$/.test(kyc.id.number)) {
          App.toast("Please enter a valid 12-digit Aadhaar number.");
          return;
        }
        if (isDuplicateAadhaar(kyc.id.number)) {
          App.toast("This Aadhaar number is already linked with another account.");
          return;
        }
        if (!kyc.uploads.frontName || !kyc.uploads.backName) {
          App.toast("Aadhaar front and back images are required.");
          return;
        }
      }

      if (kycStep === 3) {
        const selfie = document.getElementById("kycSelfie")?.files?.[0];
        try {
          if (selfie) {
            App.toast("Uploading selfie...");
            const uploaded = await uploadStorageFile({ bucket: "kyc-documents", folder: "selfies", label: "selfie", file: selfie });
            kyc.uploads.selfieName = uploaded.name;
            kyc.uploads.selfiePath = uploaded.path;
            kyc.uploads.selfieBucket = uploaded.bucket;
            kyc.uploads.selfieUrl = uploaded.url;
            kyc.uploads.selfieSize = uploaded.size;
            kyc.uploads.selfieType = uploaded.type;
          }
        } catch (err) {
          App.toast(`Selfie upload failed: ${err.message || err}`);
          return;
        }
        kyc.declarationAccepted = !!document.getElementById("kycDeclaration")?.checked;
        if (!kyc.uploads.selfieName) {
          App.toast("Selfie image is required.");
          return;
        }
        if (!kyc.declarationAccepted) {
          App.toast("Please confirm selfie and Aadhaar declaration.");
          return;
        }
      }

      await saveKycData(kyc);
      kycStep = Math.min(4, kycStep + 1);
      localStorage.setItem("AITradeX_KYC_STEP", String(kycStep));
      render();
    },
    async submitKyc() {
      const kyc = currentKyc();
      kyc.finalAccepted = !!document.getElementById("kycFinalConfirm")?.checked;
      if (!kyc.personal.fullName || !kyc.personal.dob || !kyc.personal.gender || !kyc.personal.mobile || !kyc.personal.email || !kyc.personal.city || !kyc.personal.state || !/^\d{6}$/.test(String(kyc.personal.pincode || ""))) {
        App.toast("Complete Step 1 personal details first.");
        return;
      }
      if (!/^\d{12}$/.test(String(kyc.id.number || "")) || !kyc.uploads.frontName || !kyc.uploads.backName) {
        App.toast("Complete Aadhaar verification first.");
        return;
      }
      if (isDuplicateAadhaar(kyc.id.number)) {
        App.toast("This Aadhaar number is already linked with another account.");
        return;
      }
      if (!kyc.uploads.selfieName || !kyc.declarationAccepted) {
        App.toast("Complete selfie verification first.");
        return;
      }
      if (!kyc.finalAccepted) {
        App.toast("Please confirm your KYC details before submit.");
        return;
      }

      kyc.status = "PENDING";
      kyc.submittedAt = new Date().toISOString();
      kyc.rejectReason = "";
      kyc.rejectedAt = "";
      kyc.approvedAt = "";
      await saveKycData(kyc);
      await App.notifyAsync?.({ audience: "ADMIN", title: "New KYC request", message: `${displayName()} submitted KYC for verification.`, type: "KYC", linkPage: "kyc", referenceId: `kyc_submit_${user()?.id || "user"}_${kyc.submittedAt}` });
      App.toast("KYC submitted for verification.");
      render();
    },
    async addBankMethod() {
      const kyc = currentKyc();
      if (kyc.status !== "APPROVED") {
        App.toast("KYC approval required.");
        return;
      }

      const methods = paymentMethods();
      if (methods.filter(m => m.type === "BANK" && m.status !== "REJECTED").length >= 2) {
        App.toast("Maximum 2 bank accounts allowed. Rejected bank accounts do not count in this limit.");
        return;
      }

      const bankName = document.getElementById("bankNameInput")?.value?.trim() || "";
      const accountNumber = document.getElementById("bankAccInput")?.value?.trim() || "";
      const confirmAccount = document.getElementById("bankAccConfirmInput")?.value?.trim() || "";
      const ifsc = document.getElementById("bankIfscInput")?.value?.trim() || "";
      const accountType = document.getElementById("bankTypeInput")?.value || "Savings";

      if (!bankName || !accountNumber || !ifsc) {
        App.toast("Bank name, account number and IFSC required.");
        return;
      }

      if (accountNumber !== confirmAccount) {
        App.toast("Account number does not match.");
        return;
      }

      const methodId = `PM-${Date.now()}`;
      const bankMethod = {
        id: methodId,
        type: "BANK",
        holderName: verifiedKycName(),
        bankName,
        accountNumber,
        ifsc,
        accountType,
        status: "PENDING",
        createdAt: new Date().toISOString()
      };
      methods.unshift(bankMethod);
      await savePaymentMethods(methods);
      await App.notifyAsync?.({ audience: "ADMIN", title: "New bank account request", message: `${displayName()} submitted ${bankName} bank account ending ${String(accountNumber).slice(-4)} for verification.`, type: "PAYMENT_METHOD", linkPage: "payments", referenceId: `pm_submit_${user()?.id || "user"}_${methodId}` });
      App.toast("Bank account submitted for verification.");
      render();
    },
    setChartInterval(value) {
      chartInterval = value;
      localStorage.setItem("AITradeX_CHART_INTERVAL", chartInterval);
      render();
    },
    setChartStyle(value) {
      chartStyle = value;
      localStorage.setItem("AITradeX_CHART_STYLE", chartStyle);
      selectorSheet = null;
      render();
    },
    setChartTheme(value) {
      chartTheme = value;
      localStorage.setItem("AITradeX_CHART_THEME", chartTheme);
      selectorSheet = null;
      render();
    },
    setChartToolbar(value) {
      chartToolbar = !!value;
      localStorage.setItem("AITradeX_CHART_TOOLBAR", String(chartToolbar));
      selectorSheet = null;
      render();
    },
    openSheet(type) {
      selectorSheet = type;
      render();
    },
    closeSheet() {
      selectorSheet = null;
      render();
    },
    setTradeOrderType(value) {
      clearTradeOrderNotice();
      tradeOrderType = String(value || "MARKET").toUpperCase() === "LIMIT" ? "LIMIT" : "MARKET";
      localStorage.setItem("AITradeX_TRADE_ORDER_TYPE", tradeOrderType);
      render();
    },
    setTradeLimitPrice(value) {
      clearTradeOrderNotice();
      tradeLimitPrice = String(value || "").replace(/[^0-9.]/g, "");
      localStorage.setItem("AITradeX_TRADE_LIMIT_PRICE", tradeLimitPrice);
    },
    setTradeAmount(value) {
      clearTradeOrderNotice();
      const cleanedAmount = String(value || "").replace(/[^0-9.]/g, "");
      tradeAmountPreview = cleanedAmount === "" ? "" : Math.max(0, Number(cleanedAmount || 0));
      if (tradeAmountPreview === "") localStorage.removeItem("AITradeX_TRADE_AMOUNT_PREVIEW");
      else localStorage.setItem("AITradeX_TRADE_AMOUNT_PREVIEW", String(tradeAmountPreview));
      updateTradeAmountPreviewDom();
    },
    setTradeLeverage(value) {
      clearTradeOrderNotice();
      tradeLeveragePreview = Math.max(1, Number(String(value).replace("x", "") || 1));
      localStorage.setItem("AITradeX_TRADE_LEVERAGE_PREVIEW", String(tradeLeveragePreview));
      render();
    },
    setMarket(market) {
      clearTradeOrderNotice();
      selectedMarket = market === "FOREX" ? "FOREX" : "CRYPTO";
      localStorage.setItem("AITradeX_SELECTED_MARKET", selectedMarket);
      const list = pairsForMarket();
      selectedPair = list[0].pair;
      localStorage.setItem("AITradeX_SELECTED_PAIR", selectedPair);
      selectorSheet = null;
      render();
    },
    selectPair(pair) {
      clearTradeOrderNotice();
      selectedPair = pair;
      const found = [...marketPairs.CRYPTO, ...marketPairs.FOREX].find(p => p.pair === pair);
      if (found) {
        selectedMarket = found.market;
        localStorage.setItem("AITradeX_SELECTED_MARKET", selectedMarket);
      }
      localStorage.setItem("AITradeX_SELECTED_PAIR", selectedPair);
      selectorSheet = null;
      render();
    },
    async placeManualTrade(side) {
      const u = user();
      if (!u) return;
      const settings = platformSettings();
      if (settings.maintenanceMode === true) { App.toast("Trading is paused during maintenance mode."); return; }
      if (settings.manualTradingEnabled === false) { App.toast("Manual trading is currently disabled by admin."); return; }
      if (!isTradeActivePair(selectedPair)) {
        App.toast("This market is coming soon. Crypto trading is active now.");
        return;
      }
      const margin = Number(tradeAmountPreview || 0);
      const leverage = Math.min(Number(settings.maxLeverage || 2000), Math.max(1, Number(tradeLeveragePreview || 1)));
      const normalizedSide = String(side || "BUY").toUpperCase() === "SELL" ? "SELL" : "BUY";
      const orderType = tradeOrderType === "LIMIT" ? "LIMIT" : "MARKET";

      if (!margin || margin <= 0) {
        App.toast("Enter valid margin amount.");
        return;
      }
      if (margin < Number(settings.minManualTrade || 100)) { App.toast(`Minimum manual trade is ${App.money(settings.minManualTrade || 100)}.`); return; }
      if (margin > Number(settings.maxManualTrade || 250000)) { App.toast(`Maximum manual trade is ${App.money(settings.maxManualTrade || 250000)}.`); return; }
      if (manualOpenPositions().filter(p => p.accountType === accountMode).length >= Number(settings.maxOpenPositionsPerUser || 10)) { App.toast(`Maximum ${Number(settings.maxOpenPositionsPerUser || 10)} open positions allowed per user.`); return; }
      const availableMargin = availableForNewManualTrade();
      if (margin > availableMargin) {
        App.toast(`Available manual margin is ${App.money(availableMargin)}. Close a position or reduce amount.`);
        return;
      }

      const tradeId = App.uid(orderType === "LIMIT" ? "lmt" : "trd");
      const pair = selectedPairData();
      const marketNow = visiblePairCardPrice(selectedPair) || normalizeTradePriceRow(selectedPair, App.getCachedPairPrice ? App.getCachedPairPrice(selectedPair) : null);

      if (App.isDatabaseMode?.() && window.AITradeXDB?.openManualTradeSecure) {
        try {
          let entryPrice = 0;
          let entryDisplay = "";
          let limitPrice = 0;
          let limitDisplay = "";
          let priceSource = marketNow?.source || pair.priceSource || "Live price cache";
          if (orderType === "LIMIT") {
            const limitPriceDisplayInput = Number(tradeLimitPrice || 0);
            limitPrice = limitInputToRaw(selectedPair, limitPriceDisplayInput);
            if (!Number.isFinite(limitPrice) || limitPrice <= 0) {
              App.toast("Enter valid limit price.");
              return;
            }
            limitDisplay = formatPairPrice(selectedPair, limitPrice);
            entryPrice = Number(marketNow?.rawPrice || marketNow?.price || pair.rawPrice || 0);
            entryDisplay = marketNow?.display || pair.price || "--";
            const directionError = limitOrderDirectionError(normalizedSide, limitPrice, entryPrice);
            if (directionError) { App.toast(directionError); return; }
          } else {
            let lockedPrice = visiblePairCardPrice(selectedPair);
            if (!lockedPrice) {
              try { lockedPrice = App.getLivePairPrice ? await App.getLivePairPrice(selectedPair) : null; }
              catch { lockedPrice = normalizeTradePriceRow(selectedPair, App.getCachedPairPrice ? App.getCachedPairPrice(selectedPair) : null); }
            }
            entryPrice = Number(lockedPrice?.rawPrice || lockedPrice?.price || pair.rawPrice || 0);
            if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
              App.toast("Live entry price unavailable. Please try again.");
              return;
            }
            entryDisplay = lockedPrice?.display || pair.price || String(entryPrice);
            priceSource = lockedPrice?.source || pair.priceSource || "Live price cache";
          }
          await window.AITradeXDB.openManualTradeSecure({
            tradeId,
            userId: u.id,
            accountType: normalizedAccountMode(accountMode),
            orderType,
            market: selectedMarket,
            pair: selectedPair,
            side: normalizedSide,
            margin,
            leverage,
            entryPrice,
            entryPriceDisplay: entryDisplay,
            limitPrice,
            limitPriceDisplay: limitDisplay,
            priceSource
          });
          try { await window.AITradeXDB.loadAll?.(); } catch {}
          resetTradeTicketAfterOrder(orderType === "LIMIT" ? "Limit order placed" : "Market order opened", orderType === "LIMIT" ? `${selectedPair} ${normalizedSide} limit placed at ${limitDisplay}.` : `${normalizedSide} ${selectedPair} opened at ${entryDisplay}.`);
          page = "positions";
          orderViewTab = orderType === "LIMIT" ? "PENDING" : "MANUAL";
          localStorage.setItem("AITradeX_ACTIVE_PAGE", page);
          localStorage.setItem("AITradeX_ORDER_VIEW_TAB", orderViewTab);
          render();
        } catch (error) {
          App.toast(error.message || "Manual trade could not be opened.");
        }
        return;
      }

      if (orderType === "LIMIT") {
        const limitPriceDisplayInput = Number(tradeLimitPrice || 0);
        const limitPrice = limitInputToRaw(selectedPair, limitPriceDisplayInput);
        if (!Number.isFinite(limitPrice) || limitPrice <= 0) {
          App.toast("Enter valid limit price.");
          return;
        }
        const currentForLimit = Number(marketNow?.rawPrice || marketNow?.price || pair.rawPrice || 0);
        const directionError = limitOrderDirectionError(normalizedSide, limitPrice, currentForLimit);
        if (directionError) { App.toast(directionError); return; }
        let limitLedgerRow = null;
        try {
          limitLedgerRow = App.isDatabaseMode?.() && App.addLedgerAsync ? await App.addLedgerAsync({
            userId: u.id,
            accountType: normalizedAccountMode(accountMode),
            type: "MANUAL_LIMIT_MARGIN_LOCK",
            amount: -margin,
            referenceId: tradeId,
            note: `${selectedPair} manual ${normalizedSide} limit margin locked`
          }) : App.addLedger({
            userId: u.id,
            accountType: normalizedAccountMode(accountMode),
            type: "MANUAL_LIMIT_MARGIN_LOCK",
            amount: -margin,
            referenceId: tradeId,
            note: `${selectedPair} manual ${normalizedSide} limit margin locked`
          });
        } catch (error) {
          App.toast(error.message || "Insufficient balance for this order.");
          return;
        }
        const order = {
          id: tradeId,
          userId: u.id,
          tradeType: "MANUAL",
          accountType: normalizedAccountMode(accountMode),
          orderType: "LIMIT",
          market: selectedMarket,
          pair: selectedPair,
          side: normalizedSide,
          limitPrice,
          limitPriceDisplay: formatPairPrice(selectedPair, limitPrice),
          currentPriceAtOrder: Number(marketNow?.rawPrice || marketNow?.price || pair.rawPrice || 0),
          currentPriceAtOrderDisplay: marketNow?.display || pair.price || "--",
          priceSource: marketNow?.source || pair.priceSource || "Live price cache",
          leverage,
          marginAmount: margin,
          marginLocked: true,
          positionSize: margin * leverage,
          pnl: 0,
          status: "LIMIT_PENDING",
          source: "USER_MANUAL_LIMIT",
          createdAt: new Date().toISOString(),
          createdDate: App.todayKey()
        };
        try { if (App.isDatabaseMode?.() && window.AITradeXDB?.writeTrade) await window.AITradeXDB.writeTrade(order); }
        catch (err) {
          if (limitLedgerRow) {
            try { await (App.addLedgerAsync ? App.addLedgerAsync({ userId: u.id, accountType: normalizedAccountMode(accountMode), type: "MANUAL_LIMIT_MARGIN_ROLLBACK", amount: margin, referenceId: `${tradeId}_rollback`, note: `Rollback: ${selectedPair} limit order save failed` }) : App.addLedger({ userId: u.id, accountType: normalizedAccountMode(accountMode), type: "MANUAL_LIMIT_MARGIN_ROLLBACK", amount: margin, referenceId: `${tradeId}_rollback`, note: `Rollback: ${selectedPair} limit order save failed` })); } catch {}
          }
          App.toast(`Trade save failed: ${err.message || err}`);
          return;
        }
        App.state.trades.unshift(order);
        App.saveState();
        resetTradeTicketAfterOrder("Limit order placed", `${selectedPair} ${normalizedSide} limit placed at ${order.limitPriceDisplay}.`);
        page = "positions";
        orderViewTab = "PENDING";
        localStorage.setItem("AITradeX_ACTIVE_PAGE", page);
        localStorage.setItem("AITradeX_ORDER_VIEW_TAB", orderViewTab);
        render();
        return;
      }

      let lockedPrice = visiblePairCardPrice(selectedPair);
      if (!lockedPrice) {
        try {
          lockedPrice = App.getLivePairPrice ? await App.getLivePairPrice(selectedPair) : null;
        } catch (error) {
          lockedPrice = normalizeTradePriceRow(selectedPair, App.getCachedPairPrice ? App.getCachedPairPrice(selectedPair) : null);
        }
      }
      const entryPrice = Number(lockedPrice?.rawPrice || lockedPrice?.price || pair.rawPrice || 0);
      if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
        App.toast("Live entry price unavailable. Please try again.");
        return;
      }
      let marketLedgerRow = null;
      try {
        marketLedgerRow = App.isDatabaseMode?.() && App.addLedgerAsync ? await App.addLedgerAsync({
          userId: u.id,
          accountType: normalizedAccountMode(accountMode),
          type: "MANUAL_TRADE_MARGIN_LOCK",
          amount: -margin,
          referenceId: tradeId,
          note: `${selectedPair} manual ${normalizedSide} margin locked`
        }) : App.addLedger({
          userId: u.id,
          accountType: normalizedAccountMode(accountMode),
          type: "MANUAL_TRADE_MARGIN_LOCK",
          amount: -margin,
          referenceId: tradeId,
          note: `${selectedPair} manual ${normalizedSide} margin locked`
        });
      } catch (error) {
        App.toast(error.message || "Insufficient balance for this trade.");
        return;
      }
      const trade = {
        id: tradeId,
        userId: u.id,
        tradeType: "MANUAL",
        accountType: normalizedAccountMode(accountMode),
        orderType: "MARKET",
        market: selectedMarket,
        pair: selectedPair,
        side: normalizedSide,
        entryPrice,
        entryPriceDisplay: lockedPrice?.display || pair.price || String(entryPrice),
        priceSource: lockedPrice?.source || pair.priceSource || "Live price cache",
        priceSourceType: lockedPrice?.sourceType || "LIVE_PRICE",
        priceLockedAt: lockedPrice?.fetchedAt || new Date().toISOString(),
        leverage,
        marginAmount: margin,
        marginLocked: true,
        positionSize: margin * leverage,
        pnl: 0,
        status: "OPEN",
        source: "USER_MANUAL",
        createdAt: new Date().toISOString(),
        createdDate: App.todayKey()
      };
        try { if (App.isDatabaseMode?.() && window.AITradeXDB?.writeTrade) await window.AITradeXDB.writeTrade(trade); }
      catch (err) {
        if (marketLedgerRow) {
          try { await (App.addLedgerAsync ? App.addLedgerAsync({ userId: u.id, accountType: normalizedAccountMode(accountMode), type: "MANUAL_TRADE_MARGIN_ROLLBACK", amount: margin, referenceId: `${tradeId}_rollback`, note: `Rollback: ${selectedPair} market trade save failed` }) : App.addLedger({ userId: u.id, accountType: normalizedAccountMode(accountMode), type: "MANUAL_TRADE_MARGIN_ROLLBACK", amount: margin, referenceId: `${tradeId}_rollback`, note: `Rollback: ${selectedPair} market trade save failed` })); } catch {}
        }
        App.toast(`Trade save failed: ${err.message || err}`);
        return;
      }
      App.state.trades.unshift(trade);
      App.saveState();
      resetTradeTicketAfterOrder("Market order opened", `${trade.side} ${selectedPair} opened at ${trade.entryPriceDisplay}.`);
      page = "positions";
      orderViewTab = "MANUAL";
      localStorage.setItem("AITradeX_ACTIVE_PAGE", page);
      localStorage.setItem("AITradeX_ORDER_VIEW_TAB", orderViewTab);
      render();
    },
    showAiManagedNotice() {
      App.toast("AI auto trades are managed by AI and cannot be closed manually.");
    },
    async closeManualLivePositions() {
      const positions = manualOpenPositions();
      if (!positions.length) {
        App.toast("No manual position is active.");
        return;
      }
      if (positions.length === 1) {
        try {
          await settleManualPosition(positions[0], "USER_CLOSE");
          App.toast("Manual position closed.");
          render();
        } catch (error) {
          App.toast(error.message || "Position close failed.");
        }
        return;
      }
      manualCloseSelectorOpen = true;
      render();
    },
    cancelManualCloseSelector() {
      manualCloseSelectorOpen = false;
      render();
    },
    async closeManualPositionById(positionId) {
      const target = manualOpenPositions().find(position => position.id === positionId);
      if (!target) {
        App.toast("Position not found.");
        manualCloseSelectorOpen = false;
        render();
        return;
      }
      try {
        await settleManualPosition(target, "USER_CLOSE");
        manualCloseSelectorOpen = false;
        App.toast("Manual position closed.");
        render();
      } catch (error) {
        App.toast(error.message || "Position close failed.");
      }
    },
    async cancelPendingOrder(orderId) {
      const target = pendingManualOrders().find(order => order.id === orderId);
      if (!target) {
        App.toast("Pending order not found.");
        render();
        return;
      }
      if (App.isDatabaseMode?.() && window.AITradeXDB?.cancelManualLimitSecure) {
        try {
          await window.AITradeXDB.cancelManualLimitSecure({ tradeId: target.id, userId: user().id });
          try { await window.AITradeXDB.loadAll?.(); } catch {}
          App.toast("Pending limit order cancelled.");
        } catch (err) {
          App.toast(err.message || "Unable to cancel pending order.");
        }
        render();
        return;
      }
      const margin = Math.max(0, Number(target.marginAmount || 0));
      const previous = { ...target };
      let releaseAdded = false;
      try {
        if (target.marginLocked && margin > 0) {
          const row = App.addLedgerAsync ? await App.addLedgerAsync({
            userId: user().id,
            accountType: normalizedAccountMode(target.accountType || accountMode),
            type: "MANUAL_LIMIT_MARGIN_RELEASE",
            amount: margin,
            referenceId: target.id,
            note: `${target.pair} manual ${target.side} limit order cancelled · margin released`
          }) : App.addLedger({
            userId: user().id,
            accountType: normalizedAccountMode(target.accountType || accountMode),
            type: "MANUAL_LIMIT_MARGIN_RELEASE",
            amount: margin,
            referenceId: target.id,
            note: `${target.pair} manual ${target.side} limit order cancelled · margin released`
          });
          releaseAdded = !!row;
          target.marginReleased = true;
        }
        target.status = "CANCELLED";
        target.cancelledAt = new Date().toISOString();
        if (App.isDatabaseMode?.() && window.AITradeXDB?.writeTrade) await window.AITradeXDB.writeTrade(target);
        App.saveState();
        App.toast("Pending limit order cancelled.");
      } catch (err) {
        if (releaseAdded && margin > 0) {
          try { await (App.addLedgerAsync ? App.addLedgerAsync({ userId: user().id, accountType: normalizedAccountMode(target.accountType || accountMode), type: "MANUAL_LIMIT_CANCEL_ROLLBACK", amount: -margin, referenceId: `${target.id}_cancel_rollback`, note: "Rollback: limit cancel save failed" }) : App.addLedger({ userId: user().id, accountType: normalizedAccountMode(target.accountType || accountMode), type: "MANUAL_LIMIT_CANCEL_ROLLBACK", amount: -margin, referenceId: `${target.id}_cancel_rollback`, note: "Rollback: limit cancel save failed" })); } catch {}
        }
        Object.assign(target, previous);
        App.toast(err.message || "Unable to cancel pending order.");
      }
      render();
    },
    async buyPlan(planId) {
      const u = user();
      const plan = App.planById(planId);
      if (!u || !plan) {
        App.toast("Plan not found.");
        return;
      }
      if (String(plan.status || "ACTIVE").toUpperCase() !== "ACTIVE") {
        App.toast("This plan is currently unavailable.");
        return;
      }
      const price = Math.max(0, Number(plan.price || 0));
      if (!price) {
        App.toast("Free plan is already available.");
        return;
      }
      if (App.realBalance(u.id) < price) {
        App.toast("Insufficient wallet balance. Please deposit funds first.");
        return;
      }
      const ok = confirm(`Buy ${plan.name} for ${App.money(price)} from your wallet?`);
      if (!ok) return;
      const subId = App.uid("sub");
      try {
        if (App.isDatabaseMode?.() && window.AITradeXDB?.purchasePlanSecure) {
          await window.AITradeXDB.purchasePlanSecure({ subscriptionId: subId, userId: u.id, planId: plan.id, source: "USER_PURCHASE" });
          // Referral subscription bonus is now credited inside the secure backend RPC.
          await window.AITradeXDB.loadAll?.();
        } else {
          const startedAt = new Date();
          const durationDays = Math.max(0, Number(plan.durationDays || 30));
          const expiresAt = durationDays ? new Date(startedAt.getTime() + durationDays * 86400000).toISOString() : "";
          await (App.addLedgerAsync ? App.addLedgerAsync({
            userId: u.id,
            accountType: "REAL",
            type: "SUBSCRIPTION_PURCHASE",
            amount: -price,
            referenceId: subId,
            note: `${plan.name} subscription purchased`
          }) : App.addLedger({
            userId: u.id,
            accountType: "REAL",
            type: "SUBSCRIPTION_PURCHASE",
            amount: -price,
            referenceId: subId,
            note: `${plan.name} subscription purchased`
          }));
          const changedSubscriptions = [];
          (App.state.subscriptions || []).forEach(row => {
            if (row.userId === u.id && row.status === "ACTIVE") {
              row.status = "REPLACED";
              row.replacedAt = new Date().toISOString();
              changedSubscriptions.push(row);
            }
          });
          if (!App.state.subscriptions) App.state.subscriptions = [];
          const newSubscription = {
            id: subId,
            userId: u.id,
            planId: plan.id,
            planName: plan.name,
            price,
            amount: price,
            aiTradeLimit: Number(plan.signals || 0),
            signals: Number(plan.signals || 0),
            durationDays,
            status: "ACTIVE",
            createdAt: startedAt.toISOString(),
            startsAt: startedAt.toISOString(),
            expiresAt,
            ledgerReferenceId: subId
          };
          App.state.subscriptions.unshift(newSubscription);
          App.saveState();
          const referralResult = await (App.creditReferralBonusAsync ? App.creditReferralBonusAsync({ referredUserId: u.id, eventType: "SUBSCRIPTION", amount: price, referenceId: subId, sourceLabel: plan.name }) : Promise.resolve(App.creditReferralBonus?.({ referredUserId: u.id, eventType: "SUBSCRIPTION", amount: price, referenceId: subId, sourceLabel: plan.name })));
          if (referralResult?.credited) console.info("Referral subscription bonus credited", referralResult);
        }
        App.toast(`${plan.name} activated successfully.`);
        render();
      } catch (error) {
        App.toast(error.message || "Unable to activate plan.");
      }
    },
    setManualHistoryPage(index) {
      const rows = tradeRows("MANUAL").filter(t => String(t.status || "").toUpperCase() === "CLOSED");
      const maxIndex = Math.max(0, rows.length - 1);
      manualHistoryPageIndex = Math.min(Math.max(0, Number(index || 0)), maxIndex);
      localStorage.setItem("AITradeX_MANUAL_HISTORY_PAGE", String(manualHistoryPageIndex));
      render();
    },
    setAiHistoryPage(index) {
      const rows = aiClosedRows();
      const maxIndex = Math.max(0, rows.length - 1);
      aiHistoryPageIndex = Math.min(Math.max(0, Number(index || 0)), maxIndex);
      localStorage.setItem("AITradeX_AI_HISTORY_PAGE", String(aiHistoryPageIndex));
      render();
    },
    setHistoryTab(tab) {
      historyViewTab = ["ALL", "MANUAL", "AI", "PROFIT", "LOSS"].includes(tab) ? tab : "ALL";
      historyPageIndex = 0;
      historyExpandedId = "";
      localStorage.setItem("AITradeX_HISTORY_VIEW_TAB", historyViewTab);
      localStorage.setItem("AITradeX_HISTORY_PAGE", "0");
      localStorage.removeItem("AITradeX_HISTORY_EXPANDED");
      render();
    },
    setHistorySearch(value) {
      historySearch = String(value || "");
      historyPageIndex = 0;
      historyExpandedId = "";
      localStorage.setItem("AITradeX_HISTORY_SEARCH", historySearch);
      localStorage.setItem("AITradeX_HISTORY_PAGE", "0");
      localStorage.removeItem("AITradeX_HISTORY_EXPANDED");
      render();
    },
    setHistoryPage(index) {
      const rows = historyFilteredRows();
      const maxIndex = Math.max(0, Math.ceil(rows.length / 5) - 1);
      historyPageIndex = Math.min(Math.max(0, Number(index || 0)), maxIndex);
      localStorage.setItem("AITradeX_HISTORY_PAGE", String(historyPageIndex));
      render();
    },
    toggleHistoryDetails(id) {
      historyExpandedId = historyExpandedId === id ? "" : String(id || "");
      if (historyExpandedId) localStorage.setItem("AITradeX_HISTORY_EXPANDED", historyExpandedId);
      else localStorage.removeItem("AITradeX_HISTORY_EXPANDED");
      render();
    },
    async setAutoPercent(value) {
      const u = user();
      autoPercent = Number(value);
      if (u) {
        u.aiTradePercent = autoPercent;
        try { if (App.isDatabaseMode?.() && window.AITradeXDB?.writeUser) await window.AITradeXDB.writeUser(u); } catch (err) { App.toast(`AI setting save failed: ${err.message || err}`); return; }
        App.saveState();
      }
      render();
    },
    async toggleAutoTrade() {
      const u = user();
      if (autoTradeOn) {
        aiOffConfirmOpen = true;
        render();
        return;
      }
      autoTradeOn = true;
      if (u) {
        u.aiTradeOn = true;
        if (!u.aiTradePercent) u.aiTradePercent = autoPercent || 75;
        try { if (App.isDatabaseMode?.() && window.AITradeXDB?.writeUser) await window.AITradeXDB.writeUser(u); } catch (err) { App.toast(`AI setting save failed: ${err.message || err}`); return; }
        App.saveState();
      }
      App.toast("AI Auto Trading turned on.");
      render();
    },
    cancelAiOffConfirm() {
      aiOffConfirmOpen = false;
      render();
    },
    async confirmAiOff() {
      const u = user();
      aiOffConfirmOpen = false;
      autoTradeOn = false;
      if (u) {
        u.aiTradeOn = false;
        if (!u.aiTradePercent) u.aiTradePercent = autoPercent || 75;
        try { if (App.isDatabaseMode?.() && window.AITradeXDB?.writeUser) await window.AITradeXDB.writeUser(u); } catch (err) { App.toast(`AI setting save failed: ${err.message || err}`); return; }
        App.saveState();
      }
      App.toast("AI Auto Trading turned off.");
      render();
    },
    async createSupportTicket(event) {
      event.preventDefault();
      const u = user();
      if (!u) return;
      const category = String(document.getElementById("supportCategory")?.value || "Other").trim();
      const subject = String(document.getElementById("supportSubject")?.value || "").trim();
      const message = String(document.getElementById("supportMessage")?.value || "").trim();
      if (!subject || !message) {
        App.toast("Subject and message required.");
        return;
      }
      App.state.supportTickets = App.state.supportTickets || [];
      const id = App.uid("ticket");
      const ticket = {
        id,
        userId: u.id,
        userName: displayName(),
        userEmail: u.email || "",
        userMobile: u.mobile || "",
        category,
        subject,
        message,
        status: "OPEN",
        replies: [],
        createdAt: App.now(),
        updatedAt: App.now()
      };
      App.state.supportTickets.unshift(ticket);
      if (App.isDatabaseMode?.() && window.AITradeXDB?.writeSupportTicket) {
        try { await window.AITradeXDB.writeSupportTicket(ticket); } catch (err) { App.toast(`Support ticket save failed: ${err.message || err}`); return; }
      }
      App.addNotification?.({ audience: "ADMIN", title: "New support ticket", message: `${displayName()} opened: ${subject}`, type: "SUPPORT", linkPage: "support", referenceId: id });
      App.saveState();
      App.toast("Support ticket submitted.");
      render();
    },
    extendSession() {
      if (App.touchSession && App.touchSession()) {
        App.toast("Session extended.");
        render();
      } else {
        App.toast("Session expired. Please login again.");
        App.clearSession();
        landing();
      }
    },
    async changePassword() {
      const u = user();
      if (!u) return;
      const current = document.getElementById("securityCurrentPassword")?.value || "";
      const next = document.getElementById("securityNewPassword")?.value || "";
      const confirm = document.getElementById("securityConfirmPassword")?.value || "";
      if (!window.AITradeXAuth?.verifyPassword) return App.toast("Secure password service is not loaded.");
      const verification = await window.AITradeXAuth.verifyPassword(u, current);
      if (!verification.ok) return App.toast("Current password is incorrect.");
      if (String(next).length < 4) return App.toast("New password must be at least 4 characters.");
      if (next !== confirm) return App.toast("New password confirmation does not match.");
      try {
        if (!window.AITradeXAuth?.setPassword) throw new Error("Secure password service is not loaded.");
        await window.AITradeXAuth.setPassword(u, next, { updatedBy: "user" });
        if (App.isDatabaseMode?.() && window.AITradeXDB?.writeUser) await window.AITradeXDB.writeUser(u);
      } catch (err) { App.toast(`Password save failed: ${err.message || err}`); return; }
      await App.addNotificationAsync?.({ audience: "USER", userId: u.id, title: "Password updated", message: "Your account password was changed successfully.", type: "SECURITY", linkPage: "security", referenceId: `password_${Date.now()}` });
      App.saveState();
      App.toast("Password updated successfully.");
      render();
    },
    async saveProfile() {
      const u = user();
      if (!u) return;

      const nameInput = document.getElementById("profileNameInput");
      const fileInput = document.getElementById("profileAvatarInput");
      const nextName = String(nameInput?.value || "").trim();

      if (!nextName) {
        App.toast("Display name required.");
        return;
      }

      u.name = nextName;

      const file = fileInput?.files?.[0];
      if (file) {
        try {
          App.toast("Uploading avatar...");
          const uploaded = await uploadStorageFile({ bucket: "user-avatars", folder: "avatars", label: "avatar", file });
          u.avatarName = uploaded.name;
          u.avatarBucket = uploaded.bucket;
          u.avatarPath = uploaded.path;
          u.avatarUrl = uploaded.url;
          u.avatarUploadedAt = uploaded.uploadedAt;
          try { if (App.isDatabaseMode?.() && window.AITradeXDB?.writeUser) await window.AITradeXDB.writeUser(u); } catch (err) { App.toast(`Profile database update failed: ${err.message || err}`); return; }
          App.saveState();
          App.toast("Profile updated.");
          render();
        } catch (err) {
          App.toast(`Avatar upload failed: ${err.message || err}`);
        }
      } else {
        try { if (App.isDatabaseMode?.() && window.AITradeXDB?.writeUser) await window.AITradeXDB.writeUser(u); } catch (err) { App.toast(`Profile database update failed: ${err.message || err}`); return; }
        App.saveState();
        App.toast("Profile updated.");
        render();
      }
    },
    logout() {
      App.clearSession();
      page = "home";
      drawerOpen = false;
      localStorage.removeItem("AITradeX_ACTIVE_PAGE");
      landing();
    }
  };

  async function bootUserApp(){
    try{
      if(localStorage.getItem("AITradeX_NATIVE_CHART_CLEAN_FORCE") !== "2"){
        localStorage.setItem("AITradeX_CHART_TOOLBAR", "false");
        localStorage.setItem("AITradeX_CHART_THEME", "dark");
        localStorage.setItem("AITradeX_NATIVE_CHART_CLEAN_FORCE", "2");
      }
      chartToolbar = false;
      App.clearOldUiCache?.();
      if(App.session?.userId && window.AITradeXDB?.ready){
        await window.AITradeXDB.loadAll();
      }
    }catch(err){ console.warn("AITradeX user boot DB load skipped", err?.message||err); }
    render();
    try{
      App.registerLiveSyncRenderer?.(()=>render(), "user");
      App.startLiveSync?.({role:"user"});
    }catch(err){ console.warn("User Live Sync Lite start skipped", err?.message||err); }
  }

  bootUserApp();
})();