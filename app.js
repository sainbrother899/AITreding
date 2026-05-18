
/* =========================================================
   AI Trading Assistant - Clean Core Rebuild
   UI same, logic rebuilt clean.
   ========================================================= */

const $ = (id) => document.getElementById(id);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));
const cfg = window.APP_CONFIG || {};
const isAdminPage = /admin\.html/i.test(location.pathname) || document.body?.dataset?.adminPage === "true";
const LS_KEY = "ai_trading_clean_core_v1";
const SESSION_KEY = isAdminPage ? "ai_admin_session_v1" : "ai_user_session_v1";
let supabaseClient = null;

try {
  if (window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
    supabaseClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.warn("Supabase init failed", e);
}

const DEFAULT_PRICES = {
  BTCUSDT: { price: 68000, change: 1.2 },
  ETHUSDT: { price: 3600, change: .8 },
  SOLUSDT: { price: 160, change: 1.8 },
  BNBUSDT: { price: 590, change: .4 }
};

const DEFAULT_PLANS = [
  { id: "free", name: "Free", price: 0, duration: "Lifetime", signalLimit: 5, aiTradeLimit: 5, features: ["5 AI/Admin trades per day", "Manual trades unlimited"] },
  { id: "pro", name: "Pro", price: 499, duration: "30 days", signalLimit: 50, aiTradeLimit: 10, features: ["10 AI/Admin trades per day", "Premium signals"] },
  { id: "elite", name: "Elite", price: 999, duration: "30 days", signalLimit: 999999, aiTradeLimit: 25, features: ["25 AI/Admin trades per day", "Priority AI trades"] }
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
  paymentRequests: [],
  walletLedger: [],
  plans: DEFAULT_PLANS,
  aiTradeUsage: {},
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

function money(n) {
  const v = Number(n || 0);
  return "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
function usd(n) {
  const v = Number(n || 0);
  return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
function toast(msg) {
  const el = $("toast");
  if (el) {
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 3000);
  } else {
    console.log(msg);
  }
}
function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify({
    users: state.users,
    accounts: state.accounts,
    mode: state.mode,
    prices: state.prices,
    depositRequests: state.depositRequests,
    withdrawalRequests: state.withdrawalRequests,
    managedTrades: state.managedTrades,
    referrals: state.referrals,
    kycRequests: state.kycRequests,
    paymentRequests: state.paymentRequests,
    walletLedger: state.walletLedger,
    plans: state.plans,
    aiTradeUsage: state.aiTradeUsage,
    adminSignal: state.adminSignal
  }));
}
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    Object.assign(state, saved || {});
    state.accounts = state.accounts || {};
    state.accounts.DEMO = state.accounts.DEMO || { balance: 100000, trades: [], closedTrades: [] };
    state.accounts.REAL = state.accounts.REAL || { balance: 0, trades: [], closedTrades: [] };
    state.accounts.DEMO.trades ||= [];
    state.accounts.DEMO.closedTrades ||= [];
    state.accounts.REAL.trades ||= [];
    state.accounts.REAL.closedTrades ||= [];
    state.plans = state.plans?.length ? state.plans : DEFAULT_PLANS;
    state.prices = { ...DEFAULT_PRICES, ...(state.prices || {}) };
  } catch (e) {}
  try {
    const sess = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (sess) state.user = sess;
  } catch (e) {}
}
function saveSession() {
  if (state.user) localStorage.setItem(SESSION_KEY, JSON.stringify(state.user));
  else localStorage.removeItem(SESSION_KEY);
}
function normalizeEmail(v) { return String(v || "").trim().toLowerCase(); }
function currentAccount() {
  state.accounts[state.mode] ||= { balance: state.mode === "DEMO" ? 100000 : 0, trades: [], closedTrades: [] };
  return state.accounts[state.mode];
}
function userKey(u = state.user) {
  return String(u?.id || u?.email || "local");
}
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function priceOf(coin) {
  return Number(state.prices?.[coin]?.price || DEFAULT_PRICES[coin]?.price || 100);
}
function planByName(name) {
  const n = String(name || "Free").toLowerCase();
  return (state.plans || DEFAULT_PLANS).find(p => String(p.name).toLowerCase() === n || String(p.id).toLowerCase() === n) || DEFAULT_PLANS[0];
}
function getPlan() {
  return state.user?.plan || "Free";
}
function aiLimitForUser(u) {
  const p = planByName(u?.plan || "Free");
  return Number(p.aiTradeLimit ?? p.ai_trade_limit ?? 5);
}
function aiUsageKey(u = state.user) {
  return `${userKey(u)}_REAL_${todayKey()}`;
}
function aiUsed(u = state.user) {
  return Number(state.aiTradeUsage?.[aiUsageKey(u)] || 0);
}
function incAiUsage(u) {
  state.aiTradeUsage ||= {};
  state.aiTradeUsage[aiUsageKey(u)] = aiUsed(u) + 1;
}
function decAiUsage(u) {
  state.aiTradeUsage ||= {};
  state.aiTradeUsage[aiUsageKey(u)] = Math.max(0, aiUsed(u) - 1);
}
function canReceiveAi(u) {
  return u?.autoTradePermission !== false && aiUsed(u) < aiLimitForUser(u);
}
function referralCode(user) {
  let code = user?.referral_code || user?.referralCode;
  if (!code) {
    const base = normalizeEmail(user?.email || user?.id || ("u" + Date.now()));
    code = base.replace(/[^a-z0-9]/g, "").slice(0, 8) + String(Math.floor(1000 + Math.random() * 9000));
    user.referral_code = code;
    user.referralCode = code;
  }
  return code;
}
function userByIdOrEmail(id, email) {
  const em = normalizeEmail(email);
  return (state.users || []).find(u => String(u.id) === String(id) || (!!em && normalizeEmail(u.email) === em));
}

/* ---------- Supabase helpers ---------- */
async function dbInsert(table, row) {
  if (!supabaseClient) return { data: null, error: null };
  let res = await supabaseClient.from(table).insert(row);
  if (res?.error && String(res.error.message || "").includes("invalid input syntax for type bigint") && row && row.id) {
    const safe = { ...row };
    delete safe.id;
    res = await supabaseClient.from(table).insert(safe);
  }
  return res;
}
async function dbUpdate(table, patch, col, val) {
  if (!supabaseClient) return { data: null, error: null };
  return await supabaseClient.from(table).update(patch).eq(col, val);
}

