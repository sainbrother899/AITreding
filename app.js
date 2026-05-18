
/* =========================================================
   AI Trading Assistant - Clean Rebuild V1
   Active JS is rebuilt fresh. Old app.js is kept as app-old-backup.js only.
   No monkey patches, no duplicate render intervals, no old payment/KYC patches.
   ========================================================= */

"use strict";

const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const cfg = window.APP_CONFIG || {};
const isAdminPage = !!window.FORCE_ADMIN_PAGE || /admin\.html/i.test(location.pathname) || document.body?.dataset?.adminPage === "true";

const LS_KEY = "ai_trading_clean_rebuild_v1";
const SESSION_KEY = isAdminPage ? "ai_admin_session_clean_v1" : "ai_user_session_clean_v1";
const KYC_BUCKET = "kyc-documents";

let supabaseClient = null;
try {
  if (window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
    supabaseClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    window.supabaseClient = supabaseClient;
  }
} catch (e) {
  console.warn("Supabase init failed", e);
}

const DEFAULT_PRICES = {
  BTCUSDT: { price: 68000, change: 1.2 },
  ETHUSDT: { price: 3600, change: 0.8 },
  SOLUSDT: { price: 160, change: 1.8 },
  BNBUSDT: { price: 590, change: 0.4 }
};

const DEFAULT_PLANS = [
  { id: "free", name: "Free", price: 0, duration: "Lifetime", signalLimit: 5, aiTradeLimit: 5, features: ["5 AI trades per day", "Manual trades"] },
  { id: "pro", name: "Pro", price: 499, duration: "30 days", signalLimit: 50, aiTradeLimit: 10, features: ["10 AI trades per day", "Premium signals"] },
  { id: "elite", name: "Elite", price: 999, duration: "30 days", signalLimit: 999999, aiTradeLimit: 25, features: ["25 AI trades per day"] }
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
  kycRequests: [],
  userPayoutMethods: [],
  walletLedger: [],
  referrals: [],
  plans: DEFAULT_PLANS,
  aiTradeUsage: {},
  paymentSettings: {
    upi: { active: true, upiId: "admin@upi", name: "AI Trading", qrUrl: "" },
    bank: { active: true, accountName: "AI Trading", bankName: "Demo Bank", accountNumber: "0000000000", ifsc: "DEMO0000001", branch: "Main" }
  },
  adminSignal: {
    coin: "BTCUSDT",
    signal: "BUY",
    entry: 68000,
    target: 69000,
    stop: 67500,
    confidence: 82,
    risk: "MEDIUM",
    expiry: "30 minutes",
    note: "AI trend confirmation active."
  }
};

/* ---------- Helpers ---------- */
function money(n) { return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
function usd(n) { return "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 }); }
function normalizeEmail(v) { return String(v || "").trim().toLowerCase(); }
function safeJson(v, fallback) { try { return JSON.parse(v); } catch { return fallback; } }
function userKey(u = state.user) { return String(u?.id || u?.email || "local"); }
function userEmail(u = state.user) { return normalizeEmail(u?.email || ""); }
function nowText() { return new Date().toLocaleString(); }
function priceOf(coin) { return Number(state.prices?.[coin]?.price || DEFAULT_PRICES[coin]?.price || 100); }
function toast(msg) {
  const el = $("toast");
  if (el) {
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2600);
  } else {
    console.log(msg);
  }
}
function currentAccount(mode = state.mode) {
  state.accounts ||= {};
  state.accounts[mode] ||= { balance: mode === "DEMO" ? 100000 : 0, trades: [], closedTrades: [] };
  state.accounts[mode].trades ||= [];
  state.accounts[mode].closedTrades ||= [];
  return state.accounts[mode];
}
function getLeverageSafe() {
  return Math.min(2000, Math.max(1, Number($("leverageSelect")?.value || $("leverageInput")?.value || 1)));
}
function saveState() {
  const data = { ...state, user: undefined };
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}
function loadState() {
  const saved = safeJson(localStorage.getItem(LS_KEY), {});
  if (saved && typeof saved === "object") Object.assign(state, saved);
  state.accounts ||= {};
  state.accounts.DEMO ||= { balance: 100000, trades: [], closedTrades: [] };
  state.accounts.REAL ||= { balance: 0, trades: [], closedTrades: [] };
  state.accounts.DEMO.trades ||= [];
  state.accounts.DEMO.closedTrades ||= [];
  state.accounts.REAL.trades ||= [];
  state.accounts.REAL.closedTrades ||= [];
  state.prices = { ...DEFAULT_PRICES, ...(state.prices || {}) };
  state.plans = state.plans?.length ? state.plans : DEFAULT_PLANS;
  state.userPayoutMethods ||= [];
  const session = safeJson(localStorage.getItem(SESSION_KEY), null);
  if (session) state.user = session;
}
function saveSession() {
  if (state.user) localStorage.setItem(SESSION_KEY, JSON.stringify(state.user));
  else localStorage.removeItem(SESSION_KEY);
}
function ensureUser(user) {
  if (!user) return;
  const idx = state.users.findIndex(u => String(u.id) === String(user.id) || normalizeEmail(u.email) === normalizeEmail(user.email));
  if (idx >= 0) state.users[idx] = { ...state.users[idx], ...user };
  else state.users.push(user);
}

/* ---------- DB helpers ---------- */
async function dbSelect(table) {
  if (!supabaseClient) return [];
  try {
    const { data, error } = await supabaseClient.from(table).select("*");
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn("DB select failed", table, e);
    return [];
  }
}
async function dbInsert(table, row) {
  if (!supabaseClient) return { data: null, error: null };
  try {
    let res = await supabaseClient.from(table).insert(row).select("*");
    if (res.error && /bigint/i.test(res.error.message || "") && row?.id) {
      const copy = { ...row };
      delete copy.id;
      res = await supabaseClient.from(table).insert(copy).select("*");
    }
    return res;
  } catch (e) {
    return { data: null, error: e };
  }
}
async function dbUpdate(table, patch, col, value) {
  if (!supabaseClient) return { data: null, error: null };
  try { return await supabaseClient.from(table).update(patch).eq(col, value).select("*"); }
  catch (e) { return { data: null, error: e }; }
}
async function dbUpsert(table, row, onConflict = "id") {
  if (!supabaseClient) return { data: null, error: null };
  try { return await supabaseClient.from(table).upsert(row, { onConflict }).select("*"); }
  catch (e) { return { data: null, error: e }; }
}

/* ---------- Auth ---------- */
function showAuth(show = true) {
  $("authPage")?.classList.toggle("hidden", !show);
  $("appPage")?.classList.toggle("hidden", show);
  $("logoutBtn")?.classList.toggle("hidden", show);
}
async function afterLogin(user) {
  state.user = user;
  ensureUser(user);
  saveSession();
  saveState();
  showAuth(false);
  document.body.classList.toggle("demo-mode-active", state.mode === "DEMO");
  document.body.classList.toggle("real-mode-active", state.mode === "REAL");
  await loadRemoteData();
  showPage(isAdminPage && user.role === "admin" ? "admin" : "dashboard");
  render();
}
async function login() {
  const email = normalizeEmail($("loginEmail")?.value);
  const pass = $("loginPassword")?.value || "";
  if (!email || !pass) return toast("Email aur password dalo.");

  const adminEmail = normalizeEmail(cfg.ADMIN_EMAIL || "admin@aitrade.local");
  const adminPass = cfg.ADMIN_PASSWORD || "admin123";
  if (email === adminEmail && pass === adminPass) {
    return afterLogin({ id: "admin", email, name: "Admin", role: "admin", plan: "Elite" });
  }

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
      if (!error && data?.user) {
        let profile = null;
        try {
          const { data: p } = await supabaseClient.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
          profile = p;
        } catch {}
        return afterLogin({
          id: data.user.id,
          email,
          name: profile?.name || email.split("@")[0],
          mobile: profile?.mobile || "",
          role: profile?.role || "user",
          plan: profile?.plan || "Free",
          kycStatus: profile?.kyc_status || profile?.kycStatus || "",
          kycName: profile?.kyc_name || profile?.name || ""
        });
      }
    } catch (e) { console.warn("Supabase login failed", e); }
  }

  const local = state.users.find(u => normalizeEmail(u.email) === email && (u.password === pass || !u.password));
  if (local) return afterLogin(local);
  toast("Login failed.");
}
async function register() {
  const name = $("regName")?.value?.trim() || "User";
  const email = normalizeEmail($("regEmail")?.value);
  const mobile = $("regMobile")?.value?.trim() || "";
  const pass = $("regPassword")?.value || "";
  const ref = $("regReferral")?.value?.trim() || new URLSearchParams(location.search).get("ref") || "";
  if (!email || !pass) return toast("Email aur password required hai.");

  let id = "u_" + Date.now();
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.auth.signUp({ email, password: pass });
      if (!error && data?.user?.id) id = data.user.id;
    } catch {}
  }

  const user = { id, name, email, mobile, password: pass, role: "user", plan: "Free", referred_by: ref };
  if (supabaseClient) {
    await dbUpsert("profiles", { id, name, email, mobile, role: "user", plan: "Free", referred_by: ref || null }, "id");
  }
  afterLogin(user);
}
function logout() {
  state.user = null;
  saveSession();
  showAuth(true);
  render();
}
function guestLogin() {
  afterLogin({ id: "guest", email: "guest@demo.local", name: "Guest", role: "user", plan: "Free" });
}

