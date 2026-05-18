
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
    amount, entry: priceOf(coin), current: priceOf(coin), leverage: getLeverageSafe(),
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
  if ($("userManagedTradesLog")) $("userManagedTradesLog").innerHTML = managed.map(t => `<tr><td>${t.coin?.replace("USDT","/USDT")}</td><td>${t.side}</td><td>${money(t.amount)}</td><td>${usd(t.entry)}</td><td>${usd(t.close)}</td><td class="${t.pnl>=0?'pnl-plus':'pnl-minus'}">${money(t.pnl)}</td><td>${t.status}</td></tr>`).join("") || `<tr><td colspan="7" class="empty">No closed AI/AI trades yet.</td></tr>`;
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
    <div class="real-tv-chart-shell">
      <div class="real-tv-chart-head">
        <div>
          <b>${coin.replace("USDT", "/USDT")}</b>
          <span>Live TradingView Chart</span>
        </div>
        <strong id="realChartLivePrice">${rcUsd(rcPrice(coin))}</strong>
      </div>
      <iframe
        title="TradingView ${coin}"
        class="real-tv-chart-frame"
        src="https://s.tradingview.com/widgetembed/?frameElementId=tradingview_${coin}&symbol=${encodeURIComponent(symbol)}&interval=1&hidesidetoolbar=1&symboledit=1&saveimage=0&toolbarbg=0b1220&studies=[]&theme=dark&style=1&timezone=Asia%2FKolkata&withdateranges=1&hideideas=1"
        allowtransparency="true"
        scrolling="no"
        frameborder="0">
      </iframe>
    </div>
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


/* Admin mass trade advanced field bridge */
function patchMassAdvancedBridge() {
  const btn = document.getElementById("openMassTradeBtn");
  if (btn && !btn.dataset.massAdvancedBound) {
    btn.dataset.massAdvancedBound = "1";
    btn.addEventListener("click", function(){
      const mt = document.getElementById("massTradeOrderType")?.value;
      const ml = document.getElementById("massTradeLeverage")?.value;
      if (document.getElementById("managedOrderType") && mt) document.getElementById("managedOrderType").value = mt;
      if (document.getElementById("managedLeverage") && ml) document.getElementById("managedLeverage").value = ml;
    }, true);
  }
}
setInterval(patchMassAdvancedBridge, 1000);


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
      await supabaseClient.from("payment_requests").insert({
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


/* ===== USER WALLET PERCENT AI TRADE FIX ===== */
function pctUserId(u = state.user) {
  return String(u?.id || u?.email || "local");
}

function pctMoney(n) {
  try { if (typeof money === "function") return money(n); } catch(e) {}
  return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function pctRealWalletForUser(u) {
  if (!u) return 0;
  const uid = String(u.id || u.email || "");
  try {
    if (typeof realWallet === "function") return Number(realWallet(uid) || 0);
  } catch(e) {}

  const dep = (state.depositRequests || [])
    .filter(d => String(d.userId || d.user_id || "") === uid && String(d.status || "").toUpperCase() === "APPROVED")
    .reduce((a, d) => a + Number(d.amount || 0), 0);

  const led = (state.walletLedger || [])
    .filter(l => String(l.userId || l.user_id || "") === uid)
    .reduce((a, l) => a + Number(l.amount || 0), 0);

  return Math.max(0, dep + led);
}

function pctGetUserPercent(u = state.user) {
  const p = Number(u?.aiTradePercent || u?.ai_trade_percent || 25);
  return [25, 50, 75, 100].includes(p) ? p : 25;
}

function pctSetUserPercent(percent) {
  percent = Number(percent || 25);
  if (![25,50,75,100].includes(percent)) percent = 25;
  if (!state.user) return;

  state.user.aiTradePercent = percent;
  state.user.ai_trade_percent = percent;

  const u = (state.users || []).find(x =>
    String(x.id || "") === String(state.user.id || "") ||
    String(x.email || "").toLowerCase() === String(state.user.email || "").toLowerCase()
  );
  if (u) {
    u.aiTradePercent = percent;
    u.ai_trade_percent = percent;
  }

  if (typeof supabaseClient !== "undefined" && supabaseClient && state.user.id) {
    supabaseClient.from("profiles").update({ ai_trade_percent: percent }).eq("id", state.user.id)
      .then(() => {})
      .catch(e => console.warn("ai_trade_percent save failed", e));
  }

  try { saveSession?.(); } catch(e) {}
  try { saveState?.(); } catch(e) {}
  renderAiPercentSettings();
}

function pctSetAutoTrade(enabled) {
  if (!state.user) return;
  state.user.autoTradePermission = !!enabled;
  const u = (state.users || []).find(x =>
    String(x.id || "") === String(state.user.id || "") ||
    String(x.email || "").toLowerCase() === String(state.user.email || "").toLowerCase()
  );
  if (u) u.autoTradePermission = !!enabled;

  if (typeof supabaseClient !== "undefined" && supabaseClient && state.user.id) {
    supabaseClient.from("profiles").update({ auto_trade_permission: !!enabled }).eq("id", state.user.id)
      .then(() => {})
      .catch(e => console.warn("auto_trade_permission save failed", e));
  }
  try { saveSession?.(); } catch(e) {}
  try { saveState?.(); } catch(e) {}
}

function pctTradeAmountForUser(u) {
  const percent = pctGetUserPercent(u);
  const wallet = pctRealWalletForUser(u);
  return Math.floor((wallet * percent / 100) * 100) / 100;
}

function renderAiPercentSettings() {
  try {
    if (!state.user || state.user.role === "admin") return;
    const percent = pctGetUserPercent(state.user);
    const amount = pctTradeAmountForUser(state.user);

    document.querySelectorAll("[data-ai-percent]").forEach(btn => {
      btn.classList.toggle("active", Number(btn.dataset.aiPercent) === percent);
    });

    const pctText = document.getElementById("aiTradePercentText");
    if (pctText) pctText.textContent = percent + "%";

    const amtText = document.getElementById("aiTradeAmountPreview");
    if (amtText) amtText.textContent = "AI trade amount: " + pctMoney(amount);

    const toggle = document.getElementById("userAutoAdminTradeToggle");
    if (toggle) toggle.checked = state.user.autoTradePermission !== false;
  } catch(e) {}
}

document.addEventListener("click", function(e) {
  const btn = e.target.closest("[data-ai-percent]");
  if (!btn) return;
  e.preventDefault();
  pctSetUserPercent(Number(btn.dataset.aiPercent || 25));
}, true);

document.addEventListener("change", function(e) {
  if (e.target && e.target.id === "userAutoAdminTradeToggle") {
    pctSetAutoTrade(e.target.checked);
  }
}, true);

setInterval(renderAiPercentSettings, 1500);
window.addEventListener("load", () => setTimeout(renderAiPercentSettings, 800));

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
  const leverage = Number(document.getElementById("massTradeLeverage")?.value || document.getElementById("managedLeverage")?.value || 1);
  const orderType = document.getElementById("massTradeOrderType")?.value || document.getElementById("managedOrderType")?.value || "MARKET";

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


/* Admin page guest/demo guard */
document.addEventListener("click", function(e){
  if ((window.FORCE_ADMIN_PAGE || document.body?.dataset?.adminPage === "true") && e.target.closest("#guestBtn")) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    alert("Admin page पर guest/demo login allowed नहीं है.");
    return false;
  }
}, true);


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
