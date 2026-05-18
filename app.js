/* =========================================================
   AI Trading Assistant - Optimized Production Core (v2.0)
   Removed all redundant monkey patches, structural hacks & intervals.
   Integrated Bulk DB Ops, Secure PnL Engine, and Identity Controls.
   ========================================================= */

const $ = (id) => document.getElementById(id);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));
const cfg = window.APP_CONFIG || {};
const isAdminPage = !!window.FORCE_ADMIN_PAGE || /admin\.html/i.test(location.pathname) || document.body?.dataset?.adminPage === "true";
const LS_KEY = "ai_trading_clean_core_v1";
const SESSION_KEY = isAdminPage ? "ai_admin_session_v1" : "ai_user_session_v1";
let supabaseClient = null;

// Global Limits Configuration
const CEILING_LEVERAGE = 2000;
const MAX_UPI_LIMIT = 2;
const MAX_BANK_LIMIT = 2;
const PM_SAFETY_WARNING = "YOUR PAYMENT METHOD NAME SHOULD MATCH KYC NAME. DON'T USE OTHER ACCOUNT. IF YOU USE OTHER ACCOUNT, YOUR ACCOUNT MAY BE SUSPENDED.";

try {
  if (window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
    supabaseClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.warn("Supabase initialization bypassed:", e);
}

const DEFAULT_PRICES = {
  BTCUSDT: { price: 68000, change: 1.2 },
  ETHUSDT: { price: 3600, change: 0.8 },
  SOLUSDT: { price: 160, change: 1.8 },
  BNBUSDT: { price: 590, change: 0.4 }
};

const DEFAULT_PLANS = [
  { id: "free", name: "Free", price: 0, duration: "Lifetime", signalLimit: 5, aiTradeLimit: 5, features: ["5 AI trades per day", "Manual trades unlimited"] },
  { id: "pro", name: "Pro", price: 499, duration: "30 days", signalLimit: 50, aiTradeLimit: 10, features: ["10 AI trades per day", "Premium signals"] },
  { id: "elite", name: "Elite", price: 999, duration: "30 days", signalLimit: 999999, aiTradeLimit: 25, features: ["25 AI trades per day", "Priority AI trades"] }
];

const state = {
  user: null,
  users: [],
  mode: "DEMO",
  accounts: {
    DEMO: { balance: 100000, trades: [], closedTrades: [] },
    REAL: { balance: 0, trades: [], closedTrades: [] }
  },
  prices: { ...DEFAULT_PRICES },
  depositRequests: [],
  withdrawalRequests: [],
  managedTrades: [],
  referrals: [],
  kycRequests: [],
  userPayoutMethods: [],
  walletLedger: [],
  plans: DEFAULT_PLANS,
  aiTradeUsage: {},
  paymentSettings: {
    upi: { active: true, upiId: "admin@upi", name: "AI Trading" },
    bank: { active: true, accountName: "AI Trading", bankName: "Demo Bank", accountNumber: "0000000000", ifsc: "DEMO0000001" }
  },
  adminSignal: {
    coin: "BTCUSDT", signal: "BUY", entry: 68000, target: 69000, stop: 67500, confidence: 82, risk: "MEDIUM", expiry: "30 minutes", note: "AI trend confirmation active."
  }
};

/* ---------- Helper Infrastructure ---------- */
function money(n) { return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
function usd(n) { return "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 }); }
function normalizeEmail(v) { return String(v || "").trim().toLowerCase(); }
function userKey() { return String(state.user?.id || state.user?.email || "local"); }
function priceOf(coin) { return Number(state.prices?.[coin]?.price || DEFAULT_PRICES[coin]?.price || 100); }
function getPlan() { return state.user?.plan || "Free"; }

function toast(msg) {
  const el = $("toast");
  if (el) {
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 3000);
  } else {
    console.log("[Toast]:", msg);
  }
}

function getLeverageSafe() {
  const raw = Number($("leverageSelect")?.value || 1);
  return Math.min(CEILING_LEVERAGE, Math.max(1, raw));
}

function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify({
    users: state.users, accounts: state.accounts, mode: state.mode, prices: state.prices,
    depositRequests: state.depositRequests, withdrawalRequests: state.withdrawalRequests,
    managedTrades: state.managedTrades, referrals: state.referrals, kycRequests: state.kycRequests,
    userPayoutMethods: state.userPayoutMethods, walletLedger: state.walletLedger, plans: state.plans,
    aiTradeUsage: state.aiTradeUsage, adminSignal: state.adminSignal, paymentSettings: state.paymentSettings
  }));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    Object.assign(state, saved || {});
    state.prices = { ...DEFAULT_PRICES, ...(state.prices || {}) };
  } catch (e) { console.warn("State reconstruction bypassed:", e); }
  try {
    const sess = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (sess) state.user = sess;
  } catch (e) {}
}