/* ---------- Remote load ---------- */
async function loadRemoteData() {
  if (!supabaseClient) return;

  const profiles = await dbSelect("profiles");
  if (profiles.length) {
    const map = new Map((state.users || []).map(u => [String(u.id || u.email), u]));
    profiles.forEach(p => {
      const id = p.id || p.user_id || p.email;
      map.set(String(id), {
        ...(map.get(String(id)) || {}),
        id,
        name: p.name || p.full_name || (p.email ? String(p.email).split("@")[0] : "User"),
        email: p.email || "",
        mobile: p.mobile || "",
        role: p.role || "user",
        plan: p.plan || "Free",
        kycStatus: p.kyc_status || p.kycStatus || "",
        kycName: p.kyc_name || p.name || ""
      });
    });
    state.users = Array.from(map.values());
  }

  state.depositRequests = (await dbSelect("deposit_requests")).map(r => ({
    id: String(r.id), userId: r.user_id, userEmail: r.user_email, userName: r.user_name,
    amount: Number(r.amount || 0), txn: r.txn || "", status: r.status || "PENDING", createdAt: r.created_at_text || r.created_at || ""
  }));

  state.withdrawalRequests = (await dbSelect("withdrawal_requests")).map(r => ({
    id: String(r.id), userId: r.user_id, userEmail: r.user_email, amount: Number(r.amount || 0),
    method: r.method || r.withdraw_method || "", account: r.account || r.account_detail || "", name: r.name || "", ifsc: r.ifsc || "",
    status: r.status || "PENDING", createdAt: r.created_at_text || r.created_at || ""
  }));

  state.kycRequests = (await dbSelect("kyc_requests")).map(r => ({
    id: String(r.id), userId: r.user_id, userEmail: r.user_email || r.email, name: r.full_name || r.name,
    mobile: r.mobile || "", docType: r.doc_type || "KYC", docNumber: r.doc_number || "",
    dob: r.dob || "", address: r.address || "", status: r.status || "PENDING",
    documents: r.documents || {}, createdAt: r.submitted_at || r.created_at || ""
  }));

  state.userPayoutMethods = (await dbSelect("user_payout_methods")).map(r => ({
    id: String(r.id), userId: r.user_id, userEmail: r.user_email || "", type: r.method_type || r.type || "UPI",
    upi: r.upi_id || r.upi || "", holderName: r.holder_name || "", kycName: r.kyc_name_snapshot || "",
    bankName: r.bank_name || "", accountNumber: r.account_number || "", ifsc: r.ifsc || "",
    status: r.status || "PENDING", createdAt: r.created_at_text || r.created_at || ""
  }));

  state.walletLedger = (await dbSelect("wallet_ledger")).map(r => ({
    id: String(r.id), userId: r.user_id, type: r.type, amount: Number(r.amount || 0), note: r.note || ""
  }));

  state.managedTrades = (await dbSelect("managed_trades")).map(r => ({
    id: String(r.id), userId: r.user_id, userEmail: r.user_email, coin: r.coin, side: r.side, risk: r.risk || "MEDIUM",
    amount: Number(r.amount || 0), entry: Number(r.entry_price || 0), close: r.close_price == null ? null : Number(r.close_price),
    pnl: Number(r.pnl || 0), status: r.status || "OPEN", source: r.source || "ADMIN_MANAGED", openedAt: r.opened_at || "", closedAt: r.closed_at || ""
  }));

  const settings = await dbSelect("payment_settings");
  settings.forEach(s => {
    const method = String(s.method || "").toUpperCase();
    if (method === "UPI") state.paymentSettings.upi = { active: s.is_active !== false, upiId: s.upi_id || "", name: s.title || s.account_name || "", qrUrl: s.qr_url || "" };
    if (method === "BANK") state.paymentSettings.bank = { active: s.is_active !== false, accountName: s.account_name || "", bankName: s.bank_name || "", accountNumber: s.account_number || "", ifsc: s.ifsc || "", branch: s.branch || "" };
  });

  saveState();
}

