
/* ===== SAFE RENDER GUARD ===== */
window.addEventListener("error", function(e){
  console.warn("Runtime error caught:", e.message);
});


/* ===== SUPABASE DEPOSIT ID STRIP MONKEY PATCH ===== */
(function(){
  function installDepositInsertStripper(){
    try{
      if(!window.supabaseClient && typeof supabaseClient !== "undefined") window.supabaseClient = supabaseClient;
      const client = window.supabaseClient || (typeof supabaseClient !== "undefined" ? supabaseClient : null);
      if(!client || client.__depositStripInstalled) return;
      const originalFrom = client.from.bind(client);
      client.from = function(table){
        const builder = originalFrom(table);
        if(table === "deposit_requests" && builder && typeof builder.insert === "function"){
          const originalInsert = builder.insert.bind(builder);
          builder.insert = function(values, options){
            try{
              const strip = (row) => {
                if(row && typeof row === "object"){
                  const copy = {...row};
                  delete copy.id;
                  return copy;
                }
                return row;
              };
              if(Array.isArray(values)) values = values.map(strip);
              else values = strip(values);
            }catch(e){}
            return originalInsert(values, options);
          };
        }
        return builder;
      };
      client.__depositStripInstalled = true;
      console.log("Deposit id stripper installed");
    }catch(e){
      console.warn("Deposit id stripper failed", e);
    }
  }
  installDepositInsertStripper();
  document.addEventListener("DOMContentLoaded", installDepositInsertStripper);
  setTimeout(installDepositInsertStripper, 1000);
})();


/* =========================================================
   AI Trading Assistant - Clean Core Rebuild
   UI same, logic rebuilt clean.
   ========================================================= */

const $ = (id) => document.getElementById(id);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));
const cfg = window.APP_CONFIG || {};
const isAdminPage = !!window.FORCE_ADMIN_PAGE || /admin\.html/i.test(location.pathname) || document.body?.dataset?.adminPage === "true";
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
  { id: "free", name: "Free", price: 0, duration: "Lifetime", signalLimit: 5, aiTradeLimit: 5, features: ["5 AI/AI trades per day", "Manual trades unlimited"] },
  { id: "pro", name: "Pro", price: 499, duration: "30 days", signalLimit: 50, aiTradeLimit: 10, features: ["10 AI/AI trades per day", "Premium signals"] },
  { id: "elite", name: "Elite", price: 999, duration: "30 days", signalLimit: 999999, aiTradeLimit: 25, features: ["25 AI/AI trades per day", "Priority AI trades"] }
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
    id: "local_" + Date.now(), userId: state.user.id, userEmail: state.user.email,
    userName: state.user.name, amount, txn, status: "PENDING", createdAt: new Date().toLocaleString()
  };
  state.depositRequests.unshift(req);
  if (supabaseClient) {
    const { error } = await supabaseClient.from("deposit_requests").insert({
      user_id: req.userId, user_email: req.userEmail, user_name: req.userName,
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
  if (!t) return 0;

  // CLOSED / CANCELLED manual trade PnL must stay frozen.
  if (String(t.status || "").toUpperCase() !== "OPEN") {
    const fixed = Number(t.pnl || 0);
    t.current = Number(t.close || t.closePrice || t.close_price || t.current || t.entry || 0);
    t.roi = (fixed / Number(t.amount || 1)) * 100;
    return fixed;
  }

  const current = priceOf(t.coin);
  t.current = current;
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
    amount, entry: priceOf(coin), current: priceOf(coin), leverage: getLeverageSafe(),
    orderType: $("orderType")?.value || "MARKET", status: "OPEN", source: "USER", openedAt: new Date().toLocaleString()
  };
  acc.trades.unshift(t);
  saveState(); render();
}
async function closeTrade(id, mode = state.mode) {
  const acc = state.accounts[mode];
  if (!acc) return;

  acc.trades ||= [];
  acc.closedTrades ||= [];

  const idx = acc.trades.findIndex(t => t.id === id);
  if (idx < 0) return;

  const t = acc.trades[idx];

  // Final live calculation only once at close time.
  const closePrice = priceOf(t.coin);
  t.current = closePrice;
  const diff = t.side === "SELL" ? (Number(t.entry) - closePrice) : (closePrice - Number(t.entry));
  t.pnl = (diff / Number(t.entry || 1)) * Number(t.amount || 0) * Number(t.leverage || 1);
  t.roi = (t.pnl / Number(t.amount || 1)) * 100;

  t.close = closePrice;
  t.closePrice = closePrice;
  t.closedPrice = closePrice;
  t.status = "CLOSED";
  t.closedAt = new Date().toLocaleString();
  t.closedAtISO = new Date().toISOString();
  t.pnlFrozen = true;
  t.source = t.source || "USER";

  acc.trades.splice(idx, 1);

  // Prevent duplicates.
  acc.closedTrades = (acc.closedTrades || []).filter(x => String(x.id) !== String(t.id));
  acc.closedTrades.unshift(t);

  if (mode === "REAL") {
    state.walletLedger ||= [];
    state.walletLedger.unshift({ id: "led_" + Date.now(), userId: state.user.id, type: "TRADE_PNL", amount: t.pnl, note: "Manual trade PnL" });
    await dbInsert("wallet_ledger", { user_id: state.user.id, type: "TRADE_PNL", amount: t.pnl, note: "Manual trade PnL" });
  }

  try { saveManualHistoryBackup(mode); } catch(e) {}
  saveState();
  render();
  try { renderFloatingLivePositionBar?.(); } catch(e) {}
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
  t.close = close; t.pnl = pnlForManaged(t.side, t.entry, close, t.amount, t.leverage || 1); t.status = "CLOSED"; t.closedAt = new Date().toLocaleString();
  await dbUpdate("managed_trades", { close_price: close, pnl: t.pnl, status: "CLOSED", closed_at: t.closedAt }, "id", id);
  state.walletLedger.unshift({ id: "led_" + Date.now(), userId: t.userId, type: t.source === "ADMIN_MASS" ? "MASS_TRADE_PNL" : "MANAGED_TRADE_PNL", amount: t.pnl, note: "AI trade PnL" });
  await dbInsert("wallet_ledger", { user_id: t.userId, type: t.source === "ADMIN_MASS" ? "MASS_TRADE_PNL" : "MANAGED_TRADE_PNL", amount: t.pnl, note: "AI trade PnL" });
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
    t.close = close; t.pnl = pnlForManaged(t.side, t.entry, close, t.amount, t.leverage || 1); t.status = "CLOSED"; t.closedAt = new Date().toLocaleString();
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
  if ($("walletPageBalance")) $("walletPageBalance").textContent = money(real + openPnl("REAL"));
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
  if ($("userManagedTradesLog")) $("userManagedTradesLog").innerHTML = managed.map(t => `<tr><td>${t.coin?.replace("USDT","/USDT")}</td><td>${t.side}</td><td>${money(t.amount)}</td><td>${usd(t.entry)}</td><td>${usd(t.close)}</td><td class="${t.pnl>=0?'pnl-plus':'pnl-minus'}">${money(t.pnl)}</td><td>${t.status}</td></tr>`).join("") || `<tr><td colspan="7" class="empty">No closed AI/AI trades yet.</td></tr>`;
  const acc = currentAccount();
  try { restoreManualHistoryBackup(state.mode); } catch(e) {}
  const manual = [...(acc.trades||[]), ...(acc.closedTrades||[])].filter(t => !t.source || t.source === "USER");
  if ($("userManualTradesLog")) $("userManualTradesLog").innerHTML = manual.map(t => { if (String(t.status || "OPEN").toUpperCase() === "OPEN") updateTradePnl(t); return `<tr><td>${t.coin?.replace("USDT","/USDT")}</td><td>${t.side}</td><td>${money(t.amount)}</td><td>${usd(t.entry)}</td><td>${usd(t.close || t.current)}</td><td class="${t.pnl>=0?'pnl-plus':'pnl-minus'}">${money(t.pnl)}</td><td>${t.status}</td></tr>`; }).join("") || `<tr><td colspan="7" class="empty">No manual trades yet.</td></tr>`;
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
  if ($("userWithdrawalLog")) $("userWithdrawalLog").innerHTML = state.withdrawalRequests.filter(w => String(w.userId) === uid).map(w => `<tr><td>${money(w.amount)}</td><td>${w.method}</td><td>${w.account || w.upi || "-"}</td><td>${w.status}</td><td>${w.createdAt||""}</td></tr>`).join("") || `<tr><td colspan="5" class="empty">No withdrawals.</td></tr>`;
}
function renderPlans() {
  if ($("dynamicPlansGrid")) $("dynamicPlansGrid").innerHTML = state.plans.map(p => `<div class="plan-card"><h3>${p.name}</h3><h2>${money(p.price)}</h2><p>${p.duration}</p><p>AI/AI Trades: ${p.aiTradeLimit}/day</p><button class="primary-btn" onclick="requestPlan('${p.id}')">Choose Plan</button></div>`).join("");
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


/* ===== REAL TRADINGVIEW CHART + FAST PRICE PNL FIX ===== */
const realChartFeedState = {
  fills: [],
  activeSymbol: ""
};

function rcCoin() {
  return document.getElementById("coinSelect")?.value ||
         document.getElementById("tradePairSelect")?.value ||
         "BTCUSDT";
}

function rcSymbol(coin = rcCoin()) {
  return "BINANCE:" + String(coin || "BTCUSDT").toUpperCase();
}

function rcPrice(coin = rcCoin()) {
  try {
    if (typeof priceOf === "function") return Number(priceOf(coin) || 0);
  } catch(e) {}
  return Number(state?.prices?.[coin]?.price || 0);
}

function rcUsd(n) {
  try {
    if (typeof usd === "function") return usd(n);
  } catch(e) {}
  return "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function chartHostFinal() {
  return document.getElementById("crypto_live_chart") ||
         document.getElementById("tradingViewChart") ||
         document.getElementById("chartContainer") ||
         document.querySelector(".crypto_live_chart") ||
         document.querySelector(".chart-container") ||
         document.querySelector(".trading-chart");
}

function renderRealTradingViewChart(force = false) {
  const host = chartHostFinal();
  if (!host) return;

  const coin = rcCoin();
  const symbol = rcSymbol(coin);
  if (!force && realChartFeedState.activeSymbol === symbol && host.querySelector("iframe")) return;

  realChartFeedState.activeSymbol = symbol;
  host.innerHTML = `
    <iframe
      title="TradingView ${coin}"
      class="real-tv-chart-frame clean-tv-only-frame"
      src="https://s.tradingview.com/widgetembed/?frameElementId=tradingview_${coin}&symbol=${encodeURIComponent(symbol)}&interval=1&hidesidetoolbar=1&symboledit=1&saveimage=0&toolbarbg=0b1220&studies=[]&theme=dark&style=1&timezone=Asia%2FKolkata&withdateranges=1&hideideas=1"
      allowtransparency="true"
      scrolling="no"
      frameborder="0">
    </iframe>
  `;
}
function renderOrderBookRealFix() {
  const el = document.getElementById("orderBook");
  if (!el) return;
  const coin = rcCoin();
  const price = rcPrice(coin) || 100;
  const rows = [];

  for (let i = 6; i >= 1; i--) {
    rows.push({ type: "ask", price: price * (1 + i * 0.00055), qty: (Math.random() * 1.8 + 0.08) });
  }
  for (let i = 1; i <= 6; i++) {
    rows.push({ type: "bid", price: price * (1 - i * 0.00055), qty: (Math.random() * 1.8 + 0.08) });
  }

  el.innerHTML = `
    <div class="real-book-head"><span>Price</span><span>Qty</span><span>Total</span></div>
    ${rows.map(r => `
      <div class="real-book-row ${r.type}">
        <span>${rcUsd(r.price)}</span>
        <span>${r.qty.toFixed(4)}</span>
        <span>${rcUsd(r.price * r.qty)}</span>
      </div>
    `).join("")}
  `;
}

function renderTradeFeedRealFix() {
  const el = document.getElementById("recentFills") || document.getElementById("tradeFeed");
  if (!el) return;
  const coin = rcCoin();
  const price = rcPrice(coin) || 100;

  realChartFeedState.fills.unshift({
    side: Math.random() > 0.5 ? "BUY" : "SELL",
    coin,
    price: price * (1 + (Math.random() - 0.5) * 0.0007),
    qty: Math.random() * 1.2 + 0.03,
    time: new Date().toLocaleTimeString()
  });
  realChartFeedState.fills = realChartFeedState.fills.slice(0, 12);

  el.innerHTML = realChartFeedState.fills.map(f => `
    <div class="real-fill-row ${f.side === "BUY" ? "buy" : "sell"}">
      <span>${f.side}</span>
      <b>${f.coin.replace("USDT", "/USDT")}</b>
      <em>${rcUsd(f.price)}</em>
      <small>${f.time}</small>
    </div>
  `).join("");
}

function fastPricePnlRefresh() {
  try {
    if (typeof fetchPrices === "function") fetchPrices();
  } catch(e) {}

  try {
    if (typeof renderPrices === "function") renderPrices();
    if (typeof renderTrades === "function") renderTrades();
    if (typeof renderWallet === "function") renderWallet();
    if (typeof renderAnalytics === "function") renderAnalytics();
    if (typeof renderHistory === "function") renderHistory();
  } catch(e) {
    console.warn("fast pnl refresh skipped", e);
  }

  const coin = rcCoin();
  const priceEl = document.getElementById("realChartLivePrice");
  if (priceEl) priceEl.textContent = rcUsd(rcPrice(coin));
  renderOrderBookRealFix();
}

function openHistoryPageFinal() {
  if (typeof showPage === "function") {
    showPage("aiHistory");
  } else {
    document.querySelectorAll("#appPage .page").forEach(p => p.classList.remove("active-page"));
    document.getElementById("aiHistory")?.classList.add("active-page");
  }
  if (typeof renderHistory === "function") renderHistory();
  return false;
}

window.openHistoryPageFinal = openHistoryPageFinal;

document.addEventListener("change", function(e) {
  if (e.target && ["coinSelect", "tradePairSelect"].includes(e.target.id)) {
    setTimeout(() => {
      renderRealTradingViewChart(true);
      fastPricePnlRefresh();
    }, 100);
  }
}, true);

window.addEventListener("load", function() {
  setTimeout(() => {
    renderRealTradingViewChart(true);
    fastPricePnlRefresh();
    renderTradeFeedRealFix();
  }, 600);
});

// Price/PnL fast refresh: light render every second.
// Chart iframe itself remains real TradingView and is not rebuilt every second.
setInterval(fastPricePnlRefresh, 1000);
setInterval(renderTradeFeedRealFix, 1600);


/* ===== LEVERAGE 2000X FIX ===== */
function getLeverageSafe() {
  const raw = Number(document.getElementById("leverageSelect")?.value || 1);
  return Math.min(2000, Math.max(1, raw || 1));
}


/* ===== AUTO LIQUIDATION FIX ===== */
function liquidationUserId() {
  try {
    if (typeof userKey === "function") return userKey();
  } catch(e) {}
  return String(state?.user?.id || state?.user?.email || "local");
}

async function ledgerLiquidationLoss(trade) {
  if (!trade || state.mode !== "REAL" || !state.user) return;
  const uid = state.user.id || liquidationUserId();

  const already = (state.walletLedger || []).some(l =>
    String(l.tradeId || l.trade_id || "") === String(trade.id) ||
    String(l.note || "").includes(String(trade.id))
  );
  if (already) return;

  const row = {
    id: "led_liq_" + Date.now() + "_" + Math.random().toString(16).slice(2),
    userId: uid,
    type: "TRADE_PNL",
    amount: -Math.abs(Number(trade.amount || 0)),
    note: "Liquidation loss " + trade.id,
    tradeId: trade.id
  };

  state.walletLedger = state.walletLedger || [];
  state.walletLedger.unshift(row);

  if (typeof supabaseClient !== "undefined" && supabaseClient) {
    try {
      await supabaseClient.from("wallet_ledger").insert({
        user_id: uid,
        type: "TRADE_PNL",
        amount: row.amount,
        note: row.note
      });
    } catch(e) {
      console.warn("Liquidation ledger save failed", e);
    }
  }
}

async function liquidateTradeByIndex(acc, index) {
  const t = acc.trades[index];
  if (!t || String(t.status || "OPEN").toUpperCase() !== "OPEN") return false;

  t.status = "LIQUIDATED";
  t.pnl = -Math.abs(Number(t.amount || 0));
  t.current = t.current || t.close || t.entry;
  t.close = t.current;
  t.closedAt = new Date().toLocaleString();
  t.liquidatedAt = t.closedAt;

  acc.trades.splice(index, 1);
  acc.closedTrades = acc.closedTrades || [];
  acc.closedTrades.unshift(t);

  await ledgerLiquidationLoss(t);
  return true;
}

async function checkAutoLiquidation() {
  try {
    if (!state?.accounts) return;

    const modes = ["DEMO", "REAL"];
    let changed = false;

    for (const mode of modes) {
      const acc = state.accounts[mode];
      if (!acc || !Array.isArray(acc.trades)) continue;

      for (let i = acc.trades.length - 1; i >= 0; i--) {
        const t = acc.trades[i];
        if (!t || String(t.status || "OPEN").toUpperCase() !== "OPEN") continue;

        try {
          if (typeof updateTradePnl === "function") updateTradePnl(t);
        } catch(e) {}

        const amount = Math.abs(Number(t.amount || 0));
        const pnl = Number(t.pnl || 0);

        if (amount > 0 && pnl <= -amount) {
          const oldMode = state.mode;
          state.mode = mode;
          const ok = await liquidateTradeByIndex(acc, i);
          state.mode = oldMode;
          if (ok) changed = true;
        }
      }
    }

    if (changed) {
      try { saveState?.(); } catch(e) {}
      try { render?.(); } catch(e) {}
      try { toast?.("Trade liquidated: loss reached trade amount."); } catch(e) {}
    }
  } catch(e) {
    console.warn("Auto liquidation check failed", e);
  }
}

// Patch updateTradePnl display clamp: open trade loss can show below, but liquidation will close it.
// Patch closeTrade to avoid extra close on liquidated is handled by status check.
setInterval(checkAutoLiquidation, 1000);
window.addEventListener("load", function(){
  setTimeout(checkAutoLiquidation, 1200);
});


/* ===== ADMIN TRADE ADVANCED OPTIONS FIX ===== */
function adminTradePriceSafe(coin) {
  try {
    if (typeof priceOf === "function") return Number(priceOf(coin) || 0);
  } catch(e) {}
  return Number(state?.prices?.[coin]?.price || 0);
}

function adminTradeMoneySafe(n) {
  try {
    if (typeof money === "function") return money(n);
  } catch(e) {}
  return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function adminTradeUserWallet(userIdOrEmail) {
  const u = (state.users || []).find(x =>
    String(x.id || "") === String(userIdOrEmail || "") ||
    String(x.email || "") === String(userIdOrEmail || "")
  );
  if (!u) return 0;

  const uid = String(u.id || u.email || "");
  try {
    if (typeof realWallet === "function") return Number(realWallet(uid) || 0);
  } catch(e) {}

  const deposits = (state.depositRequests || [])
    .filter(d => String(d.userId || d.user_id || "") === uid && String(d.status || "").toUpperCase() === "APPROVED")
    .reduce((a, d) => a + Number(d.amount || 0), 0);

  const ledger = (state.walletLedger || [])
    .filter(l => String(l.userId || l.user_id || "") === uid)
    .reduce((a, l) => a + Number(l.amount || 0), 0);

  return Math.max(deposits, 0) + ledger;
}

function adminTradeSelectedUsers() {
  const target = document.getElementById("managedUserSelect")?.value || "ALL";
  const users = (state.users || []).filter(u => u.role !== "admin");

  if (target === "ALL") {
    return users.filter(u => {
      try { return typeof canReceiveAi === "function" ? canReceiveAi(u) : true; }
      catch(e) { return true; }
    });
  }

  return users.filter(u => String(u.id || u.email) === String(target));
}

function adminTradeUpdateWalletPreview() {
  const target = document.getElementById("managedUserSelect")?.value || "ALL";
  const walletText = document.getElementById("managedUserWalletText");
  const availableText = document.getElementById("managedUserAvailableText");
  const amountInput = document.getElementById("managedAmount");
  const amount = Number(amountInput?.value || 0);

  if (!walletText && !availableText) return;

  if (target === "ALL") {
    const users = adminTradeSelectedUsers();
    const total = users.reduce((a, u) => a + adminTradeUserWallet(u.id || u.email), 0);
    const min = users.length ? Math.min(...users.map(u => adminTradeUserWallet(u.id || u.email))) : 0;
    if (walletText) walletText.textContent = `${users.length} users | Total ${adminTradeMoneySafe(total)}`;
    if (availableText) availableText.textContent = `Lowest user wallet: ${adminTradeMoneySafe(min)} | Trade amount: ${adminTradeMoneySafe(amount)}`;
    return;
  }

  const wallet = adminTradeUserWallet(target);
  if (walletText) walletText.textContent = adminTradeMoneySafe(wallet);
  if (availableText) availableText.textContent = `Available for trade: ${adminTradeMoneySafe(wallet)} | Trade amount: ${adminTradeMoneySafe(amount)}`;
}

function adminTradeGetEntryPrice() {
  const coin = document.getElementById("managedCoin")?.value || "BTCUSDT";
  const orderType = document.getElementById("managedOrderType")?.value || "MARKET";
  const live = adminTradePriceSafe(coin);

  if (orderType === "MARKET") {
    const entryInput = document.getElementById("managedEntryPrice");
    if (entryInput) entryInput.value = live ? live.toFixed(4) : "";
    return live;
  }

  return Number(document.getElementById("managedEntryPrice")?.value || live || 0);
}

function adminTradeGetLeverage() {
  const lev = Number(document.getElementById("managedLeverage")?.value || 1);
  return Math.min(2000, Math.max(1, lev || 1));
}

function adminTradeValidateAmountForTargets(targets, amount) {
  if (!amount || amount <= 0) {
    alert("Trade amount required.");
    return false;
  }

  const low = targets.find(u => adminTradeUserWallet(u.id || u.email) < amount);
  if (low) {
    alert(`User wallet amount kam hai: ${low.email || low.name}. Wallet: ${adminTradeMoneySafe(adminTradeUserWallet(low.id || low.email))}`);
    return false;
  }

  return true;
}

// Override existing openManagedTrade with advanced options.
async function openManagedTradeAdvanced() {
  if (state.user?.role !== "admin") return;

  const targets = adminTradeSelectedUsers();
  if (!targets.length) {
    alert("No eligible user found.");
    return;
  }

  const coin = document.getElementById("managedCoin")?.value || "BTCUSDT";
  const side = document.getElementById("managedSide")?.value || "BUY";
  const risk = document.getElementById("managedRisk")?.value || "MEDIUM";
  const amount = Number(document.getElementById("managedAmount")?.value || 0);
  const orderType = document.getElementById("managedOrderType")?.value || "MARKET";
  const leverage = adminTradeGetLeverage();
  const entry = adminTradeGetEntryPrice();

  if (!adminTradeValidateAmountForTargets(targets, amount)) return;

  for (const u of targets) {
    const t = {
      id: "mg_" + Date.now() + "_" + Math.random().toString(16).slice(2),
      userId: u.id || u.email,
      userEmail: u.email || "",
      coin,
      side,
      risk,
      amount,
      entry,
      close: null,
      pnl: 0,
      leverage,
      orderType,
      status: "OPEN",
      source: "ADMIN_MANAGED",
      openedAt: new Date().toLocaleString()
    };

    state.managedTrades = state.managedTrades || [];
    state.managedTrades.unshift(t);

    try { if (typeof incAiUsage === "function") incAiUsage(u); } catch(e) {}

    if (typeof supabaseClient !== "undefined" && supabaseClient) {
      try {
        await supabaseClient.from("managed_trades").insert({
          id: t.id,
          user_id: t.userId,
          user_email: t.userEmail,
          coin: t.coin,
          side: t.side,
          risk: t.risk,
          amount: t.amount,
          entry_price: t.entry,
          pnl: 0,
          status: "OPEN",
          source: t.source,
          opened_at: t.openedAt
        });
      } catch(e) {
        console.warn("Managed trade DB insert failed", e);
      }
    }
  }

  try { saveState?.(); } catch(e) {}
  try { render?.(); } catch(e) {}
  try { toast?.(`AI trade opened for ${targets.length} user(s).`); } catch(e) {}
}

try { openManagedTrade = openManagedTradeAdvanced; } catch(e) {}
window.openManagedTrade = openManagedTradeAdvanced;

function patchAdminAdvancedEvents() {
  const ids = ["managedUserSelect", "managedAmount", "managedCoin", "managedOrderType"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.dataset.advancedBound) {
      el.dataset.advancedBound = "1";
      el.addEventListener("change", () => {
        if (id === "managedCoin" || id === "managedOrderType") adminTradeGetEntryPrice();
        adminTradeUpdateWalletPreview();
      });
      el.addEventListener("input", adminTradeUpdateWalletPreview);
    }
  });

  const btn = document.getElementById("openManagedTradeBtn");
  if (btn && !btn.dataset.advancedOpenBound) {
    btn.dataset.advancedOpenBound = "1";
    btn.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      openManagedTradeAdvanced();
      return false;
    }, true);
  }

  adminTradeGetEntryPrice();
  adminTradeUpdateWalletPreview();
}

setInterval(patchAdminAdvancedEvents, 1000);
window.addEventListener("load", () => setTimeout(patchAdminAdvancedEvents, 800));


/* AI managed PnL leverage override */
function pnlForManaged(side, entry, close, amount, leverage = 1) {
  const diff = side === "SELL" ? Number(entry) - Number(close) : Number(close) - Number(entry);
  return (diff / Number(entry || 1)) * Number(amount || 0) * Number(leverage || 1);
}


/* ===== PLAN BUY FROM WALLET FIX ===== */
function planWalletUserId() {
  try {
    if (typeof userKey === "function") return userKey();
  } catch(e) {}
  return String(state?.user?.id || state?.user?.email || "local");
}

function planWalletBalance() {
  try {
    if (typeof realWallet === "function") return Number(realWallet(planWalletUserId()) || 0);
  } catch(e) {}

  const uid = planWalletUserId();
  const deposits = (state.depositRequests || [])
    .filter(d => String(d.userId || d.user_id || "") === String(uid) && String(d.status || "").toUpperCase() === "APPROVED")
    .reduce((a, d) => a + Number(d.amount || 0), 0);

  const ledger = (state.walletLedger || [])
    .filter(l => String(l.userId || l.user_id || "") === String(uid))
    .reduce((a, l) => a + Number(l.amount || 0), 0);

  return Math.max(0, deposits + ledger);
}

function planByIdOrName(id) {
  return (state.plans || []).find(p =>
    String(p.id || "").toLowerCase() === String(id || "").toLowerCase() ||
    String(p.name || "").toLowerCase() === String(id || "").toLowerCase()
  );
}

function planExpiryDate(duration) {
  const d = new Date();
  const text = String(duration || "30 days").toLowerCase();
  const num = Number((text.match(/\d+/) || [30])[0]);
  if (text.includes("year")) d.setDate(d.getDate() + (num * 365));
  else if (text.includes("month")) d.setMonth(d.getMonth() + num);
  else d.setDate(d.getDate() + num);
  return d.toISOString();
}

async function buyPlanFromWallet(planId) {
  if (!state.user || state.user.role === "admin") {
    alert("Please login as user.");
    return;
  }

  const plan = planByIdOrName(planId);
  if (!plan) {
    alert("Plan not found.");
    return;
  }

  const price = Number(plan.price || 0);
  const balance = planWalletBalance();

  if (price > 0 && balance < price) {
    alert("Wallet balance कम है. पहले deposit approve करवाओ. Required: " + (typeof money === "function" ? money(price) : price));
    return;
  }

  const oldPlan = state.user.plan || "Free";
  state.user.plan = plan.name || plan.id || "Free";
  state.user.planId = plan.id || "";
  state.user.planActivatedAt = new Date().toISOString();
  state.user.planExpiresAt = planExpiryDate(plan.duration);

  const u = (state.users || []).find(x =>
    String(x.id || "") === String(state.user.id || "") ||
    String(x.email || "").toLowerCase() === String(state.user.email || "").toLowerCase()
  );
  if (u) {
    u.plan = state.user.plan;
    u.planId = state.user.planId;
    u.planActivatedAt = state.user.planActivatedAt;
    u.planExpiresAt = state.user.planExpiresAt;
  }

  if (price > 0) {
    const led = {
      id: "led_plan_" + Date.now(),
      userId: state.user.id || planWalletUserId(),
      type: "PLAN_PURCHASE",
      amount: -Math.abs(price),
      note: `Plan purchase: ${state.user.plan}`
    };
    state.walletLedger = state.walletLedger || [];
    state.walletLedger.unshift(led);

    if (typeof supabaseClient !== "undefined" && supabaseClient) {
      try {
        await supabaseClient.from("wallet_ledger").insert({
          user_id: led.userId,
          type: "PLAN_PURCHASE",
          amount: led.amount,
          note: led.note
        });
      } catch(e) {
        console.warn("Plan wallet ledger save failed", e);
      }
    }
  }

  // Keep a payment/request history as PAID, not pending.
  const req = {
    id: "plan_" + Date.now(),
    userId: state.user.id || planWalletUserId(),
    userEmail: state.user.email || "",
    planId: plan.id || "",
    planName: state.user.plan,
    amount: price,
    status: "PAID",
    method: "WALLET",
    createdAt: new Date().toLocaleString()
  };
  state.paymentRequests = state.paymentRequests || [];
  state.paymentRequests.unshift(req);

  if (typeof supabaseClient !== "undefined" && supabaseClient) {
    try {
      await supabaseClient.from("user_payout_methods").insert({
        user_id: req.userId,
        user_email: req.userEmail,
        plan_id: req.planId,
        plan_name: req.planName,
        amount: req.amount,
        status: "PAID"
      });
    } catch(e) {
      console.warn("Plan payment history save failed", e);
    }

    try {
      await supabaseClient.from("profiles").update({
        plan: state.user.plan
      }).eq("id", state.user.id);
    } catch(e) {
      console.warn("Profile plan update failed", e);
    }
  }

  try { saveSession?.(); } catch(e) {}
  try { saveState?.(); } catch(e) {}
  try { render?.(); } catch(e) {}

  alert(`Plan active ho gaya: ${state.user.plan}. Wallet se ${price ? (typeof money === "function" ? money(price) : price) : "₹0"} deduct hua.`);
}

// Override old requestPlan: अब pending request नहीं, wallet से direct buy.
function requestPlan(id) {
  return buyPlanFromWallet(id);
}

window.requestPlan = requestPlan;
window.buyPlanFromWallet = buyPlanFromWallet;

function renderPlanWalletBalanceHint() {
  try {
    const grid = document.getElementById("dynamicPlansGrid");
    if (!grid) return;
    if (!document.getElementById("planWalletHint")) {
      const hint = document.createElement("div");
      hint.id = "planWalletHint";
      hint.className = "card plan-wallet-hint";
      hint.innerHTML = `<span>Wallet Balance</span><b id="planWalletBalanceText">₹0</b><small>Plan buy करने पर amount wallet से auto deduct होगा.</small>`;
      grid.parentNode.insertBefore(hint, grid);
    }
    const el = document.getElementById("planWalletBalanceText");
    if (el) el.textContent = typeof money === "function" ? money(planWalletBalance()) : String(planWalletBalance());
  } catch(e) {}
}
setInterval(renderPlanWalletBalanceHint, 1500);
window.addEventListener("load", () => setTimeout(renderPlanWalletBalanceHint, 800));