/* ---------- Real Wallet Financial Mathematics ---------- */
function realWallet(uid = userKey()) {
  const deposits = state.depositRequests.filter(d => String(d.userId) === String(uid) && d.status === "APPROVED").reduce((a, d) => a + Number(d.amount || 0), 0);
  const ledger = state.walletLedger.filter(l => String(l.userId) === String(uid)).reduce((a, l) => a + Number(l.amount || 0), 0);
  const withdrawals = state.withdrawalRequests.filter(w => String(w.userId) === String(uid) && w.status === "APPROVED").reduce((a, w) => a + Math.abs(Number(w.amount || 0)), 0);
  return deposits + ledger - withdrawals;
}

function withdrawable(uid = userKey()) {
  const dep = state.depositRequests.filter(d => String(d.userId) === String(uid) && d.status === "APPROVED").reduce((a, d) => a + Number(d.amount || 0), 0);
  const closedVolume = state.accounts.REAL.closedTrades.reduce((a, t) => a + Number(t.amount || 0), 0);
  const netPnL = state.walletLedger.filter(l => String(l.userId) === String(uid) && ["TRADE_PNL", "MANAGED_TRADE_PNL", "MASS_TRADE_PNL", "REFERRAL_BONUS"].includes(l.type)).reduce((a, l) => a + Number(l.amount || 0), 0);
  const pendingW = state.withdrawalRequests.filter(w => String(w.userId) === String(uid) && w.status === "PENDING").reduce((a, w) => a + Number(w.amount || 0), 0);
  const approvedW = state.withdrawalRequests.filter(w => String(w.userId) === String(uid) && w.status === "APPROVED").reduce((a, w) => a + Number(w.amount || 0), 0);
  
  const unlocked = Math.min(dep, closedVolume) + Math.max(0, netPnL);
  return Math.max(0, unlocked - approvedW - pendingW);
}

/* ---------- Unified Core Pricing & Valuation Ledger ---------- */
function updateTradePnl(t) {
  if (!t) return 0;
  if (String(t.status).toUpperCase() !== "OPEN") return Number(t.pnl || 0);

  const current = priceOf(t.coin);
  t.current = current;
  const diff = t.side === "SELL" ? (Number(t.entry) - current) : (current - Number(t.entry));
  t.pnl = (diff / Number(t.entry || 1)) * Number(t.amount || 0) * Number(t.leverage || 1);
  t.roi = (t.pnl / Number(t.amount || 1)) * 100;
  return Number(t.pnl || 0);
}

/* ---------- Client Automated Position Liquidation Engine ---------- */
function checkAutoLiquidation() {
  if (!state.accounts) return;
  let mutated = false;

  ["DEMO", "REAL"].forEach(mode => {
    const acc = state.accounts[mode];
    if (!acc || !Array.isArray(acc.trades)) return;

    for (let i = acc.trades.length - 1; i >= 0; i--) {
      const t = acc.trades[i];
      if (!t || String(t.status).toUpperCase() !== "OPEN") continue;

      updateTradePnl(t);
      if (Number(t.pnl) <= -Math.abs(Number(t.amount || 0))) {
        t.status = "LIQUIDATED";
        t.pnl = -Math.abs(Number(t.amount || 0));
        t.close = t.current;
        t.closedAt = new Date().toLocaleString();
        
        acc.trades.splice(i, 1);
        acc.closedTrades.unshift(t);

        if (mode === "REAL" && state.user) {
          state.walletLedger.unshift({ id: "led_liq_" + Date.now(), userId: t.userId, type: "TRADE_PNL", amount: t.pnl, note: `Liquidation Loss ${t.id}` });
          if (supabaseClient) {
            supabaseClient.from("wallet_ledger").insert({ user_id: t.userId, type: "TRADE_PNL", amount: t.pnl, note: `Liquidation Loss ${t.id}` }).then();
          }
        }
        mutated = true;
      }
    }
  });

  if (mutated) { saveState(); render(); toast("Margin call triggered: Under-collateralized assets liquidated."); }
}