/* ---------- Navigation ---------- */
function showPage(pageId) {
  $$("#appPage .page").forEach(p => p.classList.remove("active-page"));
  const target = $(pageId);
  if (target) target.classList.add("active-page");
  $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.page === pageId));
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (pageId === "wallet") renderWallet();
  if (pageId === "aiHistory") renderHistory();
  if (pageId === "kycPage" || pageId === "kyc") renderKycPage();
  if (pageId === "paymentMethodsPage" || pageId === "paymentMethods") renderPaymentMethodsPage();
}
function openRealMenuPage(type) {
  const map = { kyc: "kycPage", paymentMethods: "paymentMethodsPage", profile: "profilePage", referral: "referral" };
  showPage(map[type] || type);
}
function setupNav() {
  document.addEventListener("click", e => {
    const nav = e.target.closest("[data-page]");
    if (nav) { e.preventDefault(); showPage(nav.dataset.page); }
    const direct = e.target.closest("[data-direct-page]");
    if (direct) { e.preventDefault(); showPage(direct.dataset.directPage); $("topMoreDropdown")?.classList.remove("show"); }
    const menu = e.target.closest("[data-menu-page]");
    if (menu) { e.preventDefault(); openRealMenuPage(menu.dataset.menuPage); }
  });
  $("topMoreMenuBtn")?.addEventListener("click", e => { e.preventDefault(); $("topMoreDropdown")?.classList.toggle("show"); });
  document.addEventListener("click", e => { if (!e.target.closest(".top-more-wrap")) $("topMoreDropdown")?.classList.remove("show"); });

  $$("[data-auth-tab]").forEach(btn => btn.addEventListener("click", () => {
    $$("[data-auth-tab]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.authTab;
    $("loginForm")?.classList.toggle("active-form", tab === "login");
    $("registerForm")?.classList.toggle("active-form", tab === "register");
  }));
}

/* ---------- Prices / chart ---------- */
async function fetchPrices() {
  try {
    const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];
    const res = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbols=" + encodeURIComponent(JSON.stringify(symbols)));
    const data = await res.json();
    data.forEach(d => state.prices[d.symbol] = { price: Number(d.lastPrice), change: Number(d.priceChangePercent) });
  } catch {
    Object.keys(state.prices).forEach(k => {
      const p = state.prices[k].price;
      state.prices[k].price = Math.max(1, p + ((Math.random() - 0.5) * p * 0.001));
    });
  }
  renderPrices();
}
function ensureTradingView() {
  const host = $("crypto_live_chart") || $("tradingViewChart") || $("tradingview_chart");
  if (!host || host.dataset.tvLoaded === "1") return;
  const pair = $("coinSelect")?.value || "BTCUSDT";
  host.innerHTML = `<iframe title="TradingView" src="https://s.tradingview.com/widgetembed/?symbol=BINANCE:${pair}&interval=1&theme=dark&style=1&locale=en" style="width:100%;height:100%;min-height:420px;border:0;display:block;"></iframe>`;
  host.dataset.tvLoaded = "1";
}

/* ---------- Wallet ---------- */
function ledgerForUser(uid = userKey()) { return (state.walletLedger || []).filter(l => String(l.userId) === String(uid)); }
function approvedDeposits(uid = userKey()) {
  const req = state.depositRequests.filter(d => String(d.userId) === String(uid) && d.status === "APPROVED").reduce((a, d) => a + Number(d.amount || 0), 0);
  const led = ledgerForUser(uid).filter(l => l.type === "DEPOSIT").reduce((a, l) => a + Number(l.amount || 0), 0);
  return Math.max(req, led);
}
function approvedWithdrawals(uid = userKey()) {
  const req = state.withdrawalRequests.filter(w => String(w.userId) === String(uid) && w.status === "APPROVED").reduce((a, w) => a + Math.abs(Number(w.amount || 0)), 0);
  const led = ledgerForUser(uid).filter(l => l.type === "WITHDRAWAL").reduce((a, l) => a + Math.abs(Number(l.amount || 0)), 0);
  return Math.max(req, led);
}
function ledgerPnL(uid = userKey()) {
  return ledgerForUser(uid).filter(l => ["TRADE_PNL", "MANAGED_TRADE_PNL", "MASS_TRADE_PNL", "REFERRAL_BONUS"].includes(l.type)).reduce((a, l) => a + Number(l.amount || 0), 0);
}
function realWallet(uid = userKey()) { return approvedDeposits(uid) + ledgerPnL(uid) - approvedWithdrawals(uid); }
function tradeVolume(uid = userKey()) {
  const closed = (state.accounts.REAL.closedTrades || []).filter(t => !t.userId || String(t.userId) === String(uid)).reduce((a, t) => a + Number(t.amount || 0), 0);
  const managed = state.managedTrades.filter(t => String(t.userId) === String(uid) && t.status === "CLOSED").reduce((a, t) => a + Number(t.amount || 0), 0);
  return closed + managed;
}
function withdrawable(uid = userKey()) {
  const dep = approvedDeposits(uid);
  const vol = tradeVolume(uid);
  const pnl = ledgerPnL(uid);
  const pending = state.withdrawalRequests.filter(w => String(w.userId) === String(uid) && w.status === "PENDING").reduce((a, w) => a + Number(w.amount || 0), 0);
  return Math.max(0, Math.min(dep, vol) + Math.max(0, pnl) - approvedWithdrawals(uid) - pending);
}
async function submitDeposit() {
  if (!state.user) return toast("Login required.");
  const amount = Number(String($("depositAmount")?.value || "").replace(/,/g, ""));
  const txn = String($("depositTxn")?.value || "").replace(/\D/g, "").slice(0, 12);
  if (!amount || amount < 1000) return alert("Minimum deposit ₹1000 hai.");
  if (!/^\d{12}$/.test(txn)) return alert("UTR exactly 12 digit hona chahiye.");
  if (state.depositRequests.some(d => String(d.txn) === txn)) return alert("Duplicate UTR.");

  const req = { id: "local_dep_" + Date.now(), userId: state.user.id, userEmail: state.user.email, userName: state.user.name, amount, txn, status: "PENDING", createdAt: nowText() };

  if (supabaseClient) {
    const { data, error } = await supabaseClient.from("deposit_requests").insert({
      user_id: req.userId, user_email: req.userEmail, user_name: req.userName, amount, txn, status: "PENDING", created_at_text: req.createdAt
    }).select("id").single();
    if (error) return alert("Deposit save error: " + error.message);
    if (data?.id != null) req.id = String(data.id);
  }

  state.depositRequests.unshift(req);
  $("depositAmount").value = "";
  $("depositTxn").value = "";
  closeModal("depositModal");
  saveState(); render();
  toast("Deposit request submitted.");
}
async function approveDeposit(id) {
  const d = state.depositRequests.find(x => String(x.id) === String(id));
  if (!d) return;
  d.status = "APPROVED";
  await dbUpdate("deposit_requests", { status: "APPROVED" }, "id", id);
  state.walletLedger.unshift({ id: "led_" + Date.now(), userId: d.userId, type: "DEPOSIT", amount: d.amount, note: "Deposit approved" });
  await dbInsert("wallet_ledger", { user_id: d.userId, type: "DEPOSIT", amount: d.amount, note: "Deposit approved" });
  saveState(); render();
}
async function rejectDeposit(id) {
  const d = state.depositRequests.find(x => String(x.id) === String(id));
  if (!d) return;
  d.status = "REJECTED";
  await dbUpdate("deposit_requests", { status: "REJECTED" }, "id", id);
  saveState(); render();
}
function approvedPaymentMethods() {
  return state.userPayoutMethods.filter(m => String(m.userId) === userKey() && String(m.status).toUpperCase() === "APPROVED");
}
async function submitWithdrawal() {
  if (!state.user) return;
  const amount = Number($("withdrawAmount")?.value || 0);
  if (!amount || amount < 1000) return toast("Minimum withdrawal ₹1000.");
  if (amount > withdrawable()) return toast("Withdrawable amount se jyada nahi.");

  const approved = approvedPaymentMethods();
  const selectedId = $("withdrawApprovedMethod")?.value || "";
  const m = approved.find(x => String(x.id) === String(selectedId)) || approved[0] || null;

  const req = {
    id: "local_wd_" + Date.now(),
    userId: state.user.id,
    userEmail: state.user.email,
    amount,
    method: m?.type || $("withdrawMethod")?.value || "UPI",
    account: m ? (m.upi || m.accountNumber || "") : $("withdrawAccount")?.value || "",
    name: m?.holderName || $("withdrawName")?.value || "",
    ifsc: m?.ifsc || $("withdrawIfsc")?.value || "",
    status: "PENDING",
    createdAt: nowText()
  };

  if (supabaseClient) {
    const { data } = await supabaseClient.from("withdrawal_requests").insert({
      user_id: req.userId, user_email: req.userEmail, amount: req.amount,
      method: req.method, account: req.account, name: req.name, ifsc: req.ifsc,
      status: "PENDING", created_at_text: req.createdAt
    }).select("id").single();
    if (data?.id != null) req.id = String(data.id);
  }

  state.withdrawalRequests.unshift(req);
  closeModal("withdrawModal");
  saveState(); render();
  toast("Withdrawal request submitted.");
}
async function approveWithdrawal(id) {
  const w = state.withdrawalRequests.find(x => String(x.id) === String(id));
  if (!w) return;
  w.status = "APPROVED";
  await dbUpdate("withdrawal_requests", { status: "APPROVED" }, "id", id);
  state.walletLedger.unshift({ id: "led_" + Date.now(), userId: w.userId, type: "WITHDRAWAL", amount: -Math.abs(w.amount), note: "Withdrawal approved" });
  await dbInsert("wallet_ledger", { user_id: w.userId, type: "WITHDRAWAL", amount: -Math.abs(w.amount), note: "Withdrawal approved" });
  saveState(); render();
}
async function rejectWithdrawal(id) {
  const w = state.withdrawalRequests.find(x => String(x.id) === String(id));
  if (!w) return;
  w.status = "REJECTED";
  await dbUpdate("withdrawal_requests", { status: "REJECTED" }, "id", id);
  saveState(); render();
}