/* ===== ADMIN STABILITY FIX ===== */
function adminSafeMoney(n) {
  try { if (typeof money === "function") return money(n); } catch(e) {}
  return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
function adminSafeUsd(n) {
  try { if (typeof usd === "function") return usd(n); } catch(e) {}
  return "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
}
function adminGetUsersOnly() {
  return (state.users || []).filter(u => String(u.role || "user").toLowerCase() !== "admin");
}
function adminWalletForUser(u) {
  if (!u) return 0;
  const uid = String(u.id || u.email || "");
  try { if (typeof realWallet === "function") return Number(realWallet(uid) || 0); } catch(e) {}
  const dep = (state.depositRequests || [])
    .filter(d => String(d.userId || d.user_id || "") === uid && String(d.status || "").toUpperCase() === "APPROVED")
    .reduce((a,d)=>a+Number(d.amount||0),0);
  const led = (state.walletLedger || [])
    .filter(l => String(l.userId || l.user_id || "") === uid)
    .reduce((a,l)=>a+Number(l.amount||0),0);
  return dep + led;
}
function adminPlanLimit(u) {
  try { if (typeof aiLimitForUser === "function") return aiLimitForUser(u); } catch(e) {}
  const plan = (state.plans || []).find(p => String(p.name||p.id).toLowerCase() === String(u.plan || "Free").toLowerCase());
  return Number(plan?.aiTradeLimit || plan?.ai_trade_limit || 5);
}
function adminUsedAi(u) {
  try { if (typeof aiUsed === "function") return aiUsed(u); } catch(e) {}
  const key = `${String(u.id || u.email || "local")}_REAL_${new Date().toISOString().slice(0,10)}`;
  return Number(state.aiTradeUsage?.[key] || 0);
}
function adminCanReceiveAi(u) {
  return u?.autoTradePermission !== false && adminUsedAi(u) < adminPlanLimit(u);
}
function adminEnsurePanels() {
  const panels = document.querySelectorAll(".admin-panel");
  if (!panels.length) return;
  if (![...panels].some(p => p.classList.contains("active-admin-panel"))) {
    panels[0].classList.add("active-admin-panel");
  }
  document.querySelectorAll(".admin-tab").forEach(tab => {
    if (tab.dataset.adminStableBound) return;
    tab.dataset.adminStableBound = "1";
    tab.addEventListener("click", function(e) {
      e.preventDefault();
      document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      document.querySelectorAll(".admin-panel").forEach(p => p.classList.remove("active-admin-panel"));
      const target = document.getElementById(tab.dataset.adminTab);
      if (target) target.classList.add("active-admin-panel");
      adminRenderAllSafe();
    });
  });
}
function adminRenderStatsSafe() {
  const users = adminGetUsersOnly();
  const totalDep = (state.depositRequests || []).filter(d => String(d.status).toUpperCase()==="APPROVED").reduce((a,d)=>a+Number(d.amount||0),0);
  const pendingDep = (state.depositRequests || []).filter(d => String(d.status).toUpperCase()==="PENDING").length;
  const openTrades = (state.managedTrades || []).filter(t => String(t.status).toUpperCase()==="OPEN").length;
  const map = {
    adminTotalUsers: users.length,
    adminTotalUsersMini: users.length,
    adminTotalDeposits: adminSafeMoney(totalDep),
    adminTotalDepositsMini: adminSafeMoney(totalDep),
    adminPendingDeposits: pendingDep,
    adminPendingDepositsMini: pendingDep,
    adminOpenTrades: openTrades,
    adminOpenTradesMini: openTrades
  };
  Object.entries(map).forEach(([id,val]) => { const el=document.getElementById(id); if(el) el.textContent=val; });
}
function adminRenderDepositsSafe() {
  const el = document.getElementById("depositRequestsLog");
  if (!el) return;
  el.innerHTML = (state.depositRequests || []).map(d => {
    const st = String(d.status || "PENDING").toUpperCase();
    return `<tr>
      <td>${d.userEmail || d.user_email || "-"}</td>
      <td>${adminSafeMoney(d.amount)}</td>
      <td>${d.txn || "-"}</td>
      <td>${st}</td>
      <td>${st==="PENDING" ? `<button class="approve-btn" onclick="approveDeposit('${d.id}')">Approve</button><button class="reject-btn" onclick="rejectDeposit('${d.id}')">Reject</button>` : "-"}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="5" class="empty">No deposits.</td></tr>`;
}
function adminRenderWithdrawalsSafe() {
  const el = document.getElementById("withdrawalRequestsLog");
  if (!el) return;
  el.innerHTML = (state.withdrawalRequests || []).map(w => {
    const st = String(w.status || "PENDING").toUpperCase();
    return `<tr>
      <td>${w.userEmail || w.user_email || "-"}</td>
      <td>${adminSafeMoney(w.amount)}</td>
      <td>${w.method || "-"}</td>
      <td>${st}</td>
      <td>${st==="PENDING" ? `<button class="approve-btn" onclick="approveWithdrawal('${w.id}')">Approve</button><button class="reject-btn" onclick="rejectWithdrawal('${w.id}')">Reject</button>` : "-"}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="5" class="empty">No withdrawals.</td></tr>`;
}
function adminRenderUserSelectsSafe() {
  const users = adminGetUsersOnly();
  const managed = document.getElementById("managedUserSelect");
  if (managed) {
    const old = managed.value;
    managed.innerHTML = `<option value="ALL">All Eligible Users</option>` + users.map(u => `<option value="${u.id || u.email}">${u.email || u.name} — ${adminSafeMoney(adminWalletForUser(u))}</option>`).join("");
    if ([...managed.options].some(o => o.value === old)) managed.value = old;
  }
  adminUpdateWalletPreviewSafe();
}
function adminUpdateWalletPreviewSafe() {
  const target = document.getElementById("managedUserSelect")?.value || "ALL";
  const walletEl = document.getElementById("managedUserWalletText");
  const availEl = document.getElementById("managedUserAvailableText");
  const amount = Number(document.getElementById("managedAmount")?.value || 0);
  const users = adminGetUsersOnly();
  if (!walletEl && !availEl) return;
  if (target === "ALL") {
    const eligible = users.filter(adminCanReceiveAi);
    const total = eligible.reduce((a,u)=>a+adminWalletForUser(u),0);
    const lowest = eligible.length ? Math.min(...eligible.map(adminWalletForUser)) : 0;
    if (walletEl) walletEl.textContent = `${eligible.length} eligible | ${adminSafeMoney(total)}`;
    if (availEl) availEl.textContent = `Lowest wallet: ${adminSafeMoney(lowest)} | Trade amount: ${adminSafeMoney(amount)}`;
  } else {
    const u = users.find(x => String(x.id || x.email) === String(target));
    const bal = adminWalletForUser(u);
    if (walletEl) walletEl.textContent = adminSafeMoney(bal);
    if (availEl) availEl.textContent = `Available: ${adminSafeMoney(bal)} | Trade amount: ${adminSafeMoney(amount)}`;
  }
}
function adminRenderEligibilitySafe() {
  const el = document.getElementById("adminAiEligibilityLog");
  if (!el) return;
  el.innerHTML = adminGetUsersOnly().map(u => {
    const used = adminUsedAi(u), limit = adminPlanLimit(u), left = Math.max(0, limit-used);
    return `<tr>
      <td>${u.email || u.name || "-"}</td>
      <td>${u.plan || "Free"}</td>
      <td>${used}</td>
      <td>${limit}</td>
      <td>${left}</td>
      <td>${left>0 && u.autoTradePermission !== false ? "Eligible" : "Blocked"}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="6" class="empty">No users found.</td></tr>`;
}
function adminRenderManagedTradesSafe() {
  const open = (state.managedTrades || []).filter(t => String(t.status).toUpperCase()==="OPEN");
  const sel = document.getElementById("managedTradeSelect");
  if (sel) {
    const old = sel.value;
    sel.innerHTML = `<option value="">Select open trade</option>` + open.map(t => `<option value="${t.id}">${t.userEmail || t.userId} | ${t.side} ${t.coin} | ${adminSafeMoney(t.amount)}</option>`).join("");
    if ([...sel.options].some(o => o.value === old)) sel.value = old;
  }
  const log = document.getElementById("managedTradesLog");
  if (log) {
    log.innerHTML = (state.managedTrades || []).map(t => `<tr>
      <td>${t.userEmail || t.userId || "-"}</td>
      <td>${String(t.coin||"").replace("USDT","/USDT")}</td>
      <td>${t.side || "-"}</td>
      <td>${adminSafeMoney(t.amount)}</td>
      <td>${adminSafeUsd(t.entry || t.entry_price)}</td>
      <td>${t.close || t.close_price ? adminSafeUsd(t.close || t.close_price) : "-"}</td>
      <td class="${Number(t.pnl||0)>=0?'pnl-plus':'pnl-minus'}">${adminSafeMoney(t.pnl)}</td>
      <td>${t.status || "OPEN"}</td>
      <td>${String(t.status).toUpperCase()==="OPEN" ? `<button class="reject-btn" onclick="document.getElementById('managedTradeSelect').value='${t.id}';cancelManagedTrade()">Cancel</button>` : "-"}</td>
    </tr>`).join("") || `<tr><td colspan="9" class="empty">No managed trades.</td></tr>`;
  }
  const mass = document.getElementById("massTradesLog");
  if (mass) {
    mass.innerHTML = (state.managedTrades || []).filter(t => t.source === "ADMIN_MASS").map(t => `<tr>
      <td>${t.userEmail || t.userId || "-"}</td><td>${String(t.coin||"").replace("USDT","/USDT")}</td><td>${t.side}</td><td>${adminSafeMoney(t.amount)}</td>
      <td>${adminSafeUsd(t.entry)}</td><td>${t.close?adminSafeUsd(t.close):"-"}</td><td>${adminSafeMoney(t.pnl)}</td><td>${t.status}</td><td>-</td>
    </tr>`).join("") || `<tr><td colspan="9" class="empty">No mass trades.</td></tr>`;
  }
}
function adminRenderPlansSafe() {
  const el = document.getElementById("adminPlansEditorLog");
  if (!el) return;
  el.innerHTML = (state.plans || []).map(p => `<tr>
    <td>${p.name}</td><td>${adminSafeMoney(p.price)}</td><td>${p.duration || "-"}</td><td>${p.aiTradeLimit || p.ai_trade_limit || 5}</td>
    <td><button class="ghost-btn" onclick="editPlan('${p.id || p.name}')">Edit</button></td>
  </tr>`).join("") || `<tr><td colspan="5" class="empty">No plans.</td></tr>`;
}
function adminRenderReferralSafe() {
  const el = document.getElementById("adminReferralLog") || document.getElementById("adminReferralsLog");
  if (!el) return;
  el.innerHTML = (state.referrals || []).map(r => `<tr>
    <td>${r.referrerEmail || r.referrer_email || r.referrerId || "-"}</td>
    <td>${r.userEmail || r.user_email || r.userId || "-"}</td>
    <td>${adminSafeMoney(r.depositAmount || r.deposit_amount)}</td>
    <td>${adminSafeMoney(r.bonusAmount || r.bonus_amount)}</td>
    <td>${r.status || "PAID"}</td>
  </tr>`).join("") || `<tr><td colspan="5" class="empty">No referral bonus yet.</td></tr>`;
}
function adminRenderPaymentsSafe() {
  const el = document.getElementById("paymentRequestsLog");
  if (!el) return;
  el.innerHTML = (state.paymentRequests || []).map(p => `<tr>
    <td>${p.userEmail || p.user_email || "-"}</td><td>${p.planName || p.plan_name || p.planId || "-"}</td><td>${adminSafeMoney(p.amount)}</td><td>${p.status || "PENDING"}</td><td>-</td>
  </tr>`).join("") || `<tr><td colspan="5" class="empty">No payment requests.</td></tr>`;
}
function adminRenderKycSafe() {
  const el = document.getElementById("kycRequestsLog");
  if (!el) return;
  el.innerHTML = (state.kycRequests || []).map(k => `<tr>
    <td>${k.userEmail || k.user_email || "-"}</td><td>${k.name || "-"}</td><td>${k.docType || k.doc_type || "-"}</td><td>${k.status || "PENDING"}</td>
    <td>${String(k.status).toUpperCase()==="PENDING" ? `<button class="approve-btn" onclick="approveKyc('${k.id}')">Approve</button>` : "-"}</td>
  </tr>`).join("") || `<tr><td colspan="5" class="empty">No KYC requests.</td></tr>`;
}
function adminRenderAllSafe() {
  try {
    if (state.user?.role !== "admin") return;
    adminEnsurePanels();
    adminRenderStatsSafe();
    adminRenderDepositsSafe();
    adminRenderWithdrawalsSafe();
    adminRenderUserSelectsSafe();
    adminRenderEligibilitySafe();
    adminRenderManagedTradesSafe();
    adminRenderPlansSafe();
    adminRenderReferralSafe();
    adminRenderPaymentsSafe();
    adminRenderKycSafe();
  } catch(e) {
    console.warn("Admin stable render failed", e);
  }
}
function adminBindControlsSafe() {
  ["managedUserSelect","managedAmount","managedCoin","managedOrderType"].forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.adminStableControl) return;
    el.dataset.adminStableControl = "1";
    el.addEventListener("change", adminUpdateWalletPreviewSafe);
    el.addEventListener("input", adminUpdateWalletPreviewSafe);
  });
}
setInterval(() => {
  adminEnsurePanels();
  adminBindControlsSafe();
  adminRenderAllSafe();
}, 1200);
window.addEventListener("load", () => setTimeout(() => {
  adminEnsurePanels();
  adminBindControlsSafe();
  adminRenderAllSafe();
}, 800));


/* ===== ADMIN BULK USE USER PERCENT FIX ===== */
function pctAdminTargets() {
  const users = (state.users || []).filter(u => String(u.role || "user").toLowerCase() !== "admin");
  return users.filter(u => {
    const auto = u.autoTradePermission !== false;
    let limitOk = true;
    try {
      if (typeof canReceiveAi === "function") limitOk = canReceiveAi(u);
    } catch(e) {}
    return auto && limitOk;
  });
}

function pctAdminGetTradeFields() {
  const coin = document.getElementById("massTradeCoin")?.value || document.getElementById("managedCoin")?.value || "BTCUSDT";
  const side = document.getElementById("massTradeSide")?.value || document.getElementById("managedSide")?.value || "BUY";
  const risk = document.getElementById("massTradeRisk")?.value || document.getElementById("managedRisk")?.value || "MEDIUM";
  const leverage = Number(window.__bulkAiLeverage || document.getElementById("massTradeLeverage")?.value || document.getElementById("managedLeverage")?.value || 1);
  const orderType = window.__bulkAiOrderType || document.getElementById("massTradeOrderType")?.value || document.getElementById("managedOrderType")?.value || "MARKET";

  let entry = 0;
  try {
    if (typeof priceOf === "function") entry = Number(priceOf(coin) || 0);
  } catch(e) {}
  if (orderType === "LIMIT") {
    entry = Number(document.getElementById("managedEntryPrice")?.value || entry || 0);
  }

  return { coin, side, risk, leverage: Math.min(2000, Math.max(1, leverage || 1)), orderType, entry };
}

function pctRenderBulkPreview() {
  const useUserPct = document.getElementById("bulkUseUserPercent")?.checked !== false;
  const mode = document.getElementById("bulkPercentModeText");
  const prev = document.getElementById("bulkPercentPreviewText");
  if (!mode && !prev) return;

  if (!useUserPct) {
    const amt = Number(document.getElementById("massTradeAmount")?.value || document.getElementById("managedAmount")?.value || 0);
    if (mode) mode.textContent = "Same amount for all";
    if (prev) prev.textContent = "Every eligible user trade amount: " + pctMoney(amt);
    return;
  }

  const targets = pctAdminTargets();
  const amounts = targets.map(u => pctTradeAmountForUser(u)).filter(a => a >= 100);
  const total = amounts.reduce((a,b)=>a+b,0);
  const skipped = targets.length - amounts.length;

  if (mode) mode.textContent = "User selected %";
  if (prev) prev.textContent = `${amounts.length} users | Total amount ${pctMoney(total)} | Skipped ${skipped}`;
}

async function pctOpenBulkTradeUserPercent() {
  if (state.user?.role !== "admin") return;
  const useUserPct = document.getElementById("bulkUseUserPercent")?.checked !== false;

  // If disabled, use existing mass/managed flow.
  if (!useUserPct) {
    try {
      if (typeof openMassTrade === "function") return openMassTrade();
      if (typeof openManagedTrade === "function") return openManagedTrade();
    } catch(e) {}
  }

  const fields = pctAdminGetTradeFields();
  const targets = pctAdminTargets();
  let opened = 0, skipped = 0;

  for (const u of targets) {
    const amount = pctTradeAmountForUser(u);
    const wallet = pctRealWalletForUser(u);
    if (!amount || amount < 100 || wallet < amount) {
      skipped++;
      continue;
    }

    const t = {
      id: "mg_" + Date.now() + "_" + Math.random().toString(16).slice(2),
      userId: u.id || u.email,
      userEmail: u.email || "",
      coin: fields.coin,
      side: fields.side,
      risk: fields.risk,
      amount,
      entry: fields.entry,
      close: null,
      pnl: 0,
      leverage: fields.leverage,
      orderType: fields.orderType,
      status: "OPEN",
      source: "ADMIN_MASS",
      openedAt: new Date().toLocaleString()
    };

    state.managedTrades = state.managedTrades || [];
    state.managedTrades.unshift(t);

    try { if (typeof incAiUsage === "function") incAiUsage(u); } catch(e) {}

    if (typeof supabaseClient !== "undefined" && supabaseClient) {
      try {
        await supabaseClient.from("managed_trades").insert({
          id: t.id,
          user_id: t.userId,
          user_email: t.userEmail,
          coin: t.coin,
          side: t.side,
          risk: t.risk,
          amount: t.amount,
          entry_price: t.entry,
          pnl: 0,
          status: "OPEN",
          source: t.source,
          opened_at: t.openedAt
        });
      } catch(e) {
        console.warn("Percent bulk managed trade DB insert failed", e);
      }
    }
    opened++;
  }

  try { saveState?.(); } catch(e) {}
  try { render?.(); } catch(e) {}
  try { toast?.(`Bulk trade opened: ${opened}, skipped: ${skipped}`); } catch(e) { alert(`Bulk trade opened: ${opened}, skipped: ${skipped}`); }
}

function pctBindAdminBulkPercent() {
  const btn = document.getElementById("openMassTradeBtn");
  if (btn && !btn.dataset.percentBulkBound) {
    btn.dataset.percentBulkBound = "1";
    btn.addEventListener("click", function(e) {
      if (document.getElementById("bulkUseUserPercent")?.checked !== false) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        pctOpenBulkTradeUserPercent();
        return false;
      }
    }, true);
  }

  ["bulkUseUserPercent","massTradeAmount","managedAmount","massTradeCoin","massTradeLeverage","massTradeOrderType"].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.dataset.percentPreviewBound) {
      el.dataset.percentPreviewBound = "1";
      el.addEventListener("change", pctRenderBulkPreview);
      el.addEventListener("input", pctRenderBulkPreview);
    }
  });

  pctRenderBulkPreview();
}
setInterval(pctBindAdminBulkPercent, 1200);
window.addEventListener("load", () => setTimeout(pctBindAdminBulkPercent, 1000));