async function loadRemoteData() {
  if (!supabaseClient) return;
  try {
    const { data: profiles } = await supabaseClient.from("profiles").select("*");
    if (profiles) {
      const local = new Map((state.users || []).map(u => [String(u.id || u.email), u]));
      profiles.forEach(p => {
        const id = p.id || p.user_id || p.email;
        const old = local.get(String(id)) || {};
        local.set(String(id), {
          ...old,
          id,
          name: p.name || old.name || (p.email ? String(p.email).split("@")[0] : "User"),
          email: p.email || old.email || "",
          mobile: p.mobile || old.mobile || "",
          role: p.role || old.role || "user",
          plan: p.plan || old.plan || "Free",
          referral_code: p.referral_code || old.referral_code || old.referralCode,
          referralCode: p.referral_code || old.referralCode || old.referral_code,
          referred_by: p.referred_by || old.referred_by || old.referredBy,
          referredBy: p.referred_by || old.referredBy || old.referred_by,
          autoTradePermission: old.autoTradePermission !== false
        });
      });
      state.users = Array.from(local.values());
    }
  } catch (e) { console.warn(e); }

  const loadTable = async (table, mapper, target) => {
    try {
      const { data } = await supabaseClient.from(table).select("*");
      if (data) state[target] = data.map(mapper);
    } catch (e) {}
  };

  await loadTable("deposit_requests", r => ({
    id: String(r.id), userId: r.user_id, userEmail: r.user_email, userName: r.user_name,
    amount: Number(r.amount || 0), txn: r.txn || "", status: r.status || "PENDING",
    createdAt: r.created_at_text || r.created_at || ""
  }), "depositRequests");

  await loadTable("withdrawal_requests", r => ({
    id: String(r.id), userId: r.user_id, userEmail: r.user_email,
    amount: Number(r.amount || 0), method: r.method || r.withdraw_method || "",
    account: r.account || r.account_detail || "", name: r.name || "", ifsc: r.ifsc || "",
    status: r.status || "PENDING", createdAt: r.created_at_text || r.created_at || ""
  }), "withdrawalRequests");

  await loadTable("managed_trades", r => ({
    id: String(r.id), userId: r.user_id, userEmail: r.user_email, coin: r.coin, side: r.side,
    risk: r.risk || "MEDIUM", amount: Number(r.amount || 0),
    entry: Number(r.entry_price || 0), close: r.close_price == null ? null : Number(r.close_price),
    pnl: Number(r.pnl || 0), status: r.status || "OPEN", source: r.source || "ADMIN_MANAGED",
    openedAt: r.opened_at || "", closedAt: r.closed_at || ""
  }), "managedTrades");

  await loadTable("referrals", r => ({
    id: String(r.id), referrerId: r.referrer_id, referrerEmail: r.referrer_email,
    userId: r.user_id, userEmail: r.user_email, depositId: r.deposit_id,
    depositAmount: Number(r.deposit_amount || 0), bonusAmount: Number(r.bonus_amount || 0),
    percent: Number(r.percent || 0), status: r.status || "PAID"
  }), "referrals");

  await loadTable("wallet_ledger", r => ({
    id: String(r.id), userId: r.user_id, type: r.type, amount: Number(r.amount || 0), note: r.note || ""
  }), "walletLedger");

  try {
    const { data: plans } = await supabaseClient.from("subscription_plans").select("*");
    if (plans && plans.length) {
      state.plans = plans.map(p => ({
        id: p.id || String(p.name || "").toLowerCase(),
        name: p.name,
        price: Number(p.price || 0),
        duration: p.duration || "30 days",
        signalLimit: Number(p.signal_limit || 5),
        aiTradeLimit: Number(p.ai_trade_limit || 5),
        features: Array.isArray(p.features) ? p.features : String(p.features || "").split("\n").filter(Boolean)
      }));
    }
  } catch (e) {}

  saveState();
}

/* ---------- Auth ---------- */
function showAuth(show = true) {
  $("authPage")?.classList.toggle("hidden", !show);
  $("appPage")?.classList.toggle("hidden", show);
  $("logoutBtn")?.classList.toggle("hidden", show);
}
function afterLogin(user) {
  state.user = user;
  state.mode = user.role === "admin" ? "REAL" : (state.mode || "DEMO");
  referralCode(state.user);
  const existing = userByIdOrEmail(user.id, user.email);
  if (existing) Object.assign(existing, user);
  else state.users.push(user);
  saveSession();
  saveState();
  showAuth(false);
  document.body.classList.toggle("demo-mode-active", state.mode === "DEMO");
  document.body.classList.toggle("real-mode-active", state.mode === "REAL");
  if (isAdminPage && user.role === "admin") showPage("admin");
  else showPage("dashboard");
  loadRemoteData().then(render);
  render();
}
async function login() {
  const email = normalizeEmail($("loginEmail")?.value);
  const pass = $("loginPassword")?.value || "";
  if (!email || !pass) return toast("Email और password डालो.");

  if (isAdminPage && email === normalizeEmail(cfg.ADMIN_EMAIL || "admin@aitrade.local") && pass === (cfg.ADMIN_PASSWORD || "admin123")) {
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
        } catch (e) {}
        return afterLogin({
          id: data.user.id,
          email,
          name: profile?.name || email.split("@")[0],
          mobile: profile?.mobile || "",
          role: profile?.role || "user",
          plan: profile?.plan || "Free",
          referral_code: profile?.referral_code,
          referred_by: profile?.referred_by,
          autoTradePermission: true
        });
      }
    } catch (e) {}
  }

  const user = state.users.find(u => normalizeEmail(u.email) === email && (u.password === pass || !u.password));
  if (user) return afterLogin(user);
  toast("Login failed. Email/password check karo.");
}
async function register() {
  const name = $("regName")?.value?.trim() || "User";
  const email = normalizeEmail($("regEmail")?.value);
  const mobile = $("regMobile")?.value?.trim() || "";
  const pass = $("regPassword")?.value || "";
  const ref = $("regReferral")?.value?.trim() || new URLSearchParams(location.search).get("ref") || "";
  if (!email || !pass) return toast("Email और password required है.");

  let id = "u_" + Date.now();
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.auth.signUp({ email, password: pass });
      if (!error && data?.user?.id) id = data.user.id;
    } catch (e) {}
  }

  const user = { id, name, email, mobile, password: pass, role: "user", plan: "Free", referred_by: ref, referredBy: ref, autoTradePermission: true };
  user.referral_code = referralCode(user);
  user.referralCode = user.referral_code;

  const existing = userByIdOrEmail(id, email);
  if (existing) Object.assign(existing, user);
  else state.users.push(user);

  if (supabaseClient) {
    try {
      await supabaseClient.from("profiles").upsert({
        id, name, email, mobile, role: "user", plan: "Free",
        referral_code: user.referral_code, referred_by: ref || null
      }, { onConflict: "id" });
    } catch (e) { console.warn("profile upsert failed", e); }
  }

  afterLogin(user);
  toast("Account created.");
}
function logout() {
  state.user = null;
  saveSession();
  showAuth(true);
  render();
}
function guestLogin() {
  afterLogin({ id: "guest", email: "guest@demo.local", name: "Guest", role: "user", plan: "Free", autoTradePermission: true });
}

/* ---------- Navigation ---------- */
function showPage(pageId) {
  qsa("#appPage .page").forEach(p => p.classList.remove("active-page"));
  const target = $(pageId);
  if (target) target.classList.add("active-page");
  qsa(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.page === pageId));
  if (pageId === "aiHistory") renderHistory();
  if (pageId === "wallet") renderWallet();
  if (pageId === "referral") renderReferral();
  if (pageId === "subscription") renderPlans();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function setupNav() {
  document.addEventListener("click", e => {
    const nav = e.target.closest("[data-page]");
    if (nav) {
      e.preventDefault();
      showPage(nav.dataset.page);
    }
    const direct = e.target.closest("[data-direct-page]");
    if (direct) {
      e.preventDefault();
      showPage(direct.dataset.directPage);
      $("topMoreDropdown")?.classList.remove("show");
    }
  });
  $("topMoreMenuBtn")?.addEventListener("click", e => {
    e.preventDefault();
    $("topMoreDropdown")?.classList.toggle("show");
  });
  document.addEventListener("click", e => {
    if (!e.target.closest(".top-more-wrap")) $("topMoreDropdown")?.classList.remove("show");
  });
  qsa("[data-auth-tab]").forEach(btn => btn.addEventListener("click", () => {
    qsa("[data-auth-tab]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.authTab;
    $("loginForm")?.classList.toggle("active-form", tab === "login");
    $("registerForm")?.classList.toggle("active-form", tab === "register");
  }));
}

/* ---------- Prices ---------- */
async function fetchPrices() {
  try {
    const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];
    const res = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbols=" + encodeURIComponent(JSON.stringify(symbols)));
    const data = await res.json();
    data.forEach(d => {
      state.prices[d.symbol] = { price: Number(d.lastPrice), change: Number(d.priceChangePercent) };
    });
  } catch (e) {
    Object.keys(state.prices).forEach(k => {
      const p = state.prices[k].price;
      const move = (Math.random() - .5) * p * .001;
      state.prices[k].price = Math.max(1, p + move);
      state.prices[k].change = Number(state.prices[k].change || 0) + (Math.random() - .5) * .05;
    });
  }
  renderPrices();
}