/* ---------- Trading ---------- */
function updateTradePnl(t) {
  if (!t) return 0;
  if (String(t.status || "").toUpperCase() !== "OPEN") return Number(t.pnl || 0);
  const current = priceOf(t.coin);
  t.current = current;
  const diff = t.side === "SELL" ? Number(t.entry) - current : current - Number(t.entry);
  t.pnl = (diff / Number(t.entry || 1)) * Number(t.amount || 0) * Number(t.leverage || 1);
  t.roi = (t.pnl / Number(t.amount || 1)) * 100;
  return Number(t.pnl || 0);
}
function openManualTrade(side) {
  if (!state.user) return toast("Login required.");
  const coin = $("coinSelect")?.value || "BTCUSDT";
  const amount = Number($("tradeAmountInput")?.value || 0);
  if (!amount || amount <= 0) return toast("Trade amount dalo.");
  if (state.mode === "REAL" && amount > realWallet()) return toast("Wallet balance kam hai.");

  const t = { id: "tr_" + Date.now(), userId: state.user.id, userEmail: state.user.email, coin, side, amount, entry: priceOf(coin), current: priceOf(coin), leverage: getLeverageSafe(), status: "OPEN", source: "USER", openedAt: nowText() };
  currentAccount().trades.unshift(t);
  saveState(); render();
}
async function closeTrade(id, mode = state.mode) {
  const acc = currentAccount(mode);
  const idx = acc.trades.findIndex(t => String(t.id) === String(id));
  if (idx < 0) return;
  const t = acc.trades[idx];
  updateTradePnl(t);
  t.close = priceOf(t.coin);
  t.status = "CLOSED";
  t.closedAt = nowText();
  acc.trades.splice(idx, 1);
  acc.closedTrades.unshift(t);

  if (mode === "REAL") {
    state.walletLedger.unshift({ id: "led_" + Date.now(), userId: state.user.id, type: "TRADE_PNL", amount: t.pnl, note: "Manual trade PnL" });
    await dbInsert("wallet_ledger", { user_id: state.user.id, type: "TRADE_PNL", amount: t.pnl, note: "Manual trade PnL" });
  }
  saveState(); render();
}