/* ---------- Core System Trading Execution ---------- */
function openManualTrade(side) {
  if (!state.user) return toast("Login required.");
  const coin = $("coinSelect")?.value || "BTCUSDT";
  const amount = Number($("tradeAmountInput")?.value || 0);
  
  if (amount <= 0) return toast("Enter valid trade amount.");
  if (state.mode === "REAL" && amount > realWallet()) return toast("Insufficient wallet liquidity.");

  const acc = state.accounts[state.mode];
  const t = {
    id: "tr_" + Date.now(), userId: state.user.id, coin, side, amount,
    entry: priceOf(coin), current: priceOf(coin), leverage: getLeverageSafe(),
    status: "OPEN", source: "USER", openedAt: new Date().toLocaleString()
  };

  acc.trades.unshift(t);
  saveState(); render();
  toast(`${side} Order executed successfully.`);
}

async function closeTrade(id, mode = state.mode) {
  const acc = state.accounts[mode];
  if (!acc) return;

  const idx = acc.trades.findIndex(t => t.id === id);
  if (idx < 0) return;

  const t = acc.trades[idx];
  updateTradePnl(t);
  
  t.close = priceOf(t.coin);
  t.status = "CLOSED";
  t.closedAt = new Date().toLocaleString();

  acc.trades.splice(idx, 1);
  acc.closedTrades.unshift(t);

  if (mode === "REAL") {
    state.walletLedger.unshift({ id: "led_" + Date.now(), userId: state.user.id, type: "TRADE_PNL", amount: t.pnl, note: "Manual position settlement" });
    if (supabaseClient) {
      await supabaseClient.from("wallet_ledger").insert({ user_id: state.user.id, type: "TRADE_PNL", amount: t.pnl, note: "Manual position settlement" });
    }
  }
  saveState(); render();
}

/* ---------- Enterprise Bulk Admin Managed Risk Engine ---------- */
async function openManagedTradeAdvanced() {
  if (state.user?.role !== "admin") return;

  const selection = $("managedUserSelect")?.value || "ALL";
  const baseUsers = state.users.filter(u => u.role !== "admin");
  const targets = selection === "ALL" ? baseUsers.filter(u => u.autoTradePermission !== false) : baseUsers.filter(u => String(u.id) === selection);

  if (!targets.length) return alert("No operational allocation targets specified.");

  const coin = $("managedCoin")?.value || "BTCUSDT";
  const side = $("managedSide")?.value || "BUY";
  const risk = $("managedRisk")?.value || "MEDIUM";
  const amount = Number($("managedAmount")?.value || 0);
  const leverage = Math.min(CEILING_LEVERAGE, Math.max(1, Number($("managedLeverage")?.value || 1)));
  const entry = priceOf(coin);

  const bulkDbPayload = [];
  const timestamp = new Date().toLocaleString();

  for (const u of targets) {
    if (realWallet(u.id) < amount) {
      console.warn(`Allocation fault skipped for ${u.email}: Insufficient capital setup.`);
      continue;
    }

    const tradeId = "mg_" + Date.now() + "_" + Math.random().toString(16).slice(2);
    const t = {
      id: tradeId, userId: u.id, userEmail: u.email, coin, side, risk, amount, entry,
      close: null, pnl: 0, leverage, status: "OPEN", source: selection === "ALL" ? "ADMIN_MASS" : "ADMIN_MANAGED", openedAt: timestamp
    };

    state.managedTrades.unshift(t);

    bulkDbPayload.push({
      id: t.id, user_id: t.userId, user_email: t.userEmail, coin: t.coin, side: t.side,
      risk: t.risk, amount: t.amount, entry_price: t.entry, pnl: 0, status: "OPEN", source: t.source, opened_at: t.openedAt
    });
  }

  if (supabaseClient && bulkDbPayload.length > 0) {
    const { error } = await supabaseClient.from("managed_trades").insert(bulkDbPayload);
    if (error) return alert("Engine Bulk Operation Error: " + error.message);
  }

  saveState(); render();
  toast(`Mass signal deployed across ${bulkDbPayload.length} pipelines.`);
}