/* ---------- Wallet / Ledger ---------- */
function ledgerForUser(uid = userKey()) {
  return (state.walletLedger || []).filter(l => String(l.userId || l.user_id) === String(uid));
}
function approvedDeposits(uid = userKey()) {
  const req = (state.depositRequests || []).filter(d => String(d.userId) === String(uid) && d.status === "APPROVED").reduce((a, d) => a + Number(d.amount || 0), 0);
  const led = ledgerForUser(uid).filter(l => l.type === "DEPOSIT").reduce((a, l) => a + Number(l.amount || 0), 0);
  return Math.max(req, led);
}
function approvedWithdrawals(uid = userKey()) {
  const req = (state.withdrawalRequests || []).filter(w => String(w.userId) === String(uid) && w.status === "APPROVED").reduce((a, w) => a + Number(w.amount || 0), 0);
  const led = ledgerForUser(uid).filter(l => l.type === "WITHDRAWAL").reduce((a, l) => a + Math.abs(Number(l.amount || 0)), 0);
  return Math.max(req, led);
}
function ledgerPnL(uid = userKey()) {
  return ledgerForUser(uid).filter(l => ["TRADE_PNL", "MANAGED_TRADE_PNL", "MASS_TRADE_PNL", "REFERRAL_BONUS"].includes(l.type)).reduce((a, l) => a + Number(l.amount || 0), 0);
}
function openPnl(mode = state.mode) {
  const acc = state.accounts[mode] || {};
  return (acc.trades || []).reduce((a, t) => a + updateTradePnl(t), 0);
}
function realWallet(uid = userKey()) {
  return approvedDeposits(uid) + ledgerPnL(uid) - approvedWithdrawals(uid);
}
function tradeVolume(uid = userKey()) {
  const closed = (state.accounts.REAL.closedTrades || []).filter(t => !t.userId || String(t.userId) === String(uid)).reduce((a, t) => a + Number(t.amount || 0), 0);
  const managed = (state.managedTrades || []).filter(t => String(t.userId) === String(uid) && t.status === "CLOSED").reduce((a, t) => a + Number(t.amount || 0), 0);
  return closed + managed;
}
function withdrawable(uid = userKey()) {
  const dep = approvedDeposits(uid);
  const vol = tradeVolume(uid);
  const pnl = ledgerPnL(uid);
  const pending = (state.withdrawalRequests || []).filter(w => String(w.userId) === String(uid) && w.status === "PENDING").reduce((a, w) => a + Number(w.amount || 0), 0);
  const unlocked = Math.min(dep, vol) + Math.max(0, pnl);
  return Math.max(0, unlocked - approvedWithdrawals(uid) - pending);
}
async function submitDeposit() {
  if (!state.user) return toast("Login required.");
  const amount = Number(String($("depositAmount")?.value || "").replace(/,/g, ""));
  const txn = String($("depositTxn")?.value || "").replace(/\D/g, "").slice(0, 12);
  if (!amount || amount < 1000) return alert("Minimum deposit ₹1000 है.");
  if (!/^\d{12}$/.test(txn)) return alert("UTR exactly 12 digit होना चाहिए.");
  const dupLocal = (state.depositRequests || []).some(d => String(d.txn) === txn);
  if (dupLocal) return alert("Duplicate UTR");
  if (supabaseClient) {
    try {
      const { data } = await supabaseClient.from("deposit_requests").select("id").eq("txn", txn).limit(1);
      if (data?.length) return alert("Duplicate UTR");
    } catch (e) {}
  }
  const req = {
    id: "dep_" + Date.now(), userId: state.user.id, userEmail: state.user.email,
    userName: state.user.name, amount, txn, status: "PENDING", createdAt: new Date().toLocaleString()
  };
  state.depositRequests.unshift(req);
  if (supabaseClient) {
    const { error } = await supabaseClient.from("deposit_requests").insert({
      id: req.id, user_id: req.userId, user_email: req.userEmail, user_name: req.userName,
      amount, txn, status: "PENDING", created_at_text: req.createdAt
    });
    if (error) {
      state.depositRequests = state.depositRequests.filter(d => d.id !== req.id);
      saveState();
      return alert("Deposit save error: " + error.message);
    }
  }
  $("depositAmount").value = "";
  $("depositTxn").value = "";
  closeModal("depositModal");
  saveState(); render();
  toast("Deposit request submitted.");
}
async function approveDeposit(id) {
  const d = state.depositRequests.find(x => x.id === id);
  if (!d) return;
  d.status = "APPROVED";
  await dbUpdate("deposit_requests", { status: "APPROVED" }, "id", id);
  const led = { id: "led_" + Date.now(), userId: d.userId, type: "DEPOSIT", amount: d.amount, note: "Deposit approved" };
  state.walletLedger.unshift(led);
  await dbInsert("wallet_ledger", { user_id: d.userId, type: "DEPOSIT", amount: d.amount, note: led.note });
  await applyReferralBonus(d);
  saveState(); render();
  toast("Deposit approved.");
}
async function rejectDeposit(id) {
  const d = state.depositRequests.find(x => x.id === id);
  if (!d) return;
  d.status = "REJECTED";
  await dbUpdate("deposit_requests", { status: "REJECTED" }, "id", id);
  saveState(); render();
}
async function submitWithdrawal() {
  if (!state.user) return;
  const amount = Number($("withdrawAmount")?.value || 0);
  if (!amount || amount < 1000) return toast("Minimum withdrawal ₹1000.");
  if (amount > withdrawable()) return toast("Withdrawable amount se jyada nahi.");
  const req = {
    id: "local_wd_" + Date.now(), userId: state.user.id, userEmail: state.user.email, amount,
    method: $("withdrawMethod")?.value || "UPI", account: $("withdrawAccount")?.value || "",
    name: $("withdrawName")?.value || "", ifsc: $("withdrawIfsc")?.value || "", status: "PENDING",
    createdAt: new Date().toLocaleString()
  };
  state.withdrawalRequests.unshift(req);
  if (supabaseClient) {
    const { data, error } = await supabaseClient.from("withdrawal_requests").insert({
      user_id: req.userId, user_email: req.userEmail, amount,
      method: req.method, account: req.account, name: req.name, ifsc: req.ifsc,
      status: "PENDING", created_at_text: req.createdAt
    }).select("id").single();
    if (!error && data?.id !== undefined && data?.id !== null) req.id = String(data.id);
  }
  closeModal("withdrawModal");
  saveState(); render();
  toast("Withdrawal request submitted.");
}
async function approveWithdrawal(id) {
  const w = state.withdrawalRequests.find(x => x.id === id);
  if (!w) return;
  w.status = "APPROVED";
  await dbUpdate("withdrawal_requests", { status: "APPROVED" }, "id", id);
  state.walletLedger.unshift({ id: "led_" + Date.now(), userId: w.userId, type: "WITHDRAWAL", amount: -Math.abs(w.amount), note: "Withdrawal approved" });
  await dbInsert("wallet_ledger", { user_id: w.userId, type: "WITHDRAWAL", amount: -Math.abs(w.amount), note: "Withdrawal approved" });
  saveState(); render();
}
async function rejectWithdrawal(id) {
  const w = state.withdrawalRequests.find(x => x.id === id);
  if (!w) return;
  w.status = "REJECTED";
  await dbUpdate("withdrawal_requests", { status: "REJECTED" }, "id", id);
  saveState(); render();
}