/* ---------- KYC ---------- */
function latestKycForUser(uid = userKey(), em = userEmail()) {
  const rows = state.kycRequests.filter(k => String(k.userId) === String(uid) || normalizeEmail(k.userEmail) === em);
  if (!rows.length) return null;
  const rank = s => String(s || "PENDING").toUpperCase() === "APPROVED" ? 3 : String(s || "").toUpperCase() === "PENDING" ? 2 : 1;
  return rows.slice().sort((a,b) => (rank(b.status) - rank(a.status)) || ((Date.parse(b.createdAt) || Number(b.id) || 0) - (Date.parse(a.createdAt) || Number(a.id) || 0)))[0];
}
async function uploadKycFile(kycId, key, file) {
  if (!supabaseClient || !file?.name) return null;
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${userKey()}/${kycId}/${key}_${Date.now()}_${safe}`;
  const { error } = await supabaseClient.storage.from(KYC_BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  await dbInsert("kyc_documents", { id: `doc_${Date.now()}_${key}`, kyc_id: String(kycId), user_id: userKey(), doc_key: key, file_name: file.name, file_path: path, file_url: "", mime_type: file.type || "", size_bytes: file.size || 0 });
  return { name: file.name, path, uploadedAt: nowText() };
}
async function submitKycForm(form) {
  const fd = new FormData(form);
  const kycId = Date.now();
  const name = String(fd.get("kycName") || fd.get("name") || $("kycName")?.value || state.user?.name || "").trim();
  const mobile = String(fd.get("kycMobile") || $("kycMobile")?.value || state.user?.mobile || "").trim();
  const docType = String(fd.get("kycDocType") || $("kycDocType")?.value || "KYC").trim();
  const docNumber = String(fd.get("kycDocNumber") || fd.get("kycId") || $("kycDocNumber")?.value || "").trim();

  const row = { id: String(kycId), userId: userKey(), userEmail: state.user.email, name, mobile, docType, docNumber, status: "PENDING", documents: {}, createdAt: nowText() };

  if (supabaseClient) {
    const { error } = await supabaseClient.from("kyc_requests").insert({ id: kycId, user_id: row.userId, user_email: row.userEmail, name, full_name: name, mobile, doc_type: docType, doc_number: docNumber, status: "PENDING", submitted_at: new Date().toISOString() });
    if (error) throw error;

    const docs = {};
    const front = $("kycFrontFile")?.files?.[0] || fd.get("idFront");
    const selfie = $("kycSelfieFile")?.files?.[0] || fd.get("selfie");
    if (front?.name) docs.front = await uploadKycFile(kycId, "front", front);
    if (selfie?.name) docs.selfie = await uploadKycFile(kycId, "selfie", selfie);
    row.documents = docs;
    await supabaseClient.from("kyc_requests").update({ documents: docs }).eq("id", kycId);
  }

  state.kycRequests.unshift(row);
  state.user.kycStatus = "PENDING";
  state.user.kycName = name;
  saveSession(); saveState();
  renderKycPage();
  toast("KYC submitted.");
}
function renderKycPage() {
  const page = $("kycPage");
  if (!page) return;
  const root = $("kycPageContent") || page;
  const mine = latestKycForUser();
  const status = String(mine?.status || state.user?.kycStatus || "").toUpperCase();

  if (status === "APPROVED" || status === "PENDING") {
    root.innerHTML = `<div class="card kyc-clean-card ${status.toLowerCase()}">
      <div class="kyc-clean-icon">${status === "APPROVED" ? "✓" : "⏳"}</div>
      <h3>${status === "APPROVED" ? "Your KYC Approved" : "KYC Under Review"}</h3>
      <p>${status === "APPROVED" ? "Your identity verification is approved. You do not need to submit KYC again." : "Your KYC documents have been submitted. Please wait for admin approval."}</p>
      ${status === "APPROVED" ? `<div><span>Name</span><b>${mine?.name || state.user?.kycName || state.user?.name || ""}</b></div>` : ""}
    </div>`;
    return;
  }

  const rejected = status === "REJECTED" ? `<div class="card kyc-clean-card rejected"><div class="kyc-clean-icon">!</div><h3>KYC Rejected</h3><p>Your previous KYC was rejected. Please submit again.</p></div>` : "";
  root.innerHTML = `${rejected}
    <form id="cleanKycForm" class="card menu-real-form">
      <label>Full Name<input name="kycName" value="${state.user?.kycName || state.user?.name || ""}" required></label>
      <label>Mobile<input name="kycMobile" value="${state.user?.mobile || ""}"></label>
      <label>Document Type<select name="kycDocType"><option>PAN</option><option>Aadhaar</option><option>Passport</option><option>Other</option></select></label>
      <label>Document Number<input name="kycDocNumber" required></label>
      <label>ID Front<input type="file" name="idFront" accept="image/*,.pdf" required></label>
      <label>Selfie<input type="file" name="selfie" accept="image/*"></label>
      <button type="submit">Submit KYC Documents for Approval</button>
    </form>`;
  $("cleanKycForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    try { await submitKycForm(e.target); } catch (err) { alert("KYC submit failed: " + (err.message || err)); }
  });
}
async function approveKyc(id) {
  const k = state.kycRequests.find(x => String(x.id) === String(id));
  if (!k) return;
  k.status = "APPROVED";
  await dbUpdate("kyc_requests", { status: "APPROVED", reviewed_at: new Date().toISOString() }, "id", id);
  saveState(); renderAdmin();
}
async function rejectKyc(id) {
  const k = state.kycRequests.find(x => String(x.id) === String(id));
  if (!k) return;
  k.status = "REJECTED";
  await dbUpdate("kyc_requests", { status: "REJECTED", reviewed_at: new Date().toISOString() }, "id", id);
  saveState(); renderAdmin();
}

/* ---------- Payment Methods ---------- */
function userPaymentMethods(uid = userKey()) { return state.userPayoutMethods.filter(m => String(m.userId) === String(uid)); }
function paymentCount(type) { return userPaymentMethods().filter(m => String(m.type).toUpperCase() === String(type).toUpperCase()).length; }
function renderPaymentMethodsPage() {
  const page = $("paymentMethodsPage");
  if (!page) return;
  const root = $("paymentMethodsPageContent") || page;
  const approved = String(latestKycForUser()?.status || state.user?.kycStatus || "").toUpperCase() === "APPROVED";
  let selected = localStorage.getItem("clean_pm_type_v1") || "UPI";
  selected = selected === "BANK" ? "BANK" : "UPI";
  const canAdd = approved && (selected === "BANK" ? paymentCount("BANK") < 2 : paymentCount("UPI") < 2);
  const warning = "YOUR PAYMENT METHOD NAME SHOULD MATCH KYC NAME. DON'T USE OTHER ACCOUNT. IF YOU USE OTHER ACCOUNT, YOUR ACCOUNT MAY BE SUSPENDED.";
  const methods = userPaymentMethods();

  root.innerHTML = `<div class="pm-clean-warning">${warning}</div>
    ${approved ? "" : `<div class="card pm-kyc-note"><b>KYC Approval Required</b><span>Please complete approved KYC before adding a payment method.</span></div>`}
    <form id="cleanPaymentForm" class="card menu-real-form">
      <label>Method Type
        <select id="cleanPayType" name="type" ${approved ? "" : "disabled"}>
          <option value="UPI" ${selected === "UPI" ? "selected" : ""}>UPI</option>
          <option value="BANK" ${selected === "BANK" ? "selected" : ""}>Bank Account</option>
        </select>
      </label>
      <label class="pm-upi-field">UPI ID<input name="upi" placeholder="example@upi" ${approved ? "" : "disabled"}></label>
      <label>Account Holder Name / KYC Name<input name="holderName" value="${state.user?.kycName || state.user?.name || ""}" readonly></label>
      <div class="pm-bank-fields">
        <label>Bank Name<input name="bankName" placeholder="Bank name" ${approved ? "" : "disabled"}></label>
        <label>Account Number<input name="accountNumber" placeholder="Account number" ${approved ? "" : "disabled"}></label>
        <label>IFSC Code<input name="ifsc" placeholder="IFSC code" ${approved ? "" : "disabled"}></label>
      </div>
      <div class="pm-limit">${canAdd ? `<span>Limit: UPI ${paymentCount("UPI")}/2 • Bank ${paymentCount("BANK")}/2</span>` : `<b>${approved ? (selected === "BANK" ? "You can add only 2 bank accounts." : "You can add only 2 UPI IDs.") : "KYC approval required"}</b>`}</div>
      <button type="submit" ${canAdd ? "" : "disabled"}>${canAdd ? "Add Method for Admin Approval" : "Not Available"}</button>
    </form>
    <div class="menu-real-section-title">Saved Methods</div>
    <div class="menu-real-methods">${methods.length ? methods.map(m => `<div class="card menu-real-method-card"><div><span>${m.type}</span><b>${m.type === "UPI" ? m.upi : `${m.bankName} ****${String(m.accountNumber || "").slice(-4)}`}</b><small>${m.holderName}</small></div><em class="pm-status ${String(m.status).toLowerCase()}">${m.status}</em></div>`).join("") : `<div class="card menu-real-empty">No payment method added yet.</div>`}</div>`;

  const typeSelect = $("cleanPayType");
  function applyType() {
    const type = typeSelect?.value || "UPI";
    localStorage.setItem("clean_pm_type_v1", type);
    page.classList.toggle("pm-bank-selected", type === "BANK");
    $$(".pm-bank-fields", page).forEach(x => x.style.display = type === "BANK" ? "grid" : "none");
    $$(".pm-upi-field", page).forEach(x => x.style.display = type === "BANK" ? "none" : "grid");
  }
  typeSelect?.addEventListener("change", () => renderPaymentMethodsPage());
  applyType();

  $("cleanPaymentForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const type = String(fd.get("type") || "UPI").toUpperCase();
    if (type === "UPI" && paymentCount("UPI") >= 2) return alert("You can add only 2 UPI IDs.");
    if (type === "BANK" && paymentCount("BANK") >= 2) return alert("You can add only 2 bank accounts.");

    const method = {
      id: "pm_" + Date.now(),
      userId: userKey(),
      userEmail: state.user.email,
      type,
      upi: type === "UPI" ? String(fd.get("upi") || "").trim() : "",
      holderName: state.user.kycName || state.user.name,
      kycName: state.user.kycName || state.user.name,
      bankName: type === "BANK" ? String(fd.get("bankName") || "").trim() : "",
      accountNumber: type === "BANK" ? String(fd.get("accountNumber") || "").trim() : "",
      ifsc: type === "BANK" ? String(fd.get("ifsc") || "").trim() : "",
      status: "PENDING",
      createdAt: nowText()
    };
    if (type === "UPI" && !method.upi) return alert("Please enter UPI ID.");
    if (type === "BANK" && (!method.bankName || !method.accountNumber || !method.ifsc)) return alert("Please enter complete bank details.");

    state.userPayoutMethods.unshift(method);
    await dbUpsert("user_payout_methods", { id: method.id, user_id: method.userId, user_email: method.userEmail, method_type: method.type, holder_name: method.holderName, kyc_name_snapshot: method.kycName, upi_id: method.upi, bank_name: method.bankName, account_number: method.accountNumber, ifsc: method.ifsc, status: "PENDING", name_match: true, created_at_text: method.createdAt }, "id");
    saveState();
    renderPaymentMethodsPage();
    toast("Payment method sent for admin approval.");
  });
}
async function approvePayoutMethod(id) {
  const m = state.userPayoutMethods.find(x => String(x.id) === String(id));
  if (!m) return;
  m.status = "APPROVED";
  await dbUpdate("user_payout_methods", { status: "APPROVED", reviewed_at: new Date().toISOString() }, "id", id);
  saveState(); renderAdmin();
}
async function rejectPayoutMethod(id) {
  const m = state.userPayoutMethods.find(x => String(x.id) === String(id));
  if (!m) return;
  m.status = "REJECTED";
  await dbUpdate("user_payout_methods", { status: "REJECTED", reviewed_at: new Date().toISOString() }, "id", id);
  saveState(); renderAdmin();
}

/* ---------- Admin managed trades ---------- */
async function openManagedTrade() {
  if (state.user?.role !== "admin") return;
  const target = $("managedUserSelect")?.value || "ALL";
  const users = state.users.filter(u => u.role !== "admin");
  const targets = target === "ALL" ? users : users.filter(u => String(u.id || u.email) === String(target));
  const coin = $("managedCoin")?.value || "BTCUSDT";
  const side = $("managedSide")?.value || "BUY";
  const amount = Number($("managedAmount")?.value || 0);
  const entry = Number($("managedEntryPrice")?.value || priceOf(coin));
  for (const u of targets) {
    const t = { id: "mg_" + Date.now() + "_" + Math.random().toString(16).slice(2), userId: u.id, userEmail: u.email, coin, side, risk: $("managedRisk")?.value || "MEDIUM", amount, entry, close: null, pnl: 0, status: "OPEN", source: target === "ALL" ? "ADMIN_MASS" : "ADMIN_MANAGED", openedAt: nowText() };
    state.managedTrades.unshift(t);
    await dbInsert("managed_trades", { id: t.id, user_id: t.userId, user_email: t.userEmail, coin: t.coin, side: t.side, risk: t.risk, amount: t.amount, entry_price: t.entry, pnl: 0, status: "OPEN", source: t.source, opened_at: t.openedAt });
  }
  saveState(); render();
}
async function closeManagedTrade() {
  const id = $("managedTradeSelect")?.value;
  const close = Number($("managedClosePrice")?.value || 0);
  const t = state.managedTrades.find(x => String(x.id) === String(id));
  if (!t || !close) return;
  t.close = close;
  const diff = t.side === "SELL" ? t.entry - close : close - t.entry;
  t.pnl = (diff / Number(t.entry || 1)) * Number(t.amount || 0);
  t.status = "CLOSED";
  t.closedAt = nowText();
  await dbUpdate("managed_trades", { close_price: close, pnl: t.pnl, status: "CLOSED", closed_at: t.closedAt }, "id", id);
  state.walletLedger.unshift({ id: "led_" + Date.now(), userId: t.userId, type: "MANAGED_TRADE_PNL", amount: t.pnl, note: "AI trade PnL" });
  await dbInsert("wallet_ledger", { user_id: t.userId, type: "MANAGED_TRADE_PNL", amount: t.pnl, note: "AI trade PnL" });
  saveState(); render();
}
function cancelManagedTrade() {
  const id = $("managedTradeSelect")?.value;
  const t = state.managedTrades.find(x => String(x.id) === String(id));
  if (!t) return;
  t.status = "CANCELLED";
  t.closedAt = nowText();
  saveState(); render();
}
function openMassTrade() { openManagedTrade(); }
function closeAllMassTrades() { toast("Select individual managed trade close for V1."); }

/* ---------- Renderers ---------- */
function renderPrices() {
  const pair = $("coinSelect")?.value || "BTCUSDT";
  if ($("headerBtcPrice")) $("headerBtcPrice").textContent = usd(state.prices.BTCUSDT.price);
  if ($("tradePairPrice")) $("tradePairPrice").textContent = usd(priceOf(pair));
  if ($("tradePairChange")) $("tradePairChange").textContent = `${Number(state.prices[pair]?.change || 0).toFixed(2)}%`;
  if ($("tickerGrid")) $("tickerGrid").innerHTML = Object.entries(state.prices).map(([sym,p]) => `<div class="ticker-card"><b>${sym.replace("USDT","/USDT")}</b><span>${usd(p.price)}</span><em>${Number(p.change || 0).toFixed(2)}%</em></div>`).join("");
  ensureTradingView();
}
function renderUserHeader() {
  const u = state.user;
  if ($("userBadgeText")) $("userBadgeText").textContent = u ? (u.name || u.email || "User") : "Guest";
  if ($("userAvatar")) $("userAvatar").textContent = (u?.name || u?.email || "U").slice(0,1).toUpperCase();
  if ($("userVipBadge")) $("userVipBadge").textContent = String(u?.plan || "Free").toUpperCase();
  if ($("mockUserName")) $("mockUserName").textContent = u?.name || "User";
  if ($("planText")) $("planText").textContent = u?.plan || "Free";
}
function renderWallet() {
  const demo = state.accounts.DEMO.balance + state.accounts.DEMO.trades.reduce((a,t)=>a+updateTradePnl(t),0);
  const real = realWallet();
  if ($("walletBalance")) $("walletBalance").textContent = state.mode === "REAL" ? money(real) : money(demo);
  if ($("walletPageBalance")) $("walletPageBalance").textContent = money(real);
  if ($("mockDemoBalance")) $("mockDemoBalance").textContent = money(demo);
  if ($("mockRealBalance")) $("mockRealBalance").textContent = money(real);
  if ($("approvedDepositText")) $("approvedDepositText").textContent = money(approvedDeposits());
  if ($("tradeVolumeText")) $("tradeVolumeText").textContent = money(tradeVolume());
  if ($("profitEligibleText")) $("profitEligibleText").textContent = money(ledgerPnL());
  if ($("withdrawableAmountText")) $("withdrawableAmountText").textContent = money(withdrawable());
  const pending = state.withdrawalRequests.filter(w => String(w.userId) === userKey() && w.status === "PENDING").reduce((a,w)=>a+Number(w.amount||0),0);
  if ($("pendingWithdrawalText")) $("pendingWithdrawalText").textContent = money(pending);
  renderUserLogs();
}
function renderTrades() {
  const acc = currentAccount();
  if ($("activeTradesLog")) $("activeTradesLog").innerHTML = acc.trades.map(t => {
    updateTradePnl(t);
    return `<tr><td>${t.coin?.replace("USDT","/USDT")}</td><td>${t.side}</td><td>${money(t.amount)}</td><td>${usd(t.entry)}</td><td>${usd(t.current)}</td><td class="${t.pnl>=0?'pnl-plus':'pnl-minus'}">${money(t.pnl)}</td><td><button class="approve-btn" onclick="closeTrade('${t.id}','${state.mode}')">Close</button></td></tr>`;
  }).join("") || `<tr><td colspan="7" class="empty">No open trades.</td></tr>`;
}
function renderHistory() {
  const acc = currentAccount();
  const manual = [...acc.trades, ...acc.closedTrades];
  if ($("userManualTradesLog")) $("userManualTradesLog").innerHTML = manual.map(t => {
    if (t.status === "OPEN") updateTradePnl(t);
    return `<tr><td>${t.coin?.replace("USDT","/USDT")}</td><td>${t.side}</td><td>${money(t.amount)}</td><td>${usd(t.entry)}</td><td>${usd(t.close || t.current || t.entry)}</td><td class="${Number(t.pnl||0)>=0?'pnl-plus':'pnl-minus'}">${money(t.pnl)}</td><td>${t.status}</td></tr>`;
  }).join("") || `<tr><td colspan="7" class="empty">No manual trades yet.</td></tr>`;
  if ($("userManagedTradesLog")) $("userManagedTradesLog").innerHTML = state.managedTrades.filter(t => String(t.userId) === userKey()).map(t => `<tr><td>${t.coin}</td><td>${t.side}</td><td>${money(t.amount)}</td><td>${usd(t.entry)}</td><td>${t.close?usd(t.close):"-"}</td><td class="${t.pnl>=0?'pnl-plus':'pnl-minus'}">${money(t.pnl)}</td><td>${t.status}</td></tr>`).join("") || `<tr><td colspan="7" class="empty">No AI trades yet.</td></tr>`;
}
function renderAnalytics() {
  const rows = [...currentAccount().trades, ...currentAccount().closedTrades];
  rows.forEach(updateTradePnl);
  const total = rows.reduce((a,t)=>a+Number(t.pnl||0),0);
  const wins = rows.filter(t => Number(t.pnl||0)>0).length;
  if ($("totalTradesMetric")) $("totalTradesMetric").textContent = rows.length;
  if ($("totalPnlMetric")) $("totalPnlMetric").textContent = money(total);
  if ($("winRateMetric")) $("winRateMetric").textContent = rows.length ? Math.round(wins/rows.length*100)+"%" : "0%";
  if ($("todayPnlMini")) $("todayPnlMini").textContent = money(total);
}
function renderReferral() {
  if ($("myReferralCode")) $("myReferralCode").textContent = state.user?.referral_code || state.user?.id || "";
}
function renderPlans() {
  if ($("dynamicPlansGrid")) $("dynamicPlansGrid").innerHTML = state.plans.map(p => `<div class="plan-card"><h3>${p.name}</h3><h2>${money(p.price)}</h2><p>${p.duration}</p><p>AI Trades: ${p.aiTradeLimit}/day</p></div>`).join("");
}
function renderKycStatusMini() {
  const mine = latestKycForUser();
  if ($("kycStatusTitle")) $("kycStatusTitle").textContent = mine ? mine.status : "Not Submitted";
}
function renderUserLogs() {
  const uid = userKey();
  if ($("userDepositLog")) $("userDepositLog").innerHTML = state.depositRequests.filter(d => String(d.userId) === uid).map(d => `<tr><td>${money(d.amount)}</td><td>${d.txn||"-"}</td><td>${d.status}</td><td>${d.createdAt||""}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">No deposits.</td></tr>`;
  if ($("userWithdrawalLog")) $("userWithdrawalLog").innerHTML = state.withdrawalRequests.filter(w => String(w.userId) === uid).map(w => `<tr><td>${money(w.amount)}</td><td>${w.method}</td><td>${w.account || "-"}</td><td>${w.status}</td><td>${w.createdAt||""}</td></tr>`).join("") || `<tr><td colspan="5" class="empty">No withdrawals.</td></tr>`;
}
function renderAdmin() {
  if (state.user?.role !== "admin") return;
  if ($("adminTotalUsers")) $("adminTotalUsers").textContent = state.users.filter(u=>u.role!=="admin").length;
  if ($("adminTotalUsersMini")) $("adminTotalUsersMini").textContent = state.users.filter(u=>u.role!=="admin").length;
  const depTotal = state.depositRequests.filter(d=>d.status==="APPROVED").reduce((a,d)=>a+Number(d.amount||0),0);
  if ($("adminTotalDeposits")) $("adminTotalDeposits").textContent = money(depTotal);
  if ($("adminTotalDepositsMini")) $("adminTotalDepositsMini").textContent = money(depTotal);
  if ($("adminPendingDeposits")) $("adminPendingDeposits").textContent = state.depositRequests.filter(d=>d.status==="PENDING").length;
  if ($("adminPendingDepositsMini")) $("adminPendingDepositsMini").textContent = state.depositRequests.filter(d=>d.status==="PENDING").length;
  if ($("adminOpenTrades")) $("adminOpenTrades").textContent = state.managedTrades.filter(t=>t.status==="OPEN").length;
  if ($("adminOpenTradesMini")) $("adminOpenTradesMini").textContent = state.managedTrades.filter(t=>t.status==="OPEN").length;

  if ($("depositRequestsLog")) $("depositRequestsLog").innerHTML = state.depositRequests.map(d => `<tr><td>${d.userEmail}</td><td>${money(d.amount)}</td><td>${d.txn||"-"}</td><td>${d.status}</td><td>${d.status==="PENDING"?`<button class="approve-btn" onclick="approveDeposit('${d.id}')">Approve</button><button class="reject-btn" onclick="rejectDeposit('${d.id}')">Reject</button>`:"-"}</td></tr>`).join("") || `<tr><td colspan="5" class="empty">No deposits.</td></tr>`;
  if ($("withdrawalRequestsLog")) $("withdrawalRequestsLog").innerHTML = state.withdrawalRequests.map(w => `<tr><td>${w.userEmail}</td><td>${money(w.amount)}</td><td>${w.method}</td><td>${w.status}</td><td>${w.status==="PENDING"?`<button class="approve-btn" onclick="approveWithdrawal('${w.id}')">Approve</button><button class="reject-btn" onclick="rejectWithdrawal('${w.id}')">Reject</button>`:"-"}</td></tr>`).join("") || `<tr><td colspan="5" class="empty">No withdrawals.</td></tr>`;

  const kycBody = $("adminKycLog") || $("kycRequestsLog");
  if (kycBody) kycBody.innerHTML = state.kycRequests.map(k => `<tr><td>${k.userEmail || k.userId}</td><td>${k.name || "-"}</td><td>${k.docType || "KYC"}</td><td>${k.docNumber || "-"}</td><td>${Object.keys(k.documents||{}).length || "Uploaded"}</td><td><span class="pm-status ${String(k.status).toLowerCase()}">${k.status}</span></td><td>${k.status==="PENDING"?`<button class="approve-btn" onclick="approveKyc('${k.id}')">Approve</button><button class="reject-btn" onclick="rejectKyc('${k.id}')">Reject</button>`:`<span>Locked</span>`}</td></tr>`).join("") || `<tr><td colspan="7" class="empty">No KYC requests.</td></tr>`;

  if ($("paymentRequestsLog")) $("paymentRequestsLog").innerHTML = state.userPayoutMethods.map(m => `<tr><td>${m.userEmail || m.userId}</td><td>${m.type}</td><td>${m.type==="UPI" ? m.upi : `${m.bankName} ****${String(m.accountNumber||"").slice(-4)}`}</td><td>${m.holderName}</td><td>${m.status}</td><td>${m.status==="PENDING"?`<button class="approve-btn" onclick="approvePayoutMethod('${m.id}')">Approve</button><button class="reject-btn" onclick="rejectPayoutMethod('${m.id}')">Reject</button>`:`<span>Locked</span>`}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">No payout method requests.</td></tr>`;

  renderManagedAdmin();
}
function renderManagedAdmin() {
  const open = state.managedTrades.filter(t => t.status === "OPEN");
  if ($("managedTradeSelect")) $("managedTradeSelect").innerHTML = `<option value="">Select open trade</option>` + open.map(t => `<option value="${t.id}">${t.userEmail} ${t.coin}</option>`).join("");
  if ($("managedUserSelect")) $("managedUserSelect").innerHTML = `<option value="ALL">All Users</option>` + state.users.filter(u=>u.role!=="admin").map(u=>`<option value="${u.id || u.email}">${u.email}</option>`).join("");
  if ($("managedTradesLog")) $("managedTradesLog").innerHTML = state.managedTrades.map(t => `<tr><td>${t.userEmail}</td><td>${t.coin}</td><td>${t.side}</td><td>${money(t.amount)}</td><td>${usd(t.entry)}</td><td>${t.close?usd(t.close):"-"}</td><td class="${t.pnl>=0?'pnl-plus':'pnl-minus'}">${money(t.pnl)}</td><td>${t.status}</td><td>${t.status==="OPEN"?`<button class="reject-btn" onclick="$('managedTradeSelect').value='${t.id}';cancelManagedTrade()">Cancel</button>`:"-"}</td></tr>`).join("") || `<tr><td colspan="9" class="empty">No managed trades.</td></tr>`;
}
function renderSignal() {
  const s = state.adminSignal;
  if ($("aiSignalText")) $("aiSignalText").textContent = `${s.signal} ${s.coin?.replace("USDT","/USDT")}`;
  if ($("signalNote")) $("signalNote").textContent = s.note || "";
  if ($("userSignalCoin")) $("userSignalCoin").textContent = s.coin?.replace("USDT","/USDT");
  if ($("userTargetPrice")) $("userTargetPrice").textContent = usd(s.target);
  if ($("userStopLoss")) $("userStopLoss").textContent = usd(s.stop);
  if ($("userSignalExpiry")) $("userSignalExpiry").textContent = s.expiry;
}
function render() {
  showAuth(!state.user);
  renderUserHeader();
  renderPrices();
  renderWallet();
  renderTrades();
  renderHistory();
  renderAnalytics();
  renderReferral();
  renderPlans();
  renderKycStatusMini();
  renderSignal();
  renderAdmin();
}

/* ---------- UI helpers/events ---------- */
function openModal(id) { $(id)?.classList.add("show"); }
function closeModal(id) { $(id)?.classList.remove("show"); }
function setupEvents() {
  $("loginBtn")?.addEventListener("click", login);
  $("registerBtn")?.addEventListener("click", register);
  $("guestBtn")?.addEventListener("click", guestLogin);
  $("logoutBtn")?.addEventListener("click", logout);

  $("demoBtn")?.addEventListener("click", () => { state.mode="DEMO"; document.body.classList.add("demo-mode-active"); document.body.classList.remove("real-mode-active"); saveState(); render(); });
  $("realBtn")?.addEventListener("click", () => { state.mode="REAL"; document.body.classList.add("real-mode-active"); document.body.classList.remove("demo-mode-active"); saveState(); render(); });

  $("buyTradeBtn")?.addEventListener("click", () => openManualTrade("BUY"));
  $("sellTradeBtn")?.addEventListener("click", () => openManualTrade("SELL"));
  $("executeTradeBtn")?.addEventListener("click", () => openManualTrade("BUY"));

  $("openDepositBtn")?.addEventListener("click", () => openModal("depositModal"));
  $("openDepositBtn2")?.addEventListener("click", () => openModal("depositModal"));
  $("closeDepositModal")?.addEventListener("click", () => closeModal("depositModal"));
  $("submitDepositRequest")?.addEventListener("click", submitDeposit);

  $("openWithdrawBtn")?.addEventListener("click", () => openModal("withdrawModal"));
  $("closeWithdrawModal")?.addEventListener("click", () => closeModal("withdrawModal"));
  $("submitWithdrawRequest")?.addEventListener("click", submitWithdrawal);

  $("submitKycBtn")?.addEventListener("click", () => {
    const form = $("cleanKycForm");
    if (form) form.requestSubmit();
  });

  $("openManagedTradeBtn")?.addEventListener("click", openManagedTrade);
  $("closeManagedTradeBtn")?.addEventListener("click", closeManagedTrade);
  $("cancelManagedTradeBtn")?.addEventListener("click", cancelManagedTrade);
  $("openMassTradeBtn")?.addEventListener("click", openMassTrade);
  $("closeAllMassTradeBtn")?.addEventListener("click", closeAllMassTrades);

  document.addEventListener("input", e => {
    if (e.target?.id === "depositTxn") e.target.value = e.target.value.replace(/\D/g, "").slice(0, 12);
  });

  $$(".admin-tab").forEach(btn => btn.addEventListener("click", () => {
    $$(".admin-tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.adminTab;
    $$(".admin-panel").forEach(p => p.classList.remove("active-admin-panel"));
    $(tab)?.classList.add("active-admin-panel");
  }));
}

/* ---------- Expose ---------- */
Object.assign(window, {
  showPage, openRealMenuPage,
  login, register, logout,
  submitDeposit, approveDeposit, rejectDeposit,
  submitWithdrawal, approveWithdrawal, rejectWithdrawal,
  openManualTrade, closeTrade,
  renderKycPage, submitKycForm, approveKyc, rejectKyc,
  renderPaymentMethodsPage, approvePayoutMethod, rejectPayoutMethod,
  openManagedTrade, closeManagedTrade, cancelManagedTrade, openMassTrade, closeAllMassTrades,
  openModal, closeModal
});

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  loadState();
  setupNav();
  setupEvents();
  if (state.user) showAuth(false); else showAuth(true);
  await loadRemoteData();
  render();
  if (state.user && !isAdminPage) showPage("dashboard");
  if (state.user && isAdminPage && state.user.role === "admin") showPage("admin");
  fetchPrices();
  setInterval(fetchPrices, 7000);
  setInterval(() => {
    renderTrades();
    renderWallet();
    renderAnalytics();
  }, 2000);
});