/* ===== ADMIN REFRESH SESSION HARD FIX ===== */
(function(){
  function isHardAdminPage() {
    return !!window.FORCE_ADMIN_PAGE ||
      /(^|\/)admin\.html(\?|#|$)/i.test(location.pathname) ||
      document.body?.dataset?.adminPage === "true";
  }

  window.isHardAdminPage = isHardAdminPage;

  function getAdminSessionHard() {
    try {
      return JSON.parse(localStorage.getItem("ai_admin_session_v1") || "null");
    } catch(e) {
      return null;
    }
  }

  function saveAdminSessionHard(user) {
    if (user && user.role === "admin") {
      localStorage.setItem("ai_admin_session_v1", JSON.stringify(user));
      // Do not let user-session override admin page.
      localStorage.removeItem("ai_user_session_v1");
    }
  }

  function lockAdminPageHard() {
    if (!isHardAdminPage()) return;

    document.body.dataset.adminPage = "true";

    const adminSession = getAdminSessionHard();
    if (adminSession && adminSession.role === "admin") {
      try {
        state.user = adminSession;
        state.mode = "REAL";
        if (typeof saveSession === "function") saveSession();
      } catch(e) {}

      try {
        const auth = document.getElementById("authPage");
        const app = document.getElementById("appPage");
        const logout = document.getElementById("logoutBtn");
        if (auth) auth.classList.add("hidden");
        if (app) app.classList.remove("hidden");
        if (logout) logout.classList.remove("hidden");
      } catch(e) {}

      setTimeout(() => {
        try {
          if (typeof showPage === "function") showPage("admin");
          else document.getElementById("admin")?.classList.add("active-page");
          if (typeof render === "function") render();
        } catch(e) {}
      }, 250);
    } else {
      // No admin session: keep admin login page only. Never open user/demo dashboard on admin.html.
      try {
        state.user = null;
        localStorage.removeItem("ai_admin_session_v1");
      } catch(e) {}

      setTimeout(() => {
        const auth = document.getElementById("authPage");
        const app = document.getElementById("appPage");
        const logout = document.getElementById("logoutBtn");
        if (auth) auth.classList.remove("hidden");
        if (app) app.classList.add("hidden");
        if (logout) logout.classList.add("hidden");
      }, 100);
    }
  }

  // Patch afterLogin so admin session is saved separately.
  const installAfterLoginPatch = () => {
    try {
      if (window.__adminAfterLoginPatched) return;
      if (typeof afterLogin !== "function") return;

      const oldAfterLogin = afterLogin;
      window.afterLogin = afterLogin = function(user) {
        if (isHardAdminPage()) {
          if (!user || user.role !== "admin") {
            alert("Admin page पर केवल admin login allowed है.");
            return;
          }
          saveAdminSessionHard(user);
        }
        return oldAfterLogin(user);
      };

      window.__adminAfterLoginPatched = true;
    } catch(e) {}
  };

  document.addEventListener("DOMContentLoaded", function(){
    installAfterLoginPatch();
    setTimeout(lockAdminPageHard, 200);
    setTimeout(lockAdminPageHard, 1000);
  });

  window.addEventListener("load", function(){
    installAfterLoginPatch();
    setTimeout(lockAdminPageHard, 300);
  });

  setInterval(function(){
    installAfterLoginPatch();
    if (isHardAdminPage() && state?.user?.role === "admin") {
      const app = document.getElementById("appPage");
      const auth = document.getElementById("authPage");
      if (app && app.classList.contains("hidden")) app.classList.remove("hidden");
      if (auth && !auth.classList.contains("hidden")) auth.classList.add("hidden");
    }
  }, 1500);
})();


/* ===== ADMIN BULK + OPEN AI TRADES ONLY FIX ===== */
function adminBulkOpenOnlyFix() {
  try {
    // Rename tabs cleanly
    const massTab = document.querySelector('[data-admin-tab="adminMassTrade"]');
    if (massTab) massTab.textContent = "⇅ Bulk AI Trade";

    const managedTab = document.querySelector('[data-admin-tab="adminManagedTrade"]');
    if (managedTab) managedTab.textContent = "▤ Open AI Trades";

    // Hide generic Trades tab to reduce confusion
    const tradesTab = document.querySelector('[data-admin-tab="adminTrades"]');
    if (tradesTab) tradesTab.style.display = "none";

    const tradesPanel = document.getElementById("adminTrades");
    if (tradesPanel) tradesPanel.style.display = "none";

    // In Open AI Trades panel, hide the old single trade form. Keep close/cancel + history.
    const openPanel = document.getElementById("adminManagedTrade");
    if (openPanel) {
      const cards = openPanel.querySelectorAll(".admin-two-grid > .card");
      if (cards[0]) cards[0].classList.add("hide-single-ai-card");
      if (cards[1]) {
        const label = cards[1].querySelector(".label");
        const h2 = cards[1].querySelector("h2");
        if (label) label.textContent = "Open AI Trades";
        if (h2) h2.textContent = "Close / Cancel AI Trade";
      }
      openPanel.querySelectorAll(".section-head .label").forEach(el => {
        if (/Managed|Mass/i.test(el.textContent)) el.textContent = "Open AI Trades";
      });
      openPanel.querySelectorAll(".section-head h2").forEach(el => {
        if (/History/i.test(el.textContent)) el.textContent = "Open / Closed AI Trade History";
      });
    }

    // In Bulk AI Trade panel, hide old close block because close/cancel is handled in Open AI Trades tab.
    const bulkPanel = document.getElementById("adminMassTrade");
    if (bulkPanel) {
      const cards = Array.from(bulkPanel.querySelectorAll(":scope > .card"));
      cards.forEach(card => {
        const text = card.textContent || "";
        if (/Close Open|Close Selected|Close All Open|massClosePrice|massCloseTradeSelect/i.test(text)) {
          card.classList.add("hide-bulk-close-card");
        }
      });

      const label = bulkPanel.querySelector(".label");
      const h2 = bulkPanel.querySelector("h2");
      if (label && /Mass|AI/i.test(label.textContent)) label.textContent = "Bulk AI Trade";
      if (h2 && /Open/i.test(h2.textContent)) h2.textContent = "Open Bulk AI Trade";
    }
  } catch(e) {
    console.warn("Admin bulk/open cleanup failed", e);
  }
}

setInterval(adminBulkOpenOnlyFix, 1000);
window.addEventListener("load", () => setTimeout(adminBulkOpenOnlyFix, 500));


/* ===== BULK LEVERAGE + CLOSE ALL AI TRADES FIX ===== */
function aiBulkPrice(coin) {
  try { if (typeof priceOf === "function") return Number(priceOf(coin) || 0); } catch(e) {}
  return Number(state?.prices?.[coin]?.price || 0);
}
function aiBulkMoney(n) {
  try { if (typeof money === "function") return money(n); } catch(e) {}
  return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
function aiBulkOpenTrades() {
  return (state.managedTrades || []).filter(t => {
    const st = String(t.status || "OPEN").toUpperCase();
    const src = String(t.source || "").toUpperCase();
    return st === "OPEN" && (src.includes("ADMIN") || src.includes("AI") || src.includes("MASS") || src === "");
  });
}
function aiBulkPnl(side, entry, close, amount, leverage) {
  const diff = side === "SELL" ? Number(entry) - Number(close) : Number(close) - Number(entry);
  return (diff / Number(entry || 1)) * Number(amount || 0) * Number(leverage || 1);
}
function aiBulkGetLeverage() {
  const raw = Number(document.getElementById("massTradeLeverage")?.value || document.getElementById("managedLeverage")?.value || 1);
  return Math.min(2000, Math.max(1, raw || 1));
}
function aiBulkGetOrderType() {
  return document.getElementById("massTradeOrderType")?.value || document.getElementById("managedOrderType")?.value || "MARKET";
}

// Patch bulk trade fields into existing managed fields before old openMassTrade/openManagedTrade runs
function aiBulkBridgeFields() {
  const lev = document.getElementById("massTradeLeverage")?.value;
  const type = document.getElementById("massTradeOrderType")?.value;
  if (lev && document.getElementById("managedLeverage")) document.getElementById("managedLeverage").value = lev;
  if (type && document.getElementById("managedOrderType")) document.getElementById("managedOrderType").value = type;
}

async function closeAllAiTrades() {
  const open = aiBulkOpenTrades();
  if (!open.length) {
    alert("No open AI trades found.");
    return;
  }

  const manualClose = Number(document.getElementById("allAiClosePrice")?.value || 0);
  let closed = 0;

  for (const t of open) {
    const coin = t.coin || "BTCUSDT";
    const close = manualClose || aiBulkPrice(coin) || Number(t.entry || t.entry_price || 0);
    const entry = Number(t.entry || t.entry_price || 0);
    const amount = Number(t.amount || 0);
    const leverage = Number(t.leverage || 1);

    t.close = close;
    t.close_price = close;
    t.pnl = aiBulkPnl(t.side, entry, close, amount, leverage);
    t.status = "CLOSED";
    t.closedAt = new Date().toLocaleString();
    t.closed_at = t.closedAt;

    if (typeof supabaseClient !== "undefined" && supabaseClient) {
      try {
        await supabaseClient.from("managed_trades").update({
          close_price: close,
          pnl: t.pnl,
          status: "CLOSED",
          closed_at: t.closedAt
        }).eq("id", t.id);
      } catch(e) {
        console.warn("close all managed_trades update failed", e);
      }

      try {
        await supabaseClient.from("wallet_ledger").insert({
          user_id: t.userId || t.user_id,
          type: String(t.source || "").toUpperCase().includes("MASS") ? "MASS_TRADE_PNL" : "MANAGED_TRADE_PNL",
          amount: t.pnl,
          note: "AI trade closed by admin"
        });
      } catch(e) {
        console.warn("close all wallet ledger failed", e);
      }
    }

    state.walletLedger = state.walletLedger || [];
    state.walletLedger.unshift({
      id: "led_ai_" + Date.now() + "_" + Math.random().toString(16).slice(2),
      userId: t.userId || t.user_id,
      type: String(t.source || "").toUpperCase().includes("MASS") ? "MASS_TRADE_PNL" : "MANAGED_TRADE_PNL",
      amount: t.pnl,
      note: "AI trade closed by admin"
    });

    closed++;
  }

  try { saveState?.(); } catch(e) {}
  try { render?.(); } catch(e) {}
  alert(`Closed ${closed} open AI trades.`);
}

async function cancelAllAiTrades() {
  const open = aiBulkOpenTrades();
  if (!open.length) {
    alert("No open AI trades found.");
    return;
  }

  let cancelled = 0;
  for (const t of open) {
    t.status = "CANCELLED";
    t.pnl = 0;
    t.closedAt = new Date().toLocaleString();
    t.closed_at = t.closedAt;

    try {
      if (typeof decAiUsage === "function") decAiUsage({ id: t.userId || t.user_id, email: t.userEmail || t.user_email });
    } catch(e) {}

    if (typeof supabaseClient !== "undefined" && supabaseClient) {
      try {
        await supabaseClient.from("managed_trades").update({
          status: "CANCELLED",
          pnl: 0,
          closed_at: t.closedAt
        }).eq("id", t.id);
      } catch(e) {
        console.warn("cancel all managed_trades update failed", e);
      }
    }

    cancelled++;
  }

  try { saveState?.(); } catch(e) {}
  try { render?.(); } catch(e) {}
  alert(`Cancelled ${cancelled} open AI trades.`);
}

function bindBulkLeverageCloseAll() {
  const openBtn = document.getElementById("openMassTradeBtn");
  if (openBtn && !openBtn.dataset.bulkLevBound) {
    openBtn.dataset.bulkLevBound = "1";
    openBtn.addEventListener("click", aiBulkBridgeFields, true);
  }

  const closeBtn = document.getElementById("closeAllAiTradesBtn");
  if (closeBtn && !closeBtn.dataset.closeAllAiBound) {
    closeBtn.dataset.closeAllAiBound = "1";
    closeBtn.addEventListener("click", function(e) {
      e.preventDefault();
      closeAllAiTrades();
    });
  }

  const cancelBtn = document.getElementById("cancelAllAiTradesBtn");
  if (cancelBtn && !cancelBtn.dataset.cancelAllAiBound) {
    cancelBtn.dataset.cancelAllAiBound = "1";
    cancelBtn.addEventListener("click", function(e) {
      e.preventDefault();
      if (confirm("Cancel all open AI trades?")) cancelAllAiTrades();
    });
  }
}
setInterval(bindBulkLeverageCloseAll, 1000);
window.addEventListener("load", () => setTimeout(bindBulkLeverageCloseAll, 700));


/* ===== DIRECT ADMIN BULK LEVERAGE LOGIC FIX ===== */
function getAdminBulkLeverageDirect() {
  const v = Number(document.getElementById("massTradeLeverage")?.value || 1);
  return Math.min(2000, Math.max(1, v || 1));
}
function getAdminBulkOrderTypeDirect() {
  return document.getElementById("massTradeOrderType")?.value || "MARKET";
}
document.addEventListener("click", function(e){
  const btn = e.target.closest("#openMassTradeBtn");
  if (!btn) return;
  const lev = getAdminBulkLeverageDirect();
  const typ = getAdminBulkOrderTypeDirect();
  window.__bulkAiLeverage = lev;
  window.__bulkAiOrderType = typ;
  const ml = document.getElementById("managedLeverage");
  const mt = document.getElementById("managedOrderType");
  if (ml) ml.value = lev;
  if (mt) mt.value = typ;
}, true);


/* ===== ADMIN USERS MENU EXACT FIX ===== */
function adminUsersAliasBridge() {
  // If old Users panel IDs exist, mirror them to hard IDs so one renderer can fill both.
  const pairs = [
    ["adminUserSearch", "adminHardUserSearch"],
    ["adminUserStatusFilter", "adminHardUserStatusFilter"],
    ["adminUsersLog", "adminHardUsersLog"],
    ["adminSelectedUserTitle", "adminHardSelectedUserTitle"],
    ["adminSelectedUserSub", "adminHardSelectedUserSub"],
    ["adminDetailWallet", "adminHardDetailWallet"],
    ["adminDetailDeposit", "adminHardDetailDeposit"],
    ["adminDetailPnl", "adminHardDetailPnl"],
    ["adminDetailAiLimit", "adminHardDetailAiLimit"],
    ["adminUserPlanSelect", "adminHardUserPlanSelect"],
    ["adminUserAiPercentSelect", "adminHardUserAiPercentSelect"],
    ["adminUserAiToggle", "adminHardUserAiToggle"],
    ["adminUserActiveToggle", "adminHardUserActiveToggle"],
    ["adminWalletAdjustAmount", "adminHardWalletAdjustAmount"],
    ["adminWalletAdjustType", "adminHardWalletAdjustType"],
    ["adminWalletAdjustNote", "adminHardWalletAdjustNote"],
    ["adminWalletAdjustBtn", "adminHardWalletAdjustBtn"],
    ["adminSaveUserControlBtn", "adminHardSaveUserControlBtn"],
    ["adminViewUserHistoryBtn", "adminHardRefreshUserBtn"]
  ];
  pairs.forEach(([oldId, newId]) => {
    const oldEl = document.getElementById(oldId);
    const newEl = document.getElementById(newId);
    if (oldEl && !newEl) oldEl.id = newId;
  });

  // Make sure Users button is inside admin-menu if app was cached/modified.
  const menu = document.querySelector(".admin-menu");
  if (menu && !menu.querySelector('[data-admin-tab="adminUsers"]')) {
    const btn = document.createElement("button");
    btn.className = "admin-tab";
    btn.dataset.adminTab = "adminUsers";
    btn.textContent = "👥 Users";
    const overview = menu.querySelector('[data-admin-tab="adminOverview"]');
    if (overview) menu.insertBefore(btn, overview);
    else menu.appendChild(btn);
  }
}
setInterval(adminUsersAliasBridge, 700);
window.addEventListener("load", () => setTimeout(adminUsersAliasBridge, 300));


/* ===== USER UI STRUCTURE CLEAN REBUILD ===== */
(function(){
  const CLEAN_UI_VERSION = "user-clean-v1";

  function uiMoney(n){
    try { if (typeof money === "function") return money(n); } catch(e) {}
    return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }
  function uiUsd(n){
    try { if (typeof usd === "function") return usd(n); } catch(e) {}
    return "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  function uiPrice(coin){
    try { if (typeof priceOf === "function") return Number(priceOf(coin) || 0); } catch(e) {}
    return Number(state?.prices?.[coin]?.price || 0);
  }
  function uiRealWallet(){
    try { if (typeof realWallet === "function") return Number(realWallet() || 0); } catch(e) {}
    return Number(state?.accounts?.REAL?.balance || 0);
  }
  function uiDemoWallet(){
    return Number(state?.accounts?.DEMO?.balance || 100000);
  }
  function uiUserName(){
    return state?.user?.name || state?.user?.email?.split("@")[0] || "User";
  }
  function uiInitial(){
    return (uiUserName()[0] || "U").toUpperCase();
  }
  function uiIsUser(){
    return state?.user && state.user.role !== "admin";
  }
  function uiMode(){
    return state?.mode || "DEMO";
  }
  function uiTodayPnl(){
    try {
      const real = state?.accounts?.REAL || {};
      const demo = state?.accounts?.DEMO || {};
      const acc = state?.mode === "REAL" ? real : demo;
      const open = (acc.trades || []).reduce((a,t)=>a+Number(t.pnl||0),0);
      const closed = (acc.closedTrades || []).reduce((a,t)=>a+Number(t.pnl||0),0);
      const managed = (state.managedTrades || [])
        .filter(t => String(t.userId || t.user_id || "") === String(state.user?.id || state.user?.email || ""))
        .reduce((a,t)=>a+Number(t.pnl||0),0);
      return open + closed + managed;
    } catch(e) { return 0; }
  }
  function uiAiLimit(){
    try { if (typeof aiLimitForUser === "function") return aiLimitForUser(state.user); } catch(e) {}
    return 5;
  }
  function uiAiUsed(){
    try { if (typeof aiUsed === "function") return aiUsed(state.user); } catch(e) {}
    return 0;
  }
  function uiSignal(){
    const sig = state?.signal || state?.activeSignal || {};
    const side = sig.side || sig.action || "BUY";
    const coin = sig.coin || "BTCUSDT";
    return { side, coin };
  }

  function uiLogout(){
    try {
      if (typeof logout === "function") return logout();
    } catch(e) {}
    try {
      state.user = null;
      localStorage.removeItem("ai_user_session_v1");
      localStorage.removeItem("ai_admin_session_v1");
      localStorage.removeItem("ai_session");
    } catch(e) {}
    location.reload();
  }
  window.uiLogout = uiLogout;

  function uiSwitchMode(mode){
    try {
      if (mode === "DEMO") document.getElementById("demoBtn")?.click();
      if (mode === "REAL") document.getElementById("realBtn")?.click();
      state.mode = mode;
      if (typeof saveState === "function") saveState();
      if (typeof render === "function") render();
    } catch(e) {
      state.mode = mode;
    }
    setTimeout(uiRenderHomeShell, 60);
  }
  window.uiSwitchMode = uiSwitchMode;

  function uiShellHtml(){
    const sig = uiSignal();
    const coins = ["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT"];
    const mode = uiMode();
    const used = uiAiUsed(), limit = uiAiLimit();
    const progress = Math.min(100, Math.max(0, (used / (limit || 5))*100));
    return `
      <section id="cleanHomeShell" class="clean-home-shell">
<div class="clean-welcome-card card">
          <div class="clean-welcome-top">
            <div>
              <p class="label">Welcome Back</p>
              <h2>Hello, ${uiUserName()}</h2>
            </div>
            <div class="clean-avatar">${uiInitial()}</div>
          </div>

          <div class="clean-account-mode">
            <button type="button" class="clean-account-pill ${mode==="DEMO" ? "active" : ""}" onclick="uiSwitchMode('DEMO')">
              <span>Demo Account</span>
              <b>${uiMoney(uiDemoWallet())}</b>
            </button>
            <button type="button" class="clean-account-pill ${mode==="REAL" ? "active" : ""}" onclick="uiSwitchMode('REAL')">
              <span>Real Account</span>
              <b>${uiMoney(uiRealWallet())}</b>
            </button>
          </div>
        </div>

        <div class="clean-market-grid">
          ${coins.map(c=>{
            const ch = Number(state?.prices?.[c]?.change || 0);
            return `<div class="clean-market-card">
              <b>${c.replace("USDT","/USDT")}</b>
              <span>${uiUsd(uiPrice(c))}</span>
              <em class="${ch>=0?'pos':'neg'}">${ch.toFixed(2)}%</em>
            </div>`;
          }).join("")}
        </div>

        <div class="clean-stats-grid">
          <div class="clean-stat-card"><span>Today PnL</span><b class="${uiTodayPnl()>=0?'pos':'neg'}">${uiMoney(uiTodayPnl())}</b></div>
          <div class="clean-stat-card"><span>Win Rate</span><b>${state?.winRate || "0"}%</b></div>
          <div class="clean-stat-card"><span>Market Mood</span><b>${state?.marketMood || "Neutral"}</b></div>
          <div class="clean-stat-card"><span>Active Signal</span><b>${sig.side}</b></div>
        </div>

        <div class="clean-ai-signal-card card">
          <div class="clean-live-dot"></div>
          <div class="clean-ai-main">
            <p class="label">AI Signal Live</p>
            <h2>${sig.side} ${String(sig.coin || "BTCUSDT").replace("USDT","/USDT")}</h2>
            <p>AI trend confirmation active.</p>
          </div>
          <div class="clean-confidence">82%</div>
          <div class="clean-signal-grid">
            <div><span>Entry</span><b>Market</b></div>
            <div><span>Target</span><b>${sig.target ? uiUsd(sig.target) : "-"}</b></div>
            <div><span>Stop Loss</span><b>${sig.stopLoss ? uiUsd(sig.stopLoss) : "-"}</b></div>
            <div><span>Expires</span><b>30m</b></div>
          </div>
        </div>
      </section>
    `;
  }

  function uiGetDashboard(){
    return document.getElementById("dashboard") ||
      document.getElementById("home") ||
      document.querySelector('[data-page="home"]') ||
      document.querySelector(".page.active-page") ||
      document.getElementById("appPage");
  }

  function uiRenderHomeShell(){
    if (!uiIsUser()) return;
    const dash = uiGetDashboard();
    if (!dash) return;

    let shell = document.getElementById("cleanHomeShell");
    if (!shell) {
      shell = document.createElement("div");
      shell.id = "cleanHomeMount";
      dash.prepend(shell);
    } else {
      shell = shell.parentElement;
    }
    shell.innerHTML = uiShellHtml();

    // Hide original home clutter only in dashboard area. Other pages remain untouched.
    Array.from(dash.children).forEach(child => {
      if (child.id === "cleanHomeMount") return;
      const txt = child.textContent || "";
      if (
        /BTC\/USDT|ETH\/USDT|SOL\/USDT|BNB\/USDT|Today PnL|Win Rate|Market Mood|Active Signal|Hello,|Switch Account|AI\/AI Trades Today|AI Signal Live/i.test(txt)
      ) {
        child.classList.add("clean-home-hidden-old");
      }
    });
    document.body.classList.add("clean-user-ui-ready");
  }

  function uiShortWalletNote(){
    document.querySelectorAll(".muted, .wallet-note, p").forEach(el => {
      const t = el.textContent || "";
      if (/Deposit approval|Deposit approve|Deposit approval के बाद/i.test(t)) {
        el.textContent = "Approved deposit Real Wallet में add होगा। Open trade PnL live update होगा।";
      }
    });
  }

  function uiCreateCardsFromTable(tbodyId, mountId, type){
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    const table = tbody.closest("table");
    const wrap = table?.closest(".table-wrap") || table?.parentElement;
    if (!wrap) return;

    let mount = document.getElementById(mountId);
    if (!mount) {
      mount = document.createElement("div");
      mount.id = mountId;
      mount.className = "clean-mobile-list";
      wrap.parentNode.insertBefore(mount, wrap.nextSibling);
    }

    const headers = Array.from(table.querySelectorAll("thead th")).map(th => th.textContent.trim());
    const rows = Array.from(tbody.querySelectorAll("tr")).filter(r => !r.querySelector(".empty"));

    if (!rows.length) {
      mount.innerHTML = `<div class="clean-empty-card">No records yet.</div>`;
      return;
    }

    mount.innerHTML = rows.map(row => {
      const cells = Array.from(row.children).map(td => td.textContent.trim());
      return `<div class="clean-record-card">
        ${cells.map((c,i)=>`<p><span>${headers[i] || ("Field " + (i+1))}</span><b>${c || "-"}</b></p>`).join("")}
      </div>`;
    }).join("");
  }

  function uiMobileTableCards(){
    uiCreateCardsFromTable("userManagedTradesLog", "cleanAiHistoryList", "ai");
    uiCreateCardsFromTable("userManualTradesLog", "cleanManualHistoryList", "manual");
    uiCreateCardsFromTable("userDepositLog", "cleanDepositList", "deposit");
    uiCreateCardsFromTable("userWithdrawalLog", "cleanWithdrawList", "withdraw");
  }

  function uiRun(){
    try {
      uiRenderHomeShell();
      uiShortWalletNote();
      uiMobileTableCards();
      document.body.classList.add("clean-bottom-safe");
    } catch(e) { console.warn("Clean UI structure skipped", e); }
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(uiRun, 300));
  window.addEventListener("load", () => setTimeout(uiRun, 500));
  setInterval(function(){
    try {
      uiShortWalletNote();
      uiMobileTableCards();
      document.body.classList.add("clean-bottom-safe");
    } catch(e) {}
  }, 3000);
})();


/* ===== TRADE PAGE OPEN POSITIONS + BIG CHART ONLY ===== */
(function(){
  function posIsUser(){ return state?.user && state.user.role !== "admin"; }
  function posMoney(n){
    try { if (typeof money === "function") return money(n); } catch(e){}
    return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }
  function posUsd(n){
    try { if (typeof usd === "function") return usd(n); } catch(e){}
    return "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  function posPrice(coin){
    try { if (typeof priceOf === "function") return Number(priceOf(coin) || 0); } catch(e){}
    return Number(state?.prices?.[coin]?.price || 0);
  }
  function posMode(){ return state?.mode || "DEMO"; }
  function posAccount(){
    const mode = posMode();
    state.accounts = state.accounts || {};
    state.accounts[mode] = state.accounts[mode] || { balance: mode === "DEMO" ? 100000 : 0, trades: [], closedTrades: [] };
    state.accounts[mode].trades = state.accounts[mode].trades || [];
    state.accounts[mode].closedTrades = state.accounts[mode].closedTrades || [];
    return state.accounts[mode];
  }
  function posUpdatePnl(t){
    try { if (typeof updateTradePnl === "function") return updateTradePnl(t); } catch(e){}
    const current = posPrice(t.coin);
    t.current = current;
    const diff = t.side === "SELL" ? Number(t.entry) - current : current - Number(t.entry);
    t.pnl = (diff / Number(t.entry || 1)) * Number(t.amount || 0) * Number(t.leverage || 1);
    return t.pnl;
  }

  function posTradePage(){
    return document.getElementById("tradepage") || document.getElementById("trade") || document.querySelector('[data-page="trade"]')?.closest(".page");
  }

  function posCreateMount(){
    const tradePage = posTradePage();
    if (!tradePage) return null;

    let mount = document.getElementById("manualOpenPositionsMount");
    if (!mount) {
      mount = document.createElement("div");
      mount.id = "manualOpenPositionsMount";
      mount.className = "card manual-open-positions-card";
      mount.innerHTML = `
        <div class="section-head clean-section-head">
          <div>
            <p class="label">Live Trades</p>
            <h2>Open Positions</h2>
            <p class="muted small">User manual trades यहाँ दिखेंगी. Close button से position बंद करें.</p>
          </div>
        </div>
        <div id="manualOpenPositionsList" class="manual-open-positions-list">
          <div class="clean-empty-card">No open positions.</div>
        </div>
      `;

      const chart = document.getElementById("crypto_live_chart") || document.getElementById("tradingViewChart") || document.getElementById("chartContainer");
      const chartCard = chart?.closest(".card") || chart?.parentElement;
      if (chartCard && chartCard.parentNode) chartCard.parentNode.insertBefore(mount, chartCard.nextSibling);
      else tradePage.prepend(mount);
    }
    return mount;
  }

  function posRender(){
    if (!posIsUser()) return;
    const mount = posCreateMount();
    if (!mount) return;

    const list = document.getElementById("manualOpenPositionsList");
    if (!list) return;

    const acc = posAccount();
    const trades = (acc.trades || []).filter(t => String(t.status || "OPEN").toUpperCase() === "OPEN" && (!t.source || t.source === "USER"));

    if (!trades.length) {
      list.innerHTML = `<div class="clean-empty-card">No open positions.</div>`;
      return;
    }

    list.innerHTML = trades.map(t => {
      posUpdatePnl(t);
      const side = String(t.side || "BUY").toUpperCase();
      const pnl = Number(t.pnl || 0);
      const current = Number(t.current || posPrice(t.coin));
      return `<div class="manual-position-card ${side === "SELL" ? "sell" : "buy"}">
        <div class="position-top">
          <div>
            <b>${String(t.coin || "BTCUSDT").replace("USDT","/USDT")}</b>
            <span>${side} • ${Number(t.leverage || 1)}x • ${posMode()}</span>
          </div>
          <strong class="${pnl >= 0 ? "pos" : "neg"}">${posMoney(pnl)}</strong>
        </div>
        <div class="position-grid">
          <div><span>Amount</span><b>${posMoney(t.amount)}</b></div>
          <div><span>Entry</span><b>${posUsd(t.entry)}</b></div>
          <div><span>Live Price</span><b>${posUsd(current)}</b></div>
          <div><span>Status</span><b>OPEN</b></div>
        </div>
        <button type="button" class="close-position-btn" onclick="closeTrade('${t.id}','${posMode()}')">Close Trade</button>
      </div>`;
    }).join("");
  }

  function posBigChart(){
    const charts = [
      document.getElementById("crypto_live_chart"),
      document.getElementById("tradingViewChart"),
      document.getElementById("chartContainer")
    ].filter(Boolean);

    charts.forEach(chart => {
      chart.classList.add("big-trade-chart");
      chart.closest(".card")?.classList.add("big-trade-chart-card");
    });

    document.querySelectorAll("iframe").forEach(frame => {
      const src = frame.getAttribute("src") || "";
      if (src.includes("tradingview") || src.includes("widgetembed")) {
        frame.classList.add("big-tradingview-frame");
        frame.closest(".card")?.classList.add("big-trade-chart-card");
      }
    });
  }

  function posRun(){
    try {
      posBigChart();
      posRender();
    } catch(e) { console.warn("Positions/chart only skipped", e); }
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(posRun, 400));
  window.addEventListener("load", () => setTimeout(posRun, 600));
  setInterval(posRun, 1200);
})();


/* ===== CLEAN HOME AI CONTROL ONLY ===== */
(function(){
  let lastPct = null;
  let lastAuto = null;
  let lastAmount = null;

  function cUser(){ return state?.user && state.user.role !== "admin"; }
  function cMoney(n){
    try { if (typeof money === "function") return money(n); } catch(e){}
    return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }
  function cWallet(){
    try { if (typeof realWallet === "function") return Number(realWallet() || 0); } catch(e){}
    return Number(state?.accounts?.REAL?.balance || 0);
  }
  function cPct(){
    const p = Number(state?.user?.aiTradePercent || state?.user?.ai_trade_percent || 25);
    return [25,50,75,100].includes(p) ? p : 25;
  }
  function cAmount(){ return Math.floor((cWallet() * cPct() / 100) * 100) / 100; }

  function cTarget(){
    // IMPORTANT: do NOT append inside cleanHomeShell because that shell is rebuilt by home renderer.
    const shell = document.getElementById("cleanHomeShell");
    const dashboard = document.getElementById("dashboard") ||
           document.getElementById("home") ||
           document.querySelector('[data-page="home"]') ||
           shell?.parentElement?.parentElement ||
           document.getElementById("appPage");
    return dashboard;
  }

  function cSavePct(p){
    p = Number(p || 25);
    if (![25,50,75,100].includes(p)) p = 25;
    if (!state.user) return;

    state.user.aiTradePercent = p;
    state.user.ai_trade_percent = p;

    const u = (state.users || []).find(x =>
      String(x.id || "") === String(state.user.id || "") ||
      String(x.email || "").toLowerCase() === String(state.user.email || "").toLowerCase()
    );
    if (u) {
      u.aiTradePercent = p;
      u.ai_trade_percent = p;
    }

    if (typeof supabaseClient !== "undefined" && supabaseClient && state.user.id) {
      try { supabaseClient.from("profiles").update({ ai_trade_percent: p }).eq("id", state.user.id); } catch(e){}
    }

    try { saveSession?.(); } catch(e){}
    try { saveState?.(); } catch(e){}
    cRender(true);
  }

  function cSaveAuto(on){
    if (!state.user) return;
    state.user.autoTradePermission = !!on;

    const u = (state.users || []).find(x =>
      String(x.id || "") === String(state.user.id || "") ||
      String(x.email || "").toLowerCase() === String(state.user.email || "").toLowerCase()
    );
    if (u) u.autoTradePermission = !!on;

    if (typeof supabaseClient !== "undefined" && supabaseClient && state.user.id) {
      try { supabaseClient.from("profiles").update({ auto_trade_permission: !!on }).eq("id", state.user.id); } catch(e){}
    }

    try { saveSession?.(); } catch(e){}
    try { saveState?.(); } catch(e){}
    cRender(true);
  }

  function cBuild(){
    const card = document.createElement("div");
    card.id = "homeAiTradeControlCard";
    card.className = "card clean-home-ai-control";
    card.innerHTML = `
      <div class="section-head">
        <div>
          <p class="label">AI Trade Control</p>
          <h2>AI Trade Amount</h2>
          <p class="muted small">AI trade आपके Real Wallet के selected percentage से लगेगी.</p>
        </div>
      </div>

      <div class="clean-ai-percent-grid">
        <button type="button" class="clean-ai-percent-btn" data-home-ai-percent="25">25%</button>
        <button type="button" class="clean-ai-percent-btn" data-home-ai-percent="50">50%</button>
        <button type="button" class="clean-ai-percent-btn" data-home-ai-percent="75">75%</button>
        <button type="button" class="clean-ai-percent-btn" data-home-ai-percent="100">100%</button>
      </div>

      <div class="clean-ai-preview">
        <span>Selected</span>
        <b id="homeAiTradePercentText">25%</b>
        <small id="homeAiTradeAmountPreview">AI trade amount: ₹0</small>
      </div>

      <label class="clean-ai-toggle" for="homeUserAutoAiTradeToggle">
        <span>
          <b>Auto AI Trade</b>
          <small>Allow AI trades from admin signals</small>
        </span>
        <input type="checkbox" id="homeUserAutoAiTradeToggle" checked>
        <em></em>
      </label>
    `;

    card.addEventListener("click", function(e){
      const btn = e.target.closest("[data-home-ai-percent]");
      if (!btn) return;
      e.preventDefault();
      cSavePct(Number(btn.dataset.homeAiPercent || 25));
    });

    card.addEventListener("change", function(e){
      if (e.target && e.target.id === "homeUserAutoAiTradeToggle") cSaveAuto(e.target.checked);
    });

    return card;
  }

  function cRemoveOld(){
    // There should be no old grid in index now, but protect against cached/old markup.
    document.querySelectorAll("#aiTradePercentGrid").forEach(grid => {
      const card = grid.closest(".card") || grid.parentElement;
      if (card && card.id !== "homeAiTradeControlCard") card.remove();
    });

    document.querySelectorAll("#homeAiTradeControlCard").forEach((card, idx) => {
      if (idx > 0) card.remove();
    });
  }

  function cEnsure(){
    if (!cUser()) return null;
    cRemoveOld();

    let card = document.getElementById("homeAiTradeControlCard");
    if (!card) card = cBuild();

    const target = cTarget();
    if (target && card.parentElement !== target) target.appendChild(card);

    return card;
  }

  function cRender(force = false){
    if (!cUser()) return;
    const card = cEnsure();
    if (!card) return;

    const pct = cPct();
    const amount = cAmount();
    const auto = state.user.autoTradePermission !== false;

    if (force || pct !== lastPct) {
      card.querySelectorAll("[data-home-ai-percent]").forEach(btn => {
        btn.classList.toggle("active", Number(btn.dataset.homeAiPercent) === pct);
      });
      const t = document.getElementById("homeAiTradePercentText");
      if (t) t.textContent = pct + "%";
      lastPct = pct;
    }

    if (force || amount !== lastAmount) {
      const a = document.getElementById("homeAiTradeAmountPreview");
      if (a) a.textContent = "AI trade amount: " + cMoney(amount);
      lastAmount = amount;
    }

    if (force || auto !== lastAuto) {
      const toggle = document.getElementById("homeUserAutoAiTradeToggle");
      if (toggle) toggle.checked = auto;
      lastAuto = auto;
    }
  }

  window.renderCleanHomeAiControl = cRender;

  document.addEventListener("DOMContentLoaded", () => setTimeout(() => cRender(true), 700));
  window.addEventListener("load", () => setTimeout(() => cRender(true), 900));
  setInterval(() => cRender(false), 3000);
})();


/* ===== HOME RATE LIVE + STATIC SHELL FIX ===== */
(function(){
  let shellBuilt = false;

  function hrIsUser(){
    return state?.user && state.user.role !== "admin";
  }
  function hrMoney(n){
    try { if (typeof money === "function") return money(n); } catch(e){}
    return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }
  function hrUsd(n){
    try { if (typeof usd === "function") return usd(n); } catch(e){}
    return "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  function hrPrice(coin){
    try { if (typeof priceOf === "function") return Number(priceOf(coin) || 0); } catch(e){}
    return Number(state?.prices?.[coin]?.price || 0);
  }
  function hrChange(coin){
    return Number(state?.prices?.[coin]?.change || 0);
  }
  function hrRealWallet(){
    try { if (typeof realWallet === "function") return Number(realWallet() || 0); } catch(e){}
    return Number(state?.accounts?.REAL?.balance || 0);
  }
  function hrDemoWallet(){
    return Number(state?.accounts?.DEMO?.balance || 100000);
  }
  function hrMode(){
    return state?.mode || "DEMO";
  }
  function hrTodayPnl(){
    try {
      const acc = state?.accounts?.[hrMode()] || {};
      const open = (acc.trades || []).reduce((a,t)=>a+Number(t.pnl||0),0);
      const closed = (acc.closedTrades || []).reduce((a,t)=>a+Number(t.pnl||0),0);
      const managed = (state.managedTrades || [])
        .filter(t => String(t.userId || t.user_id || "") === String(state.user?.id || state.user?.email || ""))
        .reduce((a,t)=>a+Number(t.pnl||0),0);
      return open + closed + managed;
    } catch(e){ return 0; }
  }
  function hrSignal(){
    const sig = state?.signal || state?.activeSignal || {};
    return {
      side: sig.side || sig.action || "BUY",
      coin: sig.coin || "BTCUSDT",
      target: sig.target || sig.targetPrice || null,
      stopLoss: sig.stopLoss || sig.sl || null
    };
  }

  function hrMakeShellHtml(){
    const sig = hrSignal();
    const coins = ["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT"];
    const mode = hrMode();
    const userName = state?.user?.name || state?.user?.email?.split("@")[0] || "User";
    const initial = (userName[0] || "U").toUpperCase();

    return `
      <section id="cleanHomeShell" class="clean-home-shell static-home-shell">
<div class="clean-welcome-card card">
          <div class="clean-welcome-top">
            <div>
              <p class="label">Welcome Back</p>
              <h2>Hello, ${userName}</h2>
            </div>
            <div class="clean-avatar">${initial}</div>
          </div>

          <div class="clean-account-mode">
            <button type="button" id="cleanDemoAccountBtn" class="clean-account-pill ${mode==="DEMO" ? "active" : ""}" onclick="uiSwitchMode('DEMO')">
              <span>Demo Account</span>
              <b id="cleanDemoBalance">${hrMoney(hrDemoWallet())}</b>
            </button>
            <button type="button" id="cleanRealAccountBtn" class="clean-account-pill ${mode==="REAL" ? "active" : ""}" onclick="uiSwitchMode('REAL')">
              <span>Real Account</span>
              <b id="cleanRealBalance">${hrMoney(hrRealWallet())}</b>
            </button>
          </div>
        </div>

        <div class="clean-market-grid" id="cleanMarketGrid">
          ${coins.map(c => `
            <div class="clean-market-card" data-clean-coin="${c}">
              <b>${c.replace("USDT","/USDT")}</b>
              <span data-clean-price="${c}">${hrUsd(hrPrice(c))}</span>
              <em data-clean-change="${c}" class="${hrChange(c)>=0?'pos':'neg'}">${hrChange(c).toFixed(2)}%</em>
            </div>
          `).join("")}
        </div>

        <div class="clean-stats-grid">
          <div class="clean-stat-card"><span>Today PnL</span><b id="cleanTodayPnl" class="${hrTodayPnl()>=0?'pos':'neg'}">${hrMoney(hrTodayPnl())}</b></div>
          <div class="clean-stat-card"><span>Win Rate</span><b id="cleanWinRate">${state?.winRate || "0"}%</b></div>
          <div class="clean-stat-card"><span>Market Mood</span><b id="cleanMarketMood">${state?.marketMood || "Neutral"}</b></div>
          <div class="clean-stat-card"><span>Active Signal</span><b id="cleanActiveSignal">${sig.side}</b></div>
        </div>

        <div class="clean-ai-signal-card card">
          <div class="clean-live-dot"></div>
          <div class="clean-ai-main">
            <p class="label">AI Signal Live</p>
            <h2 id="cleanAiSignalTitle">${sig.side} ${String(sig.coin || "BTCUSDT").replace("USDT","/USDT")}</h2>
            <p>AI trend confirmation active.</p>
          </div>
          <div class="clean-confidence">82%</div>
          <div class="clean-signal-grid">
            <div><span>Entry</span><b id="cleanSignalEntry">Market</b></div>
            <div><span>Target</span><b id="cleanSignalTarget">${sig.target ? hrUsd(sig.target) : "-"}</b></div>
            <div><span>Stop Loss</span><b id="cleanSignalStopLoss">${sig.stopLoss ? hrUsd(sig.stopLoss) : "-"}</b></div>
            <div><span>Expires</span><b>30m</b></div>
          </div>
        </div>
      </section>
    `;
  }

  function hrDashboard(){
    return document.getElementById("dashboard") ||
      document.getElementById("home") ||
      document.querySelector('[data-page="home"]') ||
      document.querySelector(".page.active-page") ||
      document.getElementById("appPage");
  }

  function hrBuildOnce(){
    if (!hrIsUser()) return;
    const dash = hrDashboard();
    if (!dash) return;

    let mount = document.getElementById("cleanHomeMount");
    if (!mount) {
      mount = document.createElement("div");
      mount.id = "cleanHomeMount";
      dash.prepend(mount);
    }

    if (!document.getElementById("cleanHomeShell")) {
      mount.innerHTML = hrMakeShellHtml();
      shellBuilt = true;
    }

    hrHideOldHomeBlocks();
    hrUpdateValues();
  }

  function hrHideOldHomeBlocks(){
    const dash = hrDashboard();
    if (!dash) return;

    Array.from(dash.children).forEach(child => {
      if (child.id === "cleanHomeMount") return;
      if (child.id === "homeAiTradeControlCard") return;
      if (child.id === "manualOpenPositionsMount") return;

      const txt = child.textContent || "";
      if (
        /BTC\/USDT|ETH\/USDT|SOL\/USDT|BNB\/USDT|Today PnL|Win Rate|Market Mood|Active Signal|Hello,|Switch Account|AI\/AI Trades Today|AI Signal Live/i.test(txt)
      ) {
        child.classList.add("clean-home-hidden-old");
      }
    });

    // Also hide any old rate/ticker sections that appear between AI Signal and Live Position.
    document.querySelectorAll(".ticker-grid, #tickerGrid, .market-ticker, .live-rates, .rate-strip").forEach(el => {
      if (!el.closest("#cleanHomeShell")) {
        el.classList.add("hide-old-rate-strip");
      }
    });
  }

  function hrUpdateValues(){
    if (!document.getElementById("cleanHomeShell")) return;

    ["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT"].forEach(c => {
      const priceEl = document.querySelector(`[data-clean-price="${c}"]`);
      const changeEl = document.querySelector(`[data-clean-change="${c}"]`);
      if (priceEl) priceEl.textContent = hrUsd(hrPrice(c));
      if (changeEl) {
        const ch = hrChange(c);
        changeEl.textContent = ch.toFixed(2) + "%";
        changeEl.classList.toggle("pos", ch >= 0);
        changeEl.classList.toggle("neg", ch < 0);
      }
    });

    const demo = document.getElementById("cleanDemoBalance");
    const real = document.getElementById("cleanRealBalance");
    if (demo) demo.textContent = hrMoney(hrDemoWallet());
    if (real) real.textContent = hrMoney(hrRealWallet());

    document.getElementById("cleanDemoAccountBtn")?.classList.toggle("active", hrMode() === "DEMO");
    document.getElementById("cleanRealAccountBtn")?.classList.toggle("active", hrMode() === "REAL");

    const pnl = hrTodayPnl();
    const pnlEl = document.getElementById("cleanTodayPnl");
    if (pnlEl) {
      pnlEl.textContent = hrMoney(pnl);
      pnlEl.classList.toggle("pos", pnl >= 0);
      pnlEl.classList.toggle("neg", pnl < 0);
    }

    const win = document.getElementById("cleanWinRate");
    if (win) win.textContent = (state?.winRate || "0") + "%";

    const mood = document.getElementById("cleanMarketMood");
    if (mood) mood.textContent = state?.marketMood || "Neutral";

    const sig = hrSignal();
    const active = document.getElementById("cleanActiveSignal");
    if (active) active.textContent = sig.side;

    const title = document.getElementById("cleanAiSignalTitle");
    if (title) title.textContent = `${sig.side} ${String(sig.coin || "BTCUSDT").replace("USDT","/USDT")}`;

    const target = document.getElementById("cleanSignalTarget");
    if (target) target.textContent = sig.target ? hrUsd(sig.target) : "-";

    const sl = document.getElementById("cleanSignalStopLoss");
    if (sl) sl.textContent = sig.stopLoss ? hrUsd(sig.stopLoss) : "-";
  }

  // Override old renderer if it exists: no innerHTML rebuild after first build.
  window.uiRenderHomeShell = function(){
    hrBuildOnce();
  };

  window.updateCleanHomeRates = function(){
    try {
      hrHideOldHomeBlocks();
      hrUpdateValues();
    } catch(e) {}
  };

  document.addEventListener("DOMContentLoaded", () => setTimeout(hrBuildOnce, 400));
  window.addEventListener("load", () => setTimeout(hrBuildOnce, 700));

  // Price values update quickly, but shell never rebuilds.
  setInterval(() => {
    try {
      if (typeof fetchPrices === "function") fetchPrices();
    } catch(e) {}
    updateCleanHomeRates();
  }, 1000);
})();


/* ===== FLOATING LIVE POSITION BAR ===== */
(function(){
  function flIsUser(){
    return state?.user && state.user.role !== "admin";
  }
  function flMoney(n){
    try { if (typeof money === "function") return money(n); } catch(e){}
    return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }
  function flPrice(coin){
    try { if (typeof priceOf === "function") return Number(priceOf(coin) || 0); } catch(e){}
    return Number(state?.prices?.[coin]?.price || 0);
  }
  function flMode(){
    return state?.mode || "DEMO";
  }
  function flAccount(){
    const mode = flMode();
    state.accounts = state.accounts || {};
    state.accounts[mode] = state.accounts[mode] || { balance: mode === "DEMO" ? 100000 : 0, trades: [], closedTrades: [] };
    state.accounts[mode].trades = state.accounts[mode].trades || [];
    return state.accounts[mode];
  }
  function flUpdatePnl(t){
    try {
      if (typeof updateTradePnl === "function") return updateTradePnl(t);
    } catch(e){}
    const current = flPrice(t.coin);
    t.current = current;
    const diff = String(t.side || "BUY").toUpperCase() === "SELL" ? Number(t.entry) - current : current - Number(t.entry);
    t.pnl = (diff / Number(t.entry || 1)) * Number(t.amount || 0) * Number(t.leverage || 1);
    return t.pnl;
  }
  function flOpenManualTrades(){
    if (!flIsUser()) return [];
    const acc = flAccount();
    return (acc.trades || []).filter(t => {
      const st = String(t.status || "OPEN").toUpperCase();
      return st === "OPEN" && (!t.source || String(t.source).toUpperCase() === "USER");
    });
  }
  function flEnsureBar(){
    let bar = document.getElementById("floatingLivePositionBar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "floatingLivePositionBar";
      bar.className = "floating-live-position-bar";
      bar.innerHTML = `
        <div class="flp-left">
          <b id="flpCoin">BTC/USDT</b>
          <span id="flpSideLev">BUY 1x</span>
        </div>
        <strong id="flpPnl">₹0</strong>
        <button type="button" id="flpCloseBtn">Close</button>
      `;
      document.body.appendChild(bar);
      bar.querySelector("#flpCloseBtn")?.addEventListener("click", function(e){
        e.preventDefault();
        const id = bar.dataset.tradeId;
        if (!id) return;
        try {
          if (typeof closeTrade === "function") closeTrade(id, flMode());
        } catch(err) {
          console.warn("floating close failed", err);
        }
        setTimeout(flRender, 150);
      });
    }
    return bar;
  }
  function flRender(){
    try {
      if (!flIsUser()) return;
      const bar = flEnsureBar();
      const trades = flOpenManualTrades();

      if (!trades.length) {
        bar.classList.remove("show");
        bar.dataset.tradeId = "";
        return;
      }

      trades.forEach(flUpdatePnl);
      const first = trades[0];
      const totalPnl = trades.reduce((a,t)=>a+Number(t.pnl || 0),0);
      const pnlClass = totalPnl >= 0 ? "profit" : "loss";

      bar.dataset.tradeId = first.id || "";

      const coin = String(first.coin || "BTCUSDT").replace("USDT","/USDT");
      const side = String(first.side || "BUY").toUpperCase();
      const lev = Number(first.leverage || 1) + "x";

      const coinEl = document.getElementById("flpCoin");
      const sideEl = document.getElementById("flpSideLev");
      const pnlEl = document.getElementById("flpPnl");

      if (coinEl) coinEl.textContent = trades.length > 1 ? `Positions ${trades.length}` : coin;
      if (sideEl) sideEl.textContent = trades.length > 1 ? `${flMode()} • Open` : `${side} ${lev}`;
      if (pnlEl) {
        pnlEl.textContent = flMoney(totalPnl);
        pnlEl.classList.toggle("profit", totalPnl >= 0);
        pnlEl.classList.toggle("loss", totalPnl < 0);
      }

      bar.classList.toggle("profit", totalPnl >= 0);
      bar.classList.toggle("loss", totalPnl < 0);
      bar.classList.add("show");
    } catch(e) {
      console.warn("Floating live position render skipped", e);
    }
  }

  window.renderFloatingLivePositionBar = flRender;

  document.addEventListener("DOMContentLoaded", () => setTimeout(flRender, 600));
  window.addEventListener("load", () => setTimeout(flRender, 800));

  setInterval(function(){
    try { if (typeof fetchPrices === "function") fetchPrices(); } catch(e){}
    flRender();
  }, 1500);
})();


/* ===== GLOBAL PROFIT LOSS COLOR FIX ===== */
(function(){
  function plcTextAmount(text){
    if (!text) return null;
    const t = String(text).replace(/,/g, "").trim();

    // detect negative sign or minus unicode before currency/number
    if (/^-/.test(t) || /−/.test(t) || /-\s*₹/.test(t) || /₹\s*-/.test(t) || /-\s*\$/.test(t) || /\$\s*-/.test(t)) return -1;
    if (/^\+/.test(t) || /\+\s*₹/.test(t) || /₹\s*\+/.test(t) || /\+\s*\$/.test(t) || /\$\s*\+/.test(t)) return 1;

    // Words status fallback
    if (/\b(loss|negative|minus|red)\b/i.test(t)) return -1;
    if (/\b(profit|positive|gain|green)\b/i.test(t)) return 1;

    // Parse numeric with currency
    const m = t.match(/-?\d+(\.\d+)?/);
    if (!m) return null;
    const n = Number(m[0]);
    if (!Number.isFinite(n)) return null;
    if (n < 0) return -1;
    if (n > 0 && /pnl|profit|loss|₹|\$|\+/.test(t.toLowerCase())) return 1;
    return null;
  }

  function plcApplyTo(el){
    if (!el || el.dataset.plcSkip === "1") return;

    const txt = (el.textContent || "").trim();
    if (!txt) return;

    // Only target likely financial/PnL elements to avoid coloring all numbers.
    const cls = String(el.className || "").toLowerCase();
    const id = String(el.id || "").toLowerCase();
    const parentText = (el.parentElement?.textContent || "").toLowerCase();

    const likely = (
      cls.includes("pnl") || cls.includes("profit") || cls.includes("loss") ||
      id.includes("pnl") || id.includes("profit") || id.includes("loss") ||
      parentText.includes("pnl") || parentText.includes("profit") || parentText.includes("loss") ||
      parentText.includes("today pnl") || parentText.includes("p/l") ||
      el.closest(".manual-position-card") ||
      el.closest(".floating-live-position-bar") ||
      el.closest(".clean-stat-card") ||
      el.closest(".premium-history-card") ||
      el.closest(".clean-record-card")
    );

    if (!likely) return;

    const sign = plcTextAmount(txt);
    if (sign === null) return;

    el.classList.remove("plc-profit", "plc-loss", "profit", "loss", "pnl-plus", "pnl-minus", "pos", "neg");
    if (sign >= 0) el.classList.add("plc-profit");
    if (sign < 0) el.classList.add("plc-loss");
  }

  function plcApplyAll(){
    try {
      // Direct known IDs/classes
      [
        "#cleanTodayPnl",
        "#flpPnl",
        "#totalPnlMetric",
        "#todayPnlMetric",
        "#premiumPnlTrend",
        ".pnl-plus",
        ".pnl-minus",
        ".profit",
        ".loss",
        ".pos",
        ".neg",
        "[class*='pnl']",
        "[id*='pnl']",
        "[class*='profit']",
        "[class*='loss']",
        "[id*='profit']",
        "[id*='loss']"
      ].forEach(sel => {
        document.querySelectorAll(sel).forEach(plcApplyTo);
      });

      // Tables/cards: check values under headers/labels with PnL/Profit/Loss/P/L
      document.querySelectorAll("td, th, b, strong, span, small, p").forEach(el => {
        const txt = (el.textContent || "").trim();
        if (!txt || txt.length > 60) return;
        const parent = (el.parentElement?.textContent || "").toLowerCase();
        if (
          /pnl|p\/l|profit|loss/.test(parent) ||
          /[+-]\s*₹|₹\s*[+-]|[+-]\s*\$|\$\s*[+-]/.test(txt)
        ) {
          plcApplyTo(el);
        }
      });

      document.body.classList.add("global-pl-color-ready");
    } catch(e) {
      console.warn("Global profit/loss color skipped", e);
    }
  }

  window.applyGlobalProfitLossColors = plcApplyAll;

  document.addEventListener("DOMContentLoaded", () => setTimeout(plcApplyAll, 400));
  window.addEventListener("load", () => setTimeout(plcApplyAll, 600));
  setInterval(plcApplyAll, 2500);
})();


/* ===== MANUAL TRADE HISTORY PERMANENT BACKUP + PNL FREEZE ===== */
function manualHistoryKey(mode = state.mode) {
  return `manual_closed_trades_${userKey()}_${mode}`;
}

function normalizeManualClosedTrade(t) {
  if (!t) return t;
  t.status = String(t.status || "CLOSED").toUpperCase();
  t.source = t.source || "USER";
  t.pnl = Number(t.pnl || 0);
  t.amount = Number(t.amount || 0);
  t.entry = Number(t.entry || 0);
  t.close = Number(t.close || t.closePrice || t.close_price || t.current || t.entry || 0);
  t.current = t.close;
  t.closePrice = t.close;
  t.pnlFrozen = true;
  return t;
}

function getManualHistoryBackup(mode = state.mode) {
  try {
    const raw = localStorage.getItem(manualHistoryKey(mode));
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr.map(normalizeManualClosedTrade).filter(Boolean) : [];
  } catch(e) {
    return [];
  }
}

function saveManualHistoryBackup(mode = state.mode) {
  try {
    state.accounts ||= {};
    state.accounts[mode] ||= { balance: mode === "DEMO" ? 100000 : 0, trades: [], closedTrades: [] };
    state.accounts[mode].closedTrades ||= [];

    const existing = getManualHistoryBackup(mode);
    const current = (state.accounts[mode].closedTrades || [])
      .filter(t => (!t.source || t.source === "USER") && String(t.status || "").toUpperCase() === "CLOSED")
      .map(normalizeManualClosedTrade);

    const map = new Map();
    [...existing, ...current].forEach(t => {
      if (!t?.id) t.id = "manual_closed_" + Date.now() + "_" + Math.random().toString(16).slice(2);
      map.set(String(t.id), t);
    });

    const merged = [...map.values()].sort((a,b) => {
      const ad = Date.parse(a.closedAtISO || a.closedAt || 0) || 0;
      const bd = Date.parse(b.closedAtISO || b.closedAt || 0) || 0;
      return bd - ad;
    });

    localStorage.setItem(manualHistoryKey(mode), JSON.stringify(merged));
    return merged;
  } catch(e) {
    console.warn("saveManualHistoryBackup failed", e);
    return [];
  }
}

function restoreManualHistoryBackup(mode = state.mode) {
  try {
    state.accounts ||= {};
    state.accounts[mode] ||= { balance: mode === "DEMO" ? 100000 : 0, trades: [], closedTrades: [] };
    state.accounts[mode].closedTrades ||= [];

    const backup = getManualHistoryBackup(mode);
    if (!backup.length) return;

    const current = (state.accounts[mode].closedTrades || [])
      .filter(t => (!t.source || t.source === "USER") && String(t.status || "").toUpperCase() === "CLOSED")
      .map(normalizeManualClosedTrade);

    const map = new Map();
    [...backup, ...current].forEach(t => {
      if (!t?.id) t.id = "manual_closed_" + Date.now() + "_" + Math.random().toString(16).slice(2);
      map.set(String(t.id), normalizeManualClosedTrade(t));
    });

    const merged = [...map.values()].sort((a,b) => {
      const ad = Date.parse(a.closedAtISO || a.closedAt || 0) || 0;
      const bd = Date.parse(b.closedAtISO || b.closedAt || 0) || 0;
      return bd - ad;
    });

    const nonUserClosed = (state.accounts[mode].closedTrades || [])
      .filter(t => (t.source && t.source !== "USER") || String(t.status || "").toUpperCase() !== "CLOSED");

    state.accounts[mode].closedTrades = [...merged, ...nonUserClosed];
    localStorage.setItem(manualHistoryKey(mode), JSON.stringify(merged));
  } catch(e) {
    console.warn("restoreManualHistoryBackup failed", e);
  }
}

// Patch saveState to always include backup before saving.
(function(){
  if (window.__manualHistoryStabilityInstalled) return;
  window.__manualHistoryStabilityInstalled = true;

  try {
    const oldSaveState = saveState;
    window.saveState = saveState = function() {
      try { saveManualHistoryBackup("DEMO"); saveManualHistoryBackup("REAL"); } catch(e) {}
      return oldSaveState.apply(this, arguments);
    };
  } catch(e) {}

  try {
    const oldRender = render;
    window.render = render = function() {
      try { restoreManualHistoryBackup("DEMO"); restoreManualHistoryBackup("REAL"); } catch(e) {}
      return oldRender.apply(this, arguments);
    };
  } catch(e) {}

  window.addEventListener("load", () => {
    setTimeout(() => {
      try { restoreManualHistoryBackup("DEMO"); restoreManualHistoryBackup("REAL"); saveState(); renderHistory?.(); } catch(e) {}
    }, 800);
  });

  setInterval(() => {
    try {
      restoreManualHistoryBackup("DEMO");
      restoreManualHistoryBackup("REAL");
    } catch(e) {}
  }, 3000);
})();


/* ===== FINAL STABILITY PACK: MANUAL HISTORY DB + INTERVAL GUARDS ===== */
(function(){
  if (window.__finalStabilityPackInstalled) return;
  window.__finalStabilityPackInstalled = true;

  function fsUserId(){
    try { return String(state?.user?.id || state?.user?.email || "local"); } catch(e) { return "local"; }
  }
  function fsMode(){
    try { return state?.mode || "DEMO"; } catch(e) { return "DEMO"; }
  }
  function fsAccount(mode = fsMode()){
    state.accounts ||= {};
    state.accounts[mode] ||= { balance: mode === "DEMO" ? 100000 : 0, trades: [], closedTrades: [] };
    state.accounts[mode].trades ||= [];
    state.accounts[mode].closedTrades ||= [];
    return state.accounts[mode];
  }
  function fsNormalizeTrade(t){
    if (!t) return t;
    t.id = t.id || ("tr_" + Date.now() + "_" + Math.random().toString(16).slice(2));
    t.userId = t.userId || t.user_id || fsUserId();
    t.coin = t.coin || "BTCUSDT";
    t.side = String(t.side || "BUY").toUpperCase();
    t.amount = Number(t.amount || 0);
    t.entry = Number(t.entry || t.entry_price || 0);
    t.current = Number(t.current || t.close || t.closePrice || t.close_price || t.entry || 0);
    t.close = Number(t.close || t.closePrice || t.close_price || t.current || t.entry || 0);
    t.closePrice = t.close;
    t.leverage = Number(t.leverage || 1);
    t.pnl = Number(t.pnl || 0);
    t.status = String(t.status || "CLOSED").toUpperCase();
    t.source = t.source || "USER";
    if (t.status === "CLOSED") {
      t.current = t.close;
      t.pnlFrozen = true;
      t.closedAtISO = t.closedAtISO || new Date().toISOString();
      t.closedAt = t.closedAt || new Date(t.closedAtISO).toLocaleString();
    }
    return t;
  }

  async function fsDbInsertManualTrade(t, mode = fsMode()){
    if (typeof supabaseClient === "undefined" || !supabaseClient || !t) return;
    if (String(mode).toUpperCase() !== "REAL") return; // Demo stays local only.
    try {
      const row = {
        id: String(t.id),
        user_id: fsUserId(),
        coin: t.coin,
        side: t.side,
        amount: Number(t.amount || 0),
        entry_price: Number(t.entry || 0),
        close_price: Number(t.close || t.current || 0),
        leverage: Number(t.leverage || 1),
        pnl: Number(t.pnl || 0),
        status: String(t.status || "CLOSED").toUpperCase(),
        opened_at: t.openedAtISO || t.openedAt || null,
        closed_at: t.closedAtISO || new Date().toISOString(),
        mode: mode
      };

      // Try upsert first. If table lacks constraint, fallback insert/update.
      const up = await supabaseClient.from("manual_trades").upsert(row, { onConflict: "id" });
      if (up.error) {
        const ins = await supabaseClient.from("manual_trades").insert(row);
        if (ins.error && String(ins.error.message || "").toLowerCase().includes("duplicate")) {
          await supabaseClient.from("manual_trades").update(row).eq("id", row.id);
        }
      }
    } catch(e) {
      console.warn("manual_trades save skipped", e);
    }
  }

  async function fsLoadManualTradesFromDb(mode = "REAL"){
    if (typeof supabaseClient === "undefined" || !supabaseClient || String(mode).toUpperCase() !== "REAL") return [];
    try {
      const res = await supabaseClient
        .from("manual_trades")
        .select("*")
        .eq("user_id", fsUserId())
        .eq("status", "CLOSED")
        .order("closed_at", { ascending: false });

      if (res.error || !Array.isArray(res.data)) return [];

      return res.data.map(r => fsNormalizeTrade({
        id: r.id,
        userId: r.user_id,
        coin: r.coin,
        side: r.side,
        amount: r.amount,
        entry: r.entry_price,
        current: r.close_price,
        close: r.close_price,
        leverage: r.leverage,
        pnl: r.pnl,
        status: r.status,
        source: "USER",
        openedAtISO: r.opened_at,
        closedAtISO: r.closed_at,
        closedAt: r.closed_at ? new Date(r.closed_at).toLocaleString() : undefined,
        pnlFrozen: true
      }));
    } catch(e) {
      console.warn("manual_trades load skipped", e);
      return [];
    }
  }

  function fsMergeClosedTrades(mode, incoming){
    const acc = fsAccount(mode);
    const existing = (acc.closedTrades || [])
      .filter(t => (!t.source || t.source === "USER") && String(t.status || "").toUpperCase() === "CLOSED")
      .map(fsNormalizeTrade);
    const nonUser = (acc.closedTrades || [])
      .filter(t => (t.source && t.source !== "USER") || String(t.status || "").toUpperCase() !== "CLOSED");

    const map = new Map();
    [...existing, ...(incoming || [])].forEach(t => {
      if (!t) return;
      const nt = fsNormalizeTrade(t);
      map.set(String(nt.id), nt);
    });

    const merged = [...map.values()].sort((a,b) => {
      const ad = Date.parse(a.closedAtISO || a.closedAt || 0) || 0;
      const bd = Date.parse(b.closedAtISO || b.closedAt || 0) || 0;
      return bd - ad;
    });
    acc.closedTrades = [...merged, ...nonUser];
    return merged;
  }

  async function fsSyncManualHistory(){
    try {
      // Keep local backup synced first if existing helpers exist.
      try { restoreManualHistoryBackup?.("DEMO"); restoreManualHistoryBackup?.("REAL"); } catch(e) {}

      const accReal = fsAccount("REAL");
      const localReal = (accReal.closedTrades || [])
        .filter(t => (!t.source || t.source === "USER") && String(t.status || "").toUpperCase() === "CLOSED")
        .map(fsNormalizeTrade);
      for (const t of localReal) await fsDbInsertManualTrade(t, "REAL");

      const remote = await fsLoadManualTradesFromDb("REAL");
      if (remote.length) {
        fsMergeClosedTrades("REAL", remote);
        try { saveManualHistoryBackup?.("REAL"); } catch(e) {}
      }

      const accDemo = fsAccount("DEMO");
      accDemo.closedTrades = (accDemo.closedTrades || []).map(t => String(t.status || "").toUpperCase() === "CLOSED" ? fsNormalizeTrade(t) : t);
      try { saveManualHistoryBackup?.("DEMO"); } catch(e) {}
    } catch(e) {
      console.warn("fsSyncManualHistory failed", e);
    }
  }

  // Patch closeTrade after all earlier definitions: force frozen PnL and DB save.
  try {
    const oldClose = window.closeTrade || closeTrade;
    window.closeTrade = closeTrade = async function(id, mode = state.mode) {
      const acc = fsAccount(mode);
      const beforeOpen = [...(acc.trades || [])];
      await oldClose.apply(this, arguments);

      const afterAcc = fsAccount(mode);
      let closed = (afterAcc.closedTrades || []).find(t => String(t.id) === String(id));
      if (!closed) {
        const old = beforeOpen.find(t => String(t.id) === String(id));
        if (old) {
          closed = fsNormalizeTrade({
            ...old,
            status: "CLOSED",
            close: old.current || old.close || old.entry,
            current: old.current || old.close || old.entry,
            closedAtISO: new Date().toISOString(),
            closedAt: new Date().toLocaleString(),
            pnlFrozen: true
          });
          afterAcc.closedTrades.unshift(closed);
        }
      }
      if (closed) {
        fsNormalizeTrade(closed);
        try { saveManualHistoryBackup?.(mode); } catch(e) {}
        await fsDbInsertManualTrade(closed, mode);
      }
      try { saveState?.(); renderHistory?.(); renderFloatingLivePositionBar?.(); } catch(e) {}
    };
  } catch(e) {}

  // Patch renderHistory one more time via wrapper: restore before rendering and freeze after.
  try {
    const oldRenderHistory = window.renderHistory || renderHistory;
    window.renderHistory = renderHistory = function() {
      try { restoreManualHistoryBackup?.("DEMO"); restoreManualHistoryBackup?.("REAL"); } catch(e) {}
      const result = oldRenderHistory.apply(this, arguments);
      try {
        ["DEMO", "REAL"].forEach(mode => {
          const acc = fsAccount(mode);
          acc.closedTrades = (acc.closedTrades || []).map(t => String(t.status || "").toUpperCase() === "CLOSED" ? fsNormalizeTrade(t) : t);
        });
      } catch(e) {}
      return result;
    };
  } catch(e) {}

  window.syncManualHistoryPermanent = fsSyncManualHistory;

  window.addEventListener("load", () => {
    setTimeout(fsSyncManualHistory, 1200);
    setTimeout(() => { try { renderHistory?.(); } catch(e) {} }, 1800);
  });

  // Light sync, not heavy. Keeps cross-render stability without spamming.
  setInterval(fsSyncManualHistory, 15000);
})();


/* ===== OLD UI FLASH SAFE FIX ===== */
(function(){
  function markCleanReady(){
    try {
      // Build clean home if user is logged in and renderer exists.
      if (state?.user && state.user.role !== "admin") {
        try { if (typeof uiRenderHomeShell === "function") uiRenderHomeShell(); } catch(e) {}
        try { if (typeof updateCleanHomeRates === "function") updateCleanHomeRates(); } catch(e) {}
        try { if (typeof renderCleanHomeAiControl === "function") renderCleanHomeAiControl(true); } catch(e) {}
      }

      const hasClean = !!document.getElementById("cleanHomeShell") || !!document.getElementById("cleanHomeMount") || !state?.user || state.user?.role === "admin";
      if (hasClean) {
        document.documentElement.classList.remove("clean-home-booting");
        document.documentElement.classList.add("clean-home-ready");
      }
    } catch(e) {
      document.documentElement.classList.remove("clean-home-booting");
      document.documentElement.classList.add("clean-home-boot-fallback");
    }
  }

  document.addEventListener("DOMContentLoaded", function(){
    setTimeout(markCleanReady, 350);
    setTimeout(markCleanReady, 900);
  });
  window.addEventListener("load", function(){
    setTimeout(markCleanReady, 350);
    setTimeout(markCleanReady, 1200);
  });

  // Light guard only; no HTML removal.
  setTimeout(markCleanReady, 1800);
})();


/* ===== CLEAN TOP HEADER MENU ===== */
(function(){
  function thIsUser(){
    return state?.user && state.user.role !== "admin";
  }

  function thUserName(){
    return state?.user?.name || state?.user?.email?.split("@")[0] || "User";
  }

  function thInitial(){
    return (thUserName()[0] || "U").toUpperCase();
  }

  function thLogout(){
    try {
      if (typeof logout === "function") return logout();
    } catch(e) {}
    try {
      state.user = null;
      localStorage.removeItem("ai_user_session_v1");
      localStorage.removeItem("ai_admin_session_v1");
      localStorage.removeItem("ai_session");
    } catch(e) {}
    location.reload();
  }

  function thFindHeader(){
    return document.querySelector(".app-header, .top-header, .brand-row, header") || document.getElementById("appPage")?.firstElementChild;
  }

  function thBuildMenu(){
    let menu = document.getElementById("topHeaderMenuPanel");
    if (!menu) {
      menu = document.createElement("div");
      menu.id = "topHeaderMenuPanel";
      menu.className = "top-header-menu-panel";
      menu.innerHTML = `
        <button type="button" data-menu-panel="profile">👤 Profile</button>
        <button type="button" data-menu-panel="kyc">🛡️ KYC Verification</button>
        <button type="button" data-menu-panel="referral">🎁 Referral</button>
        <button type="button" data-menu-panel="paymentMethods">💳 My Payment Methods</button>
        <button type="button" data-menu-panel="support">🎧 Support</button>
        <button type="button" id="topHeaderLogoutBtn">🚪 Logout</button>
      `;
      document.body.appendChild(menu);

      menu.addEventListener("click", function(e){
        const page = e.target?.dataset?.gotoPage;
        if (page) {
          e.preventDefault();
          document.querySelector(`[data-page="${page}"]`)?.click();
          document.querySelector(`[data-tab="${page}"]`)?.click();
          document.getElementById(page)?.scrollIntoView?.({behavior:"smooth", block:"start"});
          menu.classList.remove("show");
        }
        if (e.target?.id === "topHeaderLogoutBtn") {
          e.preventDefault();
          thLogout();
        }
      });
    }
    return menu;
  }

  function thApply(){
    if (!thIsUser()) return;

    const header = thFindHeader();
    if (!header || header.dataset.cleanHeaderApplied === "1") {
      // Still update username/avatar when state changes.
      const name = document.getElementById("topHeaderUserName");
      const av = document.getElementById("topHeaderAvatar");
      if (name) name.textContent = thUserName();
      if (av) av.textContent = thInitial();
      return;
    }

    header.dataset.cleanHeaderApplied = "1";
    header.classList.add("clean-top-header");

    header.innerHTML = `
      <button type="button" id="topHeaderMenuBtn" class="top-header-menu-btn" aria-label="Open menu">☰</button>
      <div class="top-header-title">
        <span>AI Trading Assistant</span>
      </div>
      <button type="button" id="topHeaderUserBtn" class="top-header-user-btn">
        <em id="topHeaderAvatar">${thInitial()}</em>
        <span id="topHeaderUserName">${thUserName()}</span>
      </button>
    `;

    const menu = thBuildMenu();
    const menuBtn = document.getElementById("topHeaderMenuBtn");
    menuBtn?.addEventListener("click", function(e){
      e.preventDefault();
      menu.classList.toggle("show");
    });

    document.addEventListener("click", function(e){
      if (!menu.classList.contains("show")) return;
      if (e.target.closest("#topHeaderMenuPanel") || e.target.closest("#topHeaderMenuBtn")) return;
      menu.classList.remove("show");
    });
  }

  window.addEventListener("load", () => setTimeout(thApply, 500));
  document.addEventListener("DOMContentLoaded", () => setTimeout(thApply, 500));
  setInterval(thApply, 2500);
})();


/* ===== ORDER BOOK + TRADE FEED RESTORE FIX ===== */
(function(){
  function restoreOrderBookFeed(){
    try {
      const tradePage = document.getElementById("trade") || document.getElementById("tradepage") || document.querySelector('[data-page="trade"]');
      if (!tradePage) return;

      // Restore Order Book and Trade Feed cards/sections if previous cleanup hid them.
      Array.from(tradePage.querySelectorAll("*")).forEach(el => {
        const txt = (el.textContent || "").trim();
        if (/^(Order Book|Trade Feed)$/i.test(txt) || /Order Book/i.test(txt) || /Trade Feed/i.test(txt)) {
          let card = el.closest(".card") || el.closest("section") || el.parentElement;
          while (card && card !== tradePage && card.textContent && card.textContent.length < 80) {
            card = card.parentElement;
          }
          const target = el.closest(".card") || el.closest("section") || el.parentElement;
          if (target) {
            target.classList.remove("hide-outer-chart-ui","hide-empty-timeframe-row","hide-outer-timeframe");
            target.classList.add("force-show-order-feed");
            target.style.display = "";
            target.style.visibility = "";
            target.style.opacity = "";
          }
          el.classList.remove("hide-outer-chart-ui","hide-empty-timeframe-row","hide-outer-timeframe");
          el.classList.add("force-show-order-feed");
          el.style.display = "";
          el.style.visibility = "";
          el.style.opacity = "";
        }
      });

      // If known log containers exist, force their parent cards visible.
      [
        "orderBookLog",
        "tradeFeedLog",
        "orderBook",
        "tradeFeed",
        "liveTradeFeed",
        "orderBookBody",
        "tradeFeedBody"
      ].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const card = el.closest(".card") || el.parentElement;
        if (card) {
          card.classList.remove("hide-outer-chart-ui","hide-empty-timeframe-row","hide-outer-timeframe");
          card.classList.add("force-show-order-feed");
          card.style.display = "";
          card.style.visibility = "";
          card.style.opacity = "";
        }
      });

      // Hide only exact timeframe buttons above chart, not full rows/cards that may include feed/book.
      const chart = document.getElementById("crypto_live_chart") || document.getElementById("tradingViewChart") || document.getElementById("chartContainer") || document.querySelector("iframe[src*='tradingview'], iframe[src*='widgetembed']");
      if (chart) {
        const card = chart.closest(".card") || chart.parentElement;
        if (card) {
          card.querySelectorAll("button,a,span").forEach(el => {
            if (el.closest("#crypto_live_chart,#tradingViewChart,#chartContainer")) return;
            const t = (el.textContent || "").trim();
            if (/^(1m|5m|15m|30m|1H|4H|D)$/i.test(t)) {
              el.classList.add("hide-outer-timeframe");
            }
          });
        }
      }

      document.body.classList.add("order-feed-restored");
    } catch(e) {
      console.warn("Order book/feed restore skipped", e);
    }
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(restoreOrderBookFeed, 600));
  window.addEventListener("load", () => setTimeout(restoreOrderBookFeed, 800));
  setInterval(restoreOrderBookFeed, 2500);
})();