/* ---------- Referral ---------- */
async function applyReferralBonus(dep) {
  const referredUser = userByIdOrEmail(dep.userId, dep.userEmail);
  let code = referredUser?.referred_by || referredUser?.referredBy || "";
  if (!code && supabaseClient) {
    try {
      const { data } = await supabaseClient.from("profiles").select("referred_by").eq("id", dep.userId).maybeSingle();
      code = data?.referred_by || "";
    } catch (e) {}
  }
  if (!code) return;
  let referrer = (state.users || []).find(u => String(u.referral_code || u.referralCode || u.id || u.email).toLowerCase() === String(code).toLowerCase());
  if (!referrer && supabaseClient) {
    try {
      const { data } = await supabaseClient.from("profiles").select("*").eq("referral_code", code).maybeSingle();
      if (data) referrer = { id: data.id, email: data.email, name: data.name };
    } catch (e) {}
  }
  if (!referrer?.id) return;
  const already = (state.referrals || []).some(r => String(r.userId) === String(dep.userId) && Number(r.percent) === 10 && r.status === "PAID");
  if (already) return;
  if (supabaseClient) {
    try {
      const { data } = await supabaseClient.from("referrals").select("id").eq("user_id", dep.userId).eq("percent", 10).eq("status", "PAID").limit(1);
      if (data?.length) return;
    } catch (e) {}
  }
  const bonus = Number((Number(dep.amount || 0) * 0.10).toFixed(2));
  const rec = { id: "ref_" + Date.now(), referrerId: referrer.id, referrerEmail: referrer.email || "", userId: dep.userId, userEmail: dep.userEmail, depositId: dep.id, depositAmount: dep.amount, bonusAmount: bonus, percent: 10, status: "PAID" };
  state.referrals.unshift(rec);
  await dbInsert("referrals", { referrer_id: rec.referrerId, referrer_email: rec.referrerEmail, user_id: rec.userId, user_email: rec.userEmail, deposit_id: rec.depositId, deposit_amount: rec.depositAmount, bonus_amount: rec.bonusAmount, percent: 10, status: "PAID" });
  state.walletLedger.unshift({ id: "led_ref_" + Date.now(), userId: referrer.id, type: "REFERRAL_BONUS", amount: bonus, note: "10% first deposit referral bonus" });
  await dbInsert("wallet_ledger", { user_id: referrer.id, type: "REFERRAL_BONUS", amount: bonus, note: "10% first deposit referral bonus" });
}

/* ---------- Trading ---------- */
function updateTradePnl(t) {
  const current = priceOf(t.coin);
  t.current = t.status === "OPEN" ? current : (t.current || t.close || current);
  const diff = t.side === "SELL" ? (Number(t.entry) - Number(t.current)) : (Number(t.current) - Number(t.entry));
  t.pnl = (diff / Number(t.entry || 1)) * Number(t.amount || 0) * Number(t.leverage || 1);
  t.roi = (t.pnl / Number(t.amount || 1)) * 100;
  return Number(t.pnl || 0);
}
function openManualTrade(side) {
  const acc = currentAccount();
  const coin = $("coinSelect")?.value || "BTCUSDT";
  const amount = Number($("tradeAmountInput")?.value || 0);
  if (!amount || amount <= 0) return toast("Trade amount डालो.");
  if (state.mode === "REAL" && amount > realWallet()) return toast("Wallet balance कम है.");
  const t = {
    id: "tr_" + Date.now(), userId: state.user?.id, userEmail: state.user?.email, coin, side,
    amount, entry: priceOf(coin), current: priceOf(coin), leverage: Number($("leverageSelect")?.value || 1),
    orderType: $("orderType")?.value || "MARKET", status: "OPEN", source: "USER", openedAt: new Date().toLocaleString()
  };
  acc.trades.unshift(t);
  saveState(); render();
}
async function closeTrade(id, mode = state.mode) {
  const acc = state.accounts[mode];
  const idx = (acc.trades || []).findIndex(t => t.id === id);
  if (idx < 0) return;
  const t = acc.trades[idx];
  updateTradePnl(t);
  t.status = "CLOSED";
  t.closedAt = new Date().toLocaleString();
  acc.trades.splice(idx, 1);
  acc.closedTrades.unshift(t);
  if (mode === "REAL") {
    state.walletLedger.unshift({ id: "led_" + Date.now(), userId: state.user.id, type: "TRADE_PNL", amount: t.pnl, note: "Manual trade PnL" });
    await dbInsert("wallet_ledger", { user_id: state.user.id, type: "TRADE_PNL", amount: t.pnl, note: "Manual trade PnL" });
  }
  saveState(); render();
}
function pnlForManaged(side, entry, close, amount) {
  const diff = side === "SELL" ? Number(entry) - Number(close) : Number(close) - Number(entry);
  return (diff / Number(entry || 1)) * Number(amount || 0);
}
async function openManagedTrade() {
  if (state.user?.role !== "admin") return;
  const target = $("managedUserSelect")?.value || "ALL";
  const users = (state.users || []).filter(u => u.role !== "admin");
  const targets = target === "ALL" ? users.filter(canReceiveAi) : users.filter(u => String(u.id || u.email) === String(target) && canReceiveAi(u));
  if (!targets.length) return toast("No eligible user found.");
  const coin = $("managedCoin")?.value || "BTCUSDT";
  const side = $("managedSide")?.value || "BUY";
  const amount = Number($("managedAmount")?.value || 0);
  const entry = Number($("managedEntryPrice")?.value || priceOf(coin));
  const risk = $("managedRisk")?.value || "MEDIUM";
  for (const u of targets) {
    const t = { id: "mg_" + Date.now() + "_" + Math.random().toString(16).slice(2), userId: u.id, userEmail: u.email, coin, side, risk, amount, entry, close: null, pnl: 0, status: "OPEN", source: "ADMIN_MANAGED", openedAt: new Date().toLocaleString() };
    state.managedTrades.unshift(t);
    incAiUsage(u);
    await dbInsert("managed_trades", { id: t.id, user_id: u.id, user_email: u.email, coin, side, risk, amount, entry_price: entry, pnl: 0, status: "OPEN", source: t.source, opened_at: t.openedAt });
  }
  saveState(); render();
}
async function closeManagedTrade() {
  const id = $("managedTradeSelect")?.value;
  const close = Number($("managedClosePrice")?.value || 0);
  if (!id || !close) return toast("Trade और close price select करो.");
  const t = state.managedTrades.find(x => x.id === id);
  if (!t || t.status !== "OPEN") return;
  t.close = close; t.pnl = pnlForManaged(t.side, t.entry, close, t.amount); t.status = "CLOSED"; t.closedAt = new Date().toLocaleString();
  await dbUpdate("managed_trades", { close_price: close, pnl: t.pnl, status: "CLOSED", closed_at: t.closedAt }, "id", id);
  state.walletLedger.unshift({ id: "led_" + Date.now(), userId: t.userId, type: t.source === "ADMIN_MASS" ? "MASS_TRADE_PNL" : "MANAGED_TRADE_PNL", amount: t.pnl, note: "Admin trade PnL" });
  await dbInsert("wallet_ledger", { user_id: t.userId, type: t.source === "ADMIN_MASS" ? "MASS_TRADE_PNL" : "MANAGED_TRADE_PNL", amount: t.pnl, note: "Admin trade PnL" });
  saveState(); render();
}
async function cancelManagedTrade() {
  const id = $("managedTradeSelect")?.value;
  const t = state.managedTrades.find(x => x.id === id);
  if (!t || t.status !== "OPEN") return;
  t.status = "CANCELLED"; t.pnl = 0; t.closedAt = new Date().toLocaleString();
  decAiUsage({ id: t.userId, email: t.userEmail });
  await dbUpdate("managed_trades", { status: "CANCELLED", pnl: 0, closed_at: t.closedAt }, "id", id);
  saveState(); render();
}
async function openMassTrade() {
  if (state.user?.role !== "admin") return;
  $("managedUserSelect").value = "ALL";
  $("managedCoin").value = $("massTradeCoin")?.value || "BTCUSDT";
  $("managedSide").value = $("massTradeSide")?.value || "BUY";
  $("managedRisk").value = $("massTradeRisk")?.value || "MEDIUM";
  $("managedAmount").value = $("massTradeAmount")?.value || 100;
  $("managedEntryPrice").value = priceOf($("managedCoin").value);
  await openManagedTrade();
  state.managedTrades.filter(t => t.source === "ADMIN_MANAGED" && t.openedAt).slice(0, state.users.length).forEach(t => t.source = "ADMIN_MASS");
  saveState(); render();
}
async function closeAllMassTrades() {
  const close = Number($("massClosePrice")?.value || 0);
  if (!close) return toast("Close price required.");
  const open = state.managedTrades.filter(t => t.source === "ADMIN_MASS" && t.status === "OPEN");
  for (const t of open) {
    t.close = close; t.pnl = pnlForManaged(t.side, t.entry, close, t.amount); t.status = "CLOSED"; t.closedAt = new Date().toLocaleString();
    await dbUpdate("managed_trades", { close_price: close, pnl: t.pnl, status: "CLOSED", closed_at: t.closedAt }, "id", t.id);
    state.walletLedger.unshift({ id: "led_" + Date.now(), userId: t.userId, type: "MASS_TRADE_PNL", amount: t.pnl, note: "Mass trade PnL" });
    await dbInsert("wallet_ledger", { user_id: t.userId, type: "MASS_TRADE_PNL", amount: t.pnl, note: "Mass trade PnL" });
  }
  saveState(); render();
}