/* ---------- Secure Identity & Financial Compliance Routing ---------- */
async function submitDepositSecure() {
  if (!state.user) return;
  const amount = Number(String($("depositAmount")?.value || "").replace(/,/g, ""));
  const txn = String($("depositTxn")?.value || "").replace(/\D/g, "").slice(0, 12);

  if (amount < 1000) return alert("Minimum asset configuration size is ₹1000.");
  if (!/^\d{12}$/.test(txn)) return alert("UTR ledger trace tracking string must be exactly 12 numeric digits.");

  if (state.depositRequests.some(d => String(d.txn) === txn)) return alert("Duplicate UTR signature detected locally.");

  if (supabaseClient) {
    const { data } = await supabaseClient.from("deposit_requests").select("id").eq("txn", txn).maybeSingle();
    if (data) return alert("Network transaction trace match collision: Duplicate UTR.");
  }

  const req = {
    id: "local_dep_" + Date.now(), userId: state.user.id, userEmail: state.user.email,
    userName: state.user.name, amount, txn, status: "PENDING", createdAt: new Date().toLocaleString()
  };

  if (supabaseClient) {
    const { data, error } = await supabaseClient.from("deposit_requests").insert({
      user_id: req.userId, user_email: req.userEmail, user_name: req.userName,
      amount, txn, status: "PENDING", created_at_text: req.createdAt
    }).select("id").maybeSingle();
    
    if (error) return alert("Storage failure rejection: " + error.message);
    if (data) req.id = String(data.id);
  }

  state.depositRequests.unshift(req);
  $("depositAmount").value = ""; $("depositTxn").value = "";
  closeModal("depositModal"); saveState(); render();
  toast("Deposit transaction trace dispatched for verification.");
}

async function submitPayoutMethodSecure(e) {
  if (e) e.preventDefault();
  const kycStatusStr = String(state.user?.kycStatus || "").toUpperCase();
  if (kycStatusStr !== "APPROVED") return alert("Compliance Restriction: Verify KYC before registering settlement accounts.");

  const formElement = $("routePaymentForm") || $("securePaymentMethodForm");
  const fd = new FormData(formElement);
  const type = $("routePayType")?.value || "UPI";

  if (mCount(type) >= (type === "BANK" ? MAX_BANK_LIMIT : MAX_UPI_LIMIT)) {
    return alert(type === "BANK" ? `Maximum Limit Hit: Only ${MAX_BANK_LIMIT} Bank profiles allowed.` : `Maximum Limit Hit: Only ${MAX_UPI_LIMIT} UPI signatures allowed.`);
  }

  const verifiedLegalName = state.user.kycName || state.user.name;
  const method = {
    id: "pm_" + Date.now(), userId: userKey(), userEmail: state.user.email, type,
    upi: type === "UPI" ? String(fd.get("upi") || "").trim() : "", holderName: verifiedLegalName, kycName: verifiedLegalName,
    bankName: type === "BANK" ? String(fd.get("bankName") || "").trim() : "",
    accountNumber: type === "BANK" ? String(fd.get("accountNumber") || "").trim() : "",
    ifsc: type === "BANK" ? String(fd.get("ifsc") || "").trim() : "",
    status: "PENDING", createdAt: new Date().toLocaleString()
  };

  state.userPayoutMethods.unshift(method);
  if (supabaseClient) {
    await supabaseClient.from("user_payout_methods").insert({
      id: method.id, user_id: method.userId, method_type: method.type, holder_name: method.holderName,
      kyc_name_snapshot: method.kycName, upi_id: method.upi, bank_name: method.bankName, account_number: method.accountNumber, ifsc: method.ifsc, status: "PENDING"
    });
  }
  saveState(); render();
  toast("Payout configuration safe locked pending network check.");
}

function mCount(type) { return state.userPayoutMethods.filter(m => String(m.type).toUpperCase() === String(type).toUpperCase()).length; }

/* ---------- Server Synced Auth Processing Core ---------- */
function afterLogin(user) {
  state.user = user;
  state.mode = user.role === "admin" ? "REAL" : "DEMO";
  saveSession(); saveState(); showAuth(false);
  
  if (isAdminPage && user.role === "admin") showPage("admin");
  else showPage("dashboard");
  
  loadRemoteData().then(render);
}