/* ===== TRADE PAGE VISIBILITY FIX ===== */
(function(){
  const pageIds = ["dashboard","home","trade","tradepage","wallet","pnl","history","plans","more","profile"];

  function normalizePageName(name){
    name = String(name || "dashboard").toLowerCase();
    if (name === "home") return "dashboard";
    if (name === "tradepage") return "trade";
    if (name === "profile") return "more";
    return name;
  }

  function getActivePageFromNav(){
    const activeNav =
      document.querySelector(".bottom-nav .active,[data-page].active,[data-tab].active,.nav-btn.active,.tab-btn.active") ||
      document.querySelector(".bottom-nav button.active,.mobile-nav button.active");

    const val = activeNav?.dataset?.page || activeNav?.dataset?.tab || activeNav?.getAttribute("href")?.replace("#","");
    if (val) return normalizePageName(val);

    if (document.getElementById("trade")?.classList.contains("active-page") || document.getElementById("tradepage")?.classList.contains("active-page")) return "trade";
    if (document.getElementById("wallet")?.classList.contains("active-page")) return "wallet";
    if (document.getElementById("pnl")?.classList.contains("active-page")) return "pnl";
    if (document.getElementById("history")?.classList.contains("active-page")) return "history";
    if (document.getElementById("plans")?.classList.contains("active-page")) return "plans";
    if (document.getElementById("more")?.classList.contains("active-page")) return "more";
    return "dashboard";
  }

  function setActivePage(page){
    page = normalizePageName(page);

    const known = {
      dashboard: ["dashboard","home"],
      trade: ["trade","tradepage"],
      wallet: ["wallet"],
      pnl: ["pnl"],
      history: ["history"],
      plans: ["plans"],
      more: ["more","profile"]
    };

    Object.values(known).flat().forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const show = (known[page] || []).includes(id);
      if (show) {
        el.classList.add("active-page");
        el.classList.remove("force-page-hidden","trade-force-hidden");
        el.style.display = "";
      } else {
        el.classList.remove("active-page");
        el.classList.add("force-page-hidden");
        if (id === "trade" || id === "tradepage") el.classList.add("trade-force-hidden");
      }
    });

    document.querySelectorAll(".page,.app-page,.screen,.panel-page,[data-page-section]").forEach(el => {
      const id = normalizePageName(el.id || el.dataset.pageSection || "");
      if (!id || !pageIds.includes(id)) return;
      const show = (known[page] || []).includes(el.id) || id === page;
      if (show) {
        el.classList.add("active-page");
        el.classList.remove("force-page-hidden","trade-force-hidden");
        el.style.display = "";
      } else {
        el.classList.remove("active-page");
        el.classList.add("force-page-hidden");
        if (id === "trade") el.classList.add("trade-force-hidden");
      }
    });

    document.body.dataset.activePage = page;
  }

  function bindNav(){
    document.querySelectorAll("[data-page],[data-tab],.bottom-nav button,.mobile-nav button,.nav-btn,.tab-btn").forEach(btn => {
      if (btn.dataset.pageVisibilityBound === "1") return;
      btn.dataset.pageVisibilityBound = "1";
      btn.addEventListener("click", function(){
        setTimeout(() => {
          const page = btn.dataset.page || btn.dataset.tab || btn.getAttribute("href")?.replace("#","") || getActivePageFromNav();
          setActivePage(page);
        }, 30);
      });
    });
  }

  function fixVisibility(){
    bindNav();
    setActivePage(getActivePageFromNav());
  }

  window.fixTradePageVisibility = fixVisibility;
  window.setActiveAppPageSafe = setActivePage;

  document.addEventListener("DOMContentLoaded", () => setTimeout(fixVisibility, 400));
  window.addEventListener("load", () => setTimeout(fixVisibility, 600));
  setInterval(fixVisibility, 1200);
})();


/* ===== TRADE EXACT STRUCTURE FIX ===== */
(function(){
  function exactTradePage(){
    return document.getElementById("tradepage") || document.getElementById("trade");
  }

  function exactApply(){
    try {
      const page = exactTradePage();
      if (!page) return;

      page.classList.add("trade-exact-page");

      const chartCard = page.querySelector(".chart-card");
      const ticket = page.querySelector(".trade-page-ticket-wrap");
      const feed = page.querySelector(".chart-bottom-feed");
      const chartHost = document.getElementById("crypto_live_chart") || document.getElementById("tradingViewChart") || document.getElementById("chartContainer");

      if (chartCard) {
        chartCard.classList.add("exact-chart-card");
        chartCard.querySelector(".pro-pair-line")?.remove();
        chartCard.querySelector(".pro-time-tabs")?.remove();
        chartCard.querySelector(".chart-hint")?.remove();
      }

      if (chartHost) {
        chartHost.classList.add("exact-chart-host");
        chartHost.querySelector(".real-tv-chart-head")?.remove();
        chartHost.querySelectorAll("iframe").forEach(f => f.classList.add("exact-chart-frame"));
      }

      // Move Order Ticket outside chart card, after chart card.
      if (chartCard && ticket && chartCard.contains(ticket)) {
        chartCard.insertAdjacentElement("afterend", ticket);
      }
      if (ticket) {
        ticket.classList.add("card","exact-order-ticket-card");
        ticket.querySelector(".pill")?.classList.add("mt-order-sim-hide");
        const title = ticket.querySelector("h1,h2,h3");
        if (title && /Simulation/i.test(title.textContent || "")) title.textContent = "Place Buy/Sell Order";
        ticket.querySelectorAll("p,span,small,div").forEach(el => {
          const txt = (el.textContent || "").trim();
          if (/Simulation only|Real exchange order\/API is not connected/i.test(txt)) el.remove();
        });
      }

      // Move Order Book/Trade Feed outside chart card, after ticket.
      if (chartCard && feed && chartCard.contains(feed)) {
        if (ticket) ticket.insertAdjacentElement("afterend", feed);
        else chartCard.insertAdjacentElement("afterend", feed);
      }
      if (feed) {
        feed.classList.add("exact-feed-grid");
        feed.querySelectorAll(".mini-feed-card").forEach(card => {
          card.classList.add("card","exact-feed-card","force-show-order-feed");
          card.style.display = "";
          card.style.visibility = "";
          card.style.opacity = "";
        });
      }

      // Force Order Book and Trade Feed visible.
      ["orderBook","recentFills"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const card = el.closest(".mini-feed-card") || el.closest(".card") || el.parentElement;
        if (card) {
          card.classList.remove("hide-outer-chart-ui","hide-empty-timeframe-row","hide-outer-timeframe","force-page-hidden");
          card.classList.add("force-show-order-feed");
          card.style.display = "";
        }
      });

      document.body.classList.add("trade-exact-structure-ready");
    } catch(e) {
      console.warn("Trade exact structure skipped", e);
    }
  }

  window.applyTradeExactStructureFix = exactApply;
  document.addEventListener("DOMContentLoaded", () => setTimeout(exactApply, 500));
  window.addEventListener("load", () => setTimeout(exactApply, 750));
  setInterval(exactApply, 2000);
})();

















/* ===== CHART IMPORTANT OVERRIDE FIX ===== */
(function(){
  function chartFinalHeight(){
    const vv = window.visualViewport;
    const vh = vv?.height || window.innerHeight || document.documentElement.clientHeight || 720;
    const vw = window.innerWidth || document.documentElement.clientWidth || 390;

    if (vw <= 380) return Math.round(Math.max(430, Math.min(vh * 0.64, 560)));
    if (vw <= 480) return Math.round(Math.max(460, Math.min(vh * 0.66, 610)));
    if (vw <= 768) return Math.round(Math.max(500, Math.min(vh * 0.68, 660)));
    return Math.round(Math.max(540, Math.min(vh * 0.70, 720)));
  }

  function imp(el, prop, value){
    if (!el) return;
    el.style.setProperty(prop, value, "important");
  }

  function applyChartImportantOverride(){
    try {
      const page = document.getElementById("tradepage") || document.getElementById("trade");
      if (!page) return;

      const h = chartFinalHeight();
      const hpx = h + "px";

      const host =
        document.getElementById("crypto_live_chart") ||
        document.getElementById("tradingViewChart") ||
        document.getElementById("chartContainer");

      if (!host) return;

      const iframe = host.querySelector("iframe") || page.querySelector("iframe[src*='tradingview'], iframe[src*='widgetembed']");
      const card = host.closest(".card") || host.closest(".chart-card") || host.closest(".exact-chart-card") || host.parentElement;

      if (card) {
        card.classList.add("chart-important-card");
        card.style.setProperty("--chart-final-height", hpx);
        imp(card, "height", "auto");
        imp(card, "min-height", "auto");
        imp(card, "max-height", "none");
        imp(card, "overflow", "visible");
        imp(card, "padding", "6px");
      }

      host.classList.add("chart-important-host");
      host.style.setProperty("--chart-final-height", hpx);
      imp(host, "width", "100%");
      imp(host, "height", hpx);
      imp(host, "min-height", hpx);
      imp(host, "max-height", "none");
      imp(host, "overflow", "visible");
      imp(host, "display", "block");

      if (iframe) {
        iframe.classList.add("chart-important-frame");
        iframe.style.setProperty("--chart-final-height", hpx);
        imp(iframe, "width", "100%");
        imp(iframe, "height", hpx);
        imp(iframe, "min-height", hpx);
        imp(iframe, "max-height", "none");
        imp(iframe, "display", "block");
        imp(iframe, "border", "0");
      }

      // Remove duplicate rows outside the chart.
      page.querySelectorAll(".pro-pair-line,.pro-time-tabs,.real-tv-chart-head,.chart-hint").forEach(el => {
        imp(el, "display", "none");
      });

      document.body.classList.add("chart-important-override-ready");
    } catch(e) {
      console.warn("Chart important override skipped", e);
    }
  }

  window.applyChartImportantOverride = applyChartImportantOverride;

  document.addEventListener("DOMContentLoaded", () => setTimeout(applyChartImportantOverride, 500));
  window.addEventListener("load", () => setTimeout(applyChartImportantOverride, 700));
  window.addEventListener("resize", () => setTimeout(applyChartImportantOverride, 150));
  window.visualViewport?.addEventListener("resize", () => setTimeout(applyChartImportantOverride, 150));

  setInterval(applyChartImportantOverride, 1500);
})();


/* ===== PC SAME AS MOBILE LAYOUT ===== */
(function(){
  function applyPcSameMobile(){
    try {
      const isPc = window.innerWidth >= 900;
      document.body.classList.toggle("pc-same-mobile", isPc);
      document.documentElement.classList.toggle("pc-same-mobile-html", isPc);
    } catch(e) {}
  }
  document.addEventListener("DOMContentLoaded", applyPcSameMobile);
  window.addEventListener("load", applyPcSameMobile);
  window.addEventListener("resize", applyPcSameMobile);
})();