/* ---------- KYC / Plans / Signals ---------- */
async function submitKyc() {
  const req = { id: "kyc_" + Date.now(), userId: state.user.id, userEmail: state.user.email, name: $("kycName")?.value, mobile: $("kycMobile")?.value, docType: $("kycDocType")?.value, docNumber: $("kycDocNumber")?.value, status: "PENDING" };
  state.kycRequests.unshift(req);
  if (supabaseClient) {
    const { data } = await supabaseClient.from("kyc_requests").insert({
      user_id: req.userId, user_email: req.userEmail, name: req.name, mobile: req.mobile,
      doc_type: req.docType, doc_number: req.docNumber, status: req.status
    }).select("id").single();
    if (data?.id !== undefined && data?.id !== null) req.id = String(data.id);
  }
  saveState(); render(); toast("KYC submitted.");
}
async function approveKyc(id) {
  const k = state.kycRequests.find(x => x.id === id); if (!k) return;
  k.status = "APPROVED"; await dbUpdate("kyc_requests", { status: "APPROVED" }, "id", id); saveState(); render();
}
function saveSignal() {
  state.adminSignal = {
    coin: $("adminSignalCoin")?.value || "BTCUSDT",
    signal: $("adminSignal")?.value || "BUY",
    entry: Number($("adminEntryPrice")?.value || priceOf($("adminSignalCoin")?.value || "BTCUSDT")),
    target: Number($("adminTargetPrice")?.value || 0),
    stop: Number($("adminStopLoss")?.value || 0),
    confidence: Number($("adminConfidence")?.value || 80),
    risk: $("adminRiskLevel")?.value || "MEDIUM",
    expiry: $("adminSignalExpiry")?.value || "30 minutes",
    note: $("adminNote")?.value || "Admin signal active."
  };
  saveState(); render(); toast("Signal saved.");
}
async function savePlan() {
  const id = $("planEditId")?.value || ("plan_" + Date.now());
  const plan = {
    id, name: $("planNameInput")?.value || "Plan", price: Number($("planPriceInput")?.value || 0),
    duration: $("planDurationInput")?.value || "30 days",
    signalLimit: Number($("planSignalLimitInput")?.value || 5),
    aiTradeLimit: Number($("planAiLimitInput")?.value || 5),
    features: String($("planFeaturesInput")?.value || "").split("\n").filter(Boolean)
  };
  const idx = state.plans.findIndex(p => p.id === id);
  if (idx >= 0) state.plans[idx] = plan; else state.plans.push(plan);
  await dbInsert("subscription_plans", { id: plan.id, name: plan.name, price: plan.price, duration: plan.duration, signal_limit: plan.signalLimit, ai_trade_limit: plan.aiTradeLimit, features: plan.features });
  saveState(); render(); toast("Plan saved.");
}

