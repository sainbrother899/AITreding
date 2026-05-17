const STORAGE_KEY = "ai_trading_static_v2";

const defaultState = {
  currentMode: "DEMO",
  demoBalance: 10000,
  realBalance: 0,
  tradesUsed: 0,
  signalsUsed: 0,
  freeSignalLimit: 5,
  plan: "Free",
  signal: "BUY",
  note: "Admin controlled signal. Educational simulator only.",
  trades: []
};

let state = loadState();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? { ...defaultState, ...saved } : { ...defaultState };
  } catch {
    return { ...defaultState };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function money(value) {
  return "$" + Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

function initTradingViewChart() {
  const container = document.getElementById("crypto_live_chart");
  if (!container) return;

  if (typeof TradingView === "undefined") {
    container.innerHTML = "<div style='padding:24px;color:#8fa3bf'>TradingView chart is loading. Check internet connection if it does not appear.</div>";
    return;
  }

  new TradingView.widget({
    autosize: true,
    symbol: "BINANCE:BTCUSDT",
    interval: "5",
    timezone: "Asia/Kolkata",
    theme: "dark",
    style: "1",
    locale: "en",
    enable_publishing: false,
    hide_side_toolbar: false,
    allow_symbol_change: true,
    container_id: "crypto_live_chart"
  });
}

function render() {
  document.getElementById("walletBalance").textContent =
    money(state.currentMode === "DEMO" ? state.demoBalance : state.realBalance);

  document.getElementById("tradeCounter").textContent = state.tradesUsed;
  document.getElementById("signalCounter").textContent = state.signalsUsed;

  document.getElementById("demoBtn").classList.toggle("active", state.currentMode === "DEMO");
  document.getElementById("realBtn").classList.toggle("active", state.currentMode === "REAL");

  const signalBox = document.getElementById("signalBox");
  const signalText = document.getElementById("aiSignalText");
  const signalNote = document.getElementById("signalNote");

  signalBox.className = "signal-box " + state.signal.toLowerCase();
  signalText.textContent = state.signal === "WAIT" ? "WAIT / NO TRADE" : `${state.signal} BTC NOW`;
  signalNote.textContent = state.note || defaultState.note;

  document.getElementById("adminSignal").value = state.signal;
  document.getElementById("adminNote").value = state.note;
  document.getElementById("adminFreeLimit").value = state.freeSignalLimit;

  renderTrades();
}

function renderTrades() {
  const table = document.getElementById("activeTradesLog");
  if (!state.trades.length) {
    table.innerHTML = `<tr><td colspan="6" class="empty">No active trades running currently.</td></tr>`;
    return;
  }

  table.innerHTML = state.trades.map(t => {
    const typeClass = t.type === "BUY" ? "buy-text" : t.type === "SELL" ? "sell-text" : "wait-text";
    const pnlClass = t.pnl >= 0 ? "pnl-plus" : "pnl-minus";
    return `
      <tr>
        <td>${t.coin}</td>
        <td class="${typeClass}">${t.type}</td>
        <td>${money(t.amount)}</td>
        <td>${money(t.entry)}</td>
        <td class="${pnlClass}">${t.pnl >= 0 ? "+" : ""}${money(t.pnl)}</td>
        <td>${t.status}</td>
      </tr>
    `;
  }).join("");
}

function switchMode(mode) {
  state.currentMode = mode;
  saveState();
  render();
  toast(`${mode} dashboard selected`);
}

function setAmountPct(pct) {
  const base = state.currentMode === "DEMO" ? state.demoBalance : state.realBalance;
  document.getElementById("tradeAmountInput").value = Math.max(1, Math.floor((base * pct) / 100));
}

function getSignalAllowance() {
  if (state.plan === "Elite") return Infinity;
  if (state.plan === "Pro") return 50;
  return Number(state.freeSignalLimit || 5);
}

function executeTrade() {
  if (state.signal === "WAIT") {
    toast("Admin signal is WAIT. Trade not executed.");
    return;
  }

  if (state.signalsUsed >= getSignalAllowance()) {
    toast("Free signal limit complete. Please upgrade subscription.");
    showPage("subscription");
    return;
  }

  if (state.tradesUsed >= 10) {
    toast("Today trade limit complete.");
    return;
  }

  const input = document.getElementById("tradeAmountInput");
  const amount = Number(input.value);
  const balance = state.currentMode === "DEMO" ? state.demoBalance : state.realBalance;

  if (!amount || amount <= 0 || amount > balance) {
    toast("Invalid amount or insufficient balance.");
    return;
  }

  if (state.currentMode === "DEMO") {
    state.demoBalance -= amount;
  } else {
    state.realBalance -= amount;
  }

  const fakeEntry = 64250 + Math.round((Math.random() - 0.5) * 900);
  const fakePnl = Math.round((Math.random() * 18 - 6) * amount) / 100;

  state.tradesUsed += 1;
  state.signalsUsed += 1;

  state.trades.unshift({
    coin: "BTCUSDT",
    type: state.signal,
    amount,
    entry: fakeEntry,
    pnl: fakePnl,
    status: "RUNNING"
  });

  saveState();
  render();
  toast("Simulated trade added.");
}

function saveAdminSettings() {
  state.signal = document.getElementById("adminSignal").value;
  state.note = document.getElementById("adminNote").value.trim() || defaultState.note;
  state.freeSignalLimit = Math.max(1, Number(document.getElementById("adminFreeLimit").value || 5));
  saveState();
  render();
  toast("Admin settings saved.");
  showPage("dashboard");
}

function activatePlan(plan) {
  state.plan = plan;
  saveState();
  toast(`${plan} UI activated`);
  render();
}

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active-page"));
  document.getElementById(pageId).classList.add("active-page");

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === pageId);
  });
}

function bindEvents() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => showPage(btn.dataset.page));
  });

  document.getElementById("demoBtn").addEventListener("click", () => switchMode("DEMO"));
  document.getElementById("realBtn").addEventListener("click", () => switchMode("REAL"));

  document.querySelectorAll(".quick-buttons button").forEach(btn => {
    btn.addEventListener("click", () => setAmountPct(Number(btn.dataset.pct)));
  });

  document.getElementById("executeTradeBtn").addEventListener("click", executeTrade);
  document.getElementById("saveAdminBtn").addEventListener("click", saveAdminSettings);

  document.querySelectorAll(".plan-btn").forEach(btn => {
    btn.addEventListener("click", () => activatePlan(btn.dataset.plan));
  });

  document.getElementById("clearTradesBtn").addEventListener("click", () => {
    state.trades = [];
    saveState();
    render();
    toast("Trade history cleared.");
  });
}

window.addEventListener("load", () => {
  bindEvents();
  render();
  initTradingViewChart();
});