/* ===== WALLET SAFE MINIMAL FIX ===== */
(function(){
  function wmMoney(n){
    try { if (typeof money === "function") return money(n); } catch(e){}
    return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }
  function wmIsUser(){
    return state?.user && state.user.role !== "admin";
  }
  function wmReal(){
    try { if (typeof realWallet === "function") return Number(realWallet() || 0); } catch(e){}
    return Number(state?.accounts?.REAL?.balance || 0);
  }
  function wmOpenPnl(){
    try { if (typeof openPnl === "function") return Number(openPnl("REAL") || 0); } catch(e){}
    return (state?.accounts?.REAL?.trades || []).reduce((a,t)=>a+Number(t.pnl||0),0);
  }
  function wmWithdrawable(){
    try { if (typeof withdrawable === "function") return Number(withdrawable() || 0); } catch(e){}
    try { if (typeof withdrawableAmount === "function") return Number(withdrawableAmount() || 0); } catch(e){}
    return 0;
  }
  function wmApply(){
    if (!wmIsUser()) return;

    // Existing wallet balance only; no duplicate overview card.
    const balance = document.getElementById("walletPageBalance");
    if (balance) balance.textContent = wmMoney(wmReal() + wmOpenPnl());

    // Improve existing label if present.
    const walletTitle = document.querySelector("#wallet h2");
    if (walletTitle && /Real Wallet Equity/i.test(walletTitle.textContent || "")) {
      walletTitle.textContent = "Real Wallet Equity";
    }

    // Add small non-duplicate withdrawable note inside existing wallet card only.
    const box = document.querySelector("#wallet .withdraw-rule-box");
    if (box && !document.getElementById("walletSafeAvailableNote")) {
      const note = document.createElement("div");
      note.id = "walletSafeAvailableNote";
      note.className = "wallet-safe-available-note";
      note.innerHTML = `<span>Available for Withdrawal</span><b>${wmMoney(wmWithdrawable())}</b>`;
      box.insertAdjacentElement("afterend", note);
    } else {
      const note = document.getElementById("walletSafeAvailableNote");
      if (note) note.querySelector("b").textContent = wmMoney(wmWithdrawable());
    }

    // Withdrawal modal available amount note, only when modal exists.
    const modal = document.getElementById("withdrawModal") || document.getElementById("withdrawalModal");
    if (modal) {
      let note = modal.querySelector(".wallet-modal-available-note");
      if (!note) {
        note = document.createElement("div");
        note.className = "wallet-modal-available-note";
        const amountInput = modal.querySelector("input[type='number'], #withdrawAmount");
        if (amountInput) amountInput.insertAdjacentElement("beforebegin", note);
        else modal.prepend(note);
      }
      note.textContent = "Available for withdrawal: " + wmMoney(wmWithdrawable());
    }

    // Screenshot field note only, no table/card changes.
    const file = document.getElementById("depositScreenshot") || document.querySelector("#depositModal input[type='file']");
    if (file && file.dataset.safeWalletNote !== "1") {
      const note = document.createElement("small");
      note.className = "wallet-safe-file-note";
      note.textContent = "Screenshot admin review ke liye rahega.";
      (file.closest("label,div,.field") || file.parentElement)?.appendChild(note);
      file.dataset.safeWalletNote = "1";
    }

    document.body.classList.add("wallet-safe-minimal-ready");
  }

  window.applyWalletSafeMinimalFix = wmApply;
  document.addEventListener("DOMContentLoaded", () => setTimeout(wmApply, 500));
  window.addEventListener("load", () => setTimeout(wmApply, 700));
  setInterval(wmApply, 2500);
})();


/* ===== WALLET HISTORY BIG CARDS ===== */
(function(){
  function whMoney(n){
    try { if (typeof money === "function") return money(n); } catch(e){}
    return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }

  function whIsUser(){
    return state?.user && state.user.role !== "admin";
  }

  function whUid(){
    return String(state?.user?.id || state?.user?.email || "");
  }

  function whStatusClass(s){
    s = String(s || "PENDING").toUpperCase();
    if (["APPROVED","SUCCESS","COMPLETED","PAID"].includes(s)) return "approved";
    if (["REJECTED","FAILED","CANCELLED","DECLINED"].includes(s)) return "rejected";
    return "pending";
  }

  function whFilterUser(list){
    const uid = whUid();
    return (list || []).filter(x => {
      const xu = String(x.userId || x.user_id || x.uid || "");
      return !xu || xu === uid;
    });
  }

  function whDate(x){
    return x.createdAt || x.created_at || x.date || x.updatedAt || x.closedAt || "-";
  }

  function whDepositRows(){
    const rows = [
      ...(state?.depositRequests || []),
      ...(state?.deposits || [])
    ];
    const seen = new Set();
    return whFilterUser(rows).filter(x => {
      const id = String(x.id || x.utr || x.txn || x.transaction_id || JSON.stringify(x));
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    }).slice().reverse().slice(0, 20);
  }

  function whWithdrawalRows(){
    const rows = [
      ...(state?.withdrawalRequests || []),
      ...(state?.withdrawals || [])
    ];
    const seen = new Set();
    return whFilterUser(rows).filter(x => {
      const id = String(x.id || x.account || x.upi || x.createdAt || JSON.stringify(x));
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    }).slice().reverse().slice(0, 20);
  }

  function whHideOldTinyWalletHistory(){
    const wallet = document.getElementById("wallet");
    if (!wallet) return;

    // Hide old table sections and tiny auto cards only on mobile / phone-width desktop.
    const mobileLike = window.innerWidth < 900 || document.body.classList.contains("pc-same-mobile");
    if (!mobileLike) return;

    ["userDepositLog","userWithdrawalLog"].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const table = el.closest("table");
      const wrap = table?.closest(".table-wrap") || table?.parentElement;
      if (wrap) wrap.classList.add("wallet-old-history-hidden");
      if (table) table.classList.add("wallet-old-history-hidden");
    });

    // Hide old tiny wallet cards created by generic mobile table converter, but not our new cards.
    wallet.querySelectorAll(".mobile-table-card,.clean-record-card,.premium-history-card").forEach(card => {
      if (card.closest(".wallet-big-history-cards")) return;
      const txt = card.textContent || "";
      if (/deposit|withdraw|utr|txn|method|approved|pending|rejected/i.test(txt)) {
        card.classList.add("wallet-old-history-hidden");
      }
    });
  }

  function whSection(id, title, label){
    const wallet = document.getElementById("wallet");
    if (!wallet) return null;

    let sec = document.getElementById(id);
    if (!sec) {
      sec = document.createElement("div");
      sec.id = id;
      sec.className = "card wallet-big-history-section";
      sec.innerHTML = `
        <div class="section-head wallet-big-history-head">
          <div>
            <p class="label">${label}</p>
            <h2>${title}</h2>
          </div>
        </div>
        <div class="wallet-big-history-cards"></div>
      `;
      wallet.appendChild(sec);
    }
    return sec;
  }

  function whRenderDeposits(){
    const sec = whSection("walletBigDepositHistory", "Deposit History", "Wallet Records");
    if (!sec) return;

    const list = whDepositRows();
    const box = sec.querySelector(".wallet-big-history-cards");
    box.innerHTML = list.length ? list.map(d => {
      const status = String(d.status || "PENDING").toUpperCase();
      const cls = whStatusClass(status);
      const utr = d.utr || d.txn || d.transaction_id || d.payment_id || "-";
      const note = d.note || d.remark || d.admin_note || "";
      return `
        <div class="wallet-big-history-card deposit">
          <div class="wbh-top">
            <div>
              <span>Deposit Amount</span>
              <b>${whMoney(d.amount)}</b>
            </div>
            <em class="${cls}">${status}</em>
          </div>
          <div class="wbh-details">
            <p><span>UTR / TXN</span><strong>${utr}</strong></p>
            <p><span>Date</span><strong>${whDate(d)}</strong></p>
            ${note ? `<p><span>Note</span><strong>${note}</strong></p>` : ""}
          </div>
        </div>
      `;
    }).join("") : `<div class="wallet-big-empty">No deposit requests yet.</div>`;
  }

  function whRenderWithdrawals(){
    const sec = whSection("walletBigWithdrawalHistory", "Withdrawal History", "Wallet Records");
    if (!sec) return;

    const list = whWithdrawalRows();
    const box = sec.querySelector(".wallet-big-history-cards");
    box.innerHTML = list.length ? list.map(w => {
      const status = String(w.status || "PENDING").toUpperCase();
      const cls = whStatusClass(status);
      const method = w.method || (w.upi ? "UPI" : (w.bank ? "Bank" : "-"));
      const account = w.account || w.upi || w.bank_account || w.bank || "-";
      const note = w.note || w.remark || w.admin_note || "";
      return `
        <div class="wallet-big-history-card withdrawal">
          <div class="wbh-top">
            <div>
              <span>Withdrawal Amount</span>
              <b>${whMoney(w.amount)}</b>
            </div>
            <em class="${cls}">${status}</em>
          </div>
          <div class="wbh-details">
            <p><span>Method</span><strong>${method}</strong></p>
            <p><span>Account / UPI</span><strong>${account}</strong></p>
            <p><span>Date</span><strong>${whDate(w)}</strong></p>
            ${note ? `<p><span>Note</span><strong>${note}</strong></p>` : ""}
          </div>
        </div>
      `;
    }).join("") : `<div class="wallet-big-empty">No withdrawal requests yet.</div>`;
  }

  function whPlaceSections(){
    const dep = document.getElementById("walletBigDepositHistory");
    const wit = document.getElementById("walletBigWithdrawalHistory");
    const wallet = document.getElementById("wallet");
    if (!wallet || !dep || !wit) return;

    // Keep them near bottom of wallet, deposit first then withdrawal.
    if (dep.nextElementSibling !== wit) dep.insertAdjacentElement("afterend", wit);
  }

  function whRun(){
    try {
      if (!whIsUser()) return;
      whHideOldTinyWalletHistory();
      whRenderDeposits();
      whRenderWithdrawals();
      whPlaceSections();
      document.body.classList.add("wallet-history-big-cards-ready");
    } catch(e) {
      console.warn("Wallet big history cards skipped", e);
    }
  }

  window.applyWalletHistoryBigCards = whRun;
  document.addEventListener("DOMContentLoaded", () => setTimeout(whRun, 600));
  window.addEventListener("load", () => setTimeout(whRun, 800));
  setInterval(whRun, 2500);
})();


/* ===== WALLET HISTORY ONLY NEW CARDS ===== */
(function(){
  function hideOldWalletHistory(){
    try{
      const wallet = document.getElementById("wallet");
      if (!wallet) return;

      const newDeposit = document.getElementById("walletBigDepositHistory");
      const newWithdrawal = document.getElementById("walletBigWithdrawalHistory");
      if (!newDeposit && !newWithdrawal) return;

      // Hide old table sections for deposit/withdrawal history.
      ["userDepositLog", "userWithdrawalLog"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        const table = el.closest("table");
        const wrap = table?.closest(".table-wrap") || table?.parentElement;
        const card = table?.closest(".card") || wrap?.closest(".card");

        [table, wrap, card].filter(Boolean).forEach(node => {
          if (node.id === "walletBigDepositHistory" || node.id === "walletBigWithdrawalHistory") return;
          node.classList.add("wallet-hide-old-history-final");
          node.style.setProperty("display", "none", "important");
        });
      });

      // Hide old generated small wallet history boxes/cards, but never hide the new big card sections.
      Array.from(wallet.querySelectorAll(".card, .mobile-table-card, .clean-record-card, .premium-history-card, .wallet-history-card-box")).forEach(node => {
        if (node.id === "walletBigDepositHistory" || node.id === "walletBigWithdrawalHistory") return;
        if (node.closest("#walletBigDepositHistory") || node.closest("#walletBigWithdrawalHistory")) return;

        const txt = (node.textContent || "").trim();
        const isOldHistory =
          /Deposit Requests|Withdrawal Requests|Deposit History|Withdrawal History/i.test(txt) &&
          /UTR|TXN|Method|Status|No deposit|No withdrawal|withdrawals|deposits/i.test(txt);

        const isOldTinyBox = node.id === "walletDepositCards" || node.id === "walletWithdrawalCards";

        if (isOldHistory || isOldTinyBox) {
          node.classList.add("wallet-hide-old-history-final");
          node.style.setProperty("display", "none", "important");
        }
      });

      // Ensure new big sections visible.
      [newDeposit, newWithdrawal].filter(Boolean).forEach(node => {
        node.classList.remove("wallet-hide-old-history-final");
        node.style.setProperty("display", "block", "important");
      });

      document.body.classList.add("wallet-history-only-new-ready");
    } catch(e){
      console.warn("wallet old history hide skipped", e);
    }
  }

  window.hideOldWalletHistoryFinal = hideOldWalletHistory;

  document.addEventListener("DOMContentLoaded", () => setTimeout(hideOldWalletHistory, 900));
  window.addEventListener("load", () => setTimeout(hideOldWalletHistory, 1100));
  setInterval(hideOldWalletHistory, 2000);
})();


/* ===== MENU REAL PAGES FINAL ===== */
(function(){
  const menuPageMap = {
    profile: "profilePage",
    kyc: "kycPage",
    referral: "referralPage",
    paymentMethods: "paymentMethodsPage",
    support: "supportPage"
  };
  const normalPages = ["dashboard","home","trade","tradepage","wallet","pnl","history","plans","more"];
  const menuPages = Object.values(menuPageMap);

  function u(){ return state?.user || {}; }
  function uid(){ return String(u().id || u().email || "local"); }
  function moneyFmt(n){
    try { if (typeof money === "function") return money(n); } catch(e){}
    return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }
  function saveAll(){
    try { saveState?.(); } catch(e){}
    try { saveSession?.(); } catch(e){}
  }
  function code(){
    const x = u();
    return x.referralCode || x.refCode || x.code || String(x.id || x.email || "USER").slice(0,8).toUpperCase();
  }
  function statusBadge(s){
    s = String(s || "PENDING").toUpperCase();
    const cls = s === "APPROVED" ? "approved" : (s === "REJECTED" ? "rejected" : "pending");
    return `<em class="menu-real-status ${cls}">${s}</em>`;
  }
  function methods(){
    state.userPayoutMethods ||= state.payoutMethods || [];
    return (state.userPayoutMethods || []).filter(m => String(m.userId || m.user_id || "") === uid());
  }
  function maskMethod(m){
    const type = String(m.type || m.method || "").toUpperCase();
    if (type === "UPI") return m.upi || "-";
    const acc = String(m.accountNumber || m.account_number || "");
    return `${m.bankName || m.bank_name || "Bank"} ${acc ? "****" + acc.slice(-4) : ""}`.trim();
  }

  function profileHtml(){
    const x = u();
    const name = x.name || x.full_name || x.email?.split("@")[0] || "User";
    const email = x.email || "-";
    const mobile = x.mobile || x.phone || "-";
    const kyc = x.kycStatus || x.kyc_status || "PENDING";
    return `
      <div class="card menu-real-profile-card">
        <div class="menu-real-avatar">${(name[0] || "U").toUpperCase()}</div>
        <h3>${name}</h3>
        <p>${email}</p>
      </div>
      <div class="card menu-real-list">
        <div><span>Name</span><b>${name}</b></div>
        <div><span>Email</span><b>${email}</b></div>
        <div><span>Mobile</span><b>${mobile}</b></div>
        <div><span>KYC Status</span>${statusBadge(kyc)}</div>
        <div><span>User ID</span><b>${String(x.id || "-").slice(0,18)}</b></div>
      </div>
      <div class="card menu-real-note">Profile editing and mobile verification can be connected with backend later.</div>
    `;
  }

  function kycHtml(){
    const x = u();
    const kyc = x.kycStatus || x.kyc_status || "PENDING";
    return `
      <div class="card menu-real-hero">
        <span>Current KYC Status</span>
        ${statusBadge(kyc)}
        <small>Submit KYC details. Admin approval required.</small>
      </div>
      <form id="realKycForm" class="card menu-real-form">
        <label>Full Name
          <input name="kycName" value="${x.kycName || x.name || ""}" placeholder="Enter full name">
        </label>
        <label>PAN / ID Number
          <input name="kycId" value="${x.kycId || x.kyc_id || ""}" placeholder="PAN / Aadhaar / ID number">
        </label>
        <label>Date of Birth
          <input name="kycDob" type="date" value="${x.kycDob || x.kyc_dob || ""}">
        </label>
        <label>Address
          <textarea name="kycAddress" placeholder="Full address">${x.kycAddress || x.kyc_address || ""}</textarea>
        </label>
        <button type="submit">Submit KYC for Approval</button>
      </form>
      <div class="card menu-real-note">Document upload/storage can be connected later. This keeps the KYC flow ready.</div>
    `;
  }

  function referralHtml(){
    const x = u();
    const c = code();
    const link = `${location.origin}${location.pathname}?ref=${encodeURIComponent(c)}`;
    return `
      <div class="card menu-real-ref-card">
        <span>Your Referral Code</span>
        <b>${c}</b>
        <small>${link}</small>
        <button type="button" data-copy-real-ref="${link}">Copy Referral Link</button>
      </div>
      <div class="card menu-real-list">
        <div><span>Total Referrals</span><b>${Number(x.referrals || x.referral_count || 0)}</b></div>
        <div><span>Referral Bonus</span><b>${moneyFmt(x.referralBonus || x.referral_bonus || 0)}</b></div>
        <div><span>Status</span><b>Active</b></div>
      </div>
      <div class="card menu-real-note">Referral tracking will work when signup flow stores the ref code.</div>
    `;
  }

  function paymentMethodsHtml(){
    const list = methods();
    return `
      <div class="card menu-real-note strong">Add UPI or Bank Account. New method can be used only after admin approval.</div>
      <form id="oldDisabledRealPaymentMethodForm" class="card menu-real-form">
        <label>Method Type
          <select name="type" id="oldDisabledRealPayType">
            <option value="UPI">UPI</option>
            <option value="BANK">Bank Account</option>
          </select>
        </label>
        <label class="real-pay-upi">UPI ID
          <input name="upi" placeholder="example@upi">
        </label>
        <label>Account Holder Name
          <input name="holderName" placeholder="Account holder name">
        </label>
        <div class="real-pay-bank-fields">
          <label>Bank Name
            <input name="bankName" placeholder="Bank name">
          </label>
          <label>Account Number
            <input name="accountNumber" placeholder="Account number">
          </label>
          <label>IFSC Code
            <input name="ifsc" placeholder="IFSC code">
          </label>
        </div>
        <button type="submit">Add Method for Approval</button>
      </form>
      <div class="menu-real-section-title">Saved Methods</div>
      <div class="menu-real-methods">
        ${list.length ? list.map(m => `
          <div class="card menu-real-method-card">
            <div>
              <span>${String(m.type || m.method || "METHOD").toUpperCase()}</span>
              <b>${maskMethod(m)}</b>
              <small>${m.holderName || m.holder_name || "-"}</small>
            </div>
            ${statusBadge(m.status || "PENDING")}
          </div>
        `).join("") : `<div class="card menu-real-empty">No payment method added yet.</div>`}
      </div>
    `;
  }

  function supportHtml(){
    return `
      <div class="card menu-real-list">
        <div><span>Support Ticket</span><b>Coming Soon</b></div>
        <div><span>Email Support</span><b>support@example.com</b></div>
        <div><span>Response Time</span><b>24 Hours</b></div>
      </div>
      <form class="card menu-real-form">
        <label>Message
          <textarea placeholder="Write your issue here"></textarea>
        </label>
        <button type="button">Create Support Ticket</button>
      </form>
    `;
  }

  function renderPage(type){
    const id = menuPageMap[type];
    if (!id) return;
    const content = document.getElementById(id.replace("Page","PageContent"));
    if (!content) return;
    content.innerHTML =
      type === "profile" ? profileHtml() :
      type === "kyc" ? kycHtml() :
      type === "referral" ? referralHtml() :
      type === "paymentMethods" ? paymentMethodsHtml() :
      supportHtml();
  }

  function hideNormalPages(){
    normalPages.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove("active-page");
      el.classList.add("force-page-hidden");
      el.style.display = "none";
    });
  }
  function showMenuPage(type){
    const id = menuPageMap[type];
    if (!id) return;
    renderPage(type);
    hideNormalPages();

    menuPages.forEach(pid => {
      const el = document.getElementById(pid);
      if (!el) return;
      const show = pid === id;
      el.classList.toggle("active-page", show);
      el.classList.toggle("force-page-hidden", !show);
      el.style.display = show ? "block" : "none";
    });

    document.body.dataset.activePage = type;
    document.body.classList.add("menu-real-page-open");
    document.getElementById("topHeaderMenuPanel")?.classList.remove("show");
    document.getElementById("menuDetailPanel")?.classList.remove("show");
    document.getElementById("menuFullPagePanel")?.classList.remove("show");
    window.scrollTo({top:0, behavior:"smooth"});
  }
  function backToHome(){
    menuPages.forEach(pid => {
      const el = document.getElementById(pid);
      if (!el) return;
      el.classList.remove("active-page");
      el.classList.add("force-page-hidden");
      el.style.display = "none";
    });
    const home = document.getElementById("dashboard") || document.getElementById("home");
    if (home) {
      home.classList.add("active-page");
      home.classList.remove("force-page-hidden");
      home.style.display = "";
    }
    document.body.dataset.activePage = "dashboard";
    document.body.classList.remove("menu-real-page-open");
    try { fixTradePageVisibility?.(); } catch(e){}
  }

  function bind(){
    const menu = document.getElementById("topHeaderMenuPanel");
    if (menu && menu.dataset.realPageBound !== "1") {
      menu.dataset.realPageBound = "1";
      menu.addEventListener("click", function(e){
        const type = e.target?.dataset?.menuPanel;
        if (type) {
          e.preventDefault();
          e.stopImmediatePropagation();
          showMenuPage(type);
          return;
        }
      }, true);
    }

    document.querySelectorAll("[data-menu-back]").forEach(btn => {
      if (btn.dataset.realBackBound === "1") return;
      btn.dataset.realBackBound = "1";
      btn.addEventListener("click", backToHome);
    });

    menuPages.forEach(pid => {
      const page = document.getElementById(pid);
      if (!page || page.dataset.realSubmitBound === "1") return;
      page.dataset.realSubmitBound = "1";

      page.addEventListener("click", function(e){
        const copy = e.target.dataset.copyRealRef;
        if (copy) {
          navigator.clipboard?.writeText(copy);
          e.target.textContent = "Copied!";
          setTimeout(()=> e.target.textContent = "Copy Referral Link", 1200);
        }
      });

      page.addEventListener("change", function(e){
        if (e.target.id === "realPayType") {
          page.classList.toggle("pay-bank-mode", e.target.value === "BANK");
        }
      });

      page.addEventListener("submit", function(e){
        if (e.target.id === "realKycForm") {
          e.preventDefault();
          const fd = new FormData(e.target);
          state.user.kycStatus = "PENDING";
          state.user.kycName = fd.get("kycName");
          state.user.kycId = fd.get("kycId");
          state.user.kycDob = fd.get("kycDob");
          state.user.kycAddress = fd.get("kycAddress");
          saveAll();
          showMenuPage("kyc");
        }
        if (e.target.id === "realPaymentMethodForm") {
          e.preventDefault();
          const fd = new FormData(e.target);
          const type = String(fd.get("type") || "UPI").toUpperCase();
          state.userPayoutMethods ||= state.payoutMethods || [];
          state.userPayoutMethods.unshift({
            id: "pm_" + Date.now(),
            userId: uid(),
            type,
            upi: fd.get("upi") || "",
            holderName: fd.get("holderName") || "",
            bankName: fd.get("bankName") || "",
            accountNumber: fd.get("accountNumber") || "",
            ifsc: fd.get("ifsc") || "",
            status: "PENDING",
            createdAt: new Date().toLocaleString()
          });
          state.payoutMethods = state.userPayoutMethods;
          saveAll();
          showMenuPage("paymentMethods");
        }
      });
    });
  }

  window.openRealMenuPage = showMenuPage;
  window.closeRealMenuPage = backToHome;

  document.addEventListener("DOMContentLoaded", () => setTimeout(bind, 800));
  window.addEventListener("load", () => setTimeout(bind, 1000));
  setInterval(bind, 2500);
})();


/* ===== MENU PAGES STAY + HEADER FLASH FIX ===== */
(function(){
  const menuPageIds = ["profilePage","kycPage","referralPage","paymentMethodsPage","supportPage"];
  const menuTypes = ["profile","kyc","referral","paymentMethods","support"];

  function isMenuOpen(){
    return document.body.classList.contains("menu-real-page-open") ||
      menuPageIds.some(id => {
        const el = document.getElementById(id);
        if (!el) return false;
        const st = getComputedStyle(el);
        return el.classList.contains("active-page") && st.display !== "none";
      });
  }

  function markHeaderReady(){
    try{
      const cleanHeader = document.querySelector(".clean-top-header");
      if (cleanHeader || document.body.classList.contains("pc-same-mobile")) {
        document.documentElement.classList.remove("top-header-booting");
        document.documentElement.classList.add("top-header-clean-ready");
      }
    }catch(e){
      document.documentElement.classList.remove("top-header-booting");
      document.documentElement.classList.add("top-header-boot-fallback");
    }
  }

  function showOnlyMenuPage(activeId){
    menuPageIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const show = id === activeId;
      el.classList.toggle("active-page", show);
      el.classList.toggle("force-page-hidden", !show);
      el.style.setProperty("display", show ? "block" : "none", "important");
    });

    ["dashboard","home","trade","tradepage","wallet","pnl","history","plans","more"].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove("active-page");
      el.classList.add("force-page-hidden");
      el.style.setProperty("display", "none", "important");
    });
  }

  function keepMenuPageAlive(){
    try{
      markHeaderReady();

      if (!isMenuOpen()) return;

      let activeId = null;
      for (const id of menuPageIds) {
        const el = document.getElementById(id);
        if (el && el.classList.contains("active-page")) {
          activeId = id;
          break;
        }
      }

      if (!activeId) {
        const activeType = document.body.dataset.activePage;
        const idx = menuTypes.indexOf(activeType);
        activeId = idx >= 0 ? menuPageIds[idx] : "profilePage";
      }

      document.body.classList.add("menu-real-page-open");
      document.body.dataset.menuPageOpen = "true";
      showOnlyMenuPage(activeId);
    }catch(e){}
  }

  // Patch existing visibility fix so it does not force dashboard while menu pages are open.
  function patchVisibilityFunction(){
    try{
      if (window.__menuStayVisibilityPatched) return;
      window.__menuStayVisibilityPatched = true;

      const oldFix = window.fixTradePageVisibility;
      if (typeof oldFix === "function") {
        window.fixTradePageVisibility = function(){
          if (isMenuOpen()) {
            keepMenuPageAlive();
            return;
          }
          return oldFix.apply(this, arguments);
        };
      }

      const oldSet = window.setActiveAppPageSafe;
      if (typeof oldSet === "function") {
        window.setActiveAppPageSafe = function(page){
          if (isMenuOpen() && menuTypes.includes(String(document.body.dataset.activePage || ""))) {
            keepMenuPageAlive();
            return;
          }
          return oldSet.apply(this, arguments);
        };
      }
    }catch(e){}
  }

  // Rebind menu click in capture phase and keep page open.
  function bindMenuStay(){
    patchVisibilityFunction();
    markHeaderReady();

    const menu = document.getElementById("topHeaderMenuPanel");
    if (menu && menu.dataset.menuStayBound !== "1") {
      menu.dataset.menuStayBound = "1";
      menu.addEventListener("click", function(e){
        const type = e.target?.dataset?.menuPanel;
        if (!type) return;

        setTimeout(function(){
          const map = {
            profile:"profilePage",
            kyc:"kycPage",
            referral:"referralPage",
            paymentMethods:"paymentMethodsPage",
            support:"supportPage"
          };
          const id = map[type];
          if (!id) return;

          document.body.dataset.activePage = type;
          document.body.classList.add("menu-real-page-open");
          document.body.dataset.menuPageOpen = "true";
          showOnlyMenuPage(id);
        }, 80);
      }, true);
    }

    document.querySelectorAll("[data-menu-back]").forEach(btn => {
      if (btn.dataset.menuStayBackBound === "1") return;
      btn.dataset.menuStayBackBound = "1";
      btn.addEventListener("click", function(){
        document.body.classList.remove("menu-real-page-open");
        document.body.dataset.menuPageOpen = "false";
      }, true);
    });

    // Bottom nav should close menu-real pages.
    document.querySelectorAll(".bottom-nav button,.mobile-nav button,[data-page],[data-tab]").forEach(btn => {
      if (btn.dataset.menuStayNavBound === "1") return;
      btn.dataset.menuStayNavBound = "1";
      btn.addEventListener("click", function(){
        if (btn.closest("#topHeaderMenuPanel")) return;
        const pg = btn.dataset.page || btn.dataset.tab || "";
        if (pg && !menuTypes.includes(pg)) {
          document.body.classList.remove("menu-real-page-open");
          document.body.dataset.menuPageOpen = "false";
          menuPageIds.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.remove("active-page");
            el.classList.add("force-page-hidden");
            el.style.setProperty("display","none","important");
          });
        }
      }, true);
    });
  }

  window.keepMenuRealPageAlive = keepMenuPageAlive;

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(bindMenuStay, 500);
    setTimeout(markHeaderReady, 800);
  });
  window.addEventListener("load", () => {
    setTimeout(bindMenuStay, 700);
    setTimeout(markHeaderReady, 900);
  });

  setInterval(bindMenuStay, 1200);
  setInterval(keepMenuPageAlive, 700);
})();


/* ===== ADMIN PC LAYOUT RESTORE ===== */
(function(){
  function isAdminPage(){
    return location.pathname.toLowerCase().includes("admin") ||
      document.body.classList.contains("admin") ||
      document.getElementById("adminPage") ||
      document.getElementById("adminApp") ||
      document.querySelector(".admin-shell,.admin-layout,.admin-sidebar");
  }

  function applyAdminPcRestore(){
    try {
      const admin = isAdminPage();
      document.body.classList.toggle("admin-pc-restore", admin && window.innerWidth >= 900);
      document.documentElement.classList.toggle("admin-pc-restore-html", admin && window.innerWidth >= 900);

      if (admin) {
        // Make sure user-side centered mobile shell class does not affect admin.
        document.body.classList.remove("pc-same-mobile");
        document.documentElement.classList.remove("pc-same-mobile-html");
        document.body.removeAttribute("data-user-clean-ui");
      }
    } catch(e) {}
  }

  document.addEventListener("DOMContentLoaded", applyAdminPcRestore);
  window.addEventListener("load", applyAdminPcRestore);
  window.addEventListener("resize", applyAdminPcRestore);
  setInterval(applyAdminPcRestore, 1500);
})();