/* ---------- Render ---------- */
function renderPrices() {
  const btc = state.prices.BTCUSDT;
  if ($("headerBtcPrice")) $("headerBtcPrice").textContent = usd(btc.price);
  if ($("tradePairPrice")) $("tradePairPrice").textContent = usd(priceOf($("coinSelect")?.value || "BTCUSDT"));
  if ($("tradePairChange")) $("tradePairChange").textContent = `${Number(state.prices[$("coinSelect")?.value || "BTCUSDT"]?.change || 0).toFixed(2)}%`;
  renderTickers();
}
function renderTickers() {
  const html = Object.entries(state.prices).map(([sym, p]) => `<div class="ticker-card"><b>${sym.replace("USDT","/USDT")}</b><span>${usd(p.price)}</span><em>${Number(p.change || 0).toFixed(2)}%</em></div>`).join("");
  if ($("tickerGrid")) $("tickerGrid").innerHTML = html;
}
function renderUserHeader() {
  const u = state.user;
  if ($("userBadgeText")) $("userBadgeText").textContent = u ? (u.name || u.email || "User") : "Guest";
  if ($("userAvatar")) $("userAvatar").textContent = (u?.name || u?.email || "U").slice(0, 1).toUpperCase();
  if ($("userVipBadge")) $("userVipBadge").textContent = getPlan().toUpperCase();
  if ($("mockUserName")) $("mockUserName").textContent = u?.name || "User";
  if ($("planText")) $("planText").textContent = getPlan();
}
function renderWallet() {
  const real = realWallet();
  const demo = state.accounts.DEMO.balance + openPnl("DEMO");
  if ($("walletBalance")) $("walletBalance").textContent = state.mode === "REAL" ? money(real + openPnl("REAL")) : money(demo);
  if ($("mockDemoBalance")) $("mockDemoBalance").textContent = money(demo);
  if ($("mockRealBalance")) $("mockRealBalance").textContent = money(real);
  if ($("walletPageBalance")) $("walletPageBalance").textContent = money(real);
  if ($("approvedDepositText")) $("approvedDepositText").textContent = money(approvedDeposits());
  if ($("tradeVolumeText")) $("tradeVolumeText").textContent = money(tradeVolume());
  if ($("profitEligibleText")) $("profitEligibleText").textContent = money(ledgerPnL());
  if ($("withdrawableAmountText")) $("withdrawableAmountText").textContent = money(withdrawable());
  const pendingW = state.withdrawalRequests.filter(w => String(w.userId) === userKey() && w.status === "PENDING").reduce((a,w)=>a+Number(w.amount||0),0);
  if ($("pendingWithdrawalText")) $("pendingWithdrawalText").textContent = money(pendingW);
  renderUserLogs();
}
function renderTrades() {
  const acc = currentAccount();
  const rows = (acc.trades || []).map(t => {
    updateTradePnl(t);
    return `<tr><td>${t.coin?.replace("USDT","/USDT")}</td><td>${t.side}</td><td>${money(t.amount)}</td><td>${usd(t.entry)}</td><td>${usd(t.current)}</td><td class="${t.pnl>=0?'pnl-plus':'pnl-minus'}">${money(t.pnl)}</td><td><button class="approve-btn" onclick="closeTrade('${t.id}','${state.mode}')">Close</button></td></tr>`;
  }).join("");
  if ($("activeTradesLog")) $("activeTradesLog").innerHTML = rows || `<tr><td colspan="7" class="empty">No open trades.</td></tr>`;
}
function renderHistory() {
  const uid = userKey(), email = normalizeEmail(state.user?.email);
  const managed = state.managedTrades.filter(t => (String(t.userId) === uid || normalizeEmail(t.userEmail) === email) && t.status === "CLOSED");
  if ($("userManagedTradesLog")) $("userManagedTradesLog").innerHTML = managed.map(t => `<tr><td>${t.coin?.replace("USDT","/USDT")}</td><td>${t.side}</td><td>${money(t.amount)}</td><td>${usd(t.entry)}</td><td>${usd(t.close)}</td><td class="${t.pnl>=0?'pnl-plus':'pnl-minus'}">${money(t.pnl)}</td><td>${t.status}</td></tr>`).join("") || `<tr><td colspan="7" class="empty">No closed AI/Admin trades yet.</td></tr>`;
  const acc = currentAccount();
  const manual = [...(acc.trades||[]), ...(acc.closedTrades||[])].filter(t => !t.source || t.source === "USER");
  if ($("userManualTradesLog")) $("userManualTradesLog").innerHTML = manual.map(t => { updateTradePnl(t); return `<tr><td>${t.coin?.replace("USDT","/USDT")}</td><td>${t.side}</td><td>${money(t.amount)}</td><td>${usd(t.entry)}</td><td>${usd(t.current)}</td><td class="${t.pnl>=0?'pnl-plus':'pnl-minus'}">${money(t.pnl)}</td><td>${t.status}</td></tr>`; }).join("") || `<tr><td colspan="7" class="empty">No manual trades yet.</td></tr>`;
}
function renderAnalytics() {
  const acc = currentAccount();
  const all = [...(acc.trades||[]), ...(acc.closedTrades||[])];
  all.forEach(updateTradePnl);
  const managed = state.mode === "REAL" ? state.managedTrades.filter(t => String(t.userId) === userKey() && t.status === "CLOSED") : [];
  const rows = [...all, ...managed];
  const totalPnl = rows.reduce((a,t)=>a+Number(t.pnl||0),0);
  const wins = rows.filter(t => Number(t.pnl||0) > 0).length;
  if ($("totalTradesMetric")) $("totalTradesMetric").textContent = rows.length;
  if ($("totalPnlMetric")) $("totalPnlMetric").textContent = money(totalPnl);
  if ($("winRateMetric")) $("winRateMetric").textContent = rows.length ? Math.round(wins/rows.length*100)+"%" : "0%";
  if ($("todayPnlMini")) $("todayPnlMini").textContent = money(totalPnl);
  if ($("winRateMini")) $("winRateMini").textContent = rows.length ? Math.round(wins/rows.length*100)+"%" : "0%";
  if ($("refBonusMetric")) $("refBonusMetric").textContent = money(referralBonusTotal());
}
function referralBonusTotal() {
  return state.referrals.filter(r => String(r.referrerId) === userKey() || normalizeEmail(r.referrerEmail) === normalizeEmail(state.user?.email)).reduce((a,r)=>a+Number(r.bonusAmount||0),0);
}
function renderReferral() {
  if (!state.user) return;
  const code = referralCode(state.user);
  if ($("myReferralCode")) $("myReferralCode").textContent = code;
  if ($("refCount")) $("refCount").textContent = state.referrals.filter(r => String(r.referrerId) === userKey()).length;
  if ($("refBonus")) $("refBonus").textContent = money(referralBonusTotal());
}
function renderUserLogs() {
  const uid = userKey();
  if ($("userDepositLog")) $("userDepositLog").innerHTML = state.depositRequests.filter(d => String(d.userId) === uid).map(d => `<tr><td>${money(d.amount)}</td><td>${d.txn||"-"}</td><td>${d.status}</td><td>${d.createdAt||""}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">No deposits.</td></tr>`;
  if ($("userWithdrawalLog")) $("userWithdrawalLog").innerHTML = state.withdrawalRequests.filter(w => String(w.userId) === uid).map(w => `<tr><td>${money(w.amount)}</td><td>${w.method}</td><td>${w.status}</td><td>${w.createdAt||""}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">No withdrawals.</td></tr>`;
}
function renderPlans() {
  if ($("dynamicPlansGrid")) $("dynamicPlansGrid").innerHTML = state.plans.map(p => `<div class="plan-card"><h3>${p.name}</h3><h2>${money(p.price)}</h2><p>${p.duration}</p><p>AI/Admin Trades: ${p.aiTradeLimit}/day</p><button class="primary-btn" onclick="requestPlan('${p.id}')">Choose Plan</button></div>`).join("");
}
function requestPlan(id) {
  const p = state.plans.find(x => x.id === id);
  if (!p) return;
  state.paymentRequests.unshift({ id:"pay_"+Date.now(), userId: userKey(), userEmail: state.user.email, planId: p.id, planName:p.name, amount:p.price, status:"PENDING" });
  saveState(); render(); toast("Plan payment request created.");
}
function renderKyc() {
  const mine = state.kycRequests.find(k => String(k.userId) === userKey());
  if ($("kycStatusTitle")) $("kycStatusTitle").textContent = mine ? mine.status : "Not Submitted";
}
function renderAdmin() {
  if (state.user?.role !== "admin") return;
  if ($("adminTotalUsers")) $("adminTotalUsers").textContent = state.users.filter(u=>u.role!=="admin").length;
  if ($("adminTotalUsersMini")) $("adminTotalUsersMini").textContent = state.users.filter(u=>u.role!=="admin").length;
  const depTotal = state.depositRequests.filter(d=>d.status==="APPROVED").reduce((a,d)=>a+Number(d.amount||0),0);
  if ($("adminTotalDeposits")) $("adminTotalDeposits").textContent = money(depTotal);
  if ($("adminTotalDepositsMini")) $("adminTotalDepositsMini").textContent = money(depTotal);
  const pendingD = state.depositRequests.filter(d=>d.status==="PENDING").length;
  if ($("adminPendingDeposits")) $("adminPendingDeposits").textContent = pendingD;
  if ($("adminPendingDepositsMini")) $("adminPendingDepositsMini").textContent = pendingD;
  if ($("adminOpenTrades")) $("adminOpenTrades").textContent = state.managedTrades.filter(t=>t.status==="OPEN").length;
  if ($("adminOpenTradesMini")) $("adminOpenTradesMini").textContent = state.managedTrades.filter(t=>t.status==="OPEN").length;

  if ($("depositRequestsLog")) $("depositRequestsLog").innerHTML = state.depositRequests.map(d => `<tr><td>${d.userEmail}</td><td>${money(d.amount)}</td><td>${d.txn||"-"}</td><td>${d.status}</td><td>${d.status==="PENDING"?`<button class="approve-btn" onclick="approveDeposit('${d.id}')">Approve</button><button class="reject-btn" onclick="rejectDeposit('${d.id}')">Reject</button>`:"-"}</td></tr>`).join("") || `<tr><td colspan="5" class="empty">No deposits.</td></tr>`;
  if ($("withdrawalRequestsLog")) $("withdrawalRequestsLog").innerHTML = state.withdrawalRequests.map(w => `<tr><td>${w.userEmail}</td><td>${money(w.amount)}</td><td>${w.method}</td><td>${w.status}</td><td>${w.status==="PENDING"?`<button class="approve-btn" onclick="approveWithdrawal('${w.id}')">Approve</button><button class="reject-btn" onclick="rejectWithdrawal('${w.id}')">Reject</button>`:"-"}</td></tr>`).join("") || `<tr><td colspan="5" class="empty">No withdrawals.</td></tr>`;
  if ($("adminAiEligibilityLog")) $("adminAiEligibilityLog").innerHTML = state.users.filter(u=>u.role!=="admin").map(u=>`<tr><td>${u.email}</td><td>${u.plan||"Free"}</td><td>${aiUsed(u)}</td><td>${aiLimitForUser(u)}</td><td>${Math.max(0,aiLimitForUser(u)-aiUsed(u))}</td><td>${canReceiveAi(u)?"Eligible":"Blocked"}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">No users.</td></tr>`;
  renderManagedAdmin();
  renderPlanEditor();
  if ($("adminReferralLog")) $("adminReferralLog").innerHTML = state.referrals.map(r=>`<tr><td>${r.referrerEmail||r.referrerId}</td><td>${r.userEmail}</td><td>${money(r.depositAmount)}</td><td>${money(r.bonusAmount)}</td><td>${r.status}</td></tr>`).join("") || `<tr><td colspan="5" class="empty">No referral bonus yet.</td></tr>`;
}
function renderManagedAdmin() {
  const open = state.managedTrades.filter(t => t.status === "OPEN");
  const opts = `<option value="">Select open trade</option>` + open.map(t => `<option value="${t.id}">${t.userEmail} ${t.coin} ${money(t.amount)}</option>`).join("");
  if ($("managedTradeSelect")) $("managedTradeSelect").innerHTML = opts;
  if ($("massCloseTradeSelect")) $("massCloseTradeSelect").innerHTML = `<option value="ALL">All Open AI Mass Trades</option>` + open.filter(t=>t.source==="ADMIN_MASS").map(t=>`<option value="${t.id}">${t.userEmail} ${t.coin}</option>`).join("");
  if ($("managedUserSelect")) $("managedUserSelect").innerHTML = `<option value="ALL">All Eligible Users</option>` + state.users.filter(u=>u.role!=="admin").map(u=>`<option value="${u.id || u.email}">${u.email}</option>`).join("");
  const rows = state.managedTrades.map(t=>`<tr><td>${t.userEmail}</td><td>${t.coin}</td><td>${t.side}</td><td>${money(t.amount)}</td><td>${usd(t.entry)}</td><td>${t.close?usd(t.close):"-"}</td><td class="${t.pnl>=0?'pnl-plus':'pnl-minus'}">${money(t.pnl)}</td><td>${t.status}</td><td>${t.status==="OPEN"?`<button class="reject-btn" onclick="$('managedTradeSelect').value='${t.id}';cancelManagedTrade()">Cancel</button>`:"-"}</td></tr>`).join("");
  if ($("managedTradesLog")) $("managedTradesLog").innerHTML = rows || `<tr><td colspan="9" class="empty">No managed trades.</td></tr>`;
  if ($("massTradesLog")) $("massTradesLog").innerHTML = state.managedTrades.filter(t=>t.source==="ADMIN_MASS").map(t=>`<tr><td>${t.userEmail}</td><td>${t.coin}</td><td>${t.side}</td><td>${money(t.amount)}</td><td>${usd(t.entry)}</td><td>${t.close?usd(t.close):"-"}</td><td>${money(t.pnl)}</td><td>${t.status}</td><td>-</td></tr>`).join("") || `<tr><td colspan="9" class="empty">No mass trades.</td></tr>`;
}
function renderPlanEditor() {
  if ($("adminPlansEditorLog")) $("adminPlansEditorLog").innerHTML = state.plans.map(p=>`<tr><td>${p.name}</td><td>${money(p.price)}</td><td>${p.duration}</td><td>${p.aiTradeLimit}</td><td><button onclick="editPlan('${p.id}')" class="ghost-btn">Edit</button></td></tr>`).join("");
}
function editPlan(id) {
  const p = state.plans.find(x=>x.id===id); if(!p)return;
  $("planEditId").value=p.id; $("planNameInput").value=p.name; $("planPriceInput").value=p.price; $("planDurationInput").value=p.duration; $("planSignalLimitInput").value=p.signalLimit; $("planAiLimitInput").value=p.aiTradeLimit; $("planFeaturesInput").value=(p.features||[]).join("\n");
}
function renderSignal() {
  const s = state.adminSignal;
  if ($("aiSignalText")) $("aiSignalText").textContent = `${s.signal} ${s.coin?.replace("USDT","/USDT")}`;
  if ($("signalNote")) $("signalNote").textContent = s.note || "";
  if ($("engineSignal")) $("engineSignal").textContent = s.signal || "BUY";
  if ($("engineConfidence")) $("engineConfidence").textContent = `${s.confidence || 80}%`;
  if ($("userSignalCoin")) $("userSignalCoin").textContent = s.coin?.replace("USDT","/USDT");
  if ($("userTargetPrice")) $("userTargetPrice").textContent = usd(s.target);
  if ($("userStopLoss")) $("userStopLoss").textContent = usd(s.stop);
  if ($("userSignalExpiry")) $("userSignalExpiry").textContent = s.expiry;
  if ($("aiTradeUsedText")) $("aiTradeUsedText").textContent = aiUsed();
  if ($("aiTradeLimitText")) $("aiTradeLimitText").textContent = aiLimitForUser(state.user);
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
  renderKyc();
  renderSignal();
  renderAdmin();
}

/* ---------- UI helpers ---------- */
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
  $("openDepositBtn")?.addEventListener("click", () => openModal("depositModal"));
  $("openDepositBtn2")?.addEventListener("click", () => openModal("depositModal"));
  $("closeDepositModal")?.addEventListener("click", () => closeModal("depositModal"));
  $("submitDepositRequest")?.addEventListener("click", depositSubmitNoIdHard);
  $("openWithdrawBtn")?.addEventListener("click", () => openModal("withdrawModal"));
  $("closeWithdrawModal")?.addEventListener("click", () => closeModal("withdrawModal"));
  $("submitWithdrawRequest")?.addEventListener("click", submitWithdrawal);
  $("submitKycBtn")?.addEventListener("click", submitKyc);
  $("copyReferralBtn")?.addEventListener("click", () => { navigator.clipboard?.writeText(`${location.origin}${location.pathname}?ref=${referralCode(state.user)}`); toast("Referral link copied."); });
  $("saveAdminBtn")?.addEventListener("click", saveSignal);
  $("savePlanBtn")?.addEventListener("click", savePlan);
  $("resetPlanFormBtn")?.addEventListener("click", () => ["planEditId","planNameInput","planPriceInput","planDurationInput","planSignalLimitInput","planAiLimitInput","planFeaturesInput"].forEach(id=>{ if($(id)) $(id).value=""; }));
  $("openManagedTradeBtn")?.addEventListener("click", openManagedTrade);
  $("closeManagedTradeBtn")?.addEventListener("click", closeManagedTrade);
  $("cancelManagedTradeBtn")?.addEventListener("click", cancelManagedTrade);
  $("openMassTradeBtn")?.addEventListener("click", openMassTrade);
  $("closeAllMassTradeBtn")?.addEventListener("click", closeAllMassTrades);
  $("closeSelectedMassTradeBtn")?.addEventListener("click", async () => { const id=$("massCloseTradeSelect")?.value; if(id==="ALL") return closeAllMassTrades(); $("managedTradeSelect").value=id; $("managedClosePrice").value=$("massClosePrice").value; return closeManagedTrade(); });
  $("autoTradePermission")?.addEventListener("change", e => { state.user.autoTradePermission = e.target.checked; saveSession(); saveState(); });
  document.addEventListener("input", e => { if (e.target?.id === "depositTxn") e.target.value = e.target.value.replace(/\D/g,"").slice(0,12); });
  qsa(".admin-tab").forEach(btn => btn.addEventListener("click", () => {
    qsa(".admin-tab").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.adminTab;
    qsa(".admin-panel").forEach(p=>p.classList.remove("active-admin-panel"));
    $(tab)?.classList.add("active-admin-panel");
  }));
}

/* Expose */
Object.assign(window, { approveDeposit, rejectDeposit, approveWithdrawal, rejectWithdrawal, closeTrade, editPlan, approveKyc, showPage });

document.addEventListener("DOMContentLoaded", async () => {
  loadState();
  setupNav();
  setupEvents();
  if (state.user) showAuth(false); else showAuth(true);
  await loadRemoteData();
  render();
  fetchPrices();
  setInterval(fetchPrices, 5000);
  setInterval(() => { renderTrades(); renderWallet(); renderAnalytics(); renderHistory(); }, 1500);
});


/* ===== DEPOSIT BIGINT HARD OVERRIDE FIX ===== */
function depositHardToast(msg) {
  if (typeof toast === "function") toast(msg);
  else alert(msg);
}

function depositHardAmount() {
  const ids = ["depositAmount", "depositAmountInput", "depositInput", "walletDepositAmount", "amountInput"];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    const n = Number(String(el.value || "").replace(/,/g, "").trim());
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function depositHardUtr() {
  const ids = ["depositTxn", "depositTxnInput", "transactionId", "utrInput", "depositUtr", "utr"];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    return String(el.value || "").replace(/\D/g, "").slice(0, 12);
  }
  return "";
}

async function depositHardDuplicate(utr) {
  if (!utr) return false;

  if ((state.depositRequests || []).some(d => String(d.txn || d.utr || "").trim() === utr)) return true;

  if (supabaseClient) {
    try {
      const { data } = await supabaseClient
        .from("deposit_requests")
        .select("id")
        .eq("txn", utr)
        .limit(1);
      if (data && data.length) return true;
    } catch (e) {
      console.warn("UTR duplicate check skipped", e);
    }
  }

  return false;
}

async function depositSubmitNoIdHard() {
  try {
    if (!state.user) {
      depositHardToast("Please login first.");
      return false;
    }

    const amount = depositHardAmount();
    const txn = depositHardUtr();

    if (!amount || amount < 1000) {
      alert("Minimum deposit ₹1000 hai.");
      return false;
    }

    if (!/^[0-9]{12}$/.test(txn)) {
      alert("UTR exactly 12 digit hona chahiye.");
      return false;
    }

    if (await depositHardDuplicate(txn)) {
      alert("Duplicate UTR");
      return false;
    }

    const localId = "local_dep_" + Date.now();
    const req = {
      id: localId,
      userId: state.user.id || "",
      userEmail: state.user.email || "",
      userName: state.user.name || "",
      amount,
      txn,
      status: "PENDING",
      createdAt: new Date().toLocaleString()
    };

    // IMPORTANT: Database insert me ID bilkul nahi bhejna.
    // Ye bigint id error ko completely avoid karega.
    if (supabaseClient) {
      const dbRow = {
        user_id: req.userId,
        user_email: req.userEmail,
        user_name: req.userName,
        amount: req.amount,
        txn: req.txn,
        status: req.status,
        created_at_text: req.createdAt
      };

      const { data, error } = await supabaseClient
        .from("deposit_requests")
        .insert(dbRow)
        .select("id")
        .single();

      if (error) {
        console.error("Deposit insert error", error, dbRow);
        if (String(error.message || "").toLowerCase().includes("duplicate")) {
          alert("Duplicate UTR");
          return false;
        }
        alert("Deposit save error: " + (error.message || "Unknown error"));
        return false;
      }

      if (data && data.id !== undefined && data.id !== null) req.id = String(data.id);
    }

    state.depositRequests = state.depositRequests || [];
    state.depositRequests.unshift(req);
    saveState?.();

    ["depositAmount", "depositAmountInput", "depositInput", "walletDepositAmount", "amountInput"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    ["depositTxn", "depositTxnInput", "transactionId", "utrInput", "depositUtr", "utr"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    try { closeModal?.("depositModal"); } catch(e) {}
    render?.();
    depositHardToast("Deposit request submitted. Admin approval pending.");
    return false;
  } catch (e) {
    console.error("Deposit hard submit failed", e);
    alert("Deposit submit failed: " + (e.message || e));
    return false;
  }
}

// Override every possible old function name.
try { submitDeposit = depositSubmitNoIdHard; } catch(e) {}
try { submitDepositFinal = depositSubmitNoIdHard; } catch(e) {}
try { submitDepositWorkingFinal = depositSubmitNoIdHard; } catch(e) {}
try { createDepositRequest = depositSubmitNoIdHard; } catch(e) {}
try { handleDepositSubmit = depositSubmitNoIdHard; } catch(e) {}

window.submitDeposit = depositSubmitNoIdHard;
window.submitDepositFinal = depositSubmitNoIdHard;
window.submitDepositWorkingFinal = depositSubmitNoIdHard;
window.createDepositRequest = depositSubmitNoIdHard;
window.handleDepositSubmit = depositSubmitNoIdHard;

// Capture click before old listeners and stop them.
document.addEventListener("click", function(e) {
  const btn = e.target.closest(
    "#submitDepositRequest, #depositBtn, #submitDepositBtn, #depositSubmitBtn, #makeDepositBtn, [data-action='deposit-submit']"
  );
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  depositSubmitNoIdHard();
  return false;
}, true);

// UTR input hard limit.
document.addEventListener("input", function(e) {
  const el = e.target;
  if (!el) return;
  if (["depositTxn", "depositTxnInput", "transactionId", "utrInput", "depositUtr", "utr"].includes(el.id)) {
    el.value = String(el.value || "").replace(/\D/g, "").slice(0, 12);
  }
}, true);