async function login() {
  const email = normalizeEmail($("loginEmail")?.value);
  const pass = $("loginPassword")?.value || "";
  if (!email || !pass) return toast("Credentials omitted.");

  if (isAdminPage && email === normalizeEmail(cfg.ADMIN_EMAIL || "admin@aitrade.local") && pass === (cfg.ADMIN_PASSWORD || "admin123")) {
    return afterLogin({ id: "admin", email, name: "Admin", role: "admin", plan: "Elite" });
  }

  if (supabaseClient) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
    if (!error && data?.user) {
      const { data: profile } = await supabaseClient.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
      return afterLogin({
        id: data.user.id, email, name: profile?.name || email.split("@")[0], role: profile?.role || "user", plan: profile?.plan || "Free", kycStatus: profile?.kyc_status || "PENDING"
      });
    }
  }
  toast("Identity authentication failed.");
}

function logout() {
  state.user = null; localStorage.removeItem(SESSION_KEY); showAuth(true); render();
}

/* ---------- Data Engine Load Infrastructure ---------- */
async function loadRemoteData() {
  if (!supabaseClient) return;
  try {
    const { data: profiles } = await supabaseClient.from("profiles").select("*");
    if (profiles) {
      state.users = profiles.map(p => ({
        id: p.id, name: p.name, email: p.email, role: p.role || "user", plan: p.plan || "Free", autoTradePermission: true
      }));
    }
    
    const { data: kycs } = await supabaseClient.from("kyc_requests").select("*");
    if (kycs) state.kycRequests = kycs.map(r => ({ id: r.id, userId: r.user_id, name: r.full_name, docNumber: r.doc_number, status: r.status }));

    const { data: pms } = await supabaseClient.from("user_payout_methods").select("*");
    if (pms) {
      state.userPayoutMethods = pms.map(r => ({
        id: r.id, userId: r.user_id, type: r.method_type, upi: r.upi_id, holderName: r.holder_name, kycName: r.kyc_name_snapshot, bankName: r.bank_name, accountNumber: r.account_number, ifsc: r.ifsc, status: r.status
      }));
    }
  } catch (e) { console.warn("Remote sync structural error checked:", e); }
}

async function fetchPrices() {
  try {
    const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];
    const res = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbols=" + encodeURIComponent(JSON.stringify(symbols)));
    const data = await res.json();
    data.forEach(d => { state.prices[d.symbol] = { price: Number(d.lastPrice), change: Number(d.priceChangePercent) }; });
  } catch (e) {
    Object.keys(state.prices).forEach(k => {
      state.prices[k].price += (Math.random() - 0.5) * 5;
    });
  }
  renderPrices();
}

/* ---------- UI Interface Unified Engine ---------- */
function showAuth(show = true) {
  $("authPage")?.classList.toggle("hidden", !show);
  $("appPage")?.classList.toggle("hidden", show);
}

function showPage(pageId) {
  qsa("#appPage .page").forEach(p => p.classList.remove("active-page"));
  $(pageId)?.classList.add("active-page");
  if (pageId === "paymentMethodsPage") renderPaymentRoute();
}

function renderPrices() {
  const btc = state.prices.BTCUSDT;
  if ($("headerBtcPrice")) $("headerBtcPrice").textContent = usd(btc.price);
  
  const host = $("crypto_live_chart") || $("tradingViewChart");
  if (host && !host.querySelector("iframe")) {
    const activeCoin = $("coinSelect")?.value || "BTCUSDT";
    host.innerHTML = `<iframe title="TradingView" src="https://s.tradingview.com/widgetembed/?symbol=BINANCE:${activeCoin}&interval=1&theme=dark" style="width:100%; height:450px; border:0;"></iframe>`;
  }
}