/* ===== ADMIN PAYMENT STABLE PAGE FIX ===== */
(function(){
  function apsIsAdmin(){
    return location.pathname.toLowerCase().includes("admin") ||
      document.body.classList.contains("admin-pc-restore") ||
      document.body.classList.contains("admin") ||
      !!document.getElementById("adminPage") ||
      !!document.getElementById("adminApp") ||
      !!document.querySelector("[id*='admin' i], [class*='admin' i]");
  }

  function apsEnsureState(){
    state.userPayoutMethods ||= state.payoutMethods || [];
    state.payoutMethods = state.userPayoutMethods;
    state.paymentSettings ||= {
      upi: { active:true, upiId:"admin@upi", name:"AI Trading", qrUrl:"" },
      bank: { active:true, accountName:"AI Trading", bankName:"Demo Bank", accountNumber:"0000000000", ifsc:"DEMO0000001", branch:"Main" }
    };
    try {
      const raw = localStorage.getItem("ai_payment_security_v1");
      if (raw) {
        const d = JSON.parse(raw);
        if (d.payoutMethods && !(state.userPayoutMethods || []).length) {
          state.userPayoutMethods = d.payoutMethods;
          state.payoutMethods = d.payoutMethods;
        }
        if (d.paymentSettings) state.paymentSettings = d.paymentSettings;
      }
    } catch(e) {}
  }

  function apsSave(){
    try { saveState?.(); } catch(e){}
    try { saveSession?.(); } catch(e){}
    try {
      localStorage.setItem("ai_payment_security_v1", JSON.stringify({
        payoutMethods: state.userPayoutMethods || state.payoutMethods || [],
        paymentSettings: state.paymentSettings || {}
      }));
    } catch(e){}
  }

  function apsStatus(s){
    s = String(s || "PENDING").toUpperCase();
    const cls = s === "APPROVED" ? "approved" : (s === "REJECTED" ? "rejected" : "pending");
    return `<em class="aps-status ${cls}">${s}</em>`;
  }

  function apsMaskMethod(m){
    const type = String(m.type || m.method || "").toUpperCase();
    if (type === "UPI") return m.upi || "-";
    const acc = String(m.accountNumber || m.account_number || "");
    return `${m.bankName || m.bank_name || "Bank"} ${acc ? "****" + acc.slice(-4) : ""}`.trim();
  }

  function apsNameMatch(m){
    const holder = String(m.holderName || m.holder_name || "").trim().toLowerCase();
    const kyc = String(m.kycName || m.kyc_name || "").trim().toLowerCase();
    return holder && kyc && holder === kyc;
  }

  function apsFindMenu(){
    const selectors = [
      ".admin-sidebar nav",".admin-sidebar",".admin-menu",".admin-nav",".admin-tabs",
      ".sidebar nav",".sidebar","aside nav","aside","[class*='sidebar' i]","[class*='menu' i]"
    ];
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (!el) continue;
      if (el.querySelector("button,a") || /user|deposit|withdraw|trade|admin/i.test(el.textContent || "")) return el;
    }
    return null;
  }

  function apsRoot(){
    return document.getElementById("adminPage") ||
      document.getElementById("adminApp") ||
      document.querySelector(".admin-page,.admin-shell,.admin-layout,.admin-main,.admin-content") ||
      document.body;
  }

  function apsMakeBtn(type, icon, label){
    let btn = document.querySelector(`[data-admin-stable-pay="${type}"]`);
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "aps-menu-btn";
      btn.dataset.adminStablePay = type;
      btn.innerHTML = `<span>${icon}</span><b>${label}</b>`;
    }
    return btn;
  }

  function apsEnsureButtons(){
    if (!apsIsAdmin()) return;
    const menu = apsFindMenu();
    const payout = apsMakeBtn("payout", "💳", "Payout Method Requests");
    const settings = apsMakeBtn("settings", "🏦", "Payment Settings");

    if (menu) {
      if (!menu.querySelector('[data-admin-stable-pay="payout"]')) menu.appendChild(payout);
      if (!menu.querySelector('[data-admin-stable-pay="settings"]')) menu.appendChild(settings);
    }

    let quick = document.getElementById("adminStablePaymentQuickMenu");
    if (!quick) {
      quick = document.createElement("div");
      quick.id = "adminStablePaymentQuickMenu";
      quick.className = "aps-quick-menu";
      quick.innerHTML = `
        <button type="button" data-admin-stable-pay="payout"><span>💳</span><b>Payout Method Requests</b></button>
        <button type="button" data-admin-stable-pay="settings"><span>🏦</span><b>Payment Settings</b></button>
      `;
      apsRoot().insertAdjacentElement("afterbegin", quick);
    }
    quick.classList.toggle("hide-quick", !!menu);
  }

  function apsPanel(){
    let panel = document.getElementById("adminStablePaymentPage");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "adminStablePaymentPage";
      panel.className = "aps-page";
      panel.innerHTML = `
        <div class="aps-head">
          <button type="button" id="apsBackBtn">‹</button>
          <div><p class="label" id="apsLabel">Admin Payment</p><h2 id="apsTitle">Payment</h2></div>
        </div>
        <div id="apsContent" class="aps-content"></div>
      `;
      document.body.appendChild(panel);
      panel.querySelector("#apsBackBtn").addEventListener("click", () => {
        panel.classList.remove("show");
        document.body.classList.remove("aps-page-open");
      });
    }
    return panel;
  }

  function apsRenderPayout(){
    apsEnsureState();
    const rows = (state.userPayoutMethods || state.payoutMethods || []).slice().reverse();
    return `
      <div class="aps-section-card">
        <p class="label">User Security</p>
        <h3>Payout Method Requests</h3>
        <small>Approve only if holder name matches approved KYC name.</small>
      </div>
      <div class="aps-list">
        ${rows.length ? rows.map(m => `
          <div class="aps-request-card">
            <div class="aps-request-top">
              <div><span>User</span><b>${m.userId || "-"}</b></div>
              ${apsStatus(m.status || "PENDING")}
            </div>
            <div class="aps-grid">
              <p><span>Type</span><b>${m.type || "-"}</b></p>
              <p><span>Method</span><b>${apsMaskMethod(m)}</b></p>
              <p><span>Holder Name</span><b>${m.holderName || "-"}</b></p>
              <p><span>KYC Name</span><b>${m.kycName || "-"}</b></p>
              <p><span>Name Match</span><b class="${apsNameMatch(m) ? "plc-profit" : "plc-loss"}">${apsNameMatch(m) ? "YES" : "NO ⚠️"}</b></p>
              <p><span>Date</span><b>${m.createdAt || "-"}</b></p>
            </div>
            <div class="aps-actions">
              <button type="button" data-aps-approve="${m.id}">Approve</button>
              <button type="button" data-aps-reject="${m.id}">Reject</button>
            </div>
          </div>
        `).join("") : `<div class="aps-empty">No payout method requests.</div>`}
      </div>
    `;
  }

  function apsRenderSettings(){
    apsEnsureState();
    const upi = state.paymentSettings?.upi || {};
    const bank = state.paymentSettings?.bank || {};
    return `
      <div class="aps-section-card">
        <p class="label">Deposit Account</p>
        <h3>Payment Settings</h3>
        <small>User deposit page will show active UPI/Bank details.</small>
      </div>
      <form id="apsPaymentSettingsForm" class="aps-form">
        <label>UPI Active
          <select name="upiActive">
            <option value="true" ${upi.active !== false ? "selected" : ""}>Active</option>
            <option value="false" ${upi.active === false ? "selected" : ""}>Inactive</option>
          </select>
        </label>
        <label>UPI ID
          <input name="upiId" value="${upi.upiId || ""}" placeholder="admin@upi">
        </label>
        <label>UPI Name
          <input name="upiName" value="${upi.name || ""}" placeholder="Account name">
        </label>
        <label>Bank Active
          <select name="bankActive">
            <option value="true" ${bank.active !== false ? "selected" : ""}>Active</option>
            <option value="false" ${bank.active === false ? "selected" : ""}>Inactive</option>
          </select>
        </label>
        <label>Account Name
          <input name="accountName" value="${bank.accountName || ""}" placeholder="Account holder">
        </label>
        <label>Bank Name
          <input name="bankName" value="${bank.bankName || ""}" placeholder="Bank name">
        </label>
        <label>Account Number
          <input name="accountNumber" value="${bank.accountNumber || ""}" placeholder="Account number">
        </label>
        <label>IFSC
          <input name="ifsc" value="${bank.ifsc || ""}" placeholder="IFSC code">
        </label>
        <button type="submit">Save Payment Settings</button>
      </form>
    `;
  }

  function apsOpen(type){
    apsEnsureState();
    const panel = apsPanel();
    const title = panel.querySelector("#apsTitle");
    const label = panel.querySelector("#apsLabel");
    const content = panel.querySelector("#apsContent");

    if (type === "settings") {
      title.textContent = "Payment Settings";
      label.textContent = "Deposit Account";
      content.innerHTML = apsRenderSettings();
    } else {
      title.textContent = "Payout Method Requests";
      label.textContent = "User Security";
      content.innerHTML = apsRenderPayout();
    }

    panel.classList.add("show");
    document.body.classList.add("aps-page-open");
  }

  function apsBind(){
    if (!apsIsAdmin()) return;
    apsEnsureButtons();

    document.querySelectorAll("[data-admin-stable-pay]").forEach(btn => {
      if (btn.dataset.apsBound === "1") return;
      btn.dataset.apsBound = "1";
      btn.addEventListener("click", function(e){
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        apsOpen(btn.dataset.adminStablePay);
      }, true);
    });

    const panel = apsPanel();
    if (panel.dataset.apsActionsBound !== "1") {
      panel.dataset.apsActionsBound = "1";

      panel.addEventListener("click", function(e){
        const approve = e.target.dataset.apsApprove;
        const reject = e.target.dataset.apsReject;
        if (!approve && !reject) return;

        const id = approve || reject;
        const m = (state.userPayoutMethods || state.payoutMethods || []).find(x => String(x.id) === String(id));
        if (m) {
          m.status = approve ? "APPROVED" : "REJECTED";
          m.reviewedAt = new Date().toLocaleString();
          state.payoutMethods = state.userPayoutMethods;
          apsSave();
          apsOpen("payout");
        }
      });

      panel.addEventListener("submit", function(e){
        if (e.target.id !== "apsPaymentSettingsForm") return;
        e.preventDefault();
        const f = e.target;
        state.paymentSettings = {
          upi: { active:f.upiActive.value === "true", upiId:f.upiId.value, name:f.upiName.value, qrUrl:"" },
          bank: { active:f.bankActive.value === "true", accountName:f.accountName.value, bankName:f.bankName.value, accountNumber:f.accountNumber.value, ifsc:f.ifsc.value, branch:"" }
        };
        apsSave();
        apsOpen("settings");
        alert("Payment settings saved.");
      });
    }

    // Hide older inline payment panels permanently so they do not flicker in admin content.
    document.querySelectorAll("#adminPayoutRequestsPanel,#adminPaymentSettingsPanel").forEach(el => {
      el.style.setProperty("display", "none", "important");
      el.classList.add("force-admin-pay-hidden");
    });
  }

  window.openAdminStablePaymentPage = apsOpen;
  document.addEventListener("DOMContentLoaded", () => setTimeout(apsBind, 700));
  window.addEventListener("load", () => setTimeout(apsBind, 900));
  setInterval(apsBind, 2500);
})();





