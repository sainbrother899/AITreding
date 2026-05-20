(() => {
  const App = window.AITradeX;
  const Auth = window.AITradeXAuth;
  const root = document.getElementById("app");

  let page = localStorage.getItem("AITradeX_ACTIVE_PAGE") || "home";
  let authMode = "login";
  let accountMode = localStorage.getItem("AITradeX_ACCOUNT_MODE") || "REAL";
  let drawerOpen = false;
  let autoPercent = Number(localStorage.getItem("AITradeX_AUTO_PERCENT") || 25);
  let autoTradeOn = localStorage.getItem("AITradeX_AUTO_ON") === "true";
  let selectedMarket = localStorage.getItem("AITradeX_SELECTED_MARKET") || "CRYPTO";
  let selectedPair = localStorage.getItem("AITradeX_SELECTED_PAIR") || "BTC/USDT";
  let tradeAmountPreview = Number(localStorage.getItem("AITradeX_TRADE_AMOUNT_PREVIEW") || 1000);
  let tradeLeveragePreview = Number(localStorage.getItem("AITradeX_TRADE_LEVERAGE_PREVIEW") || 10);
  let selectorSheet = null;
  let chartInterval = localStorage.getItem("AITradeX_CHART_INTERVAL") || "15";
  let chartStyle = localStorage.getItem("AITradeX_CHART_STYLE") || "1";
  let chartTheme = localStorage.getItem("AITradeX_CHART_THEME") || "dark";
  let chartToolbar = localStorage.getItem("AITradeX_CHART_TOOLBAR") !== "false";

  const marketPairs = {
    CRYPTO: [
      { market: "CRYPTO", pair: "BTC/USDT", symbol: "BINANCE:BTCUSDT", price: "$76,737.55", inr: "₹64,15,894", change: "+2.84%", mood: "up", signal: "BUY" },
      { market: "CRYPTO", pair: "ETH/USDT", symbol: "BINANCE:ETHUSDT", price: "$2,111.72", inr: "₹1,76,434", change: "-1.04%", mood: "down", signal: "SELL" },
      { market: "CRYPTO", pair: "BNB/USDT", symbol: "BINANCE:BNBUSDT", price: "$639.82", inr: "₹53,484", change: "+0.42%", mood: "up", signal: "BUY" },
      { market: "CRYPTO", pair: "SOL/USDT", symbol: "BINANCE:SOLUSDT", price: "$184.46", inr: "₹15,415", change: "+1.20%", mood: "up", signal: "BUY" },
      { market: "CRYPTO", pair: "XRP/USDT", symbol: "BINANCE:XRPUSDT", price: "$2.47", inr: "₹206", change: "+0.62%", mood: "up", signal: "BUY" },
      { market: "CRYPTO", pair: "DOGE/USDT", symbol: "BINANCE:DOGEUSDT", price: "$0.1732", inr: "₹14.47", change: "-0.88%", mood: "down", signal: "SELL" },
      { market: "CRYPTO", pair: "ADA/USDT", symbol: "BINANCE:ADAUSDT", price: "$0.58", inr: "₹48.44", change: "+0.31%", mood: "up", signal: "WAIT" },
      { market: "CRYPTO", pair: "TRX/USDT", symbol: "BINANCE:TRXUSDT", price: "$0.124", inr: "₹10.36", change: "-0.22%", mood: "down", signal: "WAIT" },
      { market: "CRYPTO", pair: "AVAX/USDT", symbol: "BINANCE:AVAXUSDT", price: "$36.72", inr: "₹3,068", change: "+1.72%", mood: "up", signal: "BUY" },
      { market: "CRYPTO", pair: "LINK/USDT", symbol: "BINANCE:LINKUSDT", price: "$15.41", inr: "₹1,288", change: "-0.44%", mood: "down", signal: "SELL" }
    ],
    FOREX: [
      { market: "FOREX", pair: "EUR/USD", symbol: "FX:EURUSD", price: "1.0854", inr: "Euro vs Dollar", change: "+0.18%", mood: "up", signal: "BUY" },
      { market: "FOREX", pair: "GBP/USD", symbol: "FX:GBPUSD", price: "1.2712", inr: "Pound vs Dollar", change: "-0.11%", mood: "down", signal: "SELL" },
      { market: "FOREX", pair: "USD/JPY", symbol: "FX:USDJPY", price: "156.84", inr: "Dollar vs Yen", change: "+0.32%", mood: "up", signal: "BUY" },
      { market: "FOREX", pair: "USD/CHF", symbol: "FX:USDCHF", price: "0.9041", inr: "Dollar vs Franc", change: "-0.09%", mood: "down", signal: "SELL" },
      { market: "FOREX", pair: "USD/CAD", symbol: "FX:USDCAD", price: "1.3682", inr: "Dollar vs CAD", change: "+0.06%", mood: "up", signal: "WAIT" },
      { market: "FOREX", pair: "AUD/USD", symbol: "FX:AUDUSD", price: "0.6648", inr: "Aussie vs Dollar", change: "+0.14%", mood: "up", signal: "BUY" },
      { market: "FOREX", pair: "NZD/USD", symbol: "FX:NZDUSD", price: "0.6121", inr: "Kiwi vs Dollar", change: "-0.21%", mood: "down", signal: "SELL" },
      { market: "FOREX", pair: "USD/INR", symbol: "FX_IDC:USDINR", price: "83.42", inr: "Dollar vs Rupee", change: "+0.05%", mood: "up", signal: "WAIT" },
      { market: "FOREX", pair: "EUR/INR", symbol: "FX_IDC:EURINR", price: "90.52", inr: "Euro vs Rupee", change: "+0.16%", mood: "up", signal: "BUY" },
      { market: "FOREX", pair: "GBP/INR", symbol: "FX_IDC:GBPINR", price: "106.04", inr: "Pound vs Rupee", change: "-0.07%", mood: "down", signal: "WAIT" },
      { market: "FOREX", pair: "XAU/USD", symbol: "OANDA:XAUUSD", price: "$2,421.80", inr: "Gold Spot", change: "+0.74%", mood: "up", signal: "BUY" },
      { market: "FOREX", pair: "XAG/USD", symbol: "OANDA:XAGUSD", price: "$31.28", inr: "Silver Spot", change: "-0.36%", mood: "down", signal: "SELL" }
    ]
  };

  function pairsForMarket() {
    return marketPairs[selectedMarket] || marketPairs.CRYPTO;
  }

  function allTrendingPairs() {
    return [...marketPairs.CRYPTO, ...marketPairs.FOREX];
  }

  function marketFeedForPair() {
    const pair = selectedPairData();
    const isForex = selectedMarket === "FOREX";
    const isMetal = pair.pair === "XAU/USD" || pair.pair === "XAG/USD";

    if (isMetal) {
      return [
        { left: "Bid", mid: pair.price, right: "0.02%", mood: "up" },
        { left: "Ask", mid: pair.price, right: "0.03%", mood: "up" },
        { left: "Volatility", mid: "High", right: pair.change, mood: pair.mood },
        { left: "Session", mid: "Global", right: "Active", mood: "up" }
      ];
    }

    if (isForex) {
      return [
        { left: "Bid", mid: pair.price, right: "0.01%", mood: "up" },
        { left: "Ask", mid: pair.price, right: "0.02%", mood: "up" },
        { left: "Spread", mid: "Tight", right: pair.change, mood: pair.mood },
        { left: "Session", mid: "FX", right: "Open", mood: "up" }
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
    const isForex = selectedMarket === "FOREX";
    const isMetal = pair.pair === "XAU/USD" || pair.pair === "XAG/USD";

    if (isMetal) {
      return [
        { pair: pair.pair, action: `${pair.pair.includes("XAU") ? "Gold" : "Silver"} momentum ${pair.signal}`, size: "₹25,000", lev: "20x", change: pair.change, mood: pair.mood, time: "Now" },
        { pair: pair.pair, action: "Volatility alert active", size: "₹18,500", lev: "10x", change: pair.mood === "up" ? "+0.24%" : "-0.24%", mood: pair.mood, time: "1m" },
        { pair: pair.pair, action: "AI entry zone forming", size: "₹12,000", lev: "50x", change: pair.mood === "up" ? "+0.18%" : "-0.18%", mood: pair.mood, time: "3m" },
        { pair: pair.pair, action: "Global session watch", size: "₹9,000", lev: "25x", change: pair.mood === "up" ? "+0.11%" : "-0.11%", mood: pair.mood, time: "5m" }
      ];
    }

    if (isForex) {
      return [
        { pair: pair.pair, action: `${pair.signal} setup forming`, size: "₹18,000", lev: "50x", change: pair.change, mood: pair.mood, time: "Now" },
        { pair: pair.pair, action: "Spread watch active", size: "₹12,000", lev: "25x", change: pair.mood === "up" ? "+0.09%" : "-0.09%", mood: pair.mood, time: "1m" },
        { pair: pair.pair, action: "Trend confirmation pending", size: "₹15,500", lev: "100x", change: pair.mood === "up" ? "+0.12%" : "-0.12%", mood: pair.mood, time: "3m" },
        { pair: pair.pair, action: "Currency strength alert", size: "₹8,500", lev: "20x", change: pair.mood === "up" ? "+0.06%" : "-0.06%", mood: pair.mood, time: "5m" }
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
    return accountMode === "DEMO" ? App.demoBalance(u.id) : App.realBalance(u.id);
  }

  function realBalance() {
    const u = user();
    return u ? App.realBalance(u.id) : 0;
  }

  function demoBalance() {
    const u = user();
    return u ? App.demoBalance(u.id) : 0;
  }

  function pnlValue() {
    const u = user();
    if (!u) return 0;
    return App.state.trades
      .filter(t => t.userId === u.id && t.accountType === accountMode && t.status === "CLOSED")
      .reduce((sum, t) => sum + Number(t.pnl || 0), 0);
  }

  function selectedPairData() {
    return pairsForMarket().find(p => p.pair === selectedPair) || pairsForMarket()[0];
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
            ${pairsForMarket().map(p => `
              <button class="${selectedPair === p.pair ? "active" : ""}" onclick="AITradeXUser.selectPair('${p.pair}')">
                <b>${p.pair}</b>
                <span>${p.price}</span>
                <em class="${changeClass(p.change)}">${p.change}</em>
              </button>
            `).join("")}
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
              <button class="${chartToolbar ? "active" : ""}" onclick="AITradeXUser.setChartToolbar(true)">Show</button>
              <button class="${!chartToolbar ? "active" : ""}" onclick="AITradeXUser.setChartToolbar(false)">Hide</button>
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
        hide_top_toolbar: !chartToolbar,
        hide_side_toolbar: !chartToolbar,
        allow_symbol_change: false,
        save_image: false,
        withdateranges: chartToolbar,
        calendar: false,
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
    const avatarData = u ? localStorage.getItem(`AITradeX_AVATAR_${u.id}`) : "";
    if (avatarData) {
      return `<span class="avatar image-avatar"><img src="${avatarData}" alt="Avatar"/></span>`;
    }
    return `<span class="avatar">${String(name || "A").trim().charAt(0).toUpperCase()}</span>`;
  }

  function displayName() {
    const u = user();
    if (!u) return "User";
    return localStorage.getItem(`AITradeX_DISPLAY_NAME_${u.id}`) || u.name || "User";
  }

  function profileNameChip() {
    return `<button class="profile-chip visible-profile" onclick="AITradeXUser.go('profile')"><b>${App.escapeHtml(displayName())}</b>${avatar(displayName())}</button>`;
  }

  function accountSwitch(compact = false) {
    return `
      <div class="account-segment ${compact ? "compact" : ""}" aria-label="Account mode">
        <button class="${accountMode === "REAL" ? "active" : ""}" onclick="AITradeXUser.setAccountMode('REAL')">Real</button>
        <button class="${accountMode === "DEMO" ? "active" : ""}" onclick="AITradeXUser.setAccountMode('DEMO')">Demo</button>
      </div>`;
  }

  function appHeader() {
    const u = user();
    return `
      <header class="app-topbar compact-header">
        <button class="menu-btn" onclick="AITradeXUser.toggleDrawer()">☰</button>
        <div class="app-brand">
          <b>AITradeX</b>
        </div>
        ${profileNameChip()}
      </header>
      ${drawerOpen ? menuDrawer() : ""}`;
  }

  function menuDrawer() {
    const u = user();
    return `
      <div class="drawer-backdrop" onclick="AITradeXUser.toggleDrawer(false)"></div>
      <aside class="side-drawer">
        <div class="drawer-head">
          ${avatar(displayName())}
          <div>
            <b>${App.escapeHtml(displayName() || "AITradeX User")}</b>
            <span>${accountMode} account active</span>
          </div>
        </div>
        <button onclick="AITradeXUser.go('profile')" class="drawer-item">👤 Profile</button>
        <button onclick="AITradeXUser.go('kyc')" class="drawer-item">🛡️ KYC Verification</button>
        <button onclick="AITradeXUser.go('payments')" class="drawer-item">💳 My Payment Methods</button>
        <button onclick="AITradeXUser.go('referral')" class="drawer-item">🎁 Referral</button>
        <button onclick="AITradeXUser.go('support')" class="drawer-item">🎧 Support</button>
        <button onclick="AITradeXUser.logout()" class="drawer-item danger">🚪 Logout</button>
      </aside>`;
  }

  function bottomNav() {
    const nav = [
      ["home", "⌂", "Home"],
      ["trade", "⇅", "Trade"],
      ["wallet", "▣", "Wallet"],
      ["pnl", "↗", "P/L"],
      ["history", "☰", "History"]
    ];
    return `
      <nav class="bottom-nav">
        ${nav.map(([key, icon, label]) => `
          <button class="${page === key ? "active" : ""}" onclick="AITradeXUser.go('${key}')">
            <i>${icon}</i><span>${label}</span>
          </button>`).join("")}
      </nav>`;
  }

  function shell(content) {
    root.innerHTML = `
      <div class="aitx-app">
        ${appHeader()}
        <main class="app-content">${content}</main>
        ${selectorSheetHtml()}
        ${bottomNav()}
      </div>`;
  }

  function landing() {
    root.innerHTML = `
      <main class="public-wrap">
        <nav class="public-nav">
          <div class="brand"><span>AI</span><b>AITradeX</b></div>
          <div class="public-actions">
            <a href="#plans">Plans</a>
            <a href="#security">Security</a>
            <button onclick="AITradeXUser.scrollAuth()" class="btn small">Get Started</button>
          </div>
        </nav>

        <section class="hero-section">
          <div class="hero-copy">
            <p class="eyebrow">AI Real Trading Platform</p>
            <h1>AI powered trading experience with secure INR wallet.</h1>
            <p class="hero-text">AITradeX combines a premium trading dashboard, TradingView style charts, real and demo account modes, KYC verification, subscriptions, referrals and a clean wallet ledger.</p>
            <div class="hero-buttons">
              <button onclick="AITradeXUser.scrollAuth()" class="btn">Create Account</button>
              <button onclick="AITradeXUser.setAuthMode('login')" class="btn ghost">User Login</button>
            </div>
            <div class="trust-pills"><span>KYC Verified</span><span>INR Wallet</span><span>Real + Demo</span></div>
          </div>

          <div class="hero-terminal">
            <div class="terminal-head"><div><span>BTC/USDT</span><strong>₹58,42,210</strong></div><em>+2.84%</em></div>
            <div class="fake-chart"></div>
            <div class="terminal-grid"><div><span>AI Signal</span><b>BUY</b></div><div><span>Leverage</span><b>2000x</b></div><div><span>Risk</span><b>Adaptive</b></div></div>
          </div>
        </section>

        <section id="plans" class="landing-grid">
          <article><i>💰</i><h3>Secure Wallet</h3><p>Deposit, withdrawal, pending funds and ledger-based balance.</p></article>
          <article><i>📈</i><h3>AI Trading</h3><p>Buy/Sell, pairs, amount, leverage up to 2000x, real and demo accounts.</p></article>
          <article><i>🤝</i><h3>Referral</h3><p>10% one-time commission only on first approved deposit.</p></article>
        </section>

        <section id="authBox" class="auth-section">
          <div class="auth-copy"><p class="eyebrow">User Access</p><h2>${authMode === "login" ? "Login to AITradeX" : "Create AITradeX account"}</h2><p>User panel is fully separate from the control center. No control wording is shown here.</p></div>
          <div class="auth-card">
            <div class="auth-tabs"><button class="${authMode === "login" ? "active" : ""}" onclick="AITradeXUser.setAuthMode('login')">Login</button><button class="${authMode === "register" ? "active" : ""}" onclick="AITradeXUser.setAuthMode('register')">Register</button></div>
            ${authMode === "login" ? loginForm() : registerForm()}
          </div>
        </section>

        <section id="security" class="security-note"><b>AITradeX Security:</b> KYC approval and verified payment methods help reduce fraud risk before withdrawals.</section>
      </main>`;
  }

  function loginForm() {
    return `<form onsubmit="AITradeXUser.login(event)" class="form-grid"><label>Email<input id="loginEmail" type="email" required placeholder="you@example.com"/></label><label>Password<input id="loginPassword" type="password" required placeholder="Password"/></label><button class="btn">Login</button></form>`;
  }

  function registerForm() {
    return `<form onsubmit="AITradeXUser.register(event)" class="form-grid"><label>Full Name<input id="regName" required placeholder="Your name"/></label><label>Email<input id="regEmail" type="email" required placeholder="you@example.com"/></label><label>Mobile<input id="regMobile" required placeholder="10 digit mobile"/></label><label>Password<input id="regPassword" type="password" required placeholder="Create password"/></label><label>Referral Code <small>Optional</small><input id="regReferral" placeholder="Referral code"/></label><button class="btn">Create Account</button></form>`;
  }

  function homePage() {
    const u = user();
    const balance = currentBalance();
    const pnl = pnlValue();
    const tradeAmount = balance * autoPercent / 100;
    const pair = selectedPairData();

    shell(`
      <section class="account-overview-card ${accountMode.toLowerCase()}">
        <div class="overview-top">
          <div>
            <p>${accountMode === "REAL" ? "REAL ACCOUNT" : "DEMO ACCOUNT"}</p>
            <h1>${App.money(balance)}</h1>
            <span>${accountMode === "REAL" ? "Available real equity" : "Practice balance for learning"}</span>
          </div>
          ${accountSwitch()}
        </div>
        <div class="overview-mini single-mode">
          <article><span>${accountMode === "REAL" ? "Real Wallet" : "Demo Wallet"}</span><b>${App.money(balance)}</b></article>
          <article><span>Today P/L</span><b class="${pnl >= 0 ? "profit-text" : "loss-text"}">${App.money(pnl)}</b></article>
          <article><span>Mode</span><b>${accountMode === "REAL" ? "Live" : "Practice"}</b></article>
        </div>
      </section>

      <section class="market-ticker">
        ${allTrendingPairs().map(p => `
          <article class="ticker-card ${p.mood} ${selectedPair === p.pair ? "selected" : ""}" onclick="AITradeXUser.selectPair('${p.pair}')">
            <div><h3>${p.pair}</h3><small>${p.inr}</small></div>
            <strong>${p.price}</strong>
            <span class="${changeClass(p.change)}">${p.change}</span>
          </article>`).join("")}
      </section>

      <section class="compact-grid">
        <article><span>AI Status</span><b>${autoTradeOn ? "Active" : "Ready"}</b><small>Signal engine</small></article>
        <article><span>Open Trades</span><b>0</b><small>${accountMode} positions</small></article>
        <article><span>KYC</span><b>${App.kycStatus(u.id).replace("_", " ")}</b><small>Verification</small></article>
        <article><span>Selected Pair</span><b>${selectedPair}</b><small>${pair.signal} bias</small></article>
      </section>

      <section class="premium-card live-signal-card">
        <div class="card-row">
          <div>
            <p>AI SIGNAL LIVE</p>
            <h2>${pair.signal} ${selectedPair}</h2>
            <h4>AI confidence is based on live market behaviour and selected account mode.</h4>
          </div>
          <div class="confidence-ring">82%</div>
        </div>
        <div class="signal-grid">
          <article><span>Entry</span><b>Market</b></article>
          <article><span>Target</span><b>Auto</b></article>
          <article><span>Stop Loss</span><b>Smart</b></article>
          <article><span>Expires</span><b>30m</b></article>
        </div>
      </section>

      <section class="premium-card auto-card">
        <div class="card-row">
          <div><p>AI TRADE CONTROL</p><h2>Auto Trade Amount</h2><h4>Choose how much ${accountMode} balance AI can use for future automatic trades.</h4></div>
          <button class="ai-power ${autoTradeOn ? "on" : ""}" onclick="AITradeXUser.toggleAutoTrade()">${autoTradeOn ? "ON" : "OFF"}</button>
        </div>
        <div class="percent-grid">
          ${[25, 50, 75, 100].map(v => `<button class="${autoPercent === v ? "active" : ""}" onclick="AITradeXUser.setAutoPercent(${v})">${v}%</button>`).join("")}
        </div>
        <div class="auto-summary">
          <article><span>Selected</span><b>${autoPercent}%</b></article>
          <article><span>AI Trade Amount</span><b>${App.money(tradeAmount)}</b></article>
        </div>
      </section>
    `);
  }

  function tradePage() {
    const pair = selectedPairData();
    const balance = currentBalance();
    const positionSize = tradeAmountPreview * tradeLeveragePreview;

    shell(`
      <section class="trade-command clean-pair-card">
        <div>
          <p>${selectedMarket} MARKET</p>
          <h1>${selectedPair}</h1>
          <span>${pair.price} · ${pair.inr} · <em class="${changeClass(pair.change)}">${pair.change}</em></span>
        </div>
        <button class="change-pair-btn" onclick="AITradeXUser.openSheet('pair')">Change Pair</button>
      </section>

      <section class="trade-select-bar app-selector-bar market-only-bar">
        <div class="market-switch">
          <button class="${selectedMarket === "CRYPTO" ? "active" : ""}" onclick="AITradeXUser.setMarket('CRYPTO')">Crypto</button>
          <button class="${selectedMarket === "FOREX" ? "active" : ""}" onclick="AITradeXUser.setMarket('FOREX')">Forex</button>
        </div>
      </section>

      <section class="pair-rate-list">
        ${pairsForMarket().map(p => `
          <button class="${selectedPair === p.pair ? "active" : ""}" onclick="AITradeXUser.selectPair('${p.pair}')">
            <b>${p.pair}</b>
            <span>${p.price}</span>
            <em class="${changeClass(p.change)}">${p.change}</em>
          </button>
        `).join("")}
      </section>

      <section class="chart-shell tradingview-shell">
        <div class="chart-toolbar working-timeframes">
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
        <div class="responsive-chart tradingview-widget-frame">
          <div id="tradingview_chart_container" class="tradingview-chart-container"></div>
        </div>
      </section>

      <section class="premium-card order-ticket pro-order-ticket">
        <div class="card-row">
          <div>
            <p>ORDER TICKET</p>
            <h2>Buy / Sell Order</h2>
            <span class="ticket-mode">${accountMode} account selected from Home</span>
          </div>
          <span class="ticket-chip">${selectedMarket}</span>
        </div>

        <div class="trade-account-mini ${accountMode.toLowerCase()}">
          <div><span>Account</span><b>${accountMode}</b></div>
          <div><span>Available</span><b>${App.money(balance)}</b></div>
        </div>

        <div class="form-row">
          <label>Order Type<select><option>Market</option><option>Limit</option></select></label>
          <div class="app-field">
            <span>Leverage</span>
            <button class="app-select-btn full" onclick="AITradeXUser.openSheet('leverage')">
              <b>${tradeLeveragePreview}x</b>
              <em>Change</em>
            </button>
          </div>
        </div>

        <label>Margin Amount
          <input type="number" value="${tradeAmountPreview}" min="1" oninput="AITradeXUser.setTradeAmount(this.value)" placeholder="Enter INR amount"/>
        </label>

        <div class="trade-preview-grid">
          <article><span>Available</span><b>${App.money(balance)}</b></article>
          <article><span>Margin</span><b>${App.money(tradeAmountPreview)}</b></article>
          <article><span>Leverage</span><b>${tradeLeveragePreview}x</b></article>
          <article><span>Position Size</span><b>${App.money(positionSize)}</b></article>
        </div>

        <div class="form-row">
          <label>Take Profit Optional<input placeholder="TP price"/></label>
          <label>Stop Loss Optional<input placeholder="SL price"/></label>
        </div>

        <div class="buy-sell-row">
          <button class="buy-btn">BUY / LONG</button>
          <button class="sell-btn">SELL / SHORT</button>
        </div>

        <div class="confirm-summary">
          <b>Order Summary</b>
          <span>${selectedMarket} · ${selectedPair} · ${accountMode} · Margin ${App.money(tradeAmountPreview)} · Position ${App.money(positionSize)}</span>
        </div>
      </section>

      <section class="premium-card market-feed-card">
        <div class="card-row">
          <div><p>MARKET FEED</p><h2>${selectedMarket === "CRYPTO" ? "Crypto Depth" : "Forex Bid / Ask"}</h2></div>
          <span class="mini-live">LIVE</span>
        </div>
        <div class="depth-table pair-market-feed">
          <span>Metric</span><span>Value</span><span>Signal</span>
          ${marketFeedForPair().map(row => `
            <b>${row.left}</b>
            <b>${row.mid}</b>
            <b class="${row.mood === "up" ? "profit-text" : "loss-text"}">${row.right}</b>
          `).join("")}
        </div>
      </section>

      <section class="premium-card trade-feed-card">
        <div class="card-row">
          <div><p>TRADE FEED</p><h2>${selectedPair} Activity</h2></div>
          <span class="history-mode">${selectedMarket}</span>
        </div>
        <div class="trade-feed-list">
          ${tradeFeedForMarket().map(item => `
            <article class="${item.pair === selectedPair ? "active" : ""}">
              <div>
                <b>${item.pair}</b>
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

      <section class="premium-card">
        <p>OPEN POSITIONS</p>
        <h2>Active ${accountMode} Trades</h2>
        <div class="empty-state">No active ${accountMode.toLowerCase()} positions yet.</div>
      </section>
    `);

    scheduleTradingViewChart();
  }
  function walletPage() {
    const u = user();
    const balance = currentBalance();

    shell(`
      <section class="wallet-hero-card ${accountMode.toLowerCase()}">
        <div class="card-row">
          <div><p>${accountMode} WALLET</p><h1>${accountMode === "REAL" ? "Real Wallet Equity" : "Demo Practice Equity"}</h1><span class="ticket-mode">Account mode selected from Home</span></div>
        </div>
        <strong>${App.money(balance)}</strong>
        <span>${accountMode === "REAL" ? "Deposits and withdrawals enabled" : "Practice wallet only"}</span>
      </section>

      <section class="wallet-grid">
        <article><span>Available Balance</span><b>${App.money(balance)}</b><p>${accountMode === "REAL" ? "Ready for trading" : "Practice trading"}</p></article>
        <article><span>Withdrawable</span><b>${accountMode === "REAL" ? App.money(realBalance()) : "Not available"}</b><p>${accountMode === "REAL" ? "After checks" : "Demo cannot withdraw"}</p></article>
        <article><span>Pending Deposit</span><b>${App.money(App.pendingDeposit(u.id))}</b><p>Waiting approval</p></article>
        <article><span>Pending Withdrawal</span><b>${App.money(App.pendingWithdrawal(u.id))}</b><p>Under review</p></article>
      </section>

      ${accountMode === "REAL" ? `
        <section class="wallet-actions">
          <button>Deposit</button><button>Withdrawal</button><button>History</button>
        </section>
        <section class="step-preview">
          <div><span>01</span><b>Amount</b></div>
          <div><span>02</span><b>UPI / Bank</b></div>
          <div><span>03</span><b>Pay with QR</b></div>
          <div><span>04</span><b>12-digit UTR</b></div>
        </section>
      ` : `
        <section class="premium-card"><p>DEMO WALLET</p><h2>Practice Mode</h2><div class="empty-state">Demo wallet is for learning. Deposit and withdrawal are available only in Real Account.</div></section>
      `}
    `);
  }

  function pnlPage() {
    const pnl = pnlValue();
    shell(`
      <section class="compact-grid">
        <article><span>Total Trades</span><b>0</b><small>${accountMode} trades</small></article>
        <article><span>Total P/L</span><b class="${pnl >= 0 ? "profit-text" : "loss-text"}">${App.money(pnl)}</b><small>Closed trades</small></article>
        <article><span>Win Rate</span><b>0%</b><small>Performance</small></article>
        <article><span>Referral Bonus</span><b>₹0</b><small>One-time credit</small></article>
      </section>
      <section class="premium-card"><p>P/L ANALYTICS</p><h2>Performance Overview</h2><div class="analytics-graph"><i></i></div></section>
    `);
  }

  function historyPage() {
    shell(`
      <section class="premium-card history-table-card">
        <div class="card-row">
          <div><p>AI TRADE HISTORY</p><h2>AI Auto Trades</h2></div>
          <span class="history-mode">${accountMode}</span>
        </div>
        <div class="trade-history-table">
          <span>Market</span><span>Pair</span><span>Side</span><span>Lev.</span><span>Amount</span><span>P/L</span><span>Status</span>
          <b>Crypto</b><b>BTC/USDT</b><b>BUY</b><b>10x</b><b>₹10,000</b><b class="profit-text">+₹0.00</b><b>Closed</b>
          <b>Forex</b><b>EUR/USD</b><b>SELL</b><b>5x</b><b>₹5,000</b><b class="loss-text">-₹0.00</b><b>Closed</b>
        </div>
      </section>

      <section class="premium-card history-table-card">
        <div class="card-row">
          <div><p>MANUAL TRADE HISTORY</p><h2>Your Buy/Sell Trades</h2></div>
          <span class="history-mode">${accountMode}</span>
        </div>
        <div class="trade-history-table">
          <span>Market</span><span>Pair</span><span>Side</span><span>Lev.</span><span>Amount</span><span>P/L</span><span>Status</span>
          <b>Crypto</b><b>BTC/USDT</b><b>BUY</b><b>20x</b><b>₹2,000</b><b class="profit-text">+₹0.00</b><b>Closed</b>
          <b>Forex</b><b>XAU/USD</b><b>SELL</b><b>50x</b><b>₹1,500</b><b class="loss-text">-₹0.00</b><b>Closed</b>
        </div>
        <div class="empty-state small-note">Wallet history stays inside Wallet page only.</div>
      </section>
    `);
  }

  function kycPage() {
    shell(`<section class="premium-card"><p>KYC VERIFICATION</p><h2>4 Step Verification</h2><div class="step-preview vertical"><div><span>01</span><b>Personal Details</b></div><div><span>02</span><b>ID Details</b></div><div><span>03</span><b>ID Card + Selfie Upload</b></div><div><span>04</span><b>Review & Submit</b></div></div></section>`);
  }

  function paymentPage() {
    shell(`<section class="premium-card"><p>PAYMENT METHODS</p><h2>My Payment Methods</h2><div class="empty-state">Holder name will auto-fill from approved KYC. Max 2 UPI and 2 Bank accounts.</div></section>`);
  }

  function referralPage() {
    const u = user();
    shell(`<section class="premium-card"><p>REFERRAL</p><h2>Invite & Earn</h2><div class="ref-code">${u.referralCode || "-"}</div><div class="empty-state">10% commission only on first approved deposit.</div></section>`);
  }

  function profilePage() {
    const u = user();
    const savedName = displayName();
    const avatarData = localStorage.getItem(`AITradeX_AVATAR_${u.id}`) || "";

    shell(`
      <section class="premium-card profile-editor-card">
        <p>PROFILE</p>
        <h2>Edit Profile</h2>

        <div class="profile-preview">
          ${avatar(savedName)}
          <div>
            <b>${App.escapeHtml(savedName)}</b>
            <span>${App.escapeHtml(u.email)}</span>
          </div>
        </div>

        <div class="profile-form">
          <label>Display Name<input id="profileNameInput" value="${App.escapeHtml(savedName)}" placeholder="Your display name"/></label>
          <label>Avatar Image<input id="profileAvatarInput" type="file" accept="image/*"/></label>
          <button class="save-profile-btn" onclick="AITradeXUser.saveProfile()">Save Profile</button>
        </div>

        <div class="profile-note">
          Avatar अभी browser में save होगा. बाद में इसे Supabase Storage से connect करेंगे.
        </div>
      </section>

      <section class="premium-card">
        <p>ACCOUNT DETAILS</p>
        <h2>Basic Information</h2>
        <div class="profile-info-grid">
          <article><span>Email</span><b>${App.escapeHtml(u.email)}</b></article>
          <article><span>Mobile</span><b>${App.escapeHtml(u.mobile || "-")}</b></article>
          <article><span>Account Mode</span><b>${accountMode}</b></article>
          <article><span>Referral Code</span><b>${App.escapeHtml(u.referralCode || "-")}</b></article>
        </div>
      </section>
    `);
  }

  function supportPage() {
    shell(`<section class="premium-card"><p>SUPPORT</p><h2>Help Center</h2><div class="empty-state">Support tickets will be connected later.</div></section>`);
  }

  function render() {
    ensurePairForMarket();
    const u = user();
    if (!u || u.role !== "user") return landing();

    if (page === "home") return homePage();
    if (page === "trade") return tradePage();
    if (page === "wallet") return walletPage();
    if (page === "pnl") return pnlPage();
    if (page === "history") return historyPage();
    if (page === "kyc") return kycPage();
    if (page === "payments") return paymentPage();
    if (page === "referral") return referralPage();
    if (page === "profile") return profilePage();
    if (page === "support") return supportPage();
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
    register(event) {
      event.preventDefault();
      try {
        Auth.registerUser({
          name: regName.value,
          email: regEmail.value,
          mobile: regMobile.value,
          password: regPassword.value,
          referralCode: regReferral.value.trim()
        });
        page = "home";
        localStorage.setItem("AITradeX_ACTIVE_PAGE", page);
        App.toast("Account created successfully.");
        render();
      } catch (err) {
        App.toast(err.message);
      }
    },
    login(event) {
      event.preventDefault();
      try {
        Auth.loginUser({ email: loginEmail.value, password: loginPassword.value });
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
    toggleDrawer(force) {
      drawerOpen = typeof force === "boolean" ? force : !drawerOpen;
      render();
    },
    setAccountMode(mode) {
      accountMode = mode === "DEMO" ? "DEMO" : "REAL";
      localStorage.setItem("AITradeX_ACCOUNT_MODE", accountMode);
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
    setTradeAmount(value) {
      tradeAmountPreview = Math.max(0, Number(value || 0));
      localStorage.setItem("AITradeX_TRADE_AMOUNT_PREVIEW", String(tradeAmountPreview));
      render();
    },
    setTradeLeverage(value) {
      tradeLeveragePreview = Math.max(1, Number(String(value).replace("x", "") || 1));
      localStorage.setItem("AITradeX_TRADE_LEVERAGE_PREVIEW", String(tradeLeveragePreview));
      render();
    },
    setMarket(market) {
      selectedMarket = market === "FOREX" ? "FOREX" : "CRYPTO";
      localStorage.setItem("AITradeX_SELECTED_MARKET", selectedMarket);
      const list = pairsForMarket();
      selectedPair = list[0].pair;
      localStorage.setItem("AITradeX_SELECTED_PAIR", selectedPair);
      selectorSheet = null;
      render();
    },
    selectPair(pair) {
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
    setAutoPercent(value) {
      autoPercent = Number(value);
      localStorage.setItem("AITradeX_AUTO_PERCENT", autoPercent);
      render();
    },
    toggleAutoTrade() {
      autoTradeOn = !autoTradeOn;
      localStorage.setItem("AITradeX_AUTO_ON", String(autoTradeOn));
      render();
    },
    saveProfile() {
      const u = user();
      if (!u) return;

      const nameInput = document.getElementById("profileNameInput");
      const fileInput = document.getElementById("profileAvatarInput");
      const nextName = String(nameInput?.value || "").trim();

      if (!nextName) {
        App.toast("Display name required.");
        return;
      }

      localStorage.setItem(`AITradeX_DISPLAY_NAME_${u.id}`, nextName);

      const file = fileInput?.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          localStorage.setItem(`AITradeX_AVATAR_${u.id}`, reader.result);
          App.toast("Profile updated.");
          render();
        };
        reader.readAsDataURL(file);
      } else {
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

  render();
})();