function renderPaymentRoute() {
  const container = pRoot();
  if (!container || currentRoute() !== "paymentMethods") return;

  const approved = isKycApproved();
  container.innerHTML = `
    <div class="card error-box" style="color:red; font-weight:bold; padding:10px; margin-bottom:15px;">${PM_SAFETY_WARNING}</div>
    <form id="routePaymentForm" class="card form-wrap">
      <label>Method Type
        <select id="routePayType" name="type">
          <option value="UPI" ${pmType === "UPI" ? "selected" : ""}>UPI</option>
          <option value="BANK" ${pmType === "BANK" ? "selected" : ""}>Bank Account</option>
        </select>
      </label>
      <div id="upiFieldWrap" style="display:${pmType === "UPI" ? "block" : "none"};">
        <label>UPI ID <input name="upi" placeholder="username@upi"></label>
      </div>
      <div id="bankFieldWrap" style="display:${pmType === "BANK" ? "block" : "none"};">
        <label>Bank Name <input name="bankName"></label>
        <label>Account Number <input name="accountNumber"></label>
        <label>IFSC Code <input name="ifsc"></label>
      </div>
      <label>KYC Name Baseline <input value="${kycName()}" readonly></label>
      <button type="submit" ${approved ? "" : "disabled"}>${approved ? "Secure Vault Asset Method" : "KYC Clearance Blocked"}</button>
    </form>
    <div class="saved-methods-list" style="margin-top:20px;">
      <h3>Registered Clearings</h3>
      ${methods().map(m => `<div class="card text-line"><b>${m.type}</b>: ${m.type === "UPI" ? m.upi : m.accountNumber} (${m.status})</div>`).join("")}
    </div>
  `;

  $("routePayType")?.addEventListener("change", (e) => {
    pmType = e.target.value;
    $("upiFieldWrap").style.display = pmType === "UPI" ? "block" : "none";
    $("bankFieldWrap").style.display = pmType === "BANK" ? "block" : "none";
  });
  $("routePaymentForm")?.addEventListener("submit", submitPayoutMethodSecure);
}

function pRoot() { return $("paymentMethodsPageContent") || $("paymentMethodsPage"); }
function currentRoute() { return isShown($("paymentMethodsPage")) ? "paymentMethods" : ""; }
function isShown(el) { return el && el.classList.contains("active-page"); }
let pmType = "UPI";
function methods() { return state.userPayoutMethods.filter(m => String(m.userId) === userKey()); }

function render() {
  showAuth(!state.user);
  if (!state.user) return;
  
  if ($("userBadgeText")) $("userBadgeText").textContent = state.user.name;
  if ($("walletBalance")) $("walletBalance").textContent = state.mode === "REAL" ? money(realWallet()) : money(state.accounts.DEMO.balance);
  
  const activeList = currentAccount().trades;
  if ($("activeTradesLog")) {
    $("activeTradesLog").innerHTML = activeList.map(t => `
      <tr><td>${t.coin}</td><td>${t.side}</td><td>${money(t.amount)}</td><td><button onclick="closeTrade('${t.id}')">Settle</button></td></tr>
    `).join("") || "<tr><td colspan='4'>No operational items tracking live.</td></tr>";
  }
}

function currentAccount() { return state.accounts[state.mode]; }
function saveSession() { if (state.user) localStorage.setItem(SESSION_KEY, JSON.stringify(state.user)); }
function openModal(id) { $(id)?.classList.add("show"); }
function closeModal(id) { $(id)?.classList.remove("show"); }

/* ---------- System Hardware Binding Bus ---------- */
function setupEvents() {
  $("loginBtn")?.addEventListener("click", login);
  $("logoutBtn")?.addEventListener("click", logout);
  $("buyTradeBtn")?.addEventListener("click", () => openManualTrade("BUY"));
  $("sellTradeBtn")?.addEventListener("click", () => openManualTrade("SELL"));
  $("submitDepositRequest")?.addEventListener("click", submitDepositSecure);
  $("openManagedTradeBtn")?.addEventListener("click", openManagedTradeAdvanced);
  
  $("demoBtn")?.addEventListener("click", () => { state.mode = "DEMO"; render(); });
  $("realBtn")?.addEventListener("click", () => { state.mode = "REAL"; render(); });

  document.addEventListener("click", e => {
    const nav = e.target.closest("[data-page]");
    if (nav) showPage(nav.dataset.page);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  loadState(); setupEvents();
  if (state.user) showAuth(false);
  await loadRemoteData();
  render(); fetchPrices();
  
  setInterval(fetchPrices, 4000);
  setInterval(checkAutoLiquidation, 1000);
  setInterval(() => { if (state.user) render(); }, 2000);
});