/* ===== KYC PAYMENT REFERRAL CLEAN MODULE FINAL ===== */
(function(){
  const MAX_UPI = 2;
  const MAX_BANK = 2;
  const WARNING = "YOUR PAYMENT METHOD NAME SHOULD MATCH KYC NAME. DON'T USE OTHER ACCOUNT. IF YOU USE OTHER ACCOUNT, YOUR ACCOUNT MAY BE SUSPENDED.";
  const KYC_BUCKET = "kyc-documents";
  let pmType = (localStorage.getItem("kpr_pm_type") || "UPI").toUpperCase() === "BANK" ? "BANK" : "UPI";
  let renderingPayment = false;
  let renderingKyc = false;
  let renderingReferral = false;

  function sb(){
    try {
      if (window.supabaseClient) return window.supabaseClient;
      if (typeof supabaseClient !== "undefined" && supabaseClient) return supabaseClient;
    } catch(e){}
    return null;
  }
  function u(){ return state?.user || {}; }
  function uid(){ return String(u().id || u().email || "local"); }
  function email(){ return String(u().email || ""); }
  function name(){ return u().name || u().email?.split("@")[0] || "User"; }
  function kycName(){ return u().kycName || u().kyc_name || name(); }
  function saveAll(){
    try { saveState?.(); } catch(e){}
    try { saveSession?.(); } catch(e){}
  }
  function isShown(el){
    if (!el) return false;
    return el.classList.contains("active-page") && getComputedStyle(el).display !== "none";
  }
  function pageId(){
    if (isShown(document.getElementById("kycPage"))) return "kyc";
    if (isShown(document.getElementById("paymentMethodsPage"))) return "payment";
    if (isShown(document.getElementById("referral"))) return "referral";
    return "";
  }
  function rootFor(page){
    if (page === "kyc") {
      const p = document.getElementById("kycPage");
      return document.getElementById("kycPageContent") || p?.querySelector(".menu-real-content") || p?.querySelector(".menu-full-content") || p;
    }
    if (page === "payment") {
      const p = document.getElementById("paymentMethodsPage");
      return document.getElementById("paymentMethodsPageContent") || p?.querySelector(".menu-real-content") || p?.querySelector(".menu-full-content") || p;
    }
    if (page === "referral") {
      const p = document.getElementById("referral");
      return document.getElementById("referralPageContent") || p?.querySelector(".menu-real-content") || p?.querySelector(".menu-full-content") || p;
    }
    return null;
  }
  function toastMsg(msg){
    try { toast?.(msg); } catch(e){ alert(msg); }
  }

  /* ---------- KYC clean owner ---------- */
  function kycRowsForUser(){
    const id = uid();
    const em = String(email()).toLowerCase();
    return (state.kycRequests || []).filter(k =>
      String(k.userId || k.user_id || "") === id ||
      String(k.userEmail || k.user_email || k.email || "").toLowerCase() === em
    );
  }
  function rankStatus(s){
    s = String(s || "PENDING").toUpperCase();
    if (s === "APPROVED") return 3;
    if (s === "PENDING") return 2;
    if (s === "REJECTED") return 1;
    return 0;
  }
  function rowTime(r){
    const v = r.reviewed_at || r.submitted_at || r.createdAt || r.created_at || "";
    return Date.parse(v) || Number(r.id || 0) || 0;
  }
  function latestKyc(){
    const rows = kycRowsForUser();
    if (!rows.length) return null;
    return rows.slice().sort((a,b) => (rankStatus(b.status)-rankStatus(a.status)) || (rowTime(b)-rowTime(a)))[0];
  }
  function currentKycStatus(){
    return String(latestKyc()?.status || u().kycStatus || u().kyc_status || "").toUpperCase();
  }
  async function uploadKycDoc(kycId, key, file){
    const client = sb();
    if (!client || !file?.name) return null;
    const safe = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${uid()}/${kycId}/${key}_${Date.now()}_${safe}`;
    const up = await client.storage.from(KYC_BUCKET).upload(path, file, { upsert:false });
    if (up.error) throw up.error;
    try {
      await client.from("kyc_documents").insert({
        id: `doc_${Date.now()}_${key}`,
        kyc_id: String(kycId),
        user_id: uid(),
        doc_key: key,
        file_name: file.name,
        file_path: path,
        file_url: "",
        mime_type: file.type || "",
        size_bytes: file.size || 0
      });
    } catch(e){}
    return { name:file.name, path, uploadedAt:new Date().toLocaleString() };
  }
  async function submitCleanKyc(form){
    if (!state.user) return toastMsg("Login required.");
    const fd = new FormData(form);
    const kycId = Date.now();
    const fullName = String(fd.get("kycName") || fd.get("name") || kycName()).trim();
    const mobile = String(fd.get("kycMobile") || fd.get("mobile") || u().mobile || "").trim();
    const docType = String(fd.get("kycDocType") || fd.get("docType") || "KYC").trim();
    const docNumber = String(fd.get("kycDocNumber") || fd.get("docNumber") || "").trim();

    if (!fullName) return alert("Please enter KYC name.");
    if (!docNumber) return alert("Please enter document number.");

    const row = {
      id: String(kycId),
      userId: uid(),
      userEmail: email(),
      name: fullName,
      mobile,
      docType,
      docNumber,
      status: "PENDING",
      documents: {},
      createdAt: new Date().toLocaleString()
    };

    const client = sb();
    if (client) {
      const insert = await client.from("kyc_requests").insert({
        id: kycId,
        user_id: row.userId,
        user_email: row.userEmail,
        name: fullName,
        full_name: fullName,
        mobile,
        doc_type: docType,
        doc_number: docNumber,
        status: "PENDING",
        submitted_at: new Date().toISOString()
      });
      if (insert.error) throw insert.error;

      const docs = {};
      const front = form.querySelector('[name="idFront"],[name="kycFrontFile"]')?.files?.[0] || document.getElementById("kycFrontFile")?.files?.[0];
      const selfie = form.querySelector('[name="selfie"],[name="kycSelfieFile"]')?.files?.[0] || document.getElementById("kycSelfieFile")?.files?.[0];
      if (front?.name) docs.front = await uploadKycDoc(kycId, "front", front);
      if (selfie?.name) docs.selfie = await uploadKycDoc(kycId, "selfie", selfie);
      row.documents = docs;
      try { await client.from("kyc_requests").update({ documents: docs }).eq("id", kycId); } catch(e){}
    }

    state.kycRequests ||= [];
    state.kycRequests.unshift(row);
    state.user.kycStatus = "PENDING";
    state.user.kycName = fullName;
    saveAll();
    renderKyc();
    toastMsg("KYC submitted for admin approval.");
  }
  function renderKyc(){
    const root = rootFor("kyc");
    if (!root || renderingKyc) return;
    renderingKyc = true;
    try {
      const row = latestKyc();
      const status = String(row?.status || u().kycStatus || "").toUpperCase();
      if (status === "APPROVED" || status === "PENDING") {
        root.innerHTML = `
          <div class="card kpr-kyc-card ${status.toLowerCase()}">
            <div class="kpr-kyc-icon">${status === "APPROVED" ? "✓" : "⏳"}</div>
            <h3>${status === "APPROVED" ? "Your KYC Approved" : "KYC Under Review"}</h3>
            <p>${status === "APPROVED" ? "Your identity verification is approved. You do not need to submit KYC again." : "Your KYC documents have been submitted. Please wait for admin approval."}</p>
            ${status === "APPROVED" ? `<div><span>Name</span><b>${row?.name || kycName()}</b></div>` : ""}
          </div>`;
        return;
      }

      const rejected = status === "REJECTED" ? `
        <div class="card kpr-kyc-card rejected">
          <div class="kpr-kyc-icon">!</div>
          <h3>KYC Rejected</h3>
          <p>Your previous KYC was rejected. Please submit again with correct details.</p>
        </div>` : "";

      root.innerHTML = `${rejected}
        <form id="kprKycForm" class="card menu-real-form">
          <label>Full Name
            <input name="kycName" value="${kycName()}" required>
          </label>
          <label>Mobile
            <input name="kycMobile" value="${u().mobile || ""}" inputmode="numeric">
          </label>
          <label>Document Type
            <select name="kycDocType">
              <option>PAN</option>
              <option>Aadhaar</option>
              <option>Passport</option>
              <option>Other</option>
            </select>
          </label>
          <label>Document Number
            <input name="kycDocNumber" required>
          </label>
          <label>ID Front / Document
            <input type="file" name="idFront" accept="image/*,.pdf" required>
          </label>
          <label>Selfie Optional
            <input type="file" name="selfie" accept="image/*">
          </label>
          <button type="submit">Submit KYC Documents for Approval</button>
        </form>`;

      document.getElementById("kprKycForm")?.addEventListener("submit", async function(e){
        e.preventDefault();
        try { await submitCleanKyc(e.target); }
        catch(err){ alert("KYC submit failed: " + (err.message || err)); }
      }, true);
    } finally {
      renderingKyc = false;
    }
  }

  /* ---------- Payment Methods clean owner ---------- */
  function userMethods(){
    const id = uid();
    return (state.userPayoutMethods || state.payoutMethods || []).filter(m => String(m.userId || m.user_id || "") === id);
  }
  function methodType(m){ return String(m.type || m.method || m.method_type || "").toUpperCase(); }
  function countMethod(type){
    return userMethods().filter(m => methodType(m) === String(type).toUpperCase()).length;
  }
  function isKycApproved(){
    return currentKycStatus() === "APPROVED";
  }
  function canAdd(type){
    type = String(type || pmType).toUpperCase();
    return type === "BANK" ? countMethod("BANK") < MAX_BANK : countMethod("UPI") < MAX_UPI;
  }
  function setType(type){
    pmType = String(type || "UPI").toUpperCase() === "BANK" ? "BANK" : "UPI";
    localStorage.setItem("kpr_pm_type", pmType);
  }
  function maskMethod(m){
    const t = methodType(m);
    if (t === "UPI") return m.upi || m.upi_id || "-";
    const acc = String(m.accountNumber || m.account_number || "");
    return `${m.bankName || m.bank_name || "Bank"} ${acc ? "****" + acc.slice(-4) : ""}`;
  }
  async function submitPaymentMethod(form){
    if (!isKycApproved()) return alert("Please complete approved KYC before adding payment method.");
    if (!canAdd(pmType)) return alert(pmType === "BANK" ? "You can add only 2 bank accounts." : "You can add only 2 UPI IDs.");

    const fd = new FormData(form);
    const method = {
      id: "pm_" + Date.now(),
      userId: uid(),
      userEmail: email(),
      type: pmType,
      upi: pmType === "UPI" ? String(fd.get("upi") || "").trim() : "",
      holderName: kycName(),
      kycName: kycName(),
      bankName: pmType === "BANK" ? String(fd.get("bankName") || "").trim() : "",
      accountNumber: pmType === "BANK" ? String(fd.get("accountNumber") || "").trim() : "",
      ifsc: pmType === "BANK" ? String(fd.get("ifsc") || "").trim() : "",
      status: "PENDING",
      createdAt: new Date().toLocaleString()
    };

    if (pmType === "UPI" && !method.upi) return alert("Please enter UPI ID.");
    if (pmType === "BANK" && (!method.bankName || !method.accountNumber || !method.ifsc)) return alert("Please enter complete bank details.");

    state.userPayoutMethods ||= state.payoutMethods || [];
    state.userPayoutMethods.unshift(method);
    state.payoutMethods = state.userPayoutMethods;

    const client = sb();
    if (client) {
      const res = await paymentDbTry((q) => q.upsert(paymentMethodDbRow(method), { onConflict:"id" }));
      if (res.error) console.warn("Payout method DB save failed", res.error);
    }

    saveAll();
    renderPayment();
    toastMsg("Payment method sent for admin approval.");
  }
  function renderPayment(){
    const root = rootFor("payment");
    if (!root || renderingPayment) return;
    renderingPayment = true;
    try {
      const approved = isKycApproved();
      const ok = approved && canAdd(pmType);
      const methods = userMethods();

      root.innerHTML = `
        <div class="kpr-pm-warning">${WARNING}</div>
        ${approved ? "" : `<div class="card kpr-note"><b>KYC Approval Required</b><span>Please complete approved KYC before adding payment method.</span></div>`}

        <form id="kprPaymentForm" class="card menu-real-form ${approved ? "" : "disabled"}">
          <label>Method Type
            <select id="kprPayType" name="type" ${approved ? "" : "disabled"}>
              <option value="UPI" ${pmType === "UPI" ? "selected" : ""}>UPI</option>
              <option value="BANK" ${pmType === "BANK" ? "selected" : ""}>Bank Account</option>
            </select>
          </label>

          <label class="kpr-upi-field">UPI ID
            <input name="upi" placeholder="example@upi" ${approved ? "" : "disabled"}>
          </label>

          <label>Account Holder Name / KYC Name
            <input name="holderName" value="${kycName()}" readonly>
          </label>

          <div class="kpr-bank-fields">
            <label>Bank Name
              <input name="bankName" placeholder="Bank name" ${approved ? "" : "disabled"}>
            </label>
            <label>Account Number
              <input name="accountNumber" placeholder="Account number" ${approved ? "" : "disabled"}>
            </label>
            <label>IFSC Code
              <input name="ifsc" placeholder="IFSC code" ${approved ? "" : "disabled"}>
            </label>
          </div>

          <div class="kpr-limit">${ok ? `<span>Limit: UPI ${countMethod("UPI")}/${MAX_UPI} • Bank ${countMethod("BANK")}/${MAX_BANK}</span>` : `<b>${approved ? (pmType === "BANK" ? "You can add only 2 bank accounts." : "You can add only 2 UPI IDs.") : "KYC approval required"}</b>`}</div>
          <button type="submit" ${ok ? "" : "disabled"}>${ok ? "Add Method for Admin Approval" : "Not Available"}</button>
        </form>

        <div class="menu-real-section-title">Saved Methods</div>
        <div class="menu-real-methods">
          ${methods.length ? methods.map(m => `
            <div class="card menu-real-method-card">
              <div>
                <span>${methodType(m) || "METHOD"}</span>
                <b>${maskMethod(m)}</b>
                <small>${m.holderName || m.holder_name || kycName()}</small>
              </div>
              <em class="kpr-status ${String(m.status || "PENDING").toLowerCase()}">${m.status || "PENDING"}</em>
            </div>
          `).join("") : `<div class="card menu-real-empty">No payment method added yet.</div>`}
        </div>`;

      const page = document.getElementById("paymentMethodsPage");
      const select = document.getElementById("kprPayType");
      function applyTypeView(){
        if (select && select.value !== pmType) select.value = pmType;
        page?.classList.toggle("kpr-bank-selected", pmType === "BANK");
        page?.querySelectorAll(".kpr-bank-fields").forEach(el => el.style.display = pmType === "BANK" ? "grid" : "none");
        page?.querySelectorAll(".kpr-upi-field").forEach(el => el.style.display = pmType === "BANK" ? "none" : "grid");
      }
      select?.addEventListener("change", () => {
        setType(select.value);
        renderPayment();
      }, true);
      document.getElementById("kprPaymentForm")?.addEventListener("submit", async e => {
        e.preventDefault();
        await submitPaymentMethod(e.target);
      }, true);
      applyTypeView();
    } finally {
      renderingPayment = false;
    }
  }

  /* ---------- Referral clean owner ---------- */
  function referralCode(user = u()){
    let code = user.referral_code || user.referralCode;
    if (!code) {
      const base = String(user.email || user.id || "user").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
      code = base + String(Math.floor(1000 + Math.random() * 9000));
      user.referral_code = code;
      user.referralCode = code;
      saveAll();
    }
    return code;
  }
  function referralLink(){
    return `${location.origin}${location.pathname}?ref=${encodeURIComponent(referralCode())}`;
  }
  function referralBonusTotal(){
    const id = uid(), em = email().toLowerCase();
    return (state.referrals || []).filter(r => String(r.referrerId || r.referrer_id || "") === id || String(r.referrerEmail || r.referrer_email || "").toLowerCase() === em)
      .reduce((a,r) => a + Number(r.bonusAmount || r.bonus_amount || 0), 0);
  }
  function referralCount(){
    const id = uid(), em = email().toLowerCase();
    const directProfiles = (state.users || []).filter(x => String(x.referred_by || x.referredBy || "").toLowerCase() === String(referralCode()).toLowerCase()).length;
    const records = (state.referrals || []).filter(r => String(r.referrerId || r.referrer_id || "") === id || String(r.referrerEmail || r.referrer_email || "").toLowerCase() === em).length;
    return Math.max(directProfiles, records);
  }
  function renderReferral(){
    const root = rootFor("referral");
    if (!root || renderingReferral) return;
    renderingReferral = true;
    try {
      const code = referralCode();
      const link = referralLink();
      const bonus = referralBonusTotal();
      const count = referralCount();

      const myCode = document.getElementById("myReferralCode");
      const refCount = document.getElementById("refCount");
      const refBonus = document.getElementById("refBonus");
      if (myCode || refCount || refBonus) {
        if (myCode) myCode.textContent = code;
        if (refCount) refCount.textContent = count;
        if (refBonus) refBonus.textContent = "₹" + Number(bonus || 0).toLocaleString("en-IN");
        return;
      }

      root.innerHTML = `
        <div class="card kpr-ref-card">
          <span>Your Referral Code</span>
          <h2>${code}</h2>
          <p>${link}</p>
          <button id="kprCopyReferral" type="button">Copy Referral Link</button>
        </div>
        <div class="kpr-ref-grid">
          <div class="card"><span>Total Referrals</span><b>${count}</b></div>
          <div class="card"><span>Referral Bonus</span><b>₹${Number(bonus || 0).toLocaleString("en-IN")}</b></div>
        </div>`;
      document.getElementById("kprCopyReferral")?.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(link); toastMsg("Referral link copied."); }
        catch(e){ prompt("Copy referral link:", link); }
      });
    } finally {
      renderingReferral = false;
    }
  }

  /* ---------- Admin owners for KYC/Payout ---------- */
  async function approveKyc(id){
    const row = (state.kycRequests || []).find(k => String(k.id) === String(id));
    if (!row) return;
    row.status = "APPROVED";
    const client = sb();
    if (client) await client.from("kyc_requests").update({ status:"APPROVED", reviewed_at:new Date().toISOString() }).eq("id", id);
    saveAll();
    try { render?.(); } catch(e){}
  }
  async function rejectKyc(id){
    const row = (state.kycRequests || []).find(k => String(k.id) === String(id));
    if (!row) return;
    row.status = "REJECTED";
    const client = sb();
    if (client) await client.from("kyc_requests").update({ status:"REJECTED", reviewed_at:new Date().toISOString() }).eq("id", id);
    saveAll();
    try { render?.(); } catch(e){}
  }
  async function approvePayoutMethod(id){
    const row = (state.userPayoutMethods || state.payoutMethods || []).find(m => String(m.id) === String(id));
    if (!row) return;
    row.status = "APPROVED";
    const client = sb();
    if (client) await paymentDbTry((q) => q.update({ status:"APPROVED", reviewed_at:new Date().toISOString() }).eq("id", id));
    saveAll();
    try { render?.(); } catch(e){}
  }
  async function rejectPayoutMethod(id){
    const row = (state.userPayoutMethods || state.payoutMethods || []).find(m => String(m.id) === String(id));
    if (!row) return;
    row.status = "REJECTED";
    const client = sb();
    if (client) await paymentDbTry((q) => q.update({ status:"REJECTED", reviewed_at:new Date().toISOString() }).eq("id", id));
    saveAll();
    try { render?.(); } catch(e){}
  }

  /* ---------- Override only KYC/Payment/Referral routes, not design pages ---------- */
  function patchNavigation(){
    if (window.__kprCleanModulePatched) return;
    window.__kprCleanModulePatched = true;

    const oldShowPage = typeof window.showPage === "function" ? window.showPage : null;
    if (oldShowPage) {
      window.showPage = function(page){
        const res = oldShowPage.apply(this, arguments);
        setTimeout(() => {
          if (page === "kycPage" || page === "kyc") renderKyc();
          if (page === "paymentMethodsPage" || page === "paymentMethods") renderPayment();
          if (page === "referral") renderReferral();
        }, 50);
        return res;
      };
      try { showPage = window.showPage; } catch(e){}
    }

    const oldOpenRealMenuPage = typeof window.openRealMenuPage === "function" ? window.openRealMenuPage : null;
    if (oldOpenRealMenuPage) {
      window.openRealMenuPage = function(type){
        const res = oldOpenRealMenuPage.apply(this, arguments);
        setTimeout(() => {
          if (type === "kyc") renderKyc();
          if (type === "paymentMethods") renderPayment();
          if (type === "referral") renderReferral();
        }, 50);
        return res;
      };
      try { openRealMenuPage = window.openRealMenuPage; } catch(e){}
    }

    // Override global handlers for these modules only.
    window.approveKyc = approveKyc;
    window.rejectKyc = rejectKyc;
    window.approvePayoutMethod = approvePayoutMethod;
    window.rejectPayoutMethod = rejectPayoutMethod;
    window.renderKycPage = window.renderKycStepWizard || renderKyc;
    window.renderPaymentMethodsPage = renderPayment;
    window.renderReferralClean = renderReferral;
    window.kprRenderKyc = window.renderKycStepWizard || renderKyc;
    window.kprRenderPayment = renderPayment;
  }

  document.addEventListener("click", function(e){
    const text = (e.target?.textContent || "").toLowerCase();
    const pageBtn = e.target.closest("[data-page]");
    const menuBtn = e.target.closest("[data-menu-page],[data-direct-page]");
    const target = pageBtn?.dataset?.page || menuBtn?.dataset?.menuPage || menuBtn?.dataset?.directPage || "";
    if (target === "kyc" || target === "kycPage" || text.includes("kyc")) setTimeout(window.renderKycStepWizard || function(){}, 80);
    if (target === "paymentMethods" || target === "paymentMethodsPage" || text.includes("payment method")) setTimeout(renderPayment, 80);
    if (target === "referral" || text.includes("referral")) setTimeout(renderReferral, 80);
  }, true);

  document.addEventListener("submit", function(e){
    if (e.target?.id === "kprKycForm" || e.target?.id === "kprPaymentForm") return;
    const route = pageId();
    if (route === "kyc" && e.target?.matches("form")) {
      e.preventDefault();
      e.stopPropagation();
      renderKyc();
    }
    if (route === "payment" && e.target?.matches("form")) {
      e.preventDefault();
      e.stopPropagation();
      renderPayment();
    }
  }, true);

  function runForCurrent(){
    patchNavigation();
    const route = pageId();
    if (route === "kyc") (window.renderKycStepWizard || function(){})();
    if (route === "payment") renderPayment();
    if (route === "referral") renderReferral();
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(runForCurrent, 1000));
  window.addEventListener("load", () => setTimeout(runForCurrent, 1200));

  // Very slow safety only; no per-second blinking.
  setInterval(runForCurrent, 15000);
})();


/* ===== KPR CLEAN MODULE ROUTE GUARD V2 ===== */
(function(){
  function isShown(el){
    return !!(el && el.classList.contains("active-page") && getComputedStyle(el).display !== "none");
  }
  function activeKprRoute(){
    if (isShown(document.getElementById("paymentMethodsPage"))) return "payment";
    if (isShown(document.getElementById("kycPage"))) return "kyc";
    if (isShown(document.getElementById("referral"))) return "referral";
    return "";
  }
  function rerender(){
    const r = activeKprRoute();
    if (r === "payment") {
      try { window.kprRenderPayment?.(); } catch(e){}
    }
    if (r === "kyc") {
      try { window.kprRenderKyc?.(); } catch(e){}
    }
    if (r === "referral") {
      try { window.renderReferralClean?.(); } catch(e){}
    }
  }
  if (!window.__kprGuardV2Bound) {
    window.__kprGuardV2Bound = true;
    document.addEventListener("click", function(e){
      const text = (e.target?.textContent || "").toLowerCase();
      const page = e.target.closest("[data-page]")?.dataset?.page || "";
      const menu = e.target.closest("[data-menu-page]")?.dataset?.menuPage || "";
      if (["paymentMethodsPage","paymentMethods","kycPage","kyc","referral"].includes(page) ||
          ["paymentMethods","kyc","referral"].includes(menu) ||
          text.includes("payment method") || text.includes("kyc") || text.includes("referral")) {
        setTimeout(rerender, 120);
        setTimeout(rerender, 600);
      }
    }, true);
    window.addEventListener("load", () => setTimeout(rerender, 1000));
  }
})();








/* ===== PAYMENT METHOD SINGLE OWNER DB SAVE V2 ===== */
(function(){
  const TABLE = "user_payout_methods";
  const STORE = "ai_trading_user_payout_methods_single_owner_v2";
  const MAX_UPI = 2;
  const MAX_BANK = 2;
  const WARNING = "YOUR PAYMENT METHOD NAME SHOULD MATCH KYC NAME. DON'T USE OTHER ACCOUNT. IF YOU USE OTHER ACCOUNT, YOUR ACCOUNT MAY BE SUSPENDED.";

  let type = (localStorage.getItem("pm_single_type") || "UPI").toUpperCase() === "BANK" ? "BANK" : "UPI";
  let busy = false;
  let rendering = false;

  function client(){
    try {
      if (window.supabaseClient) return window.supabaseClient;
      if (typeof supabaseClient !== "undefined" && supabaseClient) return supabaseClient;
    } catch(e){}
    return null;
  }
  function user(){ return state?.user || {}; }
  function uid(){ const u = user(); return String(u.id || u.email || "local"); }
  function email(){ return String(user().email || ""); }
  function isAdmin(){ return String(user().role || "").toLowerCase() === "admin" || location.pathname.toLowerCase().includes("admin"); }
  function holderName(){ return user().kycName || user().kyc_name || user().name || user().email?.split("@")[0] || "User"; }
  function norm(v){ return String(v || "").trim().toLowerCase().replace(/\s+/g, ""); }
  function toastMsg(msg){ try { toast?.(msg); } catch(e){ alert(msg); } }

  function page(){ return document.getElementById("paymentMethodsPage"); }
  function root(){
    const p = page();
    return document.getElementById("paymentMethodsPageContent") ||
      p?.querySelector(".menu-real-content") ||
      p?.querySelector(".menu-full-content") ||
      p;
  }
  function isPaymentOpen(){
    const p = page();
    return !!(p && p.classList.contains("active-page") && getComputedStyle(p).display !== "none");
  }

  function rawList(){
    state.userPayoutMethods ||= state.payoutMethods || [];
    state.payoutMethods = state.userPayoutMethods;
    return state.userPayoutMethods;
  }
  function normalizeMethod(m){
    const t = String(m.type || m.method_type || m.method || "UPI").toUpperCase() === "BANK" ? "BANK" : "UPI";
    return {
      id: String(m.id || ("pm_" + Date.now() + "_" + Math.random().toString(16).slice(2))),
      userId: String(m.userId || m.user_id || uid()),
      userEmail: String(m.userEmail || m.user_email || ""),
      type: t,
      upi: String(m.upi || m.upi_id || ""),
      holderName: String(m.holderName || m.holder_name || holderName()),
      kycName: String(m.kycName || m.kyc_name_snapshot || holderName()),
      bankName: String(m.bankName || m.bank_name || ""),
      accountNumber: String(m.accountNumber || m.account_number || ""),
      ifsc: String(m.ifsc || "").toUpperCase(),
      status: String(m.status || "PENDING").toUpperCase(),
      createdAt: String(m.createdAt || m.created_at_text || m.created_at || new Date().toLocaleString())
    };
  }
  function keyOf(m){
    m = normalizeMethod(m);
    if (m.type === "UPI") return m.userId + "|UPI|" + norm(m.upi);
    return m.userId + "|BANK|" + norm(m.accountNumber) + "|" + norm(m.ifsc);
  }
  function rankStatus(s){
    s = String(s || "").toUpperCase();
    if (s === "APPROVED") return 3;
    if (s === "PENDING") return 2;
    if (s === "REJECTED") return 1;
    return 0;
  }
  function readLocal(){
    try {
      const arr = JSON.parse(localStorage.getItem(STORE) || "[]");
      return Array.isArray(arr) ? arr.map(normalizeMethod) : [];
    } catch(e){ return []; }
  }
  function mergeLists(){
    const map = new Map();
    for (const list of arguments) {
      (list || []).map(normalizeMethod).forEach(m => {
        const k = keyOf(m) || m.id;
        const old = map.get(k);
        if (!old || rankStatus(m.status) >= rankStatus(old.status)) map.set(k, { ...(old || {}), ...m });
      });
    }
    return Array.from(map.values());
  }
  function sync(extra=[]){
    const merged = mergeLists(rawList(), readLocal(), extra);
    state.userPayoutMethods = merged;
    state.payoutMethods = merged;
    localStorage.setItem(STORE, JSON.stringify(merged));
    try { saveState?.(); } catch(e){}
    try { saveSession?.(); } catch(e){}
    return merged;
  }
  function myMethods(){
    return sync().filter(m => String(m.userId) === uid());
  }
  function visibleMethods(){
    return isAdmin() ? sync() : myMethods();
  }
  function count(t){
    return myMethods().filter(m => m.type === t).length;
  }
  function kycApproved(){
    const st = String(user().kycStatus || user().kyc_status || "").toUpperCase();
    if (st === "APPROVED") return true;
    const rows = state?.kycRequests || [];
    return rows.some(k => {
      const same = String(k.userId || k.user_id || "") === uid() || String(k.userEmail || k.user_email || "").toLowerCase() === email().toLowerCase();
      return same && String(k.status || "").toUpperCase() === "APPROVED";
    });
  }
  function canAdd(t=type){
    return t === "BANK" ? count("BANK") < MAX_BANK : count("UPI") < MAX_UPI;
  }
  function duplicate(method){
    const k = keyOf(method);
    return myMethods().some(m => {
      const st = String(m.status || "").toUpperCase();
      return (st === "PENDING" || st === "APPROVED") && keyOf(m) === k;
    });
  }

  function dbRowFull(m){
    return {
      id: m.id,
      user_id: m.userId,
      user_email: m.userEmail || email(),
      method_type: m.type,
      holder_name: m.holderName,
      kyc_name_snapshot: m.kycName,
      upi_id: m.upi,
      bank_name: m.bankName,
      account_number: m.accountNumber,
      ifsc: m.ifsc,
      status: m.status,
      name_match: true,
      created_at_text: m.createdAt
    };
  }
  function dbRowMinimal(m){
    // Matches the SQL file schema even if user_email column was not added yet.
    return {
      id: m.id,
      user_id: m.userId,
      method_type: m.type,
      holder_name: m.holderName,
      kyc_name_snapshot: m.kycName,
      upi_id: m.upi,
      bank_name: m.bankName,
      account_number: m.accountNumber,
      ifsc: m.ifsc,
      status: m.status,
      name_match: true,
      created_at_text: m.createdAt
    };
  }
  async function dbSave(method){
    const c = client();
    if (!c) return { ok:false, reason:"no_supabase_client" };
    try {
      let res = await c.from(TABLE).upsert(dbRowFull(method), { onConflict:"id" });
      if (res.error) {
        const msg = String(res.error.message || "");
        // If table has no user_email column, retry with exact existing schema.
        if (msg.includes("user_email") || msg.includes("Could not find") || msg.includes("schema cache")) {
          res = await c.from(TABLE).upsert(dbRowMinimal(method), { onConflict:"id" });
        }
      }
      if (res.error) return { ok:false, reason:res.error.message };
      return { ok:true };
    } catch(e){
      return { ok:false, reason:e.message || String(e) };
    }
  }
  async function dbLoad(){
    const c = client();
    if (!c || !state?.user) return [];
    try {
      let query = c.from(TABLE).select("*");
      if (!isAdmin()) query = query.eq("user_id", uid());
      const res = await query;
      if (res.error) {
        console.warn("Payment method DB load failed:", res.error.message);
        return [];
      }
      return (res.data || []).map(normalizeMethod);
    } catch(e){
      console.warn("Payment method DB load failed:", e);
      return [];
    }
  }
  async function dbUpdate(id, status){
    const c = client();
    if (!c) return { ok:false };
    try {
      let res = await c.from(TABLE).update({ status, reviewed_at:new Date().toISOString() }).eq("id", id);
      if (res.error) {
        const msg = String(res.error.message || "");
        if (msg.includes("reviewed_at") || msg.includes("Could not find") || msg.includes("schema cache")) {
          res = await c.from(TABLE).update({ status }).eq("id", id);
        }
      }
      if (res.error) {
        console.warn("Payment method DB update failed:", res.error.message);
        return { ok:false, reason:res.error.message };
      }
      return { ok:true };
    } catch(e){ return { ok:false, reason:e.message || String(e) }; }
  }
  async function hydrate(){
    const rows = await dbLoad();
    sync(rows);
    renderAdmin();
  }
  function mask(m){
    m = normalizeMethod(m);
    if (m.type === "UPI") return m.upi || "-";
    return `${m.bankName || "Bank"} ${m.accountNumber ? "****" + String(m.accountNumber).slice(-4) : ""}`;
  }
  function statusPill(st){
    st = String(st || "PENDING").toUpperCase();
    return `<em class="pm-v2-status ${st.toLowerCase()}">${st}</em>`;
  }
  function methodHtml(m){
    return `<div class="card menu-real-method-card">
      <div>
        <span>${m.type}</span>
        <b>${mask(m)}</b>
        <small>${m.holderName}</small>
      </div>
      ${statusPill(m.status)}
    </div>`;
  }
  function paymentHtml(){
    const approved = kycApproved();
    const ok = approved && canAdd(type);
    const limitText = type === "BANK" ? `You can add only ${MAX_BANK} bank accounts.` : `You can add only ${MAX_UPI} UPI IDs.`;
    const list = myMethods();

    return `
      <div class="pm-v2-warning">${WARNING}</div>
      ${approved ? "" : `<div class="card pm-v2-note"><b>KYC Approval Required</b><span>Please complete approved KYC before adding a payment method.</span></div>`}

      <form id="pmV2Form" class="card menu-real-form ${approved ? "" : "disabled"}">
        <label>Method Type
          <select id="pmV2Type" name="type" ${approved ? "" : "disabled"}>
            <option value="UPI" ${type === "UPI" ? "selected" : ""}>UPI</option>
            <option value="BANK" ${type === "BANK" ? "selected" : ""}>Bank Account</option>
          </select>
        </label>

        <label class="pm-v2-upi">UPI ID
          <input name="upi" placeholder="example@upi" ${approved ? "" : "disabled"}>
        </label>

        <label>Account Holder Name / KYC Name
          <input name="holderName" value="${holderName()}" readonly>
        </label>

        <div class="pm-v2-bank">
          <label>Bank Name
            <input name="bankName" placeholder="Bank name" ${approved ? "" : "disabled"}>
          </label>
          <label>Account Number
            <input name="accountNumber" placeholder="Account number" ${approved ? "" : "disabled"}>
          </label>
          <label>IFSC Code
            <input name="ifsc" placeholder="IFSC code" ${approved ? "" : "disabled"}>
          </label>
        </div>

        <div class="pm-v2-limit">${ok ? `<span>Limit: UPI ${count("UPI")}/${MAX_UPI} • Bank ${count("BANK")}/${MAX_BANK}</span>` : `<b>${approved ? limitText : "KYC approval required"}</b>`}</div>
        <button type="submit" ${ok ? "" : "disabled"}>${ok ? "Add Method for Admin Approval" : "Not Available"}</button>
      </form>

      <div class="menu-real-section-title">Saved Methods</div>
      <div class="menu-real-methods">${list.length ? list.map(methodHtml).join("") : `<div class="card menu-real-empty">No payment method added yet.</div>`}</div>`;
  }
  function applyTypeView(){
    const p = page();
    const sel = document.getElementById("pmV2Type");
    if (sel && sel.value !== type) sel.value = type;
    p?.classList.toggle("pm-v2-bank-selected", type === "BANK");
    p?.querySelectorAll(".pm-v2-bank").forEach(el => el.style.display = type === "BANK" ? "grid" : "none");
    p?.querySelectorAll(".pm-v2-upi").forEach(el => el.style.display = type === "BANK" ? "none" : "grid");
  }
  function bind(){
    const sel = document.getElementById("pmV2Type");
    const form = document.getElementById("pmV2Form");
    sel?.addEventListener("change", () => {
      type = String(sel.value || "UPI").toUpperCase() === "BANK" ? "BANK" : "UPI";
      localStorage.setItem("pm_single_type", type);
      renderPayment();
    }, true);
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      await submit(form);
    }, true);
  }
  function renderPayment(){
    if (!isPaymentOpen() || rendering) return;
    const r = root();
    if (!r) return;
    rendering = true;
    try {
      r.innerHTML = paymentHtml();
      bind();
      applyTypeView();
    } finally {
      rendering = false;
    }
  }
  function buildMethod(form){
    const fd = new FormData(form);
    return normalizeMethod({
      id: "pm_" + Date.now(),
      userId: uid(),
      userEmail: email(),
      type,
      upi: type === "UPI" ? String(fd.get("upi") || "").trim() : "",
      holderName: holderName(),
      kycName: holderName(),
      bankName: type === "BANK" ? String(fd.get("bankName") || "").trim() : "",
      accountNumber: type === "BANK" ? String(fd.get("accountNumber") || "").trim() : "",
      ifsc: type === "BANK" ? String(fd.get("ifsc") || "").trim().toUpperCase() : "",
      status: "PENDING",
      createdAt: new Date().toLocaleString()
    });
  }
  function buttonState(btn, mode){
    if (!btn) return;
    if (mode === "loading") {
      btn.dataset.oldText = btn.dataset.oldText || btn.textContent;
      btn.disabled = true;
      btn.classList.add("pm-v2-saving");
      btn.textContent = "Sending request...";
    } else if (mode === "done") {
      btn.disabled = true;
      btn.classList.remove("pm-v2-saving");
      btn.classList.add("pm-v2-saved");
      btn.textContent = "Request Sent ✓";
    } else {
      btn.disabled = false;
      btn.classList.remove("pm-v2-saving","pm-v2-saved");
      btn.textContent = btn.dataset.oldText || "Add Method for Admin Approval";
    }
  }
  async function submit(form){
    if (busy) return;
    busy = true;
    const btn = form.querySelector("button[type='submit'],button");
    buttonState(btn, "loading");
    try {
      if (!kycApproved()) {
        alert("Please complete approved KYC before adding payment method.");
        buttonState(btn, "normal");
        return;
      }
      const method = buildMethod(form);
      if (method.type === "UPI" && !method.upi) {
        alert("Please enter UPI ID.");
        buttonState(btn, "normal");
        return;
      }
      if (method.type === "BANK" && (!method.bankName || !method.accountNumber || !method.ifsc)) {
        alert("Please enter complete bank details.");
        buttonState(btn, "normal");
        return;
      }
      if (duplicate(method)) {
        alert("This payment method is already pending or approved.");
        buttonState(btn, "normal");
        return;
      }

      sync([method]);
      renderAdmin();
      buttonState(btn, "done");

      const db = await dbSave(method);
      if (!db.ok) {
        toastMsg("Browser में save हो गया, लेकिन DB save fail है: " + db.reason);
        console.warn("Payment method DB save failed:", db.reason);
      } else {
        toastMsg("Payment method request DB में save हो गई.");
      }
      await hydrate();
      setTimeout(renderPayment, 900);
      setTimeout(renderAdmin, 900);
    } finally {
      setTimeout(() => { busy = false; }, 1400);
    }
  }
  function renderAdmin(){
    const body = document.getElementById("paymentRequestsLog") ||
      document.getElementById("payoutRequestsLog") ||
      document.getElementById("adminPayoutRequestsList");
    if (!body) return;
    const rows = visibleMethods();
    const html = rows.length ? rows.map(m => {
      const st = String(m.status || "PENDING").toUpperCase();
      return `<tr>
        <td>${m.userEmail || m.userId || "-"}</td>
        <td>${m.type}</td>
        <td>${mask(m)}</td>
        <td>${m.holderName || "-"}</td>
        <td>${statusPill(st)}</td>
        <td>${st === "PENDING" ? `<button class="approve-btn" onclick="approvePayoutMethod('${m.id}')">Approve</button><button class="reject-btn" onclick="rejectPayoutMethod('${m.id}')">Reject</button>` : `<span class="pm-v2-locked">Locked</span>`}</td>
      </tr>`;
    }).join("") : `<tr><td colspan="6" class="empty">No payout method requests.</td></tr>`;
    if (body.tagName === "TBODY") body.innerHTML = html;
    else body.innerHTML = `<table><tbody>${html}</tbody></table>`;
  }
  async function setStatus(id, status){
    const rows = sync();
    const row = rows.find(m => String(m.id) === String(id));
    if (row) row.status = status;
    sync(rows);
    await dbUpdate(id, status);
    await hydrate();
    renderAdmin();
    renderPayment();
  }
  function patchGlobals(){
    window.renderPaymentMethodsPage = renderPayment;
    window.kprRenderPayment = renderPayment;
    window.renderAdminPaymentRequestsFixed = renderAdmin;
    window.approvePayoutMethod = (id) => setStatus(id, "APPROVED");
    window.rejectPayoutMethod = (id) => setStatus(id, "REJECTED");

    const oldShowPage = window.showPage;
    if (typeof oldShowPage === "function" && !window.__pmV2ShowPatched) {
      window.__pmV2ShowPatched = true;
      window.showPage = function(pageId){
        const res = oldShowPage.apply(this, arguments);
        if (pageId === "paymentMethodsPage" || pageId === "paymentMethods") {
          setTimeout(renderPayment, 80);
          setTimeout(renderPayment, 500);
        }
        return res;
      };
      try { showPage = window.showPage; } catch(e){}
    }
    const oldOpen = window.openRealMenuPage;
    if (typeof oldOpen === "function" && !window.__pmV2MenuPatched) {
      window.__pmV2MenuPatched = true;
      window.openRealMenuPage = function(route){
        const res = oldOpen.apply(this, arguments);
        if (route === "paymentMethods") {
          setTimeout(renderPayment, 80);
          setTimeout(renderPayment, 500);
        }
        return res;
      };
      try { openRealMenuPage = window.openRealMenuPage; } catch(e){}
    }
  }
  document.addEventListener("submit", function(e){
    const form = e.target?.closest?.("form") || e.target;
    if (!form) return;
    if (form.id === "pmV2Form" || form.closest("#paymentMethodsPage")) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      submit(form);
    }
  }, true);
  document.addEventListener("click", function(e){
    const text = (e.target?.textContent || "").toLowerCase();
    const pageId = e.target.closest("[data-page]")?.dataset?.page || "";
    const menuId = e.target.closest("[data-menu-page]")?.dataset?.menuPage || "";
    if (pageId === "paymentMethodsPage" || pageId === "paymentMethods" || menuId === "paymentMethods" || text.includes("payment method")) {
      setTimeout(renderPayment, 100);
      setTimeout(renderPayment, 600);
    }
    const tab = e.target.closest("[data-admin-tab]")?.dataset?.adminTab || "";
    if (text.includes("payout") || text.includes("payment request") || tab.toLowerCase().includes("payment")) {
      setTimeout(hydrate, 150);
      setTimeout(renderAdmin, 700);
    }
  }, true);

  function boot(){
    patchGlobals();
    sync();
    hydrate();
    renderAdmin();
    if (isPaymentOpen()) renderPayment();
  }
  document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 900));
  window.addEventListener("load", () => {
    setTimeout(boot, 1000);
    setTimeout(boot, 2500);
  });
})();


/* ===== KYC STEP WIZARD FINAL ===== */
(function(){
  const TABLE = "kyc_requests";
  const DOC_TABLE = "kyc_documents";
  const BUCKET = "kyc-documents";
  const STORE = "ai_trading_kyc_step_wizard_draft_v1";
  let step = 1;
  let busy = false;
  let rendering = false;

  function client(){
    try {
      if (window.supabaseClient) return window.supabaseClient;
      if (typeof supabaseClient !== "undefined" && supabaseClient) return supabaseClient;
    } catch(e){}
    return null;
  }
  function user(){ return state?.user || {}; }
  function uid(){ const u = user(); return String(u.id || u.email || "local"); }
  function email(){ return String(user().email || ""); }
  function displayName(){ return user().kycName || user().name || user().email?.split("@")[0] || "User"; }
  function toastMsg(msg){ try { toast?.(msg); } catch(e){ alert(msg); } }
  function saveAll(){ try { saveState?.(); } catch(e){} try { saveSession?.(); } catch(e){} }

  function page(){ return document.getElementById("kycPage"); }
  function root(){
    const p = page();
    return document.getElementById("kycPageContent") ||
      p?.querySelector(".menu-real-content") ||
      p?.querySelector(".menu-full-content") ||
      p;
  }
  function isKycOpen(){
    const p = page();
    return !!(p && p.classList.contains("active-page") && getComputedStyle(p).display !== "none");
  }

  function localRows(){
    state.kycRequests ||= [];
    return state.kycRequests;
  }
  function sameUser(row){
    return String(row.userId || row.user_id || "") === uid() ||
      String(row.userEmail || row.user_email || row.email || "").toLowerCase() === email().toLowerCase();
  }
  function rank(s){
    s = String(s || "PENDING").toUpperCase();
    if (s === "APPROVED") return 3;
    if (s === "PENDING") return 2;
    if (s === "REJECTED") return 1;
    return 0;
  }
  function latestKyc(){
    const rows = localRows().filter(sameUser);
    if (!rows.length) return null;
    return rows.slice().sort((a,b) => {
      const ra = rank(b.status) - rank(a.status);
      if (ra) return ra;
      const tb = Date.parse(b.reviewed_at || b.submitted_at || b.createdAt || b.created_at || "") || Number(b.id || 0) || 0;
      const ta = Date.parse(a.reviewed_at || a.submitted_at || a.createdAt || a.created_at || "") || Number(a.id || 0) || 0;
      return tb - ta;
    })[0];
  }
  function status(){
    return String(latestKyc()?.status || user().kycStatus || user().kyc_status || "").toUpperCase();
  }
  function readDraft(){
    try {
      return JSON.parse(localStorage.getItem(STORE + "_" + uid()) || "{}") || {};
    } catch(e){ return {}; }
  }
  function saveDraftFromForm(){
    const form = document.getElementById("kycWizardForm");
    if (!form) return readDraft();
    const fd = new FormData(form);
    const data = readDraft();
    for (const [k,v] of fd.entries()) {
      if (v && typeof v === "object" && "name" in v) continue;
      data[k] = String(v || "");
    }
    localStorage.setItem(STORE + "_" + uid(), JSON.stringify(data));
    return data;
  }
  function clearDraft(){
    localStorage.removeItem(STORE + "_" + uid());
  }
  async function dbLoad(){
    const c = client();
    if (!c || !state?.user) return [];
    try {
      let res = await c.from(TABLE).select("*").eq("user_id", uid());
      if (res.error) {
        res = await c.from(TABLE).select("*");
        if (res.error) throw res.error;
        return (res.data || []).filter(sameUser);
      }
      return res.data || [];
    } catch(e){
      console.warn("KYC DB load failed", e);
      return [];
    }
  }
  function mergeRows(rows){
    if (!rows?.length) return;
    const map = new Map();
    localRows().forEach(r => map.set(String(r.id || Math.random()), r));
    rows.forEach(r => {
      const id = String(r.id || r.kyc_id || ("kyc_" + Date.now() + "_" + Math.random()));
      map.set(id, {
        id,
        userId: r.userId || r.user_id || uid(),
        userEmail: r.userEmail || r.user_email || r.email || email(),
        name: r.name || r.full_name || r.kycName || "",
        mobile: r.mobile || "",
        dob: r.dob || "",
        pan: r.pan || r.pan_number || r.doc_number || "",
        address: r.address || "",
        city: r.city || "",
        stateName: r.stateName || r.state_name || r.state || "",
        pincode: r.pincode || "",
        docType: r.docType || r.doc_type || "",
        docNumber: r.docNumber || r.doc_number || "",
        documents: r.documents || {},
        status: r.status || "PENDING",
        createdAt: r.createdAt || r.submitted_at || r.created_at || ""
      });
    });
    state.kycRequests = Array.from(map.values());
    saveAll();
  }
  async function hydrate(){
    const rows = await dbLoad();
    mergeRows(rows);
    if (isKycOpen()) render();
  }

  function statusCard(type, title, text, extra=""){
    return `<div class="card kyc-step-status ${type}">
      <div class="kyc-step-status-icon">${type === "approved" ? "✓" : (type === "pending" ? "⏳" : (type === "rejected" ? "!" : "i"))}</div>
      <h3>${title}</h3>
      <p>${text}</p>
      ${extra}
    </div>`;
  }
  function progressHtml(){
    const labels = ["Personal", "PAN", "Address", "Selfie"];
    return `<div class="kyc-step-progress">
      <div class="kyc-step-top">
        <span>KYC Verification</span>
        <b>Step ${step} of 4</b>
      </div>
      <div class="kyc-step-dots">
        ${labels.map((l,i) => {
          const n = i + 1;
          return `<div class="kyc-step-dot ${n < step ? "done" : (n === step ? "active" : "")}">
            <em>${n < step ? "✓" : n}</em><span>${l}</span>
          </div>`;
        }).join("")}
      </div>
    </div>`;
  }
  function field(name, label, value="", attrs=""){
    return `<label>${label}<input name="${name}" value="${String(value || "").replace(/"/g, "&quot;")}" ${attrs}></label>`;
  }
  function stepHtml(data){
    if (step === 1) {
      return `<div class="kyc-wizard-panel">
        <h3>Personal Details</h3>
        <p>Your KYC name should match your payment method account holder name.</p>
        ${field("fullName", "Full Name as per PAN/Aadhaar", data.fullName || displayName(), "required")}
        ${field("mobile", "Mobile Number", data.mobile || user().mobile || "", 'inputmode="numeric" required')}
        ${field("email", "Email", data.email || email(), "readonly")}
        ${field("dob", "Date of Birth", data.dob || "", 'type="date" required')}
      </div>`;
    }
    if (step === 2) {
      return `<div class="kyc-wizard-panel">
        <h3>PAN Details</h3>
        <p>Enter PAN details carefully. Wrong PAN/name can delay approval.</p>
        ${field("panNumber", "PAN Number", data.panNumber || "", 'maxlength="10" required')}
        ${field("panName", "Name as per PAN", data.panName || data.fullName || displayName(), "required")}
        <label>PAN Card Upload<input type="file" name="panFile" accept="image/*,.pdf"></label>
      </div>`;
    }
    if (step === 3) {
      return `<div class="kyc-wizard-panel">
        <h3>Address Proof</h3>
        <p>Upload clear front/back images if your document has two sides.</p>
        <label>Full Address<textarea name="address" required>${data.address || ""}</textarea></label>
        ${field("city", "City", data.city || "", "required")}
        ${field("stateName", "State", data.stateName || "", "required")}
        ${field("pincode", "Pincode", data.pincode || "", 'inputmode="numeric" required')}
        <label>Document Type
          <select name="docType" required>
            ${["Aadhaar","Passport","Driving Licence","Voter ID","Other"].map(x => `<option ${data.docType === x ? "selected" : ""}>${x}</option>`).join("")}
          </select>
        </label>
        ${field("docNumber", "Document Number", data.docNumber || "", "required")}
        <label>Document Front<input type="file" name="addressFront" accept="image/*,.pdf"></label>
        <label>Document Back Optional<input type="file" name="addressBack" accept="image/*,.pdf"></label>
      </div>`;
    }
    return `<div class="kyc-wizard-panel">
      <h3>Selfie Verification</h3>
      <p>Upload a clear selfie. Face should be visible and not blurred.</p>
      <label>Selfie Upload<input type="file" name="selfie" accept="image/*"></label>
      <label class="kyc-step-check"><input type="checkbox" name="agree" value="yes" required> I confirm that all KYC details are correct.</label>
      <div class="kyc-step-submit-note">After submit, KYC will go to admin for approval.</div>
    </div>`;
  }
  function validateStep(){
    const data = saveDraftFromForm();
    if (step === 1) {
      if (!data.fullName || !data.mobile || !data.dob) return "Please complete personal details.";
    }
    if (step === 2) {
      if (!data.panNumber || !data.panName) return "Please complete PAN details.";
      if (!/^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/.test(String(data.panNumber).trim())) return "Please enter valid PAN format.";
    }
    if (step === 3) {
      if (!data.address || !data.city || !data.stateName || !data.pincode || !data.docNumber) return "Please complete address proof details.";
    }
    return "";
  }
  function render(){
    if (!isKycOpen() || rendering) return;
    const r = root();
    if (!r) return;
    rendering = true;
    try {
      const st = status();
      const row = latestKyc();
      if (st === "APPROVED") {
        r.innerHTML = statusCard("approved", "Your KYC Approved", "Your identity verification is approved. You do not need to submit KYC again.", `<div class="kyc-approved-name"><span>Name</span><b>${row?.name || displayName()}</b></div>`);
        rendering = false;
        return;
      }
      if (st === "PENDING") {
        r.innerHTML = statusCard("pending", "KYC Under Review", "Your KYC documents have been submitted. Please wait for admin approval.");
        rendering = false;
        return;
      }

      const data = readDraft();
      const rejected = st === "REJECTED" ? statusCard("rejected", "KYC Rejected", "Your previous KYC was rejected. Please submit again with correct details.") : "";
      r.innerHTML = `${rejected}
        <form id="kycWizardForm" class="kyc-step-card">
          ${progressHtml()}
          ${stepHtml(data)}
          <div class="kyc-step-actions">
            <button type="button" id="kycStepBack" ${step === 1 ? "disabled" : ""}>Back</button>
            <button type="button" id="kycStepNext">${step === 4 ? "Submit KYC" : "Next"}</button>
          </div>
        </form>`;

      document.getElementById("kycStepBack")?.addEventListener("click", () => {
        saveDraftFromForm();
        step = Math.max(1, step - 1);
        render();
      });
      document.getElementById("kycStepNext")?.addEventListener("click", async () => {
        const err = validateStep();
        if (err) return alert(err);
        if (step < 4) {
          step += 1;
          render();
        } else {
          await submit();
        }
      });
      document.getElementById("kycWizardForm")?.addEventListener("input", saveDraftFromForm, true);
      document.getElementById("kycWizardForm")?.addEventListener("change", saveDraftFromForm, true);
    } finally {
      rendering = false;
    }
  }
  async function uploadDoc(kycId, key, file){
    const c = client();
    if (!c || !file?.name) return null;
    const safe = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${uid()}/${kycId}/${key}_${Date.now()}_${safe}`;
    const up = await c.storage.from(BUCKET).upload(path, file, { upsert:false });
    if (up.error) throw up.error;
    try {
      await c.from(DOC_TABLE).insert({
        id: `doc_${Date.now()}_${key}`,
        kyc_id: String(kycId),
        user_id: uid(),
        doc_key: key,
        file_name: file.name,
        file_path: path,
        file_url: "",
        mime_type: file.type || "",
        size_bytes: file.size || 0
      });
    } catch(e){}
    return { name:file.name, path, uploadedAt:new Date().toLocaleString() };
  }
  async function submit(){
    if (busy) return;
    busy = true;
    const form = document.getElementById("kycWizardForm");
    const btn = document.getElementById("kycStepNext");
    if (btn) { btn.disabled = true; btn.textContent = "Submitting..."; }
    try {
      const data = saveDraftFromForm();
      const kycId = Date.now();
      const row = {
        id: String(kycId),
        userId: uid(),
        userEmail: email(),
        name: data.fullName || displayName(),
        mobile: data.mobile || "",
        dob: data.dob || "",
        pan: data.panNumber || "",
        panName: data.panName || "",
        address: data.address || "",
        city: data.city || "",
        stateName: data.stateName || "",
        pincode: data.pincode || "",
        docType: data.docType || "",
        docNumber: data.docNumber || "",
        status: "PENDING",
        documents: {},
        createdAt: new Date().toLocaleString()
      };

      const c = client();
      if (c) {
        const insertRow = {
          id: kycId,
          user_id: row.userId,
          user_email: row.userEmail,
          name: row.name,
          full_name: row.name,
          mobile: row.mobile,
          dob: row.dob,
          address: row.address,
          doc_type: row.docType || "KYC",
          doc_number: row.docNumber || row.pan,
          status: "PENDING",
          submitted_at: new Date().toISOString()
        };
        let res = await c.from(TABLE).insert(insertRow);
        if (res.error) {
          // Retry with minimal schema if columns like dob/address/user_email are missing.
          res = await c.from(TABLE).insert({
            id: kycId,
            user_id: row.userId,
            name: row.name,
            mobile: row.mobile,
            doc_type: row.docType || "KYC",
            doc_number: row.docNumber || row.pan,
            status: "PENDING"
          });
        }
        if (res.error) throw res.error;

        const docs = {};
        const files = {
          panFile: form?.querySelector('[name="panFile"]')?.files?.[0],
          addressFront: form?.querySelector('[name="addressFront"]')?.files?.[0],
          addressBack: form?.querySelector('[name="addressBack"]')?.files?.[0],
          selfie: form?.querySelector('[name="selfie"]')?.files?.[0],
        };
        for (const [k,f] of Object.entries(files)) {
          if (f?.name) docs[k] = await uploadDoc(kycId, k, f);
        }
        row.documents = docs;
        try { await c.from(TABLE).update({ documents: docs }).eq("id", kycId); } catch(e){}
      }

      state.kycRequests ||= [];
      state.kycRequests.unshift(row);
      state.user.kycStatus = "PENDING";
      state.user.kycName = row.name;
      saveAll();
      clearDraft();
      step = 1;
      toastMsg("KYC submitted for admin approval.");
      render();
    } catch(e) {
      alert("KYC submit failed: " + (e.message || e));
      if (btn) { btn.disabled = false; btn.textContent = "Submit KYC"; }
    } finally {
      busy = false;
    }
  }
  async function setKycStatus(id, st){
    const rows = localRows();
    const row = rows.find(r => String(r.id) === String(id));
    if (row) row.status = st;
    const c = client();
    if (c) {
      try { await c.from(TABLE).update({ status:st, reviewed_at:new Date().toISOString() }).eq("id", id); } catch(e){}
    }
    saveAll();
    render();
    try { render?.(); } catch(e){}
  }
  function patchGlobals(){
    window.renderKycStepWizard = render;
    window.renderKycPage = render;
    window.kprRenderKyc = render;
    window.approveKyc = (id) => setKycStatus(id, "APPROVED");
    window.rejectKyc = (id) => setKycStatus(id, "REJECTED");

    const oldShowPage = window.showPage;
    if (typeof oldShowPage === "function" && !window.__kycWizardShowPatched) {
      window.__kycWizardShowPatched = true;
      window.showPage = function(pageId){
        const res = oldShowPage.apply(this, arguments);
        if (pageId === "kycPage" || pageId === "kyc") {
          setTimeout(render, 80);
          setTimeout(render, 500);
        }
        return res;
      };
      try { showPage = window.showPage; } catch(e){}
    }
    const oldOpen = window.openRealMenuPage;
    if (typeof oldOpen === "function" && !window.__kycWizardMenuPatched) {
      window.__kycWizardMenuPatched = true;
      window.openRealMenuPage = function(route){
        const res = oldOpen.apply(this, arguments);
        if (route === "kyc") {
          setTimeout(render, 80);
          setTimeout(render, 500);
        }
        return res;
      };
      try { openRealMenuPage = window.openRealMenuPage; } catch(e){}
    }
  }
  document.addEventListener("click", function(e){
    const text = (e.target?.textContent || "").toLowerCase();
    const pageId = e.target.closest("[data-page]")?.dataset?.page || "";
    const menuId = e.target.closest("[data-menu-page]")?.dataset?.menuPage || "";
    if (pageId === "kycPage" || pageId === "kyc" || menuId === "kyc" || text.includes("kyc")) {
      setTimeout(render, 100);
      setTimeout(render, 600);
    }
  }, true);

  function boot(){
    patchGlobals();
    hydrate();
    if (isKycOpen()) render();
  }
  document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 900));
  window.addEventListener("load", () => {
    setTimeout(boot, 1000);
    setTimeout(boot, 2500);
  });
})();


/* ===== MENU PAGES AUTH VISIBILITY FIX ===== */
(function(){
  const MENU_PAGE_IDS = [
    "kycPage",
    "paymentMethodsPage",
    "profilePage",
    "referral",
    "referralPage"
  ];

  function isLoggedIn(){
    try {
      return !!(state && state.user);
    } catch(e){
      return false;
    }
  }

  function appPage(){
    return document.getElementById("appPage");
  }

  function authPage(){
    return document.getElementById("authPage");
  }

  function pageEl(id){
    return document.getElementById(id);
  }

  function ensureInsideApp(){
    const app = appPage();
    if (!app) return;

    MENU_PAGE_IDS.forEach(id => {
      const el = pageEl(id);
      if (!el) return;

      // If menu pages are outside the app wrapper, move them inside appPage
      // so login/register screen never shows them.
      if (!app.contains(el)) {
        app.appendChild(el);
      }

      el.classList.add("page", "menu-owned-page");
    });
  }

  function hideMenuPages(){
    MENU_PAGE_IDS.forEach(id => {
      const el = pageEl(id);
      if (!el) return;
      el.classList.remove("active-page");
      el.style.display = "none";
      el.setAttribute("aria-hidden", "true");
    });
  }

  function showOnlyMenuPage(id){
    ensureInsideApp();

    MENU_PAGE_IDS.forEach(pid => {
      const el = pageEl(pid);
      if (!el) return;
      const active = pid === id;
      el.classList.toggle("active-page", active);
      el.style.display = active ? "" : "none";
      el.setAttribute("aria-hidden", active ? "false" : "true");
    });
  }

  function applyVisibility(){
    ensureInsideApp();
    document.body.classList.toggle("auth-mode", !isLoggedIn());
    document.body.classList.toggle("app-mode", isLoggedIn());

    if (!isLoggedIn()) {
      hideMenuPages();
      return;
    }

    MENU_PAGE_IDS.forEach(id => {
      const el = pageEl(id);
      if (!el) return;
      const active = el.classList.contains("active-page");
      el.style.display = active ? "" : "none";
      el.setAttribute("aria-hidden", active ? "false" : "true");
    });
  }

  function openMenuPage(type){
    if (!isLoggedIn()) {
      applyVisibility();
      return;
    }

    const map = {
      kyc: "kycPage",
      paymentMethods: "paymentMethodsPage",
      paymentMethod: "paymentMethodsPage",
      profile: "profilePage",
      referral: pageEl("referral") ? "referral" : "referralPage"
    };

    const id = map[type] || type;
    if (!pageEl(id)) return;

    // Hide normal dashboard pages.
    document.querySelectorAll("#appPage .page").forEach(p => {
      if (!MENU_PAGE_IDS.includes(p.id)) {
        p.classList.remove("active-page");
      }
    });

    showOnlyMenuPage(id);

    setTimeout(() => {
      if (id === "kycPage") {
        try { window.renderKycStepWizard?.(); } catch(e){}
        try { window.renderKycPage?.(); } catch(e){}
      }
      if (id === "paymentMethodsPage") {
        try { window.renderPaymentMethodsPage?.(); } catch(e){}
        try { window.kprRenderPayment?.(); } catch(e){}
      }
      if (id === "referral" || id === "referralPage") {
        try { window.renderReferralClean?.(); } catch(e){}
      }
    }, 80);
  }

  function patchShowAuth(){
    if (window.__menuPagesShowAuthPatched) return;
    window.__menuPagesShowAuthPatched = true;

    const oldShowAuth = typeof window.showAuth === "function"
      ? window.showAuth
      : (typeof showAuth === "function" ? showAuth : null);

    if (oldShowAuth) {
      window.showAuth = function(show){
        const res = oldShowAuth.apply(this, arguments);
        setTimeout(applyVisibility, 0);
        setTimeout(applyVisibility, 100);
        return res;
      };
      try { showAuth = window.showAuth; } catch(e){}
    }
  }

  function patchShowPage(){
    if (window.__menuPagesShowPagePatched) return;
    window.__menuPagesShowPagePatched = true;

    const oldShowPage = typeof window.showPage === "function" ? window.showPage : null;
    if (oldShowPage) {
      window.showPage = function(pageId){
        const menuIds = ["kycPage","paymentMethodsPage","profilePage","referral","referralPage","paymentMethods"];
        if (menuIds.includes(pageId)) {
          const target = pageId === "paymentMethods" ? "paymentMethodsPage" : pageId;
          openMenuPage(target);
          return;
        }

        const res = oldShowPage.apply(this, arguments);
        if (isLoggedIn()) hideMenuPages();
        setTimeout(applyVisibility, 80);
        return res;
      };
      try { showPage = window.showPage; } catch(e){}
    }
  }

  function patchOpenRealMenuPage(){
    if (window.__menuPagesOpenRealPatched) return;
    window.__menuPagesOpenRealPatched = true;

    const oldOpen = typeof window.openRealMenuPage === "function" ? window.openRealMenuPage : null;
    window.openRealMenuPage = function(type){
      const mapKeys = ["kyc","paymentMethods","paymentMethod","profile","referral"];
      if (mapKeys.includes(type)) {
        openMenuPage(type);
        return;
      }
      if (oldOpen) return oldOpen.apply(this, arguments);
    };
    try { openRealMenuPage = window.openRealMenuPage; } catch(e){}
  }

  document.addEventListener("click", function(e){
    const menuBtn = e.target.closest("[data-menu-page]");
    if (menuBtn) {
      const type = menuBtn.dataset.menuPage;
      if (["kyc","paymentMethods","paymentMethod","profile","referral"].includes(type)) {
        e.preventDefault();
        e.stopPropagation();
        openMenuPage(type);
      }
    }

    const direct = e.target.closest("[data-direct-page]");
    if (direct) {
      const type = direct.dataset.directPage;
      if (["kyc","kycPage","paymentMethods","paymentMethodsPage","profile","profilePage","referral","referralPage"].includes(type)) {
        e.preventDefault();
        e.stopPropagation();
        openMenuPage(type);
      }
    }

    const page = e.target.closest("[data-page]");
    if (page) {
      const type = page.dataset.page;
      if (["kyc","kycPage","paymentMethods","paymentMethodsPage","profile","profilePage","referral","referralPage"].includes(type)) {
        e.preventDefault();
        e.stopPropagation();
        openMenuPage(type);
      }
    }
  }, true);

  function boot(){
    ensureInsideApp();
    patchShowAuth();
    patchShowPage();
    patchOpenRealMenuPage();
    applyVisibility();
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(boot, 200);
    setTimeout(boot, 1000);
  });
  window.addEventListener("load", () => {
    setTimeout(boot, 200);
    setTimeout(boot, 1200);
    setTimeout(applyVisibility, 2500);
  });

  window.fixMenuPagesVisibility = boot;
  window.openMenuOwnedPage = openMenuPage;
})();





/* ===== ADMIN KYC PAYOUT TABLES FILTER PAGINATION FINAL ===== */
(function(){
  const PAGE_SIZE = 5;
  const st = { kycPage:1, payoutPage:1, kycSearch:"", payoutSearch:"", kycStatus:"ALL", payoutStatus:"ALL", payoutType:"ALL" };

  function c(){ try { return window.supabaseClient || (typeof supabaseClient !== "undefined" ? supabaseClient : null); } catch(e){ return null; } }
  function isAdmin(){ try { return location.pathname.toLowerCase().includes("admin") || String(state?.user?.role||"").toLowerCase()==="admin" || !!document.getElementById("adminKycLog") || !!document.getElementById("paymentRequestsLog"); } catch(e){ return false; } }
  function norm(v){ return String(v||"").trim().toLowerCase(); }
  function save(){ try { saveState?.(); } catch(e){} }

  function kycRows(){
    state.kycRequests ||= [];
    return state.kycRequests.map(r => ({
      id:String(r.id||r.kyc_id||""), userId:String(r.userId||r.user_id||""), userEmail:String(r.userEmail||r.user_email||r.email||""),
      name:String(r.name||r.full_name||r.kycName||""), mobile:String(r.mobile||""), dob:String(r.dob||""), address:String(r.address||""),
      city:String(r.city||""), stateName:String(r.stateName||r.state_name||r.state||""), pincode:String(r.pincode||""),
      docType:String(r.docType||r.doc_type||"KYC"), docNumber:String(r.docNumber||r.doc_number||r.pan||""),
      documents:r.documents||{}, status:String(r.status||"PENDING").toUpperCase(), createdAt:String(r.createdAt||r.submitted_at||r.created_at||"")
    }));
  }
  function payoutRows(){
    state.userPayoutMethods ||= state.payoutMethods || [];
    state.payoutMethods = state.userPayoutMethods;
    return state.userPayoutMethods.map(m => {
      const type = String(m.type||m.method_type||m.method||"UPI").toUpperCase()==="BANK" ? "BANK" : "UPI";
      return { id:String(m.id||""), userId:String(m.userId||m.user_id||""), userEmail:String(m.userEmail||m.user_email||""), type,
        upi:String(m.upi||m.upi_id||""), holderName:String(m.holderName||m.holder_name||""), kycName:String(m.kycName||m.kyc_name_snapshot||""),
        bankName:String(m.bankName||m.bank_name||""), accountNumber:String(m.accountNumber||m.account_number||""), ifsc:String(m.ifsc||""),
        status:String(m.status||"PENDING").toUpperCase(), createdAt:String(m.createdAt||m.created_at_text||m.created_at||"") };
    });
  }
  function mergeKyc(rows){
    const map = new Map(); kycRows().forEach(r=>map.set(r.id,r));
    (rows||[]).forEach(r=>{
      const id=String(r.id||r.kyc_id||("kyc_"+Date.now()+"_"+Math.random()));
      map.set(id,{id,userId:String(r.user_id||r.userId||""),userEmail:String(r.user_email||r.userEmail||r.email||""),name:String(r.full_name||r.name||""),mobile:String(r.mobile||""),dob:String(r.dob||""),address:String(r.address||""),city:String(r.city||""),stateName:String(r.state_name||r.stateName||r.state||""),pincode:String(r.pincode||""),docType:String(r.doc_type||r.docType||"KYC"),docNumber:String(r.doc_number||r.docNumber||""),documents:r.documents||{},status:String(r.status||"PENDING").toUpperCase(),createdAt:String(r.submitted_at||r.created_at||r.createdAt||"")});
    });
    state.kycRequests = Array.from(map.values()); save();
  }
  function mergePayout(rows){
    const map = new Map(); payoutRows().forEach(r=>map.set(r.id,r));
    (rows||[]).forEach(m=>{
      const id=String(m.id||("pm_"+Date.now()+"_"+Math.random()));
      map.set(id,{id,userId:String(m.user_id||m.userId||""),userEmail:String(m.user_email||m.userEmail||""),type:String(m.method_type||m.type||"UPI").toUpperCase()==="BANK"?"BANK":"UPI",upi:String(m.upi_id||m.upi||""),holderName:String(m.holder_name||m.holderName||""),kycName:String(m.kyc_name_snapshot||m.kycName||""),bankName:String(m.bank_name||m.bankName||""),accountNumber:String(m.account_number||m.accountNumber||""),ifsc:String(m.ifsc||""),status:String(m.status||"PENDING").toUpperCase(),createdAt:String(m.created_at_text||m.created_at||m.createdAt||"")});
    });
    state.userPayoutMethods = Array.from(map.values()); state.payoutMethods = state.userPayoutMethods; save();
  }

  async function loadKyc(){ const db=c(); if(!db)return; try{ let r=await db.from("kyc_requests").select("*").order("created_at",{ascending:false}); if(r.error) r=await db.from("kyc_requests").select("*"); if(!r.error) mergeKyc(r.data||[]); }catch(e){console.warn("KYC load failed",e);} }
  async function loadPayout(){ const db=c(); if(!db)return; try{ let r=await db.from("user_payout_methods").select("*").order("created_at",{ascending:false}); if(r.error) r=await db.from("user_payout_methods").select("*"); if(!r.error) mergePayout(r.data||[]); }catch(e){console.warn("Payout load failed",e);} }

  function badge(x){ x=String(x||"PENDING").toUpperCase(); return `<span class="admin-table-status ${x.toLowerCase()}">${x}</span>`; }
  function pager(kind,total,page){
    const pages=Math.max(1,Math.ceil(total/PAGE_SIZE)), start=total?((page-1)*PAGE_SIZE)+1:0, end=Math.min(total,page*PAGE_SIZE);
    return `<div class="admin-table-pager"><span>Showing ${start}–${end} of ${total}</span><div><button data-admin-page-kind="${kind}" data-admin-page-dir="prev" ${page<=1?"disabled":""}>Previous</button><b>Page ${page} of ${pages}</b><button data-admin-page-kind="${kind}" data-admin-page-dir="next" ${page>=pages?"disabled":""}>Next</button></div></div>`;
  }
  function toolbar(panel,kind,title){
    let tb=document.getElementById(`admin${kind}Toolbar`); if(tb) return tb;
    tb=document.createElement("div"); tb.id=`admin${kind}Toolbar`; tb.className="admin-table-toolbar";
    tb.innerHTML=`<div><span>${title}</span><b>Search, filter & manage</b></div><input id="admin${kind}Search" placeholder="Search user, name, email..." /><select id="admin${kind}Status"><option value="ALL">All Status</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select>${kind==="Payout"?`<select id="adminPayoutType"><option value="ALL">All Type</option><option value="UPI">UPI</option><option value="BANK">Bank</option></select>`:""}`;
    const t=panel?.querySelector("table")||panel?.firstElementChild; if(t) t.parentNode.insertBefore(tb,t); else panel?.prepend(tb);
    bindToolbar(kind); return tb;
  }
  function bindToolbar(kind){
    const s=document.getElementById(`admin${kind}Search`), f=document.getElementById(`admin${kind}Status`), typ=document.getElementById("adminPayoutType");
    if(s&&!s.dataset.bound){s.dataset.bound=1; s.addEventListener("input",()=>{ if(kind==="Kyc"){st.kycSearch=s.value;st.kycPage=1;renderKyc();}else{st.payoutSearch=s.value;st.payoutPage=1;renderPayout();} });}
    if(f&&!f.dataset.bound){f.dataset.bound=1; f.addEventListener("change",()=>{ if(kind==="Kyc"){st.kycStatus=f.value;st.kycPage=1;renderKyc();}else{st.payoutStatus=f.value;st.payoutPage=1;renderPayout();} });}
    if(typ&&!typ.dataset.bound){typ.dataset.bound=1; typ.addEventListener("change",()=>{st.payoutType=typ.value;st.payoutPage=1;renderPayout();});}
  }

  function kycBody(){ return document.getElementById("adminKycLog")||document.getElementById("kycRequestsLog")||document.querySelector("#adminKycPanel tbody")||document.querySelector("#kycManagement tbody"); }
  function kycPanel(){ const b=kycBody(); return b?.closest(".card")||b?.closest(".admin-panel")||document.body; }
  function fileCount(k){ const d=k.documents||{}; return Array.isArray(d)?d.length:(d&&typeof d==="object"?Object.keys(d).length:0); }
  function filteredKyc(){ const q=norm(st.kycSearch); return kycRows().filter(k=>(st.kycStatus==="ALL"||k.status===st.kycStatus)&&(!q||norm([k.userEmail,k.userId,k.name,k.mobile,k.docType,k.docNumber,k.address,k.city,k.stateName,k.pincode].join(" ")).includes(q))).sort((a,b)=>(Date.parse(b.createdAt)||Number(b.id)||0)-(Date.parse(a.createdAt)||Number(a.id)||0)); }
  function renderKyc(){
    if(!isAdmin())return; const body=kycBody(); if(!body)return; const panel=kycPanel(); toolbar(panel,"Kyc","KYC Requests");
    const list=filteredKyc(), pages=Math.max(1,Math.ceil(list.length/PAGE_SIZE)); st.kycPage=Math.min(Math.max(1,st.kycPage),pages);
    const rows=list.slice((st.kycPage-1)*PAGE_SIZE,st.kycPage*PAGE_SIZE);
    body.innerHTML=rows.length?rows.map(k=>`<tr><td>${k.userEmail||k.userId||"-"}</td><td>${k.name||"-"}</td><td>${k.docType||"KYC"}</td><td>${k.docNumber||"-"}</td><td>${fileCount(k)?fileCount(k)+" files":"Uploaded"}</td><td>${badge(k.status)}</td><td><button class="admin-table-view" onclick="viewKycDetails('${k.id}')">View</button>${k.status==="PENDING"?`<button class="approve-btn" onclick="approveKyc('${k.id}')">Approve</button><button class="reject-btn" onclick="rejectKyc('${k.id}')">Reject</button>`:`<span class="admin-table-locked">Locked</span>`}</td></tr>`).join(""):`<tr><td colspan="7" class="empty">No KYC requests found.</td></tr>`;
    let pg=document.getElementById("adminKycPager"); if(!pg){pg=document.createElement("div");pg.id="adminKycPager";(body.closest("table")||panel).after(pg);} pg.innerHTML=pager("kyc",list.length,st.kycPage);
  }
  function detailRoot(id, panel){ let el=document.getElementById(id); if(el)return el; el=document.createElement("div"); el.id=id; el.className="admin-table-details"; panel.appendChild(el); return el; }
  function viewKycDetails(id){
    const k=kycRows().find(x=>String(x.id)===String(id)); const root=detailRoot("adminKycDetails",kycPanel()); if(!k){root.innerHTML="";return;}
    const docs=k.documents&&typeof k.documents==="object"?Object.entries(k.documents):[];
    root.innerHTML=`<div class="card admin-detail-card"><div class="admin-detail-head"><div><span>KYC DETAILS</span><h3>${k.name||"User KYC"}</h3><p>${k.userEmail||k.userId||"-"}</p></div>${badge(k.status)}</div><div class="admin-detail-grid"><div><span>Mobile</span><b>${k.mobile||"-"}</b></div><div><span>DOB</span><b>${k.dob||"-"}</b></div><div><span>Doc Type</span><b>${k.docType||"-"}</b></div><div><span>Doc No.</span><b>${k.docNumber||"-"}</b></div><div><span>Address</span><b>${k.address||"-"}</b></div><div><span>City / State / Pincode</span><b>${[k.city,k.stateName,k.pincode].filter(Boolean).join(" / ")||"-"}</b></div></div><div class="admin-detail-docs">${docs.length?docs.map(([key,val])=>`<div><span>${key}</span><b>${val?.name||val?.file_name||key}</b><small>${val?.path||val?.file_path||""}</small></div>`).join(""):`<div><span>Documents</span><b>No file metadata found</b></div>`}</div><div class="admin-detail-actions">${k.status==="PENDING"?`<button class="approve-btn" onclick="approveKyc('${k.id}')">Approve</button><button class="reject-btn" onclick="rejectKyc('${k.id}')">Reject</button>`:`<span class="admin-table-locked">Action Locked</span>`}</div></div>`;
  }
  async function setKyc(id,x){ const row=state.kycRequests?.find(r=>String(r.id||r.kyc_id)===String(id)); if(row)row.status=x; const db=c(); if(db){try{let r=await db.from("kyc_requests").update({status:x,reviewed_at:new Date().toISOString()}).eq("id",id); if(r.error) await db.from("kyc_requests").update({status:x}).eq("id",id);}catch(e){}} save(); renderKyc(); viewKycDetails(id); }

  function payoutBody(){ return document.getElementById("paymentRequestsLog")||document.getElementById("payoutRequestsLog")||document.getElementById("adminPayoutRequestsList")||document.querySelector("#adminPayoutPanel tbody")||document.querySelector("#payoutMethodsPanel tbody"); }
  function payoutPanel(){ const b=payoutBody(); return b?.closest(".card")||b?.closest(".admin-panel")||document.body; }
  function mask(m){ return m.type==="UPI"?(m.upi||"-"):`${m.bankName||"Bank"} ${m.accountNumber?"****"+String(m.accountNumber).slice(-4):""}`; }
  function filteredPayout(){ const q=norm(st.payoutSearch); return payoutRows().filter(m=>(st.payoutStatus==="ALL"||m.status===st.payoutStatus)&&(st.payoutType==="ALL"||m.type===st.payoutType)&&(!q||norm([m.userEmail,m.userId,m.type,m.upi,m.holderName,m.kycName,m.bankName,m.accountNumber,m.ifsc].join(" ")).includes(q))).sort((a,b)=>(Date.parse(b.createdAt)||Number(String(b.id).replace(/\D/g,""))||0)-(Date.parse(a.createdAt)||Number(String(a.id).replace(/\D/g,""))||0));}
  function renderPayout(){
    if(!isAdmin())return; const body=payoutBody(); if(!body)return; const panel=payoutPanel(); toolbar(panel,"Payout","Payout Method Requests");
    const list=filteredPayout(), pages=Math.max(1,Math.ceil(list.length/PAGE_SIZE)); st.payoutPage=Math.min(Math.max(1,st.payoutPage),pages);
    const rows=list.slice((st.payoutPage-1)*PAGE_SIZE,st.payoutPage*PAGE_SIZE);
    const html=rows.length?rows.map(m=>`<tr><td>${m.userEmail||m.userId||"-"}</td><td>${m.type}</td><td>${mask(m)}</td><td>${m.holderName||"-"}</td><td>${m.kycName||"-"}</td><td>${badge(m.status)}</td><td><button class="admin-table-view" onclick="viewPayoutDetails('${m.id}')">View</button>${m.status==="PENDING"?`<button class="approve-btn" onclick="approvePayoutMethod('${m.id}')">Approve</button><button class="reject-btn" onclick="rejectPayoutMethod('${m.id}')">Reject</button>`:`<span class="admin-table-locked">Locked</span>`}<button class="admin-table-delete" onclick="deletePayoutMethod('${m.id}')">Delete</button></td></tr>`).join(""):`<tr><td colspan="7" class="empty">No payout method requests found.</td></tr>`;
    if(body.tagName==="TBODY") body.innerHTML=html; else body.innerHTML=`<table class="admin-table"><tbody>${html}</tbody></table>`;
    let pg=document.getElementById("adminPayoutPager"); if(!pg){pg=document.createElement("div");pg.id="adminPayoutPager";(body.closest("table")||panel).after(pg);} pg.innerHTML=pager("payout",list.length,st.payoutPage);
  }
  function viewPayoutDetails(id){
    const m=payoutRows().find(x=>String(x.id)===String(id)); const root=detailRoot("adminPayoutDetails",payoutPanel()); if(!m){root.innerHTML="";return;}
    root.innerHTML=`<div class="card admin-detail-card"><div class="admin-detail-head"><div><span>PAYOUT METHOD DETAILS</span><h3>${m.type} Method</h3><p>${m.userEmail||m.userId||"-"}</p></div>${badge(m.status)}</div><div class="admin-detail-grid"><div><span>Type</span><b>${m.type}</b></div><div><span>Method</span><b>${mask(m)}</b></div><div><span>Holder Name</span><b>${m.holderName||"-"}</b></div><div><span>KYC Name</span><b>${m.kycName||"-"}</b></div><div><span>Name Match</span><b>${norm(m.holderName)===norm(m.kycName)?"YES":"NO"}</b></div><div><span>Date</span><b>${m.createdAt||"-"}</b></div></div><div class="admin-detail-actions">${m.status==="PENDING"?`<button class="approve-btn" onclick="approvePayoutMethod('${m.id}')">Approve</button><button class="reject-btn" onclick="rejectPayoutMethod('${m.id}')">Reject</button>`:`<span class="admin-table-locked">Action Locked</span>`}<button class="admin-table-delete" onclick="deletePayoutMethod('${m.id}')">Delete Method</button></div></div>`;
  }
  async function setPayout(id,x){ const row=state.userPayoutMethods?.find(m=>String(m.id)===String(id)); if(row)row.status=x; const db=c(); if(db){try{let r=await db.from("user_payout_methods").update({status:x,reviewed_at:new Date().toISOString()}).eq("id",id); if(r.error) await db.from("user_payout_methods").update({status:x}).eq("id",id);}catch(e){}} save(); renderPayout(); viewPayoutDetails(id); }
  async function delPayout(id){ if(!confirm("Delete this payout method? User can add a new method again."))return; state.userPayoutMethods=(state.userPayoutMethods||[]).filter(m=>String(m.id)!==String(id)); state.payoutMethods=state.userPayoutMethods; const db=c(); if(db){try{await db.from("user_payout_methods").delete().eq("id",id);}catch(e){}} save(); const d=document.getElementById("adminPayoutDetails"); if(d)d.innerHTML=""; renderPayout(); }

  async function refresh(){ await Promise.all([loadKyc(),loadPayout()]); renderKyc(); renderPayout(); }
  function patch(){
    window.viewKycDetails=viewKycDetails; window.approveKyc=(id)=>setKyc(id,"APPROVED"); window.rejectKyc=(id)=>setKyc(id,"REJECTED"); window.renderAdminKycRequests=renderKyc;
    window.viewPayoutDetails=viewPayoutDetails; window.approvePayoutMethod=(id)=>setPayout(id,"APPROVED"); window.rejectPayoutMethod=(id)=>setPayout(id,"REJECTED"); window.deletePayoutMethod=delPayout; window.renderAdminPayoutRequests=renderPayout; window.renderAdminPaymentRequestsFixed=renderPayout;
    const old=window.renderAdmin; if(typeof old==="function"&&!window.__adminTablesFinalPatch){ window.__adminTablesFinalPatch=true; window.renderAdmin=function(){const r=old.apply(this,arguments);setTimeout(renderKyc,50);setTimeout(renderPayout,80);return r;}; try{renderAdmin=window.renderAdmin;}catch(e){}}
  }
  document.addEventListener("click",function(e){
    const pg=e.target.closest("[data-admin-page-kind]"); if(pg){ const kind=pg.dataset.adminPageKind, dir=pg.dataset.adminPageDir; if(kind==="kyc"){st.kycPage+=dir==="next"?1:-1;renderKyc();} if(kind==="payout"){st.payoutPage+=dir==="next"?1:-1;renderPayout();} return; }
    const text=(e.target?.textContent||"").toLowerCase(), tab=e.target.closest("[data-admin-tab]")?.dataset?.adminTab||"", page=e.target.closest("[data-page]")?.dataset?.page||"";
    if(text.includes("kyc")||text.includes("payout")||text.includes("payment method")||tab.toLowerCase().includes("kyc")||tab.toLowerCase().includes("payment")||page.toLowerCase().includes("admin")){setTimeout(refresh,150);setTimeout(()=>{renderKyc();renderPayout();},800);}
  },true);
  function boot(){ if(!isAdmin())return; patch(); refresh(); renderKyc(); renderPayout(); }
  document.addEventListener("DOMContentLoaded",()=>setTimeout(boot,900));
  window.addEventListener("load",()=>{setTimeout(boot,900);setTimeout(refresh,2600);});
})();


/* ===== PAYOUT STABLE PAGE TABLE OVERRIDE FINAL ===== */
(function(){
  const PAGE_SIZE = 5;
  const ps = { page:1, search:"", status:"ALL", type:"ALL" };

  function c(){ try { return window.supabaseClient || (typeof supabaseClient !== "undefined" ? supabaseClient : null); } catch(e){ return null; } }
  function norm(v){ return String(v||"").trim().toLowerCase(); }
  function save(){ try { saveState?.(); } catch(e){} }

  function rows(){
    state.userPayoutMethods ||= state.payoutMethods || [];
    state.payoutMethods = state.userPayoutMethods;
    return state.userPayoutMethods.map(m => {
      const type = String(m.type||m.method_type||m.method||"UPI").toUpperCase()==="BANK" ? "BANK" : "UPI";
      return {
        id:String(m.id||""), userId:String(m.userId||m.user_id||""), userEmail:String(m.userEmail||m.user_email||""),
        type, upi:String(m.upi||m.upi_id||""), holderName:String(m.holderName||m.holder_name||""),
        kycName:String(m.kycName||m.kyc_name_snapshot||""), bankName:String(m.bankName||m.bank_name||""),
        accountNumber:String(m.accountNumber||m.account_number||""), ifsc:String(m.ifsc||""),
        status:String(m.status||"PENDING").toUpperCase(), createdAt:String(m.createdAt||m.created_at_text||m.created_at||"")
      };
    });
  }
  function merge(dbRows){
    const map = new Map();
    rows().forEach(r => map.set(r.id, r));
    (dbRows||[]).forEach(m => {
      const id = String(m.id||("pm_"+Date.now()+"_"+Math.random()));
      map.set(id, {
        id, userId:String(m.user_id||m.userId||""), userEmail:String(m.user_email||m.userEmail||""),
        type:String(m.method_type||m.type||"UPI").toUpperCase()==="BANK" ? "BANK" : "UPI",
        upi:String(m.upi_id||m.upi||""), holderName:String(m.holder_name||m.holderName||""),
        kycName:String(m.kyc_name_snapshot||m.kycName||""), bankName:String(m.bank_name||m.bankName||""),
        accountNumber:String(m.account_number||m.accountNumber||""), ifsc:String(m.ifsc||""),
        status:String(m.status||"PENDING").toUpperCase(), createdAt:String(m.created_at_text||m.created_at||m.createdAt||"")
      });
    });
    state.userPayoutMethods = Array.from(map.values());
    state.payoutMethods = state.userPayoutMethods;
    save();
  }
  async function load(){
    const db=c(); if(!db) return;
    try {
      let r = await db.from("user_payout_methods").select("*").order("created_at",{ascending:false});
      if(r.error) r = await db.from("user_payout_methods").select("*");
      if(!r.error) merge(r.data||[]);
    } catch(e){ console.warn("Payout stable load failed", e); }
  }
  function badge(x){ x=String(x||"PENDING").toUpperCase(); return `<span class="aps-table-status ${x.toLowerCase()}">${x}</span>`; }
  function mask(m){ return m.type==="UPI" ? (m.upi||"-") : `${m.bankName||"Bank"} ${m.accountNumber ? "****"+String(m.accountNumber).slice(-4) : ""}`; }
  function filtered(){
    const q=norm(ps.search);
    return rows().filter(m => {
      const stOk = ps.status==="ALL" || m.status===ps.status;
      const typeOk = ps.type==="ALL" || m.type===ps.type;
      const text = norm([m.userEmail,m.userId,m.type,m.upi,m.holderName,m.kycName,m.bankName,m.accountNumber,m.ifsc].join(" "));
      return stOk && typeOk && (!q || text.includes(q));
    }).sort((a,b)=>(Date.parse(b.createdAt)||Number(String(b.id).replace(/\D/g,""))||0)-(Date.parse(a.createdAt)||Number(String(a.id).replace(/\D/g,""))||0));
  }
  function toolbar(){
    return `<div class="aps-table-toolbar">
      <div><span>User Security</span><b>Payout Method Requests</b><small>Approve only if holder name matches approved KYC name.</small></div>
      <input id="apsPayoutSearch" placeholder="Search user, name, UPI, bank..." value="${ps.search.replace(/"/g,"&quot;")}">
      <select id="apsPayoutStatus">
        <option value="ALL" ${ps.status==="ALL"?"selected":""}>All Status</option>
        <option value="PENDING" ${ps.status==="PENDING"?"selected":""}>Pending</option>
        <option value="APPROVED" ${ps.status==="APPROVED"?"selected":""}>Approved</option>
        <option value="REJECTED" ${ps.status==="REJECTED"?"selected":""}>Rejected</option>
      </select>
      <select id="apsPayoutType">
        <option value="ALL" ${ps.type==="ALL"?"selected":""}>All Type</option>
        <option value="UPI" ${ps.type==="UPI"?"selected":""}>UPI</option>
        <option value="BANK" ${ps.type==="BANK"?"selected":""}>Bank</option>
      </select>
    </div>`;
  }
  function pager(total){
    const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
    ps.page=Math.min(Math.max(1,ps.page),pages);
    const start=total?((ps.page-1)*PAGE_SIZE)+1:0, end=Math.min(total,ps.page*PAGE_SIZE);
    return `<div class="aps-table-pager">
      <span>Showing ${start}–${end} of ${total}</span>
      <div>
        <button type="button" data-aps-page="prev" ${ps.page<=1?"disabled":""}>Previous</button>
        <b>Page ${ps.page} of ${pages}</b>
        <button type="button" data-aps-page="next" ${ps.page>=pages?"disabled":""}>Next</button>
      </div>
    </div>`;
  }
  function table(){
    const list=filtered(), pageRows=list.slice((ps.page-1)*PAGE_SIZE, ps.page*PAGE_SIZE);
    return `${toolbar()}
      <div class="aps-table-wrap">
        <table class="aps-payout-table">
          <thead><tr><th>User</th><th>Type</th><th>Method</th><th>Holder</th><th>KYC Name</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            ${pageRows.length ? pageRows.map(m => `<tr>
              <td>${m.userEmail||m.userId||"-"}</td>
              <td>${m.type}</td>
              <td>${mask(m)}</td>
              <td>${m.holderName||"-"}</td>
              <td>${m.kycName||"-"}</td>
              <td>${badge(m.status)}</td>
              <td>
                <button class="aps-view-btn" onclick="viewPayoutDetails('${m.id}')">View</button>
                ${m.status==="PENDING" ? `<button class="approve-btn" onclick="approvePayoutMethod('${m.id}')">Approve</button><button class="reject-btn" onclick="rejectPayoutMethod('${m.id}')">Reject</button>` : `<span class="aps-locked">Locked</span>`}
                <button class="aps-delete-btn" onclick="deletePayoutMethod('${m.id}')">Delete</button>
              </td>
            </tr>`).join("") : `<tr><td colspan="7" class="empty">No payout method requests found.</td></tr>`}
          </tbody>
        </table>
      </div>
      ${pager(list.length)}
      <div id="apsPayoutDetails" class="aps-payout-details"></div>`;
  }
  function detail(id){
    const m=rows().find(x=>String(x.id)===String(id));
    const root=document.getElementById("apsPayoutDetails") || document.getElementById("adminPayoutDetails");
    if(!root || !m) return;
    root.innerHTML=`<div class="card aps-detail-card">
      <div class="aps-detail-head"><div><span>PAYOUT DETAILS</span><h3>${m.type} Method</h3><p>${m.userEmail||m.userId||"-"}</p></div>${badge(m.status)}</div>
      <div class="aps-detail-grid">
        <div><span>Type</span><b>${m.type}</b></div><div><span>Method</span><b>${mask(m)}</b></div>
        <div><span>Holder Name</span><b>${m.holderName||"-"}</b></div><div><span>KYC Name</span><b>${m.kycName||"-"}</b></div>
        <div><span>Name Match</span><b>${norm(m.holderName)===norm(m.kycName)?"YES":"NO"}</b></div><div><span>Date</span><b>${m.createdAt||"-"}</b></div>
      </div>
      <div class="aps-detail-actions">
        ${m.status==="PENDING" ? `<button class="approve-btn" onclick="approvePayoutMethod('${m.id}')">Approve</button><button class="reject-btn" onclick="rejectPayoutMethod('${m.id}')">Reject</button>` : `<span class="aps-locked">Action Locked</span>`}
        <button class="aps-delete-btn" onclick="deletePayoutMethod('${m.id}')">Delete Method</button>
      </div>
    </div>`;
  }
  async function setStatus(id,x){
    const m=state.userPayoutMethods?.find(v=>String(v.id)===String(id)); if(m) m.status=x;
    const db=c(); if(db){ try{ let r=await db.from("user_payout_methods").update({status:x,reviewed_at:new Date().toISOString()}).eq("id",id); if(r.error) await db.from("user_payout_methods").update({status:x}).eq("id",id); }catch(e){} }
    save(); render(); setTimeout(()=>detail(id),50);
  }
  async function del(id){
    if(!confirm("Delete this payout method? User can add a new method again.")) return;
    state.userPayoutMethods=(state.userPayoutMethods||[]).filter(m=>String(m.id)!==String(id));
    state.payoutMethods=state.userPayoutMethods;
    const db=c(); if(db){ try{ await db.from("user_payout_methods").delete().eq("id",id); }catch(e){} }
    save(); render();
  }
  function content(){
    const el=document.getElementById("apsContent");
    return el;
  }
  function render(){
    const el=content();
    if(el && document.body.classList.contains("aps-page-open")) {
      const title=document.getElementById("apsTitle");
      const label=document.getElementById("apsLabel");
      if(title && title.textContent.toLowerCase().includes("payout")) {
        title.textContent="Payout Method Requests";
        if(label) label.textContent="User Security";
        el.innerHTML=table();
        bind();
      }
    }
  }
  function bind(){
    const s=document.getElementById("apsPayoutSearch"), stSel=document.getElementById("apsPayoutStatus"), ty=document.getElementById("apsPayoutType");
    if(s&&!s.dataset.bound){s.dataset.bound=1; s.addEventListener("input",()=>{ps.search=s.value; ps.page=1; render();});}
    if(stSel&&!stSel.dataset.bound){stSel.dataset.bound=1; stSel.addEventListener("change",()=>{ps.status=stSel.value; ps.page=1; render();});}
    if(ty&&!ty.dataset.bound){ty.dataset.bound=1; ty.addEventListener("change",()=>{ps.type=ty.value; ps.page=1; render();});}
  }
  function patch(){
    window.viewPayoutDetails=detail;
    window.approvePayoutMethod=(id)=>setStatus(id,"APPROVED");
    window.rejectPayoutMethod=(id)=>setStatus(id,"REJECTED");
    window.deletePayoutMethod=del;
    window.renderPayoutStableTable=render;
  }
  document.addEventListener("click",function(e){
    const pg=e.target.closest("[data-aps-page]");
    if(pg){ ps.page += pg.dataset.apsPage==="next" ? 1 : -1; render(); return; }
    const btn=e.target.closest("[data-admin-stable-pay]");
    if(btn && btn.dataset.adminStablePay==="payout"){ setTimeout(()=>load().then(render),120); setTimeout(render,700); }
  },true);
  function boot(){ patch(); load().then(render); }
  document.addEventListener("DOMContentLoaded",()=>setTimeout(boot,1000));
  window.addEventListener("load",()=>{setTimeout(boot,1200);setTimeout(()=>load().then(render),2500);});
})();


/* ===== ADMIN PAYOUT TABLE SAFETY RERENDER ===== */
(function(){
  function rerenderPayoutTable(){
    try { window.renderPayoutStableTable?.(); } catch(e){}
  }
  document.addEventListener("click", function(e){
    const btn = e.target.closest("[data-admin-stable-pay]");
    if (btn && btn.dataset.adminStablePay === "payout") {
      setTimeout(rerenderPayoutTable, 180);
      setTimeout(rerenderPayoutTable, 700);
      setTimeout(rerenderPayoutTable, 1400);
    }
  }, true);
  window.addEventListener("load", () => setTimeout(rerenderPayoutTable, 1600));
})();
