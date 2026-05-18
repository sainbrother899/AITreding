const CONFIG = window.APP_CONFIG || {};
const IS_ADMIN_PAGE = document.body?.dataset?.adminPage === "true";
const MIN_DEPOSIT_AMOUNT = 1000;
const MIN_WITHDRAW_AMOUNT = 1000;
let supabaseClient = null;

if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY && window.supabase) {
  supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
}

const STORAGE_KEY = "ai_trading_final_v4";
const USER_SESSION_KEY = "ai_trading_user_session_v1";
const ADMIN_SESSION_KEY = "ai_trading_admin_session_v1";

const defaultAdmin = {
  id: "admin-local",
  name: "Admin",
  email: CONFIG.ADMIN_EMAIL || "admin@aitrade.local",
  mobile: "",
  password: CONFIG.ADMIN_PASSWORD || "admin123",
  role: "admin",
  plan: "Elite",
  referralCode: "ADMINAI",
  referredBy: ""
};

const defaultState = {
  user: null,
  users: [defaultAdmin],
  mode: "DEMO",
  demoBalance: 10000,
  realBalance: 0,
  signalsUsed: 0,
  freeSignalLimit: 5,
  accounts: {
    DEMO: { balance: 10000, signalsUsed: 0, trades: [], closedTrades: [], recentFills: [] },
    REAL: { balance: 0, signalsUsed: 0, trades: [], closedTrades: [], recentFills: [] }
  },
  signal: "BUY",
  note: "AI engine combined signal.",
  signalCoin: "BTCUSDT",
  entryPrice: "",
  targetPrice: "",
  stopLoss: "",
  confidence: 70,
  riskLevel: "MEDIUM",
  signalExpiry: "30 minutes",
  trades: [],
  paymentRequests: [],
  depositRequests: [],
  withdrawalRequests: [],
  realTradeVolumeTotal: 0,
  realProfitTotal: 0,
  realApprovedDepositTotal: 0,
  closedTrades: [],
  recentFills: [],
  selectedPaymentPlan: "Pro",
  referrals: [],
  kycRequests: [],
  plans: [
    { id: "free", name: "Free", price: 0, duration: "Lifetime", signalLimit: 5, aiTradeLimit: 5, features: ["5 signals/day", "Demo dashboard", "Live prices"], active: true },
    { id: "pro", name: "Pro", price: 499, duration: "30 days", signalLimit: 50, aiTradeLimit: 10, features: ["50 signals/day", "Advanced AI indicator", "Referral bonus tracking"], active: true },
    { id: "elite", name: "Elite", price: 999, duration: "30 days", signalLimit: 999999, aiTradeLimit: 25, features: ["Unlimited signals UI", "PnL analytics", "Priority dashboard"], active: true }
  ],
  aiTradeUsage: {},
  managedTrades: [],
  autoTradePermission: true,
  prices: {}
};

let state = loadState();
normalizeAccounts();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const merged = { ...defaultState, ...(saved || {}) };
    if (!merged.users.some(u => u.email === defaultAdmin.email)) merged.users.unshift(defaultAdmin);
    return merged;
  } catch {
    return { ...defaultState };
  }
}

function saveState() {
  normalizeAccounts();
  if (typeof syncAccountBackups === "function") syncAccountBackups();
  state.demoBalance = state.accounts.DEMO.balance;
  state.realBalance = state.accounts.REAL.balance;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getSessionKey() {
  return IS_ADMIN_PAGE ? ADMIN_SESSION_KEY : USER_SESSION_KEY;
}

function saveCurrentSession() {
  if (state.user) localStorage.setItem(getSessionKey(), JSON.stringify(state.user));
}

function loadCurrentSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(getSessionKey()));
    return saved || null;
  } catch {
    return null;
  }
}

function clearCurrentSession() {
  localStorage.removeItem(getSessionKey());
}

function $(id) { return document.getElementById(id); }

function money(v) {
  return "$" + Number(v || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function rupee(v) {
  return "₹" + Number(v || 0).toLocaleString("en-IN");
}

function toast(msg) {
  const el = $("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
}

function makeReferralCode(name) {
  return (name || "USER").replace(/[^a-z0-9]/gi, "").slice(0, 5).toUpperCase() + Math.floor(1000 + Math.random() * 9000);
}

function getCurrentUserFull() {
  return state.users.find(u => u.id === state.user?.id) || state.user;
}

function getPlan() {
  return getCurrentUserFull()?.plan || state.user?.plan || "Free";
}

function normalizeAccounts() {
  if (!state.accounts) {
    state.accounts = {
      DEMO: { balance: Number(state.demoBalance || 10000), signalsUsed: 0, trades: [], closedTrades: [], recentFills: [] },
      REAL: { balance: Number(state.realBalance || 0), signalsUsed: 0, trades: [], closedTrades: [], recentFills: [] }
    };
  }

  if (!state.accounts.DEMO) state.accounts.DEMO = { balance: 10000, signalsUsed: 0, trades: [], closedTrades: [], recentFills: [] };
  if (!state.accounts.REAL) state.accounts.REAL = { balance: 0, signalsUsed: 0, trades: [], closedTrades: [], recentFills: [] };

  for (const key of ["DEMO", "REAL"]) {
    state.accounts[key].balance = Number(state.accounts[key].balance || 0);
    state.accounts[key].signalsUsed = Number(state.accounts[key].signalsUsed || 0);
    state.accounts[key].trades = state.accounts[key].trades || [];
    state.accounts[key].closedTrades = state.accounts[key].closedTrades || [];
    state.accounts[key].recentFills = state.accounts[key].recentFills || [];
  }

  // One-time migration from older build fields into DEMO account, only if account has no trades.
  if ((state.trades || []).length && state.accounts.DEMO.trades.length === 0) {
    state.accounts.DEMO.trades = state.trades;
  }
  if ((state.closedTrades || []).length && state.accounts.DEMO.closedTrades.length === 0) {
    state.accounts.DEMO.closedTrades = state.closedTrades;
  }
}

function currentAccount() {
  normalizeAccounts();
  return state.accounts[state.mode === "REAL" ? "REAL" : "DEMO"];
}

function accountLabel() {
  return state.mode === "REAL" ? "Real Account" : "Demo Account";
}




function todayKey() { return new Date().toISOString().slice(0, 10); }

function getPlanObjectByName(planName = getPlan()) {
  const plans = state.plans || [];
  return plans.find(p => p.name === planName) || plans.find(p => p.id === String(planName).toLowerCase()) || null;
}

function aiTradeDailyLimit(planName = getPlan()) {
  const plan = getPlanObjectByName(planName);
  if (plan && plan.aiTradeLimit !== undefined) return Number(plan.aiTradeLimit || 0);
  if (plan && plan.ai_trade_limit !== undefined) return Number(plan.ai_trade_limit || 0);
  if (!planName || String(planName).toLowerCase() === "free") return 5;
  return 5;
}

function aiUsageKey(userId = state.user?.id || "local", mode = state.mode || "DEMO") {
  return `${userId}_${mode}_${todayKey()}`;
}

function aiTradesUsedToday(userId = state.user?.id || "local", mode = state.mode || "DEMO") {
  state.aiTradeUsage = state.aiTradeUsage || {};
  return Number(state.aiTradeUsage[aiUsageKey(userId, mode)] || 0);
}

function decrementAiTradeUsage(userId = state.user?.id || "local", mode = state.mode || "DEMO") {
  state.aiTradeUsage = state.aiTradeUsage || {};
  const key = aiUsageKey(userId, mode);
  state.aiTradeUsage[key] = Math.max(0, Number(state.aiTradeUsage[key] || 0) - 1);
}

function incrementAiTradeUsage(userId = state.user?.id || "local", mode = state.mode || "DEMO") {
  state.aiTradeUsage = state.aiTradeUsage || {};
  const key = aiUsageKey(userId, mode);
  state.aiTradeUsage[key] = Number(state.aiTradeUsage[key] || 0) + 1;
}

function canReceiveAiTrade(user, mode = "REAL") {
  const planName = user?.plan || "Free";
  const limit = aiTradeDailyLimit(planName);
  const used = aiTradesUsedToday(user?.id || "local", mode);
  const auto = user?.autoTradePermission !== false;
  return auto && used < limit;
}

function currentAiTradeLimitText() { return aiTradeDailyLimit(getPlan()); }


function signalLimit() {
  const p = getPlan();
  const plan = (state.plans || []).find(x => x.name === p && x.active !== false);
  if (plan) {
    if (Number(plan.signalLimit) >= 999999) return "∞";
    return Number(plan.signalLimit || state.freeSignalLimit || 5);
  }
  if (p === "Elite") return "∞";
  if (p === "Pro") return 50;
  return Number(state.freeSignalLimit || 5);
}

function numericSignalLimit() {
  const l = signalLimit();
  return l === "∞" ? 999999 : Number(l);
}

async function register() {
  const name = $("regName")?.value.trim();
  const email = $("regEmail")?.value.trim().toLowerCase();
  const mobile = $("regMobile")?.value.trim();
  const password = $("regPassword")?.value;
  const referredBy = $("regReferral")?.value.trim().toUpperCase();

  if (!name || !email || !mobile || !password) {
    toast("All register fields required.");
    return;
  }

  if (state.users.some(u => u.email === email)) {
    toast("Email already registered on this browser.");
    return;
  }

  let id = "u_" + Date.now();

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { name, mobile } }
      });

      if (error) {
        toast(error.message || "Supabase signup failed.");
        return;
      }

      id = data.user?.id || id;
    } catch (e) {
      toast("Supabase signup error. Check URL/key/SQL.");
      return;
    }
  }

  const user = {
    id,
    name,
    email,
    mobile,
    password,
    role: "user",
    plan: "Free",
    referralCode: makeReferralCode(name),
    referredBy
  };

  state.users.push(user);

  if (referredBy) {
    const ref = { code: referredBy, userEmail: email, bonus: 50, status: "JOINED" };
    state.referrals.push(ref);
    await saveReferralToSupabase(ref);
  }

  await saveProfileToSupabase(user);

  state.user = { ...user, password: undefined };
  saveCurrentSession();
  saveState();
  showApp();
  toast("Account created.");
}

async function login() {
  const email = $("loginEmail")?.value.trim().toLowerCase();
  const password = $("loginPassword")?.value;

  if (!email || !password) {
    toast("Email and password required.");
    return;
  }

  const localUser = state.users.find(u => u.email === email && u.password === password);

  if (localUser) {
    if (IS_ADMIN_PAGE && localUser.role !== "admin") {
      toast("Only admin can login on this page.");
      return;
    }
    if (!IS_ADMIN_PAGE && localUser.role === "admin") {
      toast("Admin login is separate. Open admin.html");
      return;
    }

    state.user = { ...localUser, password: undefined };
    if (typeof localUser.realBalance === "number") {
      normalizeAccounts();
      state.accounts.REAL.balance = localUser.realBalance;
      state.realBalance = localUser.realBalance;
    }
    saveCurrentSession();
    saveState();
    await loadRemoteData();
    showApp();
    toast(localUser.role === "admin" ? "Admin logged in." : "Logged in.");
    return;
  }

  if (!supabaseClient) {
    toast("Invalid login details.");
    return;
  }

  if (IS_ADMIN_PAGE) {
    toast("Admin login uses local admin credentials only.");
    return;
  }

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      toast(error?.message || "Invalid login details.");
      return;
    }

    let profile = null;
    const { data: profileRows } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .limit(1);

    if (profileRows && profileRows[0]) {
      profile = profileRows[0];
    }

    const user = {
      id: data.user.id,
      name: profile?.name || data.user.user_metadata?.name || email.split("@")[0],
      email: data.user.email,
      mobile: profile?.mobile || "",
      role: profile?.role || "user",
      plan: profile?.plan || "Free",
      referralCode: profile?.referral_code || makeReferralCode(email),
      referredBy: profile?.referred_by || ""
    };

    if (!state.users.some(u => u.id === user.id)) state.users.push({ ...user, password: "" });
    state.user = user;
    saveCurrentSession();
    saveState();
    await loadRemoteData();
    showApp();
    toast("Logged in.");
  } catch (e) {
    toast("Login error. Check Supabase setup.");
  }
}

function guestLogin() {
  if (IS_ADMIN_PAGE) return;
  let user = state.users.find(u => u.email === "demo@user.local");
  if (!user) {
    user = {
      id: "guest",
      name: "Demo User",
      email: "demo@user.local",
      mobile: "",
      password: "demo",
      role: "user",
      plan: "Free",
      referralCode: "DEMO1234",
      referredBy: ""
    };
    state.users.push(user);
  }
  state.user = { ...user, password: undefined };
  saveCurrentSession();
  saveState();
  showApp();
  toast("Demo user started.");
}

async function logout() {
  if (supabaseClient && state.user?.role !== "admin") {
    try { await supabaseClient.auth.signOut(); } catch {}
  }
  state.user = null;
  clearCurrentSession();
  saveState();
  $("authPage")?.classList.remove("hidden");
  $("appPage")?.classList.add("hidden");
  $("logoutBtn")?.classList.add("hidden");
  if ($("userBadge")) $("userBadge").textContent = "Guest";
}

async function saveProfileToSupabase(user) {
  if (!supabaseClient) return;
  try {
    await supabaseClient.from("profiles").upsert({
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role || "user",
      plan: user.plan || "Free",
      referral_code: user.referralCode,
      referred_by: user.referredBy || ""
    });
  } catch (e) {
    console.warn("Supabase profile save failed", e);
  }
}

async function saveReferralToSupabase(ref) {
  if (!supabaseClient) return;
  try {
    await supabaseClient.from("referrals").insert({
      referral_code: ref.code,
      joined_user_email: ref.userEmail,
      bonus: ref.bonus,
      status: ref.status
    });
  } catch (e) {
    console.warn("Supabase referral save failed", e);
  }
}


async function addWalletLedgerEntry(type, amount, note = "") {
  if (!supabaseClient || !state.user?.id || state.user?.role === "admin") return;

  try {
    await supabaseClient.from("wallet_ledger").insert({
      user_id: state.user.id,
      type,
      amount: Number(amount || 0),
      note
    });
  } catch (e) {
    console.warn("Wallet ledger insert failed", e);
  }
}

async function recalcRealBalanceFromLedger() {
  if (!supabaseClient || !state.user?.id || state.user?.role === "admin") return;

  try {
    const { data: ledgerRows, error } = await supabaseClient
      .from("wallet_ledger")
      .select("amount,type")
      .eq("user_id", state.user.id);

    if (error) return;

    const total = (ledgerRows || []).reduce((a, x) => a + Number(x.amount || 0), 0);

    normalizeAccounts();
    state.accounts.REAL.balance = total;
    state.realBalance = total;
    saveState();
  } catch (e) {
    console.warn("Wallet ledger recalc failed", e);
  }
}



async function fetchSupabaseProfilesForAdmin() {
  if (!supabaseClient) return;
  try {
    const { data: profiles } = await supabaseClient
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profiles && profiles.length) {
      const existing = state.users || [];
      const byKey = new Map(existing.map(u => [String(u.id || u.email), u]));
      profiles.forEach(p => {
        const id = String(p.id || p.user_id || p.email || "");
        const current = byKey.get(id) || {};
        byKey.set(id, {
          ...current,
          id: p.id || p.user_id || current.id || p.email,
          name: p.name || current.name || (p.email ? String(p.email).split("@")[0] : "User"),
          email: p.email || current.email || "",
          mobile: p.mobile || current.mobile || "",
          role: p.role || current.role || "user",
          plan: p.plan || current.plan || "Free",
          autoTradePermission: current.autoTradePermission !== false
        });
      });
      state.users = Array.from(byKey.values());
    }
  } catch (e) {
    console.warn("Profiles fetch failed", e);
  }
}

async function loadRemoteData() {
  if (!supabaseClient) return;
  await fetchSupabaseProfilesForAdmin();

  try {
    const { data: payments } = await supabaseClient
      .from("payment_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (payments) {
      state.paymentRequests = payments.map(p => ({
        id: String(p.id),
        userId: p.user_id,
        plan: p.plan,
        name: p.name,
        mobile: p.mobile,
        txn: p.txn,
        screenshot: p.screenshot_url || "Not uploaded",
        status: p.status || "PENDING"
      }));
    }
  } catch (e) {
    console.warn("Payment fetch failed", e);
  }

  try {
    const { data: deposits } = await supabaseClient
      .from("deposit_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (deposits) {
      state.depositRequests = deposits.map(d => ({
        id: String(d.id),
        userId: d.user_id,
        userEmail: d.user_email || "",
        amount: Number(d.amount || 0),
        txn: d.txn,
        screenshot: d.screenshot_url || "Not uploaded",
        status: d.status || "PENDING",
        date: d.created_at ? new Date(d.created_at).toLocaleString() : ""
      }));
    }
  } catch (e) {
    console.warn("Deposit fetch failed", e);
  }

  try {
    const { data: withdrawals } = await supabaseClient
      .from("withdrawal_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (withdrawals) {
      state.withdrawalRequests = withdrawals.map(w => ({
        id: String(w.id),
        userId: w.user_id,
        userEmail: w.user_email || "",
        amount: Number(w.amount || 0),
        method: w.method || "UPI",
        account: w.account || "",
        name: w.name || "",
        ifsc: w.ifsc || "",
        status: w.status || "PENDING",
        date: w.created_at ? new Date(w.created_at).toLocaleString() : ""
      }));
    }
  } catch (e) {
    console.warn("Withdrawal fetch failed", e);
  }

  try {
    const { data: remotePlans } = await supabaseClient
      .from("subscription_plans")
      .select("*")
      .order("price", { ascending: true });

    if (remotePlans && remotePlans.length) {
      state.plans = remotePlans.map(p => ({
        id: String(p.id),
        name: p.name,
        price: Number(p.price || 0),
        duration: p.duration || "30 days",
        signalLimit: Number(p.signal_limit || 5),
        aiTradeLimit: Number(p.ai_trade_limit || 5),
        features: Array.isArray(p.features) ? p.features : String(p.features || "").split("\n").filter(Boolean),
        active: p.active !== false
      }));
    }
  } catch (e) {
    console.warn("Plans fetch failed", e);
  }

  try {
    const { data: kycRows } = await supabaseClient
      .from("kyc_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (kycRows) {
      state.kycRequests = kycRows.map(k => ({
        id: String(k.id),
        userId: k.user_id,
        userEmail: k.user_email || "",
        name: k.name,
        mobile: k.mobile,
        docType: k.doc_type,
        docNumber: k.doc_number,
        frontFile: k.front_file || "",
        selfieFile: k.selfie_file || "",
        status: k.status || "PENDING",
        date: k.created_at ? new Date(k.created_at).toLocaleString() : ""
      }));
    }
  } catch (e) {
    console.warn("KYC fetch failed", e);
  }

  
  try {
    const { data: managedRows } = await supabaseClient
      .from("managed_trades")
      .select("*")
      .order("created_at", { ascending: false });

    if (managedRows) {
      state.managedTrades = managedRows.map(mapManagedTradeRow);
    }
  } catch (e) {
    console.warn("Managed trades fetch failed", e);
  }

try {
    const { data: refs } = await supabaseClient.from("referrals").select("*");
    if (refs) {
      state.referrals = refs.map(r => ({
        code: r.referral_code,
        userEmail: r.joined_user_email,
        bonus: Number(r.bonus || 0),
        status: r.status
      }));
    }
  } catch (e) {
    console.warn("Referral fetch failed", e);
  }

  try {
    if (state.user?.id && state.user?.role !== "admin") {
      const { data: profiles } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", state.user.id)
        .limit(1);

      if (profiles && profiles[0]) {
        const p = profiles[0];
        state.user.plan = p.plan || state.user.plan || "Free";
        state.user.referralCode = p.referral_code || state.user.referralCode;
      }

      const { data: ledgerRows } = await supabaseClient
        .from("wallet_ledger")
        .select("amount,type")
        .eq("user_id", state.user.id);

      if (ledgerRows) {
        const depositTotal = ledgerRows
          .filter(x => x.type === "DEPOSIT")
          .reduce((a, x) => a + Number(x.amount || 0), 0);
        normalizeAccounts();
        state.accounts.REAL.balance = depositTotal;
        state.realBalance = depositTotal;
      }
    }
  } catch (e) {
    console.warn("Profile/wallet refresh failed", e);
  }

  saveState();
}

function showApp() {
  $("authPage")?.classList.add("hidden");
  $("appPage")?.classList.remove("hidden");
  $("logoutBtn")?.classList.remove("hidden");

  if ($("userBadgeText")) $("userBadgeText").textContent = state.user?.name || "User";
  else if ($("userBadge")) $("userBadge").textContent = "User: " + (state.user?.name || "");
  if ($("userAvatar")) $("userAvatar").textContent = (state.user?.name || "U").slice(0,1).toUpperCase();
  if ($("userVipBadge")) $("userVipBadge").textContent = getPlan().toUpperCase();

  const adminNav = $("adminNavBtn");
  if (adminNav) adminNav.classList.toggle("hidden", state.user?.role !== "admin");

  const refCode = $("myReferralCode");
  if (refCode) refCode.textContent = state.user?.referralCode || "----";

  if (IS_ADMIN_PAGE) showPage("admin");
  else showPage("dashboard");

  render();
  setTimeout(initTradingViewChart, 100);
}

function showAuthTab(tab) {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.authTab === tab));
  $("loginForm")?.classList.toggle("active-form", tab === "login");
  $("registerForm")?.classList.toggle("active-form", tab === "register");
}


function enforceAccountNavigation() {
  const isDemo = state.mode !== "REAL";
  document.body.classList.toggle("demo-mode-active", isDemo);
  document.body.classList.toggle("real-mode-active", !isDemo);

  document.querySelectorAll(".real-only-nav").forEach(btn => {
    btn.style.display = isDemo ? "none" : "";
  });

  // If user is on a real-only page and switches to demo, push to dashboard.
  const activeRealOnly = document.querySelector(".page.active-page.real-only-page");
  if (isDemo && activeRealOnly) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active-page"));
    $("dashboard")?.classList.add("active-page");
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.page === "dashboard"));
  }
}

function showPage(page) {
  if (!$(page)) return;

  if (state.mode !== "REAL" && $(page).classList.contains("real-only-page")) {
    toast("Demo Account में सिर्फ Home और PnL available हैं.");
    page = "dashboard";
  }

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active-page"));
  $(page).classList.add("active-page");

  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.page === page));
  enforceAccountNavigation();
  render();
}


function currentOpenPnl(mode = state.mode) {
  normalizeAccounts();
  const key = mode === "REAL" ? "REAL" : "DEMO";
  const acc = state.accounts[key];
  (acc.trades || []).forEach(updateTradePnl);
  return (acc.trades || []).reduce((a, t) => a + Number(t.pnl || 0), 0);
}


function realWalletDisplayTotal(includePending = true) {
  // Final display formula:
  // Approved Deposit + Real Profit/Loss - Approved Withdrawal - Pending Withdrawal
  // This fixes total wallet not changing while withdrawable was changing.
  const deposits = typeof approvedDepositTotal === "function" ? approvedDepositTotal() : Number(state.accounts?.REAL?.balance || state.realBalance || 0);
  const profit = typeof realProfitEligible === "function" ? realProfitEligible() : 0;
  const approvedW = typeof approvedWithdrawalTotal === "function" ? approvedWithdrawalTotal() : 0;
  const pendingW = includePending && typeof pendingWithdrawalTotal === "function" ? pendingWithdrawalTotal() : 0;
  return Math.max(0, Number(deposits || 0) + Number(profit || 0) - Number(approvedW || 0) - Number(pendingW || 0));
}

function accountEquity(mode = state.mode) {
  normalizeAccounts();
  const key = mode === "REAL" ? "REAL" : "DEMO";

  if (key === "REAL" && typeof realWalletDisplayTotal === "function") {
    return realWalletDisplayTotal(true);
  }

  return Number(state.accounts[key].balance || 0) + currentOpenPnl(key);
}

function syncAccountBackups() {
  normalizeAccounts();
  state.demoBalance = Number(state.accounts.DEMO.balance || 0);
  state.realBalance = Number(state.accounts.REAL.balance || 0);
}

function render() {
  if (!state.user) return;

  const acc = currentAccount();
  const selectedEquity = accountEquity(state.mode);
  const realEquity = accountEquity("REAL");
  if ($("walletBalance")) $("walletBalance").textContent = money(selectedEquity);
  if ($("walletPageBalance")) $("walletPageBalance").textContent = money(realEquity);
  if ($("accountModeTitle")) $("accountModeTitle").textContent = accountLabel();
  if ($("accountModeText")) $("accountModeText").textContent = state.mode === "REAL"
    ? "Real account balance, real-account signals and real-account positions only."
    : "Demo account balance, demo signals and demo positions only.";
  $("demoBtn")?.classList.toggle("active", state.mode === "DEMO");
  $("realBtn")?.classList.toggle("active", state.mode === "REAL");
  enforceAccountNavigation();

  if ($("signalCounter")) $("signalCounter").textContent = currentAccount().signalsUsed;
  if ($("signalLimitText")) $("signalLimitText").textContent = signalLimit();
  if ($("planText")) $("planText").textContent = getPlan();
  if ($("aiTradeUsedText")) $("aiTradeUsedText").textContent = finalAiUsedToday(finalCurrentUserKey(), "REAL");
  if ($("aiTradeLimitText")) $("aiTradeLimitText").textContent = finalGetPlanLimit(finalPlanName());
  if ($("autoTradePermission")) $("autoTradePermission").checked = state.user?.autoTradePermission !== false;

  if ($("signalBox")) $("signalBox").className = "signal-box " + state.signal.toLowerCase();
  if ($("aiSignalText")) $("aiSignalText").textContent = state.signal === "WAIT" ? "WAIT / NO TRADE" : `${state.signal} BTC NOW`;
  if ($("signalNote")) $("signalNote").textContent = `${state.note} | Risk: ${state.riskLevel || "MEDIUM"} | Confidence: ${state.confidence || 70}%`;
  if ($("userSignalCoin")) $("userSignalCoin").textContent = String(state.signalCoin || "BTCUSDT").replace("USDT","/USDT");
  if ($("userTargetPrice")) $("userTargetPrice").textContent = state.targetPrice ? money(state.targetPrice) : "-";
  if ($("userStopLoss")) $("userStopLoss").textContent = state.stopLoss ? money(state.stopLoss) : "-";
  if ($("userSignalExpiry")) $("userSignalExpiry").textContent = state.signalExpiry || "30 minutes";

  if ($("adminSignal")) $("adminSignal").value = state.signal;
  if ($("adminNote")) $("adminNote").value = state.note;
  if ($("adminFreeLimit")) $("adminFreeLimit").value = state.freeSignalLimit;
  if ($("adminSignalCoin")) $("adminSignalCoin").value = state.signalCoin || "BTCUSDT";
  if ($("adminEntryPrice")) $("adminEntryPrice").value = state.entryPrice || "";
  if ($("adminTargetPrice")) $("adminTargetPrice").value = state.targetPrice || "";
  if ($("adminStopLoss")) $("adminStopLoss").value = state.stopLoss || "";
  if ($("adminConfidence")) $("adminConfidence").value = state.confidence || 70;
  if ($("adminRiskLevel")) $("adminRiskLevel").value = state.riskLevel || "MEDIUM";
  if ($("adminSignalExpiry")) $("adminSignalExpiry").value = state.signalExpiry || "30 minutes";

  renderTickers();
  renderTrades();
  renderPayments();
  renderDeposits();
  renderWithdrawals();
  renderWithdrawalEligibility();
  renderUserManagedTrades();
  finalRefreshAllUserAnalytics();
  renderUserManualTrades();
  renderAdminPanel();
  renderPlans();
  renderKyc();
  renderPremiumMetrics();
  renderAnalytics();
  renderReferral();
}

async function fetchRealPrices() {
  try {
    const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];
    const res = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbols=" + encodeURIComponent(JSON.stringify(symbols)));
    const data = await res.json();

    data.forEach(x => {
      state.prices[x.symbol] = {
        price: Number(x.lastPrice),
        change: Number(x.priceChangePercent)
      };
    });

    saveState();
    runIndicatorEngine();
    render();
  } catch (e) {
    console.warn(e);
    runIndicatorEngine();
    render();
  }
}

function renderTickers() {
  const grid = $("tickerGrid");
  if (!grid) return;

  const coins = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];
  grid.innerHTML = coins.map(s => {
    const p = state.prices[s] || { price: 0, change: 0 };
    return `<div class="ticker"><h3>${s.replace("USDT", "/USDT")}</h3><strong>${money(p.price)}</strong><p class="${p.change >= 0 ? "up" : "down"}">${p.change >= 0 ? "+" : ""}${p.change.toFixed(2)}%</p></div>`;
  }).join("");
}

function runIndicatorEngine() {
  if (!$("engineSignal")) return;

  const btc = state.prices.BTCUSDT || { price: 0, change: 0 };
  let signal = "WAIT";
  let confidence = 50;
  let reason = "Market neutral. Wait for better confirmation.";

  if (btc.change > 1.2) {
    signal = "BUY";
    confidence = Math.min(92, 65 + btc.change * 6);
    reason = "BTC 24h momentum positive. Engine suggests BUY bias.";
  } else if (btc.change < -1.2) {
    signal = "SELL";
    confidence = Math.min(92, 65 + Math.abs(btc.change) * 6);
    reason = "BTC 24h momentum negative. Engine suggests SELL/avoid long.";
  }

  if (state.signal !== "WAIT") signal = state.signal;

  $("engineSignal").textContent = signal + " SIGNAL";
  $("engineConfidence").textContent = Math.round(confidence) + "%";
  $("confidenceMeter").style.width = Math.round(confidence) + "%";
  $("engineReason").textContent = reason;
}

function placeTrade(side) {
  // Manual user trade is unlimited. AI/Admin trades have separate daily limit.
const amount = Number($("tradeAmountInput")?.value);
  const coin = $("coinSelect")?.value || "BTCUSDT";
  const orderType = $("orderType")?.value || "MARKET";
  const leverage = Number($("leverageSelect")?.value || 1);
  const tp = Number($("takeProfitInput")?.value || 0);
  const sl = Number($("stopLossInput")?.value || 0);
  const acc = currentAccount();
  const bal = acc.balance;

  if (!amount || amount <= 0 || amount > bal) {
    toast("Invalid amount or insufficient balance.");
    return;
  }

  const entry = state.prices[coin]?.price || fallbackPrice(coin);

  // Simulation margin is not deducted from wallet balance on open.
  // Balance changes only when trade is closed by net PnL.
  syncAccountBackups();
  acc.signalsUsed++;

  const trade = {
    id: "t_" + Date.now(),
    coin,
    side,
    orderType,
    leverage,
    amount,
    entry,
    current: entry,
    pnl: 0,
    roi: 0,
    takeProfit: tp || null,
    stopLoss: sl || null,
    status: "OPEN",
    openedAt: new Date().toLocaleString()
  };

  acc.trades.unshift(trade);

  if (state.mode === "REAL") {
    state.realTradeVolumeTotal = Number(state.realTradeVolumeTotal || 0) + Number(amount || 0);
  }

  acc.recentFills = acc.recentFills || [];
  acc.recentFills.unshift({ side, coin, price: entry, amount, time: new Date().toLocaleTimeString() });
  acc.recentFills = acc.recentFills.slice(0, 8);

  saveTradeToSupabase(trade);
  saveState();
  render();

  document.querySelector(".wallet-card")?.classList.add("trade-flash");
  setTimeout(() => document.querySelector(".wallet-card")?.classList.remove("trade-flash"), 900);

  toast(`${side} ${coin.replace("USDT","/USDT")} position opened.`);
}

function executeTrade() {
  placeTrade(state.signal === "SELL" ? "SELL" : "BUY");
}

function fallbackPrice(coin) {
  const map = { BTCUSDT: 65000, ETHUSDT: 3200, SOLUSDT: 150, BNBUSDT: 580 };
  return map[coin] || 100;
}

async function closeTrade(id) {
  const acc = currentAccount();
  const index = acc.trades.findIndex(t => t.id === id);
  if (index === -1) return;

  const trade = acc.trades[index];
  updateTradePnl(trade);

  const pnl = Number(trade.pnl || 0);

  // IMPORTANT FIX:
  // Previous version added margin + pnl on close, causing double balance.
  // Now wallet settlement is NET PnL only.
  // Example: 100000 balance, trade 100000, profit 18 => wallet becomes 100018, not 200018.
  acc.balance = Number(acc.balance || 0) + pnl;
  if (acc.balance < 0) acc.balance = 0;

  trade.status = "CLOSED";
  trade.closedAt = new Date().toLocaleString();

  acc.closedTrades = acc.closedTrades || [];
  acc.closedTrades.unshift({ ...trade });

  if (state.mode === "REAL" && pnl > 0 && !trade.profitCounted) {
    state.realProfitTotal = Number(state.realProfitTotal || 0) + pnl;
    trade.profitCounted = true;
  }

  acc.recentFills = acc.recentFills || [];
  acc.recentFills.unshift({
    side: "CLOSE",
    coin: trade.coin,
    price: trade.current,
    amount: trade.amount,
    time: new Date().toLocaleTimeString()
  });

  acc.trades.splice(index, 1);
  syncAccountBackups();

  // Trade PnL ledger entry: persists profit/loss after refresh.
  if (state.mode === "REAL" && pnl !== 0) {
    await addWalletLedgerEntry("TRADE_PNL", pnl, `Closed ${trade.side} ${trade.coin}`);
    await recalcRealBalanceFromLedger();
  }

  saveState();
  render();

  const msg = pnl >= 0
    ? `Trade closed. Profit added: ${money(pnl)}`
    : `Trade closed. Loss deducted: ${money(Math.abs(pnl))}`;
  toast(msg + " | Wallet updated.");
}

function updateTradePnl(t) {
  const current = state.prices[t.coin]?.price || t.current || t.entry;
  t.current = current;
  const diff = t.side === "BUY" ? (current - t.entry) : (t.entry - current);
  t.pnl = (diff / t.entry) * t.amount * (t.leverage || 1);
  t.roi = t.amount ? (t.pnl / t.amount) * 100 : 0;

  if (t.takeProfit) {
    if ((t.side === "BUY" && current >= t.takeProfit) || (t.side === "SELL" && current <= t.takeProfit)) {
      t.hitNote = "TP HIT";
    }
  }

  if (t.stopLoss) {
    if ((t.side === "BUY" && current <= t.stopLoss) || (t.side === "SELL" && current >= t.stopLoss)) {
      t.hitNote = "SL HIT";
    }
  }
}

async function saveTradeToSupabase(trade) {
  if (!supabaseClient || !state.user || state.user.role === "admin") return;
  try {
    await supabaseClient.from("trades").insert({
      user_id: state.user.id,
      coin: trade.coin,
      side: trade.side,
      amount: trade.amount,
      entry_price: trade.entry,
      current_price: trade.current,
      pnl: trade.pnl,
      status: trade.status
    });
  } catch (e) {
    console.warn("Trade save failed", e);
  }
}

function renderTrades() {
  const table = $("activeTradesLog");
  if (!table) return;

  const acc = currentAccount();
  acc.trades.forEach(updateTradePnl);

  const rows = acc.trades.map(t => `
    <tr>
      <td>${t.coin.replace("USDT","/USDT")}</td>
      <td class="${t.side === "BUY" ? "buy-text" : "sell-text"}">${t.side}</td>
      <td>${money(t.amount)}</td>
      <td>${t.leverage || 1}x</td>
      <td>${money(t.entry)}</td>
      <td>${money(t.current)}</td>
      <td class="${t.pnl >= 0 ? "pnl-plus" : "pnl-minus"}">${t.pnl >= 0 ? "+" : ""}${money(t.pnl)}<br><small>${(t.roi || 0).toFixed(2)}%</small></td>
      <td><small>TP: ${t.takeProfit ? money(t.takeProfit) : "-"}<br>SL: ${t.stopLoss ? money(t.stopLoss) : "-"}<br>${t.hitNote || ""}</small></td>
      <td><button class="close-btn" onclick="closeTrade('${t.id}')">Close</button></td>
    </tr>
  `).join("");

  table.innerHTML = rows || `<tr><td colspan="9" class="empty">No open positions yet.</td></tr>`;

  renderOrderBook();
  renderRecentFills();
  saveState();
}

function renderOrderBook() {
  const el = $("orderBook");
  if (!el) return;
  const btc = state.prices.BTCUSDT?.price || 65000;
  const rows = [];
  for (let i = 3; i >= 1; i--) {
    rows.push({ type: "ASK", price: btc + i * 8.5, qty: (Math.random() * 1.8 + .2).toFixed(4) });
  }
  for (let i = 1; i <= 3; i++) {
    rows.push({ type: "BID", price: btc - i * 8.5, qty: (Math.random() * 1.8 + .2).toFixed(4) });
  }
  el.innerHTML = rows.map(r => {
    const depth = Math.min(85, Math.max(18, Number(r.qty) * 38));
    return `<div class="book-row ${r.type === "ASK" ? "ask" : "bid"}" style="--depth:${depth}%"><span>${r.type}</span><span>${money(r.price)}</span><span>${r.qty}</span></div>`;
  }).join("");
}

function renderRecentFills() {
  const el = $("recentFills");
  if (!el) return;
  const fills = currentAccount().recentFills || [];
  el.innerHTML = fills.map(f => `<div class="fill-row ${String(f.side).toLowerCase()}"><span>${f.side}</span><span>${f.coin.replace("USDT","/USDT")}</span><span>${money(f.price)}</span></div>`).join("") || `<p class="muted small">No recent fills yet.</p>`;
}


function currentUserClosedManagedTrades() {
  const uid = String(state.user?.id || "local");
  const email = String(state.user?.email || "").toLowerCase();

  return (state.managedTrades || []).filter(t => {
    const tid = String(t.userId || "");
    const temail = String(t.userEmail || "").toLowerCase();
    const belongsToUser = tid === uid || (!!email && temail === email);
    return belongsToUser && String(t.status || "").toUpperCase() === "CLOSED";
  }).map(t => ({
    ...t,
    amount: Number(t.amount || 0),
    pnl: Number(t.pnl || 0),
    source: "ADMIN_MANAGED",
    status: "CLOSED"
  }));
}

function allUserPnlTrades() {
  normalizeAccounts();
  const acc = currentAccount ? currentAccount() : state.accounts?.[state.mode || "DEMO"];
  const manual = [
    ...((acc?.trades || []).map(t => ({ ...t, status: t.status || "OPEN" }))),
    ...((acc?.closedTrades || []).map(t => ({ ...t, status: t.status || "CLOSED" })))
  ];

  // Managed PnL should count only in Real Account analytics.
  const managed = state.mode === "REAL" ? currentUserClosedManagedTrades() : [];
  return [...manual, ...managed];
}


function renderAnalytics() {
  if (!$("totalTradesMetric")) return;

  const allTrades = allUserPnlTrades();
  const total = allTrades.length;
  const pnl = allTrades.reduce((a, t) => a + Number(t.pnl || 0), 0);
  const wins = allTrades.filter(t => t.pnl > 0).length;

  $("totalTradesMetric").textContent = total;
  $("totalPnlMetric").textContent = money(pnl);
  $("totalPnlMetric").className = pnl >= 0 ? "pnl-plus" : "pnl-minus";
  $("winRateMetric").textContent = total ? Math.round(wins / total * 100) + "%" : "0%";

  const myRef = state.user?.referralCode;
  const bonus = state.referrals.filter(r => r.code === myRef).reduce((a, r) => a + Number(r.bonus || 0), 0);
  $("refBonusMetric").textContent = rupee(bonus);

  $("pnlBars").innerHTML = (
    allTrades.slice(0, 8).map((t, i) => `
      <div class="pnl-bar">
        <span>Trade ${i + 1}</span>
        <div class="pnl-track"><i class="${t.pnl < 0 ? "loss" : ""}" style="width:${Math.min(100, Math.abs(t.pnl) * 8 + 8)}%"></i></div>
        <strong class="${t.pnl >= 0 ? "pnl-plus" : "pnl-minus"}">${money(t.pnl)}</strong>
      </div>
    `).join("") || "<p class='muted'>No analytics data yet.</p>"
  );
}

function renderReferral() {
  if (!$("refCount")) return;

  const code = state.user?.referralCode;
  const refs = state.referrals.filter(r => r.code === code);
  const bonus = refs.reduce((a, r) => a + Number(r.bonus || 0), 0);

  $("refCount").textContent = refs.length;
  $("refBonus").textContent = rupee(bonus);
}

function openPaymentModal(plan) {
  state.selectedPaymentPlan = plan;
  saveState();

  if ($("paymentPlanTitle")) $("paymentPlanTitle").textContent = `${plan} Subscription Manual Payment`;
  $("paymentModal")?.classList.add("show");
}

function closePaymentModal() {
  $("paymentModal")?.classList.remove("show");
}

async function submitManualPayment() {
  const name = $("payerName")?.value.trim();
  const mobile = $("payerMobile")?.value.trim();
  const txn = $("transactionId")?.value.trim();
  const file = $("paymentScreenshot")?.files[0];

  if (!name || !mobile || !txn) {
    toast("Name, mobile and UTR required.");
    return;
  }

  let remoteId = "p_" + Date.now();

  if (supabaseClient && state.user?.id) {
    try {
      const { data, error } = await supabaseClient
        .from("payment_requests")
        .insert({
          user_id: state.user.id,
          plan: state.selectedPaymentPlan,
          name,
          mobile,
          txn,
          screenshot_url: file ? file.name : "Not uploaded",
          status: "PENDING"
        })
        .select()
        .single();

      if (error) {
        toast(error.message || "Payment save failed.");
        return;
      }

      remoteId = String(data.id);
    } catch (e) {
      toast("Payment request save failed. Check Supabase SQL.");
      return;
    }
  }

  state.paymentRequests.unshift({
    id: remoteId,
    userId: state.user?.id || "local",
    plan: state.selectedPaymentPlan,
    name,
    mobile,
    txn,
    screenshot: file ? file.name : "Not uploaded",
    status: "PENDING"
  });

  saveState();
  render();
  closePaymentModal();

  if ($("payerName")) $("payerName").value = "";
  if ($("payerMobile")) $("payerMobile").value = "";
  if ($("transactionId")) $("transactionId").value = "";
  if ($("paymentScreenshot")) $("paymentScreenshot").value = "";

  toast("Payment request submitted.");
}


function openDepositModal() {
  if ($("depositUpiText")) $("depositUpiText").textContent = CONFIG.UPI_ID || "yourupi@bank";
  if ($("depositAccountText")) $("depositAccountText").textContent = CONFIG.ACCOUNT_NAME || "AI Trading Assistant";
  if ($("depositBankText")) $("depositBankText").textContent = CONFIG.BANK_NAME || "Your Bank Name";
  if ($("depositAccountNoText")) $("depositAccountNoText").textContent = CONFIG.ACCOUNT_NO || "000000000000";
  if ($("depositIfscText")) $("depositIfscText").textContent = CONFIG.IFSC || "ABCD0000000";
  $("depositModal")?.classList.add("show");
}

function closeDepositModal() {
  $("depositModal")?.classList.remove("show");
}

async function submitDepositRequest() {
  const amount = Number($("depositAmount")?.value || 0);
  const txn = $("depositTxn")?.value.trim();
  const file = $("depositScreenshot")?.files[0];

  if (!amount || amount <= 0 || !txn) {
    toast("Deposit amount and UTR required.");
    return;
  }

  if (amount < MIN_DEPOSIT_AMOUNT) {
    toast("Minimum deposit amount is ₹1000.");
    return;
  }

  let remoteId = "d_" + Date.now();

  if (supabaseClient && state.user?.id) {
    try {
      const { data, error } = await supabaseClient
        .from("deposit_requests")
        .insert({
          user_id: state.user.id,
          user_email: state.user.email || "",
          amount,
          txn,
          screenshot_url: file ? file.name : "Not uploaded",
          status: "PENDING"
        })
        .select()
        .single();

      if (error) {
        toast(error.message || "Deposit save failed.");
        return;
      }

      remoteId = String(data.id);
    } catch (e) {
      toast("Deposit request save failed. Run latest SQL.");
      return;
    }
  }

  state.depositRequests.unshift({
    id: remoteId,
    userId: state.user?.id || "local",
    userEmail: state.user?.email || "",
    amount,
    txn,
    screenshot: file ? file.name : "Not uploaded",
    status: "PENDING",
    date: new Date().toLocaleString()
  });

  saveState();
  render();
  closeDepositModal();

  if ($("depositAmount")) $("depositAmount").value = "";
  if ($("depositTxn")) $("depositTxn").value = "";
  if ($("depositScreenshot")) $("depositScreenshot").value = "";

  toast("Deposit request submitted for admin approval.");
}



function ensureWithdrawalTotals() {
  state.realTradeVolumeTotal = Number(state.realTradeVolumeTotal || 0);
  state.realProfitTotal = Number(state.realProfitTotal || 0);
  state.realApprovedDepositTotal = Number(state.realApprovedDepositTotal || 0);
}

function currentUserIdSafe() {
  return String(state.user?.id || "local");
}

function realAccountTrades() {
  normalizeAccounts();
  return [
    ...(state.accounts?.REAL?.trades || []),
    ...(state.accounts?.REAL?.closedTrades || [])
  ];
}

function approvedDepositTotal(userId = currentUserIdSafe()) {
  ensureWithdrawalTotals();

  const localApproved = (state.depositRequests || [])
    .filter(d => String(d.userId) === String(userId) && d.status === "APPROVED")
    .reduce((a, d) => a + Number(d.amount || 0), 0);

  return Math.max(Number(state.realApprovedDepositTotal || 0), localApproved);
}

function approvedWithdrawalTotal(userId = currentUserIdSafe()) {
  return (state.withdrawalRequests || [])
    .filter(w => String(w.userId) === String(userId) && w.status === "APPROVED")
    .reduce((a, w) => a + Number(w.amount || 0), 0);
}

function pendingWithdrawalTotal(userId = currentUserIdSafe()) {
  return (state.withdrawalRequests || [])
    .filter(w => String(w.userId) === String(userId) && w.status === "PENDING")
    .reduce((a, w) => a + Number(w.amount || 0), 0);
}

function realTradeVolume() {
  ensureWithdrawalTotals();

  const liveVolume = realAccountTrades()
    .reduce((a, t) => a + Number(t.amount || 0), 0);

  return Math.max(Number(state.realTradeVolumeTotal || 0), liveVolume);
}

function realProfitEligible() {
  ensureWithdrawalTotals();

  const liveProfit = realAccountTrades()
    .reduce((a, t) => a + Math.max(0, Number(t.pnl || 0)), 0);

  const managedProfit = (state.managedTrades || [])
    .filter(t => String(t.status || "").toUpperCase() === "CLOSED")
    .reduce((a, t) => a + Math.max(0, Number(t.pnl || 0)), 0);

  return Math.max(Number(state.realProfitTotal || 0), liveProfit + managedProfit);
}

function withdrawableAmount() {
  ensureWithdrawalTotals();

  const deposits = approvedDepositTotal();
  const traded = realTradeVolume();
  const profit = realProfitEligible();
  const approvedW = approvedWithdrawalTotal();
  const pendingW = pendingWithdrawalTotal();

  // Deposit unlock rule:
  // 1) Deposit amount unlocks only after equal trade volume.
  // 2) Positive profit is withdrawable.
  // 3) Pending + approved withdrawals reduce available amount.
  const unlockedDeposit = Math.min(deposits, traded);
  const totalEligible = unlockedDeposit + profit;
  return Math.max(0, totalEligible - approvedW - pendingW);
}

function renderWithdrawalEligibility() {
  if ($("approvedDepositText")) $("approvedDepositText").textContent = money(approvedDepositTotal());
  if ($("tradeVolumeText")) $("tradeVolumeText").textContent = money(realTradeVolume());
  if ($("profitEligibleText")) $("profitEligibleText").textContent = money(realProfitEligible());
  if ($("withdrawableAmountText")) $("withdrawableAmountText").textContent = money(withdrawableAmount());
  if ($("pendingWithdrawalText")) $("pendingWithdrawalText").textContent = money(pendingWithdrawalTotal());
}


function openWithdrawModal() {
  $("withdrawModal")?.classList.add("show");
}

function closeWithdrawModal() {
  $("withdrawModal")?.classList.remove("show");
}

async function submitWithdrawRequest() {
  const amount = Number($("withdrawAmount")?.value || 0);
  const method = $("withdrawMethod")?.value || "UPI";
  const account = $("withdrawAccount")?.value.trim();
  const name = $("withdrawName")?.value.trim();
  const ifsc = $("withdrawIfsc")?.value.trim();

  normalizeAccounts();
  const realBalance = Number(state.accounts?.REAL?.balance || state.realBalance || 0);
  const eligible = withdrawableAmount();

  if (!amount || amount <= 0 || !account || !name) {
    toast("Amount, account/UPI and name required.");
    return;
  }

  if (amount < MIN_WITHDRAW_AMOUNT) {
    toast("Minimum withdrawal amount is ₹1000.");
    return;
  }

  if (amount > realBalance) {
    toast("Insufficient Real Account balance.");
    return;
  }

  if (amount > eligible) {
    toast(`Withdrawable amount only ${money(eligible)}. Deposit unlocks after trading volume.`);
    return;
  }

  let remoteId = "w_" + Date.now();

  if (supabaseClient && state.user?.id) {
    try {
      const { data, error } = await supabaseClient
        .from("withdrawal_requests")
        .insert({
          user_id: state.user.id,
          user_email: state.user.email || "",
          amount,
          method,
          account,
          name,
          ifsc,
          status: "PENDING"
        })
        .select()
        .single();

      if (error) {
        toast(error.message || "Withdrawal save failed.");
        return;
      }

      remoteId = String(data.id);
    } catch (e) {
      toast("Withdrawal request save failed. Run latest SQL.");
      return;
    }
  }

  state.withdrawalRequests.unshift({
    id: remoteId,
    userId: state.user?.id || "local",
    userEmail: state.user?.email || "",
    amount,
    method,
    account,
    name,
    ifsc,
    status: "PENDING",
    date: new Date().toLocaleString()
  });

  saveState();
  render();
  closeWithdrawModal();

  if ($("withdrawAmount")) $("withdrawAmount").value = "";
  if ($("withdrawAccount")) $("withdrawAccount").value = "";
  if ($("withdrawName")) $("withdrawName").value = "";
  if ($("withdrawIfsc")) $("withdrawIfsc").value = "";

  toast("Withdrawal request submitted. Amount reserved from wallet total.");
}

function renderWithdrawals() {
  const adminTable = $("withdrawalRequestsLog");
  const userTable = $("userWithdrawalLog");

  if (adminTable && state.user?.role === "admin") {
    adminTable.innerHTML = (state.withdrawalRequests || []).map(w => `
      <tr>
        <td>${w.userEmail || w.userId || "-"}</td>
        <td>${money(w.amount)}</td>
        <td>${w.method}</td>
        <td>${w.account}</td>
        <td>${w.name}</td>
        <td>${w.status}</td>
        <td>${w.status === "PENDING" ? `<div class="action-row"><button class="approve-btn" onclick="approveWithdrawal('${w.id}')">Approve</button><button class="reject-btn" onclick="rejectWithdrawal('${w.id}')">Reject</button></div>` : "-"}</td>
      </tr>
    `).join("") || `<tr><td colspan="7" class="empty">No withdrawal requests.</td></tr>`;
  }

  if (userTable) {
    const myWithdrawals = (state.withdrawalRequests || []).filter(w => String(w.userId) === String(state.user?.id));
    userTable.innerHTML = myWithdrawals.map(w => `
      <tr>
        <td>${money(w.amount)}</td>
        <td>${w.method}</td>
        <td>${w.account}</td>
        <td>${w.status}</td>
        <td>${w.date || "-"}</td>
      </tr>
    `).join("") || `<tr><td colspan="5" class="empty">No withdrawal requests yet.</td></tr>`;
  }
}

async function approveWithdrawal(id) {
  const req = (state.withdrawalRequests || []).find(w => String(w.id) === String(id));
  if (!req) return;

  normalizeAccounts();
  ensureWithdrawalTotals();

  const amount = Number(req.amount || 0);

  if (req.status === "APPROVED") {
    toast("Withdrawal already approved.");
    return;
  }

  // Deduct from shared Real Account balance immediately.
  state.accounts.REAL.balance = Math.max(0, Number(state.accounts.REAL.balance || state.realBalance || 0) - amount);
  state.realBalance = state.accounts.REAL.balance;

  // Also store on local user record if available.
  const u = (state.users || []).find(x => String(x.id) === String(req.userId));
  if (u) u.realBalance = Math.max(0, Number(u.realBalance || 0) - amount);

  req.status = "APPROVED";
  await refApplyFirstDeposit10PercentBonus(req);
  
  req.approvedAt = new Date().toLocaleString();

  if (supabaseClient) {
    try {
      await supabaseClient.from("withdrawal_requests").update({ status: "APPROVED" }).eq("id", id);
      await supabaseClient.from("wallet_ledger").insert({
        user_id: req.userId,
        type: "WITHDRAWAL",
        amount: -Math.abs(amount),
        note: "Manual withdrawal approved"
      });

      if (String(state.user?.id) === String(req.userId) && state.user?.role !== "admin") {
        await recalcRealBalanceFromLedger();
      }
    } catch (e) {
      console.warn("Withdrawal approve remote update failed", e);
    }
  }

  saveState();
  render();
  toast("Withdrawal approved and Real balance deducted.");
}

async function rejectWithdrawal(id) {
  const req = (state.withdrawalRequests || []).find(w => String(w.id) === String(id));
  if (!req) return;
  req.status = "REJECTED";

  if (supabaseClient) {
    try { await supabaseClient.from("withdrawal_requests").update({ status: "REJECTED" }).eq("id", id); } catch {}
  }

  saveState();
  render();
  toast("Withdrawal rejected.");
}


function renderDeposits() {
  const adminTable = $("depositRequestsLog");
  const userTable = $("userDepositLog");

  if (adminTable && state.user?.role === "admin") {
    adminTable.innerHTML = (state.depositRequests || []).map(d => `
      <tr>
        <td>${d.userEmail || d.userId || "-"}</td>
        <td>${money(d.amount)}</td>
        <td>${d.txn}</td>
        <td>${d.screenshot || "-"}</td>
        <td>${d.status}</td>
        <td>${d.status === "PENDING" ? `<div class="action-row"><button class="approve-btn" onclick="approveDeposit('${d.id}')">Approve</button><button class="reject-btn" onclick="rejectDeposit('${d.id}')">Reject</button></div>` : "-"}</td>
      </tr>
    `).join("") || `<tr><td colspan="6" class="empty">No deposit requests.</td></tr>`;
  }

  if (userTable) {
    const myDeposits = (state.depositRequests || []).filter(d => String(d.userId) === String(state.user?.id));
    userTable.innerHTML = myDeposits.map(d => `
      <tr>
        <td>${money(d.amount)}</td>
        <td>${d.txn}</td>
        <td>${d.status}</td>
        <td>${d.date || "-"}</td>
      </tr>
    `).join("") || `<tr><td colspan="4" class="empty">No deposit requests yet.</td></tr>`;
  }
}







/* ===== REFERRAL FIRST DEPOSIT 10 PERCENT AUTO BONUS ===== */
const REFERRAL_FIRST_DEPOSIT_PERCENT = 10;

function refClean(v) {
  return String(v || "").trim();
}

function refLower(v) {
  return refClean(v).toLowerCase();
}

function refMakeCode(user) {
  const raw = refLower(user?.email || user?.id || ("u" + Date.now()));
  return raw.replace(/[^a-z0-9]/g, "").slice(0, 10) || ("ref" + Date.now());
}

function refLocalUserByIdOrEmail(id, email) {
  const uid = refClean(id);
  const em = refLower(email);
  return (state.users || []).find(u =>
    refClean(u.id) === uid || (!!em && refLower(u.email) === em)
  ) || null;
}

async function refEnsureCurrentUserCode() {
  if (!state.user) return;
  const code = state.user.referralCode || state.user.referral_code || refMakeCode(state.user);
  state.user.referralCode = code;
  state.user.referral_code = code;

  const u = refLocalUserByIdOrEmail(state.user.id, state.user.email);
  if (u) {
    u.referralCode = code;
    u.referral_code = code;
  }

  if (supabaseClient && state.user.id) {
    try {
      await supabaseClient.from("profiles").update({ referral_code: code }).eq("id", state.user.id);
    } catch(e) {
      console.warn("referral_code save failed", e);
    }
  }

  saveState?.();
}

async function refSaveReferredByForCurrentUser(code) {
  code = refClean(code);
  if (!code || !state.user) return;

  state.user.referredBy = code;
  state.user.referred_by = code;

  const u = refLocalUserByIdOrEmail(state.user.id, state.user.email);
  if (u) {
    u.referredBy = code;
    u.referred_by = code;
  }

  if (supabaseClient && state.user.id) {
    try {
      await supabaseClient.from("profiles").update({ referred_by: code }).eq("id", state.user.id);
    } catch(e) {
      console.warn("referred_by save failed", e);
    }
  }

  saveState?.();
}

async function refGetReferredBy(userId, userEmail) {
  const local = refLocalUserByIdOrEmail(userId, userEmail);
  let code = refClean(local?.referredBy || local?.referred_by || local?.referralCodeUsed || local?.referral_code_used);

  if (!code && supabaseClient && userId) {
    try {
      const { data } = await supabaseClient
        .from("profiles")
        .select("referred_by")
        .eq("id", userId)
        .maybeSingle();
      code = refClean(data?.referred_by);
    } catch(e) {}
  }

  return code;
}

async function refFindReferrer(code) {
  code = refClean(code);
  if (!code) return null;

  const local = (state.users || []).find(u =>
    refLower(u.referralCode || u.referral_code) === refLower(code) ||
    refLower(u.id) === refLower(code) ||
    refLower(u.email) === refLower(code)
  );
  if (local) return local;

  if (supabaseClient) {
    try {
      const { data } = await supabaseClient
        .from("profiles")
        .select("id,email,referral_code")
        .eq("referral_code", code)
        .maybeSingle();
      if (data?.id) return { id: data.id, email: data.email, referral_code: data.referral_code };
    } catch(e) {}

    try {
      const { data } = await supabaseClient
        .from("profiles")
        .select("id,email,referral_code")
        .eq("email", code)
        .maybeSingle();
      if (data?.id) return { id: data.id, email: data.email, referral_code: data.referral_code };
    } catch(e) {}
  }

  return null;
}

async function refFirstDepositBonusAlreadyPaid(userId, userEmail) {
  const uid = refClean(userId);
  const em = refLower(userEmail);

  if ((state.referrals || []).some(r => {
    const paid = String(r.status || "").toUpperCase() === "PAID";
    const sameUser = (uid && refClean(r.userId || r.user_id) === uid) || (em && refLower(r.userEmail || r.user_email) === em);
    const firstDeposit = Number(r.percent || 0) === REFERRAL_FIRST_DEPOSIT_PERCENT || String(r.type || "").toUpperCase() === "FIRST_DEPOSIT_BONUS";
    return paid && sameUser && firstDeposit;
  })) return true;

  if (supabaseClient) {
    try {
      if (uid) {
        const { data } = await supabaseClient
          .from("referrals")
          .select("id")
          .eq("user_id", uid)
          .eq("status", "PAID")
          .eq("percent", REFERRAL_FIRST_DEPOSIT_PERCENT)
          .limit(1);
        if (data && data.length) return true;
      }
      if (em) {
        const { data } = await supabaseClient
          .from("referrals")
          .select("id")
          .eq("user_email", em)
          .eq("status", "PAID")
          .eq("percent", REFERRAL_FIRST_DEPOSIT_PERCENT)
          .limit(1);
        if (data && data.length) return true;
      }
    } catch(e) {}
  }

  return false;
}

async function refApplyFirstDeposit10PercentBonus(dep) {
  if (!dep || String(dep.status || "").toUpperCase() !== "APPROVED") return;

  const userId = refClean(dep.userId || dep.user_id);
  const userEmail = refClean(dep.userEmail || dep.user_email);
  const depositId = refClean(dep.id || dep.depositId || dep.deposit_id || ("dep_" + Date.now()));
  const depositAmount = Number(String(dep.amount || dep.depositAmount || dep.deposit_amount || 0).replace(/,/g, ""));
  if (!depositAmount || depositAmount <= 0) return;

  const referredBy = await refGetReferredBy(userId, userEmail);
  if (!referredBy) {
    console.warn("No referred_by found for deposit user", { userId, userEmail });
    return;
  }

  const referrer = await refFindReferrer(referredBy);
  if (!referrer?.id) {
    console.warn("Referrer not found for code", referredBy);
    return;
  }

  if (await refFirstDepositBonusAlreadyPaid(userId, userEmail)) {
    console.log("First deposit referral bonus already paid", { userId, userEmail });
    return;
  }

  const bonusAmount = Number((depositAmount * REFERRAL_FIRST_DEPOSIT_PERCENT / 100).toFixed(2));

  const record = {
    id: "ref10_" + Date.now() + "_" + Math.random().toString(16).slice(2),
    referrerId: referrer.id,
    referrerEmail: referrer.email || "",
    userId,
    userEmail,
    depositId,
    depositAmount,
    bonusAmount,
    percent: REFERRAL_FIRST_DEPOSIT_PERCENT,
    status: "PAID",
    type: "FIRST_DEPOSIT_BONUS",
    date: new Date().toLocaleString()
  };

  state.referrals = state.referrals || [];
  state.referrals.unshift(record);

  if (supabaseClient) {
    try {
      await supabaseClient.from("referrals").insert({
        referrer_id: record.referrerId,
        referrer_email: record.referrerEmail,
        user_id: record.userId,
        user_email: record.userEmail,
        deposit_id: record.depositId,
        deposit_amount: record.depositAmount,
        bonus_amount: record.bonusAmount,
        percent: REFERRAL_FIRST_DEPOSIT_PERCENT,
        status: "PAID"
      });
    } catch(e) {
      console.warn("Referral record insert failed", e);
    }

    try {
      await supabaseClient.from("wallet_ledger").insert({
        user_id: record.referrerId,
        type: "REFERRAL_BONUS",
        amount: record.bonusAmount,
        note: "10% first deposit referral bonus after approved deposit " + record.depositId
      });
    } catch(e) {
      console.warn("Referral wallet ledger insert failed", e);
    }
  }

  if (state.user && refClean(state.user.id) === refClean(record.referrerId)) {
    normalizeAccounts?.();
    state.accounts.REAL.balance = Number(state.accounts.REAL.balance || state.realBalance || 0) + bonusAmount;
    state.realBalance = state.accounts.REAL.balance;
  }

  saveState?.();
  console.log("10% FIRST DEPOSIT REFERRAL BONUS PAID", record);
}

async function approveDeposit(id) {
  const req = (state.depositRequests || []).find(d => String(d.id) === String(id));
  if (!req) return;

  req.status = "APPROVED";

  if (String(state.user?.id) === String(req.userId)) {
    normalizeAccounts();
    state.accounts.REAL.balance += Number(req.amount || 0);
    state.realBalance = state.accounts.REAL.balance;
  }

  // Store approved amount into local user record if available
  const user = state.users.find(u => String(u.id) === String(req.userId));
  if (user) user.realBalance = Number(user.realBalance || 0) + Number(req.amount || 0);

  if (supabaseClient) {
    try {
      await supabaseClient.from("deposit_requests").update({ status: "APPROVED" }).eq("id", id);
      await supabaseClient.from("wallet_ledger").insert({
        user_id: req.userId,
        type: "DEPOSIT",
        amount: req.amount,
        note: "Manual deposit approved"
      });

      if (String(state.user?.id) === String(req.userId) && state.user?.role !== "admin") {
        await recalcRealBalanceFromLedger();
      }
    } catch (e) {
      console.warn("Deposit approve remote update failed", e);
    }
  }

  saveState();
  render();
  
  toast("Deposit approved. User balance updated on next login/refresh.");
}


function renderPayments() {
  const tbody = $("paymentRequestsLog");
  if (!tbody || state.user?.role !== "admin") return;

  tbody.innerHTML = state.paymentRequests.map(p => `
    <tr>
      <td>${p.plan}</td>
      <td>${p.name}</td>
      <td>${p.mobile}</td>
      <td>${p.txn}</td>
      <td>${p.status}</td>
      <td>${p.status === "PENDING" ? `<div class="action-row"><button class="approve-btn" onclick="approvePayment('${p.id}')">Approve</button><button class="reject-btn" onclick="rejectPayment('${p.id}')">Reject</button></div>` : "-"}</td>
    </tr>
  `).join("") || `<tr><td colspan="6" class="empty">No payment requests.</td></tr>`;
}

async function approvePayment(id) {
  const req = state.paymentRequests.find(p => String(p.id) === String(id));
  if (!req) return;

  req.status = "APPROVED";

  const user = state.users.find(u => u.id === req.userId);
  if (user) user.plan = req.plan;

  if (supabaseClient) {
    try {
      await supabaseClient.from("payment_requests").update({ status: "APPROVED" }).eq("id", id);
      if (req.userId) await supabaseClient.from("profiles").update({ plan: req.plan }).eq("id", req.userId);
    } catch (e) {
      console.warn("Approve remote update failed", e);
    }
  }

  saveState();
  render();
  toast("Payment approved and plan activated.");
}

function saveAdminSettings() {
  state.signal = $("adminSignal")?.value || "BUY";
  state.signalCoin = $("adminSignalCoin")?.value || "BTCUSDT";
  state.entryPrice = $("adminEntryPrice")?.value || "";
  state.targetPrice = $("adminTargetPrice")?.value || "";
  state.stopLoss = $("adminStopLoss")?.value || "";
  state.confidence = Math.max(1, Math.min(100, Number($("adminConfidence")?.value || 70)));
  state.riskLevel = $("adminRiskLevel")?.value || "MEDIUM";
  state.signalExpiry = $("adminSignalExpiry")?.value || "30 minutes";
  state.note = $("adminNote")?.value.trim() || "Admin signal updated.";
  state.freeSignalLimit = Math.max(1, Number($("adminFreeLimit")?.value || 5));
  saveState();
  render();
  showPage(IS_ADMIN_PAGE ? "admin" : "dashboard");
  toast("Admin signal saved.");
}


function switchAdminTab(tabId) {
  document.querySelectorAll(".admin-tab").forEach(b => b.classList.toggle("active", b.dataset.adminTab === tabId));
  document.querySelectorAll(".admin-panel").forEach(p => p.classList.remove("active-admin-panel"));
  $(tabId)?.classList.add("active-admin-panel");
}



function renderPremiumMetrics() {
  if ($("mockUserName")) $("mockUserName").textContent = state.user?.name || "Trader";
  if ($("mockDemoBalance")) $("mockDemoBalance").textContent = money(state.accounts?.DEMO?.balance || state.demoBalance || 10000);
  if ($("mockRealBalance")) $("mockRealBalance").textContent = money(state.accounts?.REAL?.balance || state.realBalance || 0);

  const allTrades = allUserPnlTrades();
  const pnl = allTrades.reduce((a,t)=>a+Number(t.pnl||0),0);
  const wins = allTrades.filter(t => Number(t.pnl||0) > 0).length;
  const winRate = allTrades.length ? Math.round((wins / allTrades.length) * 100) : 0;
  const btc = state.prices.BTCUSDT || { price: 0, change: 0 };

  if ($("todayPnlMini")) {
    $("todayPnlMini").textContent = money(pnl);
    $("todayPnlMini").className = pnl >= 0 ? "pnl-plus" : "pnl-minus";
  }
  if ($("winRateMini")) $("winRateMini").textContent = winRate + "%";
  if ($("marketMoodMini")) {
    $("marketMoodMini").textContent = btc.change > .6 ? "Bullish" : btc.change < -.6 ? "Bearish" : "Neutral";
    $("marketMoodMini").className = btc.change >= 0 ? "pnl-plus" : "pnl-minus";
  }
  if ($("activeSignalMini")) $("activeSignalMini").textContent = `${state.signal || "WAIT"} ${String(state.signalCoin || "BTCUSDT").replace("USDT","")}`;
  if ($("headerBtcPrice")) $("headerBtcPrice").textContent = money(btc.price || 0);

  if ($("signalEntryMeta")) $("signalEntryMeta").textContent = state.entryPrice ? money(state.entryPrice) : "Market";
  if ($("signalTarget1Meta")) $("signalTarget1Meta").textContent = state.targetPrice ? money(state.targetPrice) : "-";
  if ($("signalStopMeta")) $("signalStopMeta").textContent = state.stopLoss ? money(state.stopLoss) : "-";
  if ($("signalCountdown")) $("signalCountdown").textContent = state.signalExpiry || "30m";
}


function renderPlans() {
  const grid = $("dynamicPlansGrid");
  if (grid) {
    const plans = (state.plans || []).filter(p => p.active !== false);
    grid.innerHTML = plans.map(p => `
      <div class="card plan-card ${p.name === "Pro" ? "featured" : ""}">
        ${p.name === "Pro" ? `<span class="tag">Popular</span>` : ""}
        <h3>${p.name}</h3>
        <p class="price">${rupee(p.price || 0)}</p>
        <p class="muted small">${p.duration || "30 days"} • ${Number(p.signalLimit) >= 999999 ? "Unlimited" : p.signalLimit} signals</p>
        <ul class="plan-feature-list">
          ${(p.features || []).map(f => `<li>${f}</li>`).join("")}
        </ul>
        ${Number(p.price || 0) === 0 ? `<button class="ghost-full">Current / Free</button>` : `<button class="primary-btn plan-btn" onclick="openPaymentModal('${p.name}')">Pay Manually</button>`}
      </div>
    `).join("");
  }

  renderPlanEditor();
}

function renderPlanEditor() {
  const el = $("adminPlansEditorLog");
  if (!el) return;

  el.innerHTML = (state.plans || []).map(p => `
    <tr>
      <td>${p.name}</td>
      <td>${rupee(p.price || 0)}</td>
      <td>${Number(p.aiTradeLimit || 5)}</td>
      <td>${p.active === false ? "Hidden" : "Active"}</td>
      <td>
        <div class="plan-actions">
          <button class="ghost-btn" onclick="editPlan('${p.id}')">Edit</button>
          <button class="reject-btn" onclick="togglePlan('${p.id}')">${p.active === false ? "Show" : "Hide"}</button>
          <button class="reject-btn" onclick="deletePlan('${p.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="5" class="empty">No plans created.</td></tr>`;
}

function resetPlanForm() {
  if ($("planEditId")) $("planEditId").value = "";
  if ($("planNameInput")) $("planNameInput").value = "";
  if ($("planPriceInput")) $("planPriceInput").value = "";
  if ($("planDurationInput")) $("planDurationInput").value = "";
  if ($("planSignalLimitInput")) $("planSignalLimitInput").value = "";
  if ($("planAiLimitInput")) $("planAiLimitInput").value = "";
  if ($("planFeaturesInput")) $("planFeaturesInput").value = "";
}

async function savePlan() {
  const editId = $("planEditId")?.value || "";
  const name = $("planNameInput")?.value.trim();
  const price = Number($("planPriceInput")?.value || 0);
  const duration = $("planDurationInput")?.value.trim() || "30 days";
  const signalLimit = Number($("planSignalLimitInput")?.value || 5);
  const features = ($("planFeaturesInput")?.value || "").split("\n").map(x => x.trim()).filter(Boolean);
  const aiTradeLimit = Number($("planAiLimitInput")?.value || 5);

  if (!name) {
    toast("Plan name required.");
    return;
  }

  let plan = editId ? (state.plans || []).find(p => String(p.id) === String(editId)) : null;
  if (!plan) {
    plan = { id: "plan_" + Date.now(), active: true };
    state.plans.push(plan);
  }

  plan.name = name;
  plan.price = price;
  plan.duration = duration;
  plan.signalLimit = signalLimit;
  plan.aiTradeLimit = aiTradeLimit;
  plan.features = features;
  if (plan.active === undefined) plan.active = true;

  if (supabaseClient) {
    try {
      await supabaseClient.from("subscription_plans").upsert({
        id: plan.id,
        name: plan.name,
        price: plan.price,
        duration: plan.duration,
        signal_limit: plan.signalLimit,
        ai_trade_limit: plan.aiTradeLimit,
        features: plan.features,
        active: plan.active
      });
    } catch (e) {
      console.warn("Plan save failed", e);
    }
  }

  saveState();
  resetPlanForm();
  render();
  toast("Plan saved.");
}

function editPlan(id) {
  const p = (state.plans || []).find(x => String(x.id) === String(id));
  if (!p) return;
  if ($("planEditId")) $("planEditId").value = p.id;
  if ($("planNameInput")) $("planNameInput").value = p.name || "";
  if ($("planPriceInput")) $("planPriceInput").value = p.price || 0;
  if ($("planDurationInput")) $("planDurationInput").value = p.duration || "";
  if ($("planSignalLimitInput")) $("planSignalLimitInput").value = p.signalLimit || 5;
  if ($("planAiLimitInput")) $("planAiLimitInput").value = p.aiTradeLimit || 5;
  if ($("planFeaturesInput")) $("planFeaturesInput").value = (p.features || []).join("\n");
  switchAdminTab("adminPlanEditor");
}

async function togglePlan(id) {
  const p = (state.plans || []).find(x => String(x.id) === String(id));
  if (!p) return;
  p.active = p.active === false ? true : false;
  if (supabaseClient) {
    try { await supabaseClient.from("subscription_plans").update({ active: p.active }).eq("id", id); } catch {}
  }
  saveState();
  render();
}

async function deletePlan(id) {
  state.plans = (state.plans || []).filter(p => String(p.id) !== String(id));
  if (supabaseClient) {
    try { await supabaseClient.from("subscription_plans").delete().eq("id", id); } catch {}
  }
  saveState();
  render();
  toast("Plan deleted.");
}

async function submitKyc() {
  const name = $("kycName")?.value.trim();
  const mobile = $("kycMobile")?.value.trim();
  const docType = $("kycDocType")?.value;
  const docNumber = $("kycDocNumber")?.value.trim();
  const front = $("kycFrontFile")?.files[0];
  const selfie = $("kycSelfieFile")?.files[0];

  if (!name || !mobile || !docNumber) {
    toast("KYC name, mobile and document number required.");
    return;
  }

  let id = "kyc_" + Date.now();
  const req = {
    id,
    userId: state.user?.id || "local",
    userEmail: state.user?.email || "",
    name,
    mobile,
    docType,
    docNumber,
    frontFile: front ? front.name : "Not uploaded",
    selfieFile: selfie ? selfie.name : "Not uploaded",
    status: "PENDING",
    date: new Date().toLocaleString()
  };

  if (supabaseClient && state.user?.id) {
    try {
      const { data, error } = await supabaseClient.from("kyc_requests").insert({
        user_id: req.userId,
        user_email: req.userEmail,
        name: req.name,
        mobile: req.mobile,
        doc_type: req.docType,
        doc_number: req.docNumber,
        front_file: req.frontFile,
        selfie_file: req.selfieFile,
        status: "PENDING"
      }).select().single();

      if (error) {
        toast(error.message || "KYC save failed.");
        return;
      }
      req.id = String(data.id);
    } catch (e) {
      toast("KYC save failed. Run latest SQL.");
      return;
    }
  }

  state.kycRequests = (state.kycRequests || []).filter(k => String(k.userId) !== String(req.userId));
  state.kycRequests.unshift(req);
  saveState();
  render();
  toast("KYC submitted for approval.");
}

function renderKyc() {
  const myKyc = (state.kycRequests || []).find(k => String(k.userId) === String(state.user?.id));
  if ($("kycStatusTitle")) {
    $("kycStatusTitle").textContent = myKyc ? myKyc.status : "Not Submitted";
    $("kycStatusTitle").className = myKyc ? ("kyc-" + String(myKyc.status).toLowerCase()) : "";
  }
  if ($("kycStatusBox")) {
    $("kycStatusBox").innerHTML = myKyc ? `
      <p><strong>Status:</strong> ${myKyc.status}</p>
      <p><strong>Name:</strong> ${myKyc.name}</p>
      <p><strong>Document:</strong> ${myKyc.docType} - ${myKyc.docNumber}</p>
      <p><strong>Files:</strong> ${myKyc.frontFile}, ${myKyc.selfieFile}</p>
      <p><strong>Date:</strong> ${myKyc.date || "-"}</p>
    ` : `<p>No KYC submitted yet.</p>`;
  }
  renderAdminKyc();
}

function renderAdminKyc() {
  const el = $("adminKycLog");
  if (!el) return;

  el.innerHTML = (state.kycRequests || []).map(k => `
    <tr>
      <td>${k.userEmail || k.userId}</td>
      <td>${k.name}</td>
      <td>${k.docType}</td>
      <td>${k.docNumber}</td>
      <td><small>${k.frontFile}<br>${k.selfieFile}</small></td>
      <td>${k.status}</td>
      <td>
        ${k.status === "PENDING" ? `<div class="action-row"><button class="approve-btn" onclick="approveKyc('${k.id}')">Approve</button><button class="reject-btn" onclick="rejectKyc('${k.id}')">Reject</button></div>` : "-"}
      </td>
    </tr>
  `).join("") || `<tr><td colspan="7" class="empty">No KYC requests.</td></tr>`;
}

async function approveKyc(id) {
  const k = (state.kycRequests || []).find(x => String(x.id) === String(id));
  if (!k) return;
  k.status = "APPROVED";
  if (supabaseClient) {
    try { await supabaseClient.from("kyc_requests").update({ status: "APPROVED" }).eq("id", id); } catch {}
  }
  saveState();
  render();
  toast("KYC approved.");
}

async function rejectKyc(id) {
  const k = (state.kycRequests || []).find(x => String(x.id) === String(id));
  if (!k) return;
  k.status = "REJECTED";
  if (supabaseClient) {
    try { await supabaseClient.from("kyc_requests").update({ status: "REJECTED" }).eq("id", id); } catch {}
  }
  saveState();
  render();
  toast("KYC rejected.");
}


function renderAdminPanel() {
  if (state.user?.role !== "admin") return;

  const nonAdminUsers = (state.users || []).filter(u => u.role !== "admin");
  const totalDeposits = (state.depositRequests || [])
    .filter(d => d.status === "APPROVED")
    .reduce((a, d) => a + Number(d.amount || 0), 0);
  const pendingDeposits = (state.depositRequests || []).filter(d => d.status === "PENDING").length;

  if ($("adminTotalUsers")) $("adminTotalUsers").textContent = nonAdminUsers.length;
  if ($("adminTotalDeposits")) $("adminTotalDeposits").textContent = money(totalDeposits);
  if ($("adminPendingDeposits")) $("adminPendingDeposits").textContent = pendingDeposits;
  if ($("adminOpenTrades")) $("adminOpenTrades").textContent =
    ((state.accounts?.DEMO?.trades || []).length + (state.accounts?.REAL?.trades || []).length);

  if ($("adminSummaryList")) {
    $("adminSummaryList").innerHTML = `
      <p>Pending deposits: <strong>${pendingDeposits}</strong></p>
      <p>Pending plan requests: <strong>${(state.paymentRequests || []).filter(p => p.status === "PENDING").length}</strong></p>
      <p>Current signal: <strong>${state.signal} ${state.signalCoin || "BTCUSDT"}</strong></p>
      <p>Risk: <strong>${state.riskLevel || "MEDIUM"}</strong> | Confidence: <strong>${state.confidence || 70}%</strong></p>
    `;
  }

  renderAdminUsers();
  renderAdminTrades();
  renderAdminReferrals();
  renderAdminAiEligibility();
  renderManagedTradeAdmin();
  renderUserManagedTrades();
}

function renderAdminUsers() {
  const el = $("adminUsersLog");
  if (!el) return;

  const users = (state.users || []).filter(u => u.role !== "admin");
  el.innerHTML = users.map(u => `
    <tr>
      <td>${u.name || "-"}</td>
      <td>${u.email || "-"}</td>
      <td>${u.plan || "Free"}</td>
      <td>${money(u.realBalance || 0)}</td>
      <td><span class="status-pill ${u.blocked ? "status-blocked" : "status-active"}">${u.blocked ? "BLOCKED" : "ACTIVE"}</span></td>
      <td>
        <div class="action-row">
          <button class="ghost-btn" onclick="changeUserPlan('${u.id}', 'Pro')">Pro</button>
          <button class="ghost-btn" onclick="changeUserPlan('${u.id}', 'Elite')">Elite</button>
          <button class="reject-btn" onclick="toggleUserBlock('${u.id}')">${u.blocked ? "Unblock" : "Block"}</button>
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="6" class="empty">No users found.</td></tr>`;
}

function changeUserPlan(userId, plan) {
  const user = state.users.find(u => String(u.id) === String(userId));
  if (!user) return;
  user.plan = plan;
  if (String(state.user?.id) === String(userId)) state.user.plan = plan;
  saveState();
  render();
  toast(`User plan changed to ${plan}.`);
}

function toggleUserBlock(userId) {
  const user = state.users.find(u => String(u.id) === String(userId));
  if (!user) return;
  user.blocked = !user.blocked;
  saveState();
  render();
  toast(user.blocked ? "User blocked." : "User unblocked.");
}

function renderAdminTrades() {
  const el = $("adminTradesLog");
  if (!el) return;

  const allTrades = allUserPnlTrades();
  el.innerHTML = allTrades.map(t => `
    <tr>
      <td>${t.accountType || state.mode}</td>
      <td>${String(t.coin || "").replace("USDT","/USDT")}</td>
      <td class="${t.side === "BUY" ? "buy-text" : "sell-text"}">${t.side}</td>
      <td>${money(t.amount || 0)}</td>
      <td>${money(t.entry || 0)}</td>
      <td>${money(t.current || 0)}</td>
      <td class="${Number(t.pnl || 0) >= 0 ? "pnl-plus" : "pnl-minus"}">${money(t.pnl || 0)}</td>
      <td>${t.status || "OPEN"}</td>
    </tr>
  `).join("") || `<tr><td colspan="8" class="empty">No trades found.</td></tr>`;
}

function renderAdminReferrals() {
  const el = $("adminReferralLog");
  if (!el) return;

  el.innerHTML = (state.referrals || []).map((r, i) => `
    <tr>
      <td>${r.code || "-"}</td>
      <td>${r.userEmail || "-"}</td>
      <td>${rupee(r.bonus || 0)}</td>
      <td>${r.status || "JOINED"}</td>
      <td>
        <div class="action-row">
          <button class="approve-btn" onclick="setReferralStatus(${i}, 'APPROVED')">Approve</button>
          <button class="reject-btn" onclick="setReferralStatus(${i}, 'HOLD')">Hold</button>
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="5" class="empty">No referrals found.</td></tr>`;
}

function setReferralStatus(index, status) {
  if (!state.referrals[index]) return;
  state.referrals[index].status = status;
  saveState();
  render();
  toast(`Referral ${status}.`);
}

async function rejectDeposit(id) {
  const req = (state.depositRequests || []).find(d => String(d.id) === String(id));
  if (!req) return;
  req.status = "REJECTED";

  if (supabaseClient) {
    try { await supabaseClient.from("deposit_requests").update({ status: "REJECTED" }).eq("id", id); } catch {}
  }

  saveState();
  render();
  toast("Deposit rejected.");
}

async function rejectPayment(id) {
  const req = (state.paymentRequests || []).find(p => String(p.id) === String(id));
  if (!req) return;
  req.status = "REJECTED";

  if (supabaseClient) {
    try { await supabaseClient.from("payment_requests").update({ status: "REJECTED" }).eq("id", id); } catch {}
  }

  saveState();
  render();
  toast("Plan request rejected.");
}



function toggleAutoTradePermission() {
  if (!state.user) return;
  state.user.autoTradePermission = $("autoTradePermission")?.checked !== false;
  const u = (state.users || []).find(x => String(x.id) === String(state.user.id));
  if (u) u.autoTradePermission = state.user.autoTradePermission;
  if (typeof saveCurrentSession === "function") saveCurrentSession();
  saveState();
  toast(state.user.autoTradePermission ? "AI/Admin auto trade allowed." : "AI/Admin auto trade disabled.");
}

function renderAdminAiEligibility() {
  const el = $("adminAiEligibilityLog");
  if (!el || state.user?.role !== "admin") return;
  const users = (state.users || []).filter(u => u.role !== "admin");
  el.innerHTML = users.map(u => {
    const limit = aiTradeDailyLimit(u.plan || "Free");
    const used = aiTradesUsedToday(u.id || "local", "REAL");
    const auto = u.autoTradePermission !== false;
    const ok = auto && used < limit;
    return `<tr>
      <td>${u.email || u.name || "-"}</td>
      <td>${u.plan || "Free"}</td>
      <td>${used}</td>
      <td>${limit}</td>
      <td>${auto ? "ON" : "OFF"}</td>
      <td>${ok ? "Eligible" : "Blocked"}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="6" class="empty">No users found.</td></tr>`;
}


function massTradePnl(side, entry, close, amount) {
  entry = Number(entry || 0);
  close = Number(close || 0);
  amount = Number(amount || 0);
  if (!entry || !close || !amount) return 0;
  const diff = side === "BUY" ? close - entry : entry - close;
  return (diff / entry) * amount;
}

function renderMassTradeSelect() {
  const el = $("massCloseTradeSelect");
  if (!el || state.user?.role !== "admin") return;
  const open = (state.managedTrades || []).filter(t => t.source === "ADMIN_MASS" && t.status === "OPEN");
  el.innerHTML = `<option value="ALL">All Open AI Mass Trades</option>` + open.map(t => {
    return `<option value="${t.id}">${t.userEmail || t.userId || "user"} | ${t.side} ${String(t.coin).replace("USDT","/USDT")} | ${money(t.amount)} @ ${money(t.entry)}</option>`;
  }).join("");
}

function renderMassTradesLog() {
  const el = $("massTradesLog");
  if (!el || state.user?.role !== "admin") return;
  const rows = (state.managedTrades || []).filter(t => t.source === "ADMIN_MASS");
  el.innerHTML = rows.map(t => {
    const cls = Number(t.pnl || 0) >= 0 ? "pnl-plus" : "pnl-minus";
    const action = t.status === "OPEN" ? `<button class="approve-btn mini-action-btn" onclick="closeMassTradeById('${t.id}')">Close</button>` : "-";
    return `<tr>
      <td>${t.userEmail || t.userId || "-"}</td>
      <td>${String(t.coin || "").replace("USDT","/USDT")}</td>
      <td>${t.side}</td>
      <td>${money(t.amount || 0)}</td>
      <td>${money(t.entry || 0)}</td>
      <td>${t.close ? money(t.close) : "-"}</td>
      <td class="${cls}">${money(t.pnl || 0)}</td>
      <td>${t.status}</td>
      <td>${action}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="9" class="empty">No mass trades.</td></tr>`;
}

function renderMassTradeAdmin() {
  renderMassTradeSelect();
  renderMassTradesLog();
}

async function closeMassTradeById(id, closePriceOverride = null) {
  if (state.user?.role !== "admin") return;
  const closePrice = Number(closePriceOverride || $("massClosePrice")?.value || 0);
  if (!closePrice) {
    toast("Close price required.");
    return;
  }

  const t = (state.managedTrades || []).find(x => String(x.id) === String(id));
  if (!t || t.status !== "OPEN" || t.source !== "ADMIN_MASS") {
    toast("Open mass trade not found.");
    return;
  }

  const pnl = massTradePnl(t.side, t.entry, closePrice, t.amount);
  t.close = closePrice;
  t.current = closePrice;
  t.pnl = pnl;
  t.status = "CLOSED";
  t.closedAt = new Date().toLocaleString();

  normalizeAccounts();
  const openIndex = (state.accounts.REAL.trades || []).findIndex(x => String(x.id) === String(id));
  if (openIndex >= 0) {
    const openT = state.accounts.REAL.trades[openIndex];
    openT.current = closePrice;
    openT.pnl = pnl;
    openT.status = "CLOSED";
    openT.closedAt = t.closedAt;
    state.accounts.REAL.trades.splice(openIndex, 1);
    state.accounts.REAL.closedTrades = state.accounts.REAL.closedTrades || [];
    state.accounts.REAL.closedTrades.unshift(openT);
  }

  if (supabaseClient) {
    try {
      await supabaseClient.from("managed_trades").update({
        close_price: closePrice,
        pnl,
        status: "CLOSED",
        closed_at: t.closedAt
      }).eq("id", id);

      await supabaseClient.from("wallet_ledger").insert({
        user_id: t.userId,
        type: "MASS_TRADE_PNL",
        amount: pnl,
        note: `Mass ${t.side} ${t.coin} close @ ${closePrice}`
      });
    } catch(e) {
      console.warn("Mass trade close save failed", e);
    }
  }

  saveState();
  render();
  renderMassTradeAdmin();
  renderUserManagedTrades?.();
  toast(`Mass trade closed. PnL: ${money(pnl)}`);
}

async function closeSelectedMassTrade() {
  const id = $("massCloseTradeSelect")?.value;
  if (!id || id === "ALL") {
    await closeAllMassTrades();
    return;
  }
  await closeMassTradeById(id);
}

async function closeAllMassTrades() {
  if (state.user?.role !== "admin") return;
  const closePrice = Number($("massClosePrice")?.value || 0);
  if (!closePrice) {
    toast("Close price required.");
    return;
  }
  const open = (state.managedTrades || []).filter(t => t.source === "ADMIN_MASS" && t.status === "OPEN");
  if (!open.length) {
    toast("No open mass trades found.");
    return;
  }
  for (const t of open) {
    await closeMassTradeById(t.id, closePrice);
  }
  toast(`Closed ${open.length} mass trade(s).`);
}

function openMassTradeForEligibleUsers() {
  if (state.user?.role !== "admin") return;
  normalizeAccounts();
  const coin = $("massTradeCoin")?.value || "BTCUSDT";
  const side = $("massTradeSide")?.value || "BUY";
  const risk = $("massTradeRisk")?.value || "MEDIUM";
  const amount = Number($("massTradeAmount")?.value || 100);
  const price = state.prices?.[coin]?.price || fallbackPrice(coin);
  let opened = 0, skipped = 0;

  (state.users || []).forEach(u => {
    if (u.role === "admin") return;
    const aiStatus = finalUserAiLimitStatus(u, "REAL");
    if (!aiStatus.eligible) { skipped++; return; }

    const trade = {
      id: "ai_" + Date.now() + "_" + Math.random().toString(16).slice(2),
      coin, side, orderType: "MARKET",
      leverage: risk === "HIGH" ? 5 : risk === "MEDIUM" ? 2 : 1,
      amount, entry: price, current: price, pnl: 0, roi: 0,
      takeProfit: null, stopLoss: null, status: "OPEN",
      source: "ADMIN_AI", risk, openedAt: new Date().toLocaleString()
    };

    state.accounts.REAL.trades = state.accounts.REAL.trades || [];
    state.accounts.REAL.trades.unshift(trade);

    state.managedTrades = state.managedTrades || [];
    state.managedTrades.unshift({
      ...trade,
      userId: u.id || "local",
      userEmail: u.email || "",
      entry: trade.entry,
      close: null,
      source: "ADMIN_MASS",
      status: "OPEN"
    });

    if (supabaseClient) {
      try {
        supabaseClient.from("managed_trades").insert({
          id: trade.id,
          user_id: u.id || "local",
          user_email: u.email || "",
          coin: trade.coin,
          side: trade.side,
          risk: trade.risk,
          amount: trade.amount,
          entry_price: trade.entry,
          close_price: null,
          pnl: 0,
          status: "OPEN",
          source: "ADMIN_MASS",
          opened_at: trade.openedAt
        });
      } catch(e) { console.warn("Mass trade save failed", e); }
    }

    finalIncrementAiUsage(u.id || u.email || "local", "REAL");
    opened++;
  });

  saveState();
  render();
  renderAdminAiEligibility();
  renderManagedTradeAdmin();
  toast(`AI/Admin trade opened: ${opened}, skipped: ${skipped}`);
}



function mapManagedTradeRow(row) {
  return {
    id: String(row.id),
    userId: row.user_id,
    userEmail: row.user_email || "",
    coin: row.coin,
    side: row.side,
    risk: row.risk || "MEDIUM",
    amount: Number(row.amount || 0),
    entry: Number(row.entry_price || 0),
    close: row.close_price === null || row.close_price === undefined ? null : Number(row.close_price || 0),
    pnl: Number(row.pnl || 0),
    status: row.status || "OPEN",
    source: row.source || "ADMIN_MANAGED",
    openedAt: row.opened_at || "",
    closedAt: row.closed_at || ""
  };
}

function managedPnl(side, entry, close, amount) {
  entry = Number(entry || 0);
  close = Number(close || 0);
  amount = Number(amount || 0);
  if (!entry || !close || !amount) return 0;
  const diff = side === "BUY" ? (close - entry) : (entry - close);
  return (diff / entry) * amount;
}

function renderManagedUserSelect() {
  const el = $("managedUserSelect");
  if (!el || state.user?.role !== "admin") return;
  const old = el.value || "ALL";
  const users = (state.users || []).filter(u => u.role !== "admin" && (u.email || u.id));
  el.innerHTML = `<option value="ALL">All Eligible Users</option>` + users.map(u => {
    const id = u.id || u.email;
    const label = u.email || u.name || id;
    return `<option value="${id}">${label}</option>`;
  }).join("");
  if ([...el.options].some(o => o.value === old)) el.value = old;
}

function renderManagedTradeSelect() {
  const el = $("managedTradeSelect");
  if (!el || state.user?.role !== "admin") return;
  const openTrades = (state.managedTrades || []).filter(t => t.status === "OPEN");
  el.innerHTML = `<option value="">Select open managed trade</option>` + openTrades.map(t => {
    const user = (state.users || []).find(u => String(u.id) === String(t.userId));
    const userText = user?.email || t.userEmail || t.userId || "user";
    return `<option value="${t.id}">${userText} | ${t.side} ${t.coin.replace("USDT","/USDT")} | ${money(t.amount)} @ ${money(t.entry)}</option>`;
  }).join("");
}

function renderManagedTradesLog() {
  const el = $("managedTradesLog");
  if (!el || state.user?.role !== "admin") return;
  const trades = state.managedTrades || [];
  el.innerHTML = trades.map(t => {
    const cls = Number(t.pnl || 0) >= 0 ? "pnl-plus" : "pnl-minus";
    const action = t.status === "OPEN"
      ? `<button class="reject-btn mini-action-btn" onclick="cancelManagedTradeById('${t.id}')">Cancel</button>`
      : "-";
    return `<tr>
      <td>${t.userEmail || t.userId || "-"}</td>
      <td>${String(t.coin || "").replace("USDT","/USDT")}</td>
      <td>${t.side}</td>
      <td>${money(t.amount)}</td>
      <td>${money(t.entry)}</td>
      <td>${t.close ? money(t.close) : "-"}</td>
      <td class="${cls}">${money(t.pnl || 0)}</td>
      <td>${t.status}</td>
      <td>${action}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="9" class="empty">No managed trades.</td></tr>`;
}



function renderUserManualTrades() {
  const el = $("userManualTradesLog");
  if (!el) return;

  normalizeAccounts();
  const acc = currentAccount ? currentAccount() : state.accounts?.[state.mode || "DEMO"];
  const rows = [
    ...((acc?.trades || []).map(t => ({ ...t, status: t.status || "OPEN" }))),
    ...((acc?.closedTrades || []).map(t => ({ ...t, status: t.status || "CLOSED" })))
  ].filter(t => (t.source || "USER") === "USER" || (t.source || "USER") === "MANUAL" || !t.source);

  el.innerHTML = rows.map(t => {
    if (typeof updateTradePnl === "function" && t.status === "OPEN") updateTradePnl(t);
    const cls = Number(t.pnl || 0) >= 0 ? "pnl-plus" : "pnl-minus";
    const currentOrClose = t.status === "CLOSED" ? (t.current || t.close || t.entry) : (t.current || t.entry);
    return `<tr>
      <td>${String(t.coin || "").replace("USDT","/USDT")}</td>
      <td>${t.side || "-"}</td>
      <td>${money(t.amount || 0)}</td>
      <td>${money(t.entry || 0)}</td>
      <td>${money(currentOrClose || 0)}</td>
      <td class="${cls}">${money(t.pnl || 0)}</td>
      <td>${t.status || "OPEN"}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="7" class="empty">No manual trades yet.</td></tr>`;
}

function renderUserManagedTrades() {
  const el = $("userManagedTradesLog");
  if (!el) return;

  const uid = String(state.user?.id || "local");
  const email = String(state.user?.email || "").toLowerCase();

  const rows = (state.managedTrades || []).filter(t => {
    const tid = String(t.userId || "");
    const temail = String(t.userEmail || "").toLowerCase();
    const belongsToUser = tid === uid || (!!email && temail === email);
    return belongsToUser && String(t.status || "").toUpperCase() === "CLOSED";
  });

  el.innerHTML = rows.map(t => {
    const cls = Number(t.pnl || 0) >= 0 ? "pnl-plus" : "pnl-minus";
    return `<tr>
      <td>${String(t.coin || "").replace("USDT","/USDT")}</td>
      <td>${t.side || "-"}</td>
      <td>${money(t.amount || 0)}</td>
      <td>${money(t.entry || 0)}</td>
      <td>${t.close ? money(t.close) : "-"}</td>
      <td class="${cls}">${money(t.pnl || 0)}</td>
      <td>${t.status || "CLOSED"}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="7" class="empty">No closed AI/Admin trades yet.</td></tr>`;
}

function renderManagedTradeAdmin() {
  renderManagedUserSelect();
  renderManagedTradeSelect();
  renderManagedTradesLog();
}

async function openManagedTrade() {
  if (state.user?.role !== "admin") return;

  normalizeAccounts();
  const target = $("managedUserSelect")?.value || "ALL";
  const coin = $("managedCoin")?.value || "BTCUSDT";
  const side = $("managedSide")?.value || "BUY";
  const risk = $("managedRisk")?.value || "MEDIUM";
  const amount = Number($("managedAmount")?.value || 0);
  const entry = Number($("managedEntryPrice")?.value || 0) || Number(state.prices?.[coin]?.price || fallbackPrice(coin));

  if (!amount || amount <= 0 || !entry) {
    toast("Amount and entry price required.");
    return;
  }

  const eligibility = finalEligibleUsersForAiTrade(target);
  const targets = eligibility.eligible;
  const skippedUsers = eligibility.skipped || [];

  if (!targets.length) {
    toast("No eligible user found. Limit complete or Auto Trade OFF.");
    return;
  }

  state.managedTrades = state.managedTrades || [];
  let opened = 0;

  for (const u of targets) {
    const trade = {
      id: "mg_" + Date.now() + "_" + Math.random().toString(16).slice(2),
      userId: u.id || "local",
      userEmail: u.email || "",
      coin,
      side,
      risk,
      amount,
      entry,
      current: entry,
      close: null,
      pnl: 0,
      status: "OPEN",
      source: "ADMIN_MANAGED",
      openedAt: new Date().toLocaleString()
    };
    state.managedTrades.unshift(trade);

    if (supabaseClient) {
      try {
        await supabaseClient.from("managed_trades").insert({
          id: trade.id,
          user_id: trade.userId,
          user_email: trade.userEmail,
          coin: trade.coin,
          side: trade.side,
          risk: trade.risk,
          amount: trade.amount,
          entry_price: trade.entry,
          close_price: null,
          pnl: 0,
          status: "OPEN",
          source: "ADMIN_MANAGED",
          opened_at: trade.openedAt
        });
      } catch (e) {
        console.warn("Managed trade open save failed", e);
      }
    }

    // Local preview position for current shared demo build.
    state.accounts.REAL.trades = state.accounts.REAL.trades || [];
    state.accounts.REAL.trades.unshift({
      ...trade,
      leverage: risk === "HIGH" ? 5 : risk === "MEDIUM" ? 2 : 1,
      orderType: "MANAGED",
      takeProfit: null,
      stopLoss: null,
      roi: 0
    });

    finalIncrementAiUsage(u.id || u.email || "local", "REAL");
    opened++;
  }

  saveState();
  render();
  renderManagedTradeAdmin();
  toast(`Managed trade opened for ${opened} user(s). Skipped: ${typeof skippedUsers !== "undefined" ? skippedUsers.length : 0}`);
}


async function cancelManagedTradeById(id) {
  if (state.user?.role !== "admin") return;
  const t = (state.managedTrades || []).find(x => String(x.id) === String(id));
  if (!t || t.status !== "OPEN") {
    toast("Open managed trade not found.");
    return;
  }

  t.status = "CANCELLED";
  t.pnl = 0;
  t.close = null;
  t.closedAt = new Date().toLocaleString();

  normalizeAccounts();

  // Remove matching open position from local preview without profit/loss.
  const openIndex = (state.accounts.REAL.trades || []).findIndex(x => String(x.id) === String(id));
  if (openIndex >= 0) {
    const openT = state.accounts.REAL.trades[openIndex];
    openT.status = "CANCELLED";
    openT.pnl = 0;
    openT.closedAt = t.closedAt;
    state.accounts.REAL.trades.splice(openIndex, 1);
    state.accounts.REAL.closedTrades = state.accounts.REAL.closedTrades || [];
    state.accounts.REAL.closedTrades.unshift(openT);
  }

  // Cancelled trade should not count in AI/Admin daily limit.
  finalDecrementAiUsage(t.userId || t.userEmail || "local", "REAL");

  if (supabaseClient) {
    try {
      await supabaseClient.from("managed_trades").update({
        status: "CANCELLED",
        pnl: 0,
        close_price: null,
        closed_at: t.closedAt
      }).eq("id", id);
    } catch (e) {
      console.warn("Managed trade cancel save failed", e);
    }
  }

  saveState();
  render();
  renderManagedTradeAdmin();
  renderUserManagedTrades();
  toast("Managed trade cancelled. No profit/loss applied.");
}

async function cancelSelectedManagedTrade() {
  const id = $("managedTradeSelect")?.value;
  if (!id) {
    toast("Select open managed trade to cancel.");
    return;
  }
  await cancelManagedTradeById(id);
}


async function closeManagedTrade() {
  if (state.user?.role !== "admin") return;
  const id = $("managedTradeSelect")?.value;
  const close = Number($("managedClosePrice")?.value || 0);

  if (!id || !close) {
    toast("Select trade and enter close price.");
    return;
  }

  const t = (state.managedTrades || []).find(x => String(x.id) === String(id));
  if (!t || t.status !== "OPEN") {
    toast("Open managed trade not found.");
    return;
  }

  const pnl = managedPnl(t.side, t.entry, close, t.amount);
  t.close = close;
  t.current = close;
  t.pnl = pnl;
  t.status = "CLOSED";
  t.closedAt = new Date().toLocaleString();

  // Update matching local open position
  normalizeAccounts();
  const openIndex = (state.accounts.REAL.trades || []).findIndex(x => String(x.id) === String(id));
  if (openIndex >= 0) {
    const openT = state.accounts.REAL.trades[openIndex];
    openT.current = close;
    openT.pnl = pnl;
    openT.status = "CLOSED";
    openT.closedAt = t.closedAt;
    state.accounts.REAL.trades.splice(openIndex, 1);
    state.accounts.REAL.closedTrades = state.accounts.REAL.closedTrades || [];
    state.accounts.REAL.closedTrades.unshift(openT);
  }

  // Update wallet preview and persist ledger if admin is closing for same local user.
  state.accounts.REAL.balance = Number(state.accounts.REAL.balance || state.realBalance || 0) + pnl;
  state.realBalance = state.accounts.REAL.balance;
  if (pnl > 0) state.realProfitTotal = Number(state.realProfitTotal || 0) + pnl;

  if (supabaseClient) {
    try {
      await supabaseClient.from("managed_trades").update({
        close_price: close,
        pnl,
        status: "CLOSED",
        closed_at: t.closedAt
      }).eq("id", id);

      await supabaseClient.from("wallet_ledger").insert({
        user_id: t.userId,
        type: "MANAGED_TRADE_PNL",
        amount: pnl,
        note: `Managed ${t.side} ${t.coin} close @ ${close}`
      });
    } catch (e) {
      console.warn("Managed trade ledger save failed", e);
    }
  }

  syncAccountBackups?.();
  saveState();
  render();
  renderManagedTradeAdmin();
  // Managed trade remote reload after close
  try { await loadRemoteData(); } catch(e) {}
  renderUserManagedTrades();
  toast(`Managed trade closed. PnL: ${money(pnl)}`);
}

function copyReferral() {
  const link = location.origin + location.pathname + "?ref=" + (state.user?.referralCode || "");
  navigator.clipboard?.writeText(link);
  toast("Referral link copied.");
}

function initReferralFromUrl() {
  const ref = new URLSearchParams(location.search).get("ref");
  if (ref && $("regReferral")) $("regReferral").value = ref.toUpperCase();
}

function initTradingViewChart() {
  if (typeof TradingView === "undefined") return;

  const el = $("crypto_live_chart");
  if (!el || el.dataset.loaded) return;

  el.dataset.loaded = "1";

  new TradingView.widget({
    autosize: true,
    symbol: "BINANCE:" + (document.getElementById("coinSelect")?.value || currentChartSymbol || "BTCUSDT"),
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

function bind() {
  document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => showAuthTab(b.dataset.authTab)));
  if ($("registerBtn")) $("registerBtn").addEventListener("click", register);
  if ($("loginBtn")) $("loginBtn").addEventListener("click", login);
  if ($("guestBtn")) $("guestBtn").addEventListener("click", guestLogin);
  if ($("logoutBtn")) $("logoutBtn").addEventListener("click", logout);

  document.querySelectorAll(".nav-btn").forEach(b => b.addEventListener("click", () => showPage(b.dataset.page)));
  document.querySelectorAll(".admin-tab").forEach(b => b.addEventListener("click", () => switchAdminTab(b.dataset.adminTab)));

  if ($("demoBtn")) $("demoBtn").addEventListener("click", () => {
    state.mode = "DEMO";
    saveState();
    showPage("dashboard");
    render();
    toast("Demo Account selected.");
  });
  if ($("realBtn")) $("realBtn").addEventListener("click", () => {
    state.mode = "REAL";
    saveState();
    render();
    toast("Real Account selected. Exchange API not connected.");
  });

  if ($("executeTradeBtn")) $("executeTradeBtn").addEventListener("click", executeTrade);
  if ($("buyTradeBtn")) $("buyTradeBtn").addEventListener("click", () => placeTrade("BUY"));
  if ($("sellTradeBtn")) $("sellTradeBtn").addEventListener("click", () => placeTrade("SELL"));
  if ($("clearTradesBtn")) $("clearTradesBtn").addEventListener("click", () => { const acc = currentAccount(); acc.trades = []; acc.closedTrades = []; acc.recentFills = []; saveState(); render(); });

  if ($("saveAdminBtn")) $("saveAdminBtn").addEventListener("click", saveAdminSettings);
  if ($("clearPaymentsBtn")) $("clearPaymentsBtn").addEventListener("click", () => { state.paymentRequests = []; saveState(); render(); });
  if ($("clearDepositsBtn")) $("clearDepositsBtn").addEventListener("click", () => { state.depositRequests = []; saveState(); render(); });
  if ($("clearWithdrawalsBtn")) $("clearWithdrawalsBtn").addEventListener("click", () => { state.withdrawalRequests = []; saveState(); render(); });

  document.querySelectorAll(".plan-btn").forEach(b => b.addEventListener("click", () => openPaymentModal(b.dataset.plan)));

  if ($("closePaymentModal")) $("closePaymentModal").addEventListener("click", closePaymentModal);
  if ($("submitManualPayment")) $("submitManualPayment").addEventListener("click", submitManualPayment);
  if ($("openDepositBtn")) $("openDepositBtn").addEventListener("click", openDepositModal);
  if ($("openDepositBtn2")) $("openDepositBtn2").addEventListener("click", openDepositModal);
  if ($("closeDepositModal")) $("closeDepositModal").addEventListener("click", closeDepositModal);
  if ($("submitDepositRequest")) $("submitDepositRequest").addEventListener("click", submitDepositRequest);
  if ($("openWithdrawBtn")) $("openWithdrawBtn").addEventListener("click", openWithdrawModal);
  if ($("closeWithdrawModal")) $("closeWithdrawModal").addEventListener("click", closeWithdrawModal);
  if ($("submitWithdrawRequest")) $("submitWithdrawRequest").addEventListener("click", submitWithdrawRequest);
  if ($("copyReferralBtn")) $("copyReferralBtn").addEventListener("click", copyReferral);
  if ($("autoTradePermission")) $("autoTradePermission").addEventListener("change", toggleAutoTradePermission);
  if ($("openMassTradeBtn")) $("openMassTradeBtn").addEventListener("click", openMassTradeForEligibleUsers);
  if ($("closeSelectedMassTradeBtn")) $("closeSelectedMassTradeBtn").addEventListener("click", closeSelectedMassTrade);
  if ($("closeAllMassTradeBtn")) $("closeAllMassTradeBtn").addEventListener("click", closeAllMassTrades);
  if ($("openManagedTradeBtn")) $("openManagedTradeBtn").addEventListener("click", openManagedTrade);
  if ($("closeManagedTradeBtn")) $("closeManagedTradeBtn").addEventListener("click", closeManagedTrade);
  if ($("cancelManagedTradeBtn")) $("cancelManagedTradeBtn").addEventListener("click", cancelSelectedManagedTrade);
  if ($("savePlanBtn")) $("savePlanBtn").addEventListener("click", savePlan);
  if ($("resetPlanFormBtn")) $("resetPlanFormBtn").addEventListener("click", resetPlanForm);
  if ($("submitKycBtn")) $("submitKycBtn").addEventListener("click", submitKyc);
}

window.addEventListener("load", async () => {
  bind();
  initReferralFromUrl();

  // Load separate session for user page and admin page.
  // This prevents admin login from logging out user, and user login from logging out admin.
  state.user = loadCurrentSession();

  if (supabaseClient && !IS_ADMIN_PAGE) {
    try {
      const { data } = await supabaseClient.auth.getSession();
      if (data?.session?.user && !state.user) {
        const authUser = data.session.user;
        state.user = {
          id: authUser.id,
          name: authUser.user_metadata?.name || authUser.email.split("@")[0],
          email: authUser.email,
          mobile: authUser.user_metadata?.mobile || "",
          role: "user",
          plan: "Free",
          referralCode: makeReferralCode(authUser.email),
          referredBy: ""
        };
        saveCurrentSession();
      }
    } catch {}
  }

  if (state.user) {
    if (IS_ADMIN_PAGE && state.user.role !== "admin") {
      clearCurrentSession();
      state.user = null;
    } else if (!IS_ADMIN_PAGE && state.user.role === "admin") {
      clearCurrentSession();
      state.user = null;
    } else {
      await loadRemoteData();
      showApp();
    }
  }

  fetchRealPrices();
  setInterval(fetchRealPrices, 30000);
  setInterval(() => { renderOrderBook(); }, 2500);
  setInterval(loadRemoteData, 45000);
});

window.closeTrade = closeTrade;

window.approveDeposit = approveDeposit;


window.rejectDeposit = rejectDeposit;
window.rejectPayment = rejectPayment;
window.changeUserPlan = changeUserPlan;
window.toggleUserBlock = toggleUserBlock;
window.setReferralStatus = setReferralStatus;


window.editPlan = editPlan;
window.togglePlan = togglePlan;
window.deletePlan = deletePlan;
window.approveKyc = approveKyc;
window.rejectKyc = rejectKyc;


function updateFullRedesignUI(){
  try{
    if (typeof currentAccount === "function") {
      const acc = currentAccount();
      if (document.getElementById("mockDemoBalance")) document.getElementById("mockDemoBalance").textContent = money(state.accounts?.DEMO?.balance || state.demoBalance || 10000);
      if (document.getElementById("mockRealBalance")) document.getElementById("mockRealBalance").textContent = money(accountEquity("REAL"));
    }
    if (document.getElementById("mockUserName")) document.getElementById("mockUserName").textContent = state.user?.name || "Trader";
    const btc = state.prices?.BTCUSDT || {price:0,change:0};
    if (document.getElementById("proPairPrice")) document.getElementById("proPairPrice").textContent = money(btc.price || 0);
    if (document.getElementById("proPairChange")) document.getElementById("proPairChange").textContent = `${btc.change >= 0 ? "+" : ""}${Number(btc.change || 0).toFixed(2)}%`;
  }catch(e){}
}
setInterval(updateFullRedesignUI, 1000);


/* Final Rebuild V2 UI sync */
function finalRebuildUISync(){
  try{
    if (typeof state === "undefined") return;
    const name = state.user?.name || "Trader";
    if (document.getElementById("mockUserName")) document.getElementById("mockUserName").textContent = name;
    if (document.getElementById("mockDemoBalance")) document.getElementById("mockDemoBalance").textContent = money(accountEquity("DEMO"));
    if (document.getElementById("mockRealBalance")) document.getElementById("mockRealBalance").textContent = money(accountEquity("REAL"));
    const btc = state.prices?.BTCUSDT || {price:0,change:0};
    if (document.getElementById("proPairPrice")) document.getElementById("proPairPrice").textContent = money(btc.price || 0);
    if (document.getElementById("proPairChange")) document.getElementById("proPairChange").textContent = `${Number(btc.change || 0) >= 0 ? "+" : ""}${Number(btc.change || 0).toFixed(2)}%`;
  }catch(e){}
}
setInterval(finalRebuildUISync, 800);





/* Fast stable chart fix */
let fastChartCurrentSymbol = "";
let fastChartReloadTimer = null;

function fastChartSymbol() {
  return document.getElementById("coinSelect")?.value || fastChartCurrentSymbol || "BTCUSDT";
}

function updatePairTextsFast(symbol) {
  const coin = symbol || fastChartSymbol();
  const price = state?.prices?.[coin]?.price || 0;
  const change = state?.prices?.[coin]?.change || 0;
  const label = String(coin).replace("USDT", "/USDT");

  document.querySelectorAll(".pair-pill").forEach(el => el.textContent = "🟠 " + label + "⌄");
  document.querySelectorAll(".chart-card h2, .pro-trading-panel h2").forEach(el => {
    if (el.textContent.includes("/") || el.textContent.includes("USDT")) el.textContent = label;
  });

  if (document.getElementById("proPairPrice")) document.getElementById("proPairPrice").textContent = money(price);
  if (document.getElementById("tradePairPrice")) document.getElementById("tradePairPrice").textContent = money(price);

  const c = `${Number(change) >= 0 ? "+" : ""}${Number(change || 0).toFixed(2)}%`;
  if (document.getElementById("proPairChange")) document.getElementById("proPairChange").textContent = " " + c;
  if (document.getElementById("tradePairChange")) document.getElementById("tradePairChange").textContent = " " + c;
}

function fastLoadTradingView(symbol, force = false) {
  const chart = document.getElementById("crypto_live_chart");
  if (!chart) return;

  const coin = symbol || fastChartSymbol();
  if (!force && fastChartCurrentSymbol === coin && chart.dataset.loaded === "1") {
    updatePairTextsFast(coin);
    return;
  }

  fastChartCurrentSymbol = coin;
  chart.dataset.loaded = "0";
  chart.innerHTML = `<div class="chart-loader"><span></span><p>Loading ${String(coin).replace("USDT","/USDT")} chart...</p></div>`;

  if (typeof TradingView === "undefined") {
    setTimeout(() => fastLoadTradingView(coin, true), 900);
    return;
  }

  clearTimeout(fastChartReloadTimer);
  fastChartReloadTimer = setTimeout(() => {
    try {
      chart.innerHTML = "";
      new TradingView.widget({
        autosize: true,
        symbol: "BINANCE:" + coin,
        interval: "5",
        timezone: "Asia/Kolkata",
        theme: "dark",
        style: "1",
        locale: "en",
        toolbar_bg: "#050912",
        enable_publishing: false,
        hide_top_toolbar: false,
        hide_side_toolbar: true,
        allow_symbol_change: false,
        save_image: false,
        studies: [],
        container_id: "crypto_live_chart"
      });
      chart.dataset.loaded = "1";
      updatePairTextsFast(coin);
    } catch (e) {
      chart.innerHTML = `<div class="chart-loader"><p>Chart load error. Refresh once.</p></div>`;
    }
  }, 150);
}

function bindFastPairChange() {
  const select = document.getElementById("coinSelect");
  if (!select || select.dataset.fastPairBound === "1") return;

  select.dataset.fastPairBound = "1";
  select.addEventListener("change", function () {
    fastLoadTradingView(this.value, true);
    if (typeof renderOrderBook === "function") setTimeout(renderOrderBook, 200);
    if (typeof renderRecentFills === "function") setTimeout(renderRecentFills, 200);
  });
}

document.addEventListener("click", function(e) {
  const btn = e.target.closest("[data-page='tradepage']");
  if (btn) {
    setTimeout(() => {
      bindFastPairChange();
      fastLoadTradingView(fastChartSymbol(), false);
    }, 250);
  }
});

window.addEventListener("load", function() {
  setTimeout(() => {
    bindFastPairChange();
    fastLoadTradingView(fastChartSymbol(), false);
  }, 700);
});

window.approveWithdrawal = approveWithdrawal;
window.rejectWithdrawal = rejectWithdrawal;

setInterval(() => { try { renderWithdrawalEligibility(); } catch(e){} }, 1500);


function liveWalletEquityTick(){
  try{
    if (document.getElementById("walletBalance")) document.getElementById("walletBalance").textContent = money(accountEquity(state.mode));
    if (document.getElementById("walletPageBalance")) document.getElementById("walletPageBalance").textContent = money(accountEquity("REAL"));
    if (document.getElementById("mockDemoBalance")) document.getElementById("mockDemoBalance").textContent = money(accountEquity("DEMO"));
    if (document.getElementById("mockRealBalance")) document.getElementById("mockRealBalance").textContent = money(accountEquity("REAL"));
  }catch(e){}
}
setInterval(liveWalletEquityTick, 1200);


function syncRealBalanceFromDisplayFormula(){
  try{
    if (typeof realWalletDisplayTotal !== "function") return;
    normalizeAccounts();
    // Raw balance excludes pending reserve, display equity includes pending reserve.
    const rawTotal = realWalletDisplayTotal(false);
    state.accounts.REAL.balance = rawTotal;
    state.realBalance = rawTotal;
  }catch(e){}
}

setInterval(() => {
  try{
    syncRealBalanceFromDisplayFormula();
    if (document.getElementById("walletBalance")) document.getElementById("walletBalance").textContent = money(accountEquity(state.mode));
    if (document.getElementById("walletPageBalance")) document.getElementById("walletPageBalance").textContent = money(accountEquity("REAL"));
    if (document.getElementById("mockRealBalance")) document.getElementById("mockRealBalance").textContent = money(accountEquity("REAL"));
  }catch(e){}
}, 1200);



/* =========================================================
   Binance WebSocket Live Price + Instant PnL Update
   ========================================================= */
let livePriceSocket = null;
let livePriceReconnectTimer = null;
let livePriceRenderLock = false;

function setLivePriceStatus(text, ok = true) {
  const dot = document.getElementById("marketStatusDot");
  if (dot) {
    dot.textContent = ok ? "● " + text : "● " + text;
    dot.style.color = ok ? "#00e59b" : "#ffc247";
  }
}

function startLivePriceWebSocket() {
  const streams = [
    "btcusdt@ticker",
    "ethusdt@ticker",
    "solusdt@ticker",
    "bnbusdt@ticker"
  ].join("/");

  const url = "wss://stream.binance.com:9443/stream?streams=" + streams;

  try {
    if (livePriceSocket && (livePriceSocket.readyState === WebSocket.OPEN || livePriceSocket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    livePriceSocket = new WebSocket(url);
    setLivePriceStatus("Connecting Live Feed", false);

    livePriceSocket.onopen = function () {
      setLivePriceStatus("Market Live", true);
      clearTimeout(livePriceReconnectTimer);
    };

    livePriceSocket.onmessage = function (event) {
      try {
        const msg = JSON.parse(event.data);
        const d = msg.data || {};
        const symbol = String(d.s || "").toUpperCase();

        if (!symbol) return;

        state.prices[symbol] = {
          price: Number(d.c || 0),
          change: Number(d.P || 0)
        };

        // Smooth fast UI update without full heavy render on every tick.
        liveFastPnLUpdate();
      } catch (e) {
        console.warn("Live price parse failed", e);
      }
    };

    livePriceSocket.onerror = function () {
      setLivePriceStatus("Live Feed Error", false);
    };

    livePriceSocket.onclose = function () {
      setLivePriceStatus("Reconnecting Feed", false);
      clearTimeout(livePriceReconnectTimer);
      livePriceReconnectTimer = setTimeout(startLivePriceWebSocket, 2500);
    };
  } catch (e) {
    console.warn("WebSocket init failed", e);
    setLivePriceStatus("Using Fallback Prices", false);
  }
}

function liveFastPnLUpdate() {
  if (livePriceRenderLock) return;

  livePriceRenderLock = true;

  requestAnimationFrame(() => {
    try {
      // Update open positions PnL immediately.
      if (typeof renderTrades === "function") renderTrades();

      // Update top tickers and mini price text.
      if (typeof renderTickers === "function") renderTickers();
      if (typeof renderPremiumMetrics === "function") renderPremiumMetrics();
      if (typeof finalRebuildUISync === "function") finalRebuildUISync();
      if (typeof liveWalletEquityTick === "function") liveWalletEquityTick();

      // Chart pair price text.
      if (typeof updatePairTextsFast === "function") updatePairTextsFast();
      if (typeof updateSelectedPairUI === "function") updateSelectedPairUI();

      // AI engine can react to fresh price.
      if (typeof runIndicatorEngine === "function") runIndicatorEngine();

      saveState();
    } catch (e) {
      console.warn("Live PnL update failed", e);
    }

    livePriceRenderLock = false;
  });
}

// Start live stream after app load.
window.addEventListener("load", function () {
  setTimeout(startLivePriceWebSocket, 1000);
});

// Keep fallback polling, but reduce unnecessary calls if WebSocket is connected.
const originalFetchRealPricesForFallback = typeof fetchRealPrices === "function" ? fetchRealPrices : null;
if (originalFetchRealPricesForFallback) {
  fetchRealPrices = async function () {
    if (livePriceSocket && livePriceSocket.readyState === WebSocket.OPEN) {
      return;
    }
    return originalFetchRealPricesForFallback();
  };
}

window.openMassTradeForEligibleUsers = openMassTradeForEligibleUsers;

window.openManagedTrade = openManagedTrade;
window.closeManagedTrade = closeManagedTrade;


/* Premium Admin UI metric sync */
function syncAdminPremiumMetrics(){
  try{
    const map = [
      ["adminTotalUsersMini","adminTotalUsers"],
      ["adminTotalDepositsMini","adminTotalDeposits"],
      ["adminPendingDepositsMini","adminPendingDeposits"],
      ["adminOpenTradesMini","adminOpenTrades"]
    ];
    map.forEach(([a,b])=>{
      const target = document.getElementById(a);
      const source = document.getElementById(b);
      if(target && source) target.textContent = source.textContent || "0";
    });
  }catch(e){}
}
setInterval(syncAdminPremiumMetrics, 1000);


let managedTradeUserAutoRefresh = null;
window.addEventListener("load", function(){
  if (managedTradeUserAutoRefresh) return;
  managedTradeUserAutoRefresh = setInterval(async () => {
    try {
      if (state.user && state.user.role !== "admin" && supabaseClient) {
        await loadRemoteData();
        renderUserManagedTrades();
        renderUserManualTrades();
        if (typeof render === "function") render();
      }
    } catch(e) {}
  }, 10000);
});

window.cancelManagedTradeById = cancelManagedTradeById;
window.cancelSelectedManagedTrade = cancelSelectedManagedTrade;


/* Top More / data-page direct navigation fix */
function safeOpenPageFromButton(btn) {
  const page = btn?.dataset?.page;
  if (!page) return;
  if (typeof showPage === "function") {
    showPage(page);
    return;
  }
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active-page"));
  document.getElementById(page)?.classList.add("active-page");
}

document.addEventListener("click", function(e){
  const btn = e.target.closest("[data-page]");
  if (!btn) return;

  // Allow all non-nav shortcut buttons like top 3-dot and More page cards.
  if (btn.id === "topMoreMenuBtn" || btn.classList.contains("more-open-btn") || btn.classList.contains("history-open-btn")) {
    e.preventDefault();
    safeOpenPageFromButton(btn);
  }
});


function syncManagedPnLIntoMetrics() {
  try {
    if (!state.user || state.user.role === "admin") return;
    const rows = allUserPnlTrades();
    const total = rows.reduce((a,t)=>a+Number(t.pnl||0),0);
    const wins = rows.filter(t=>Number(t.pnl||0)>0).length;
    const winRate = rows.length ? Math.round((wins / rows.length) * 100) : 0;

    if ($("totalTradesMetric")) $("totalTradesMetric").textContent = rows.length;
    if ($("totalPnlMetric")) {
      $("totalPnlMetric").textContent = money(total);
      $("totalPnlMetric").className = total >= 0 ? "pnl-plus" : "pnl-minus";
    }
    if ($("winRateMetric")) $("winRateMetric").textContent = winRate + "%";
    if ($("todayPnlMini")) $("todayPnlMini").textContent = money(total);
    if ($("winRateMini")) $("winRateMini").textContent = winRate + "%";
  } catch(e) {}
}
setInterval(syncManagedPnLIntoMetrics, 1200);


/* ===== FINAL UNIFIED USER PNL ANALYTICS FIX ===== */
function finalBelongsToCurrentUser(t) {
  const uid = String(state.user?.id || "local");
  const email = String(state.user?.email || "").toLowerCase();
  const tid = String(t.userId || t.user_id || "");
  const temail = String(t.userEmail || t.user_email || "").toLowerCase();
  return !tid && !temail ? true : tid === uid || (!!email && temail === email);
}

function finalUserManualTrades() {
  normalizeAccounts();
  const mode = state.mode || "DEMO";
  const acc = state.accounts?.[mode] || currentAccount?.() || {};
  const open = (acc.trades || []).filter(t => (t.source || "USER") === "USER" || (t.source || "USER") === "MANUAL" || !t.source);
  const closed = (acc.closedTrades || []).filter(t => (t.source || "USER") === "USER" || (t.source || "USER") === "MANUAL" || !t.source);
  return [...open, ...closed].map(t => {
    if ((t.status || "OPEN") === "OPEN" && typeof updateTradePnl === "function") updateTradePnl(t);
    return { ...t, pnl: Number(t.pnl || 0), status: t.status || "OPEN", source: t.source || "USER" };
  });
}

function finalUserManagedClosedTrades() {
  if ((state.mode || "DEMO") !== "REAL") return [];
  return (state.managedTrades || [])
    .filter(t => finalBelongsToCurrentUser(t))
    .filter(t => String(t.status || "").toUpperCase() === "CLOSED")
    .map(t => ({
      ...t,
      coin: t.coin,
      side: t.side,
      amount: Number(t.amount || 0),
      entry: Number(t.entry || t.entry_price || 0),
      current: Number(t.close || t.close_price || t.current || 0),
      close: Number(t.close || t.close_price || 0),
      pnl: Number(t.pnl || 0),
      status: "CLOSED",
      source: "ADMIN_MANAGED"
    }));
}

function finalAllUserPnlTrades() {
  return [...finalUserManualTrades(), ...finalUserManagedClosedTrades()];
}

function finalRenderPnLAnalytics() {
  if (!state.user || state.user.role === "admin") return;

  const rows = finalAllUserPnlTrades();
  const totalTrades = rows.length;
  const totalPnl = rows.reduce((a, t) => a + Number(t.pnl || 0), 0);
  const wins = rows.filter(t => Number(t.pnl || 0) > 0).length;
  const winRate = totalTrades ? Math.round((wins / totalTrades) * 100) : 0;

  if ($("totalTradesMetric")) $("totalTradesMetric").textContent = totalTrades;
  if ($("totalPnlMetric")) {
    $("totalPnlMetric").textContent = money(totalPnl);
    $("totalPnlMetric").className = totalPnl >= 0 ? "pnl-plus" : "pnl-minus";
  }
  if ($("winRateMetric")) $("winRateMetric").textContent = winRate + "%";

  if ($("todayPnlMini")) {
    $("todayPnlMini").textContent = money(totalPnl);
    $("todayPnlMini").className = totalPnl >= 0 ? "pnl-plus" : "pnl-minus";
  }
  if ($("winRateMini")) $("winRateMini").textContent = winRate + "%";

  if ($("pnlBars")) {
    const last = rows.slice(0, 10).reverse();
    $("pnlBars").innerHTML = last.map(t => {
      const pnl = Number(t.pnl || 0);
      const h = Math.min(100, Math.max(8, Math.abs(pnl) / Math.max(1, Math.abs(totalPnl)) * 100));
      return `<div class="pnl-bar ${pnl >= 0 ? "profit" : "loss"}" style="height:${h}%"><span>${money(pnl)}</span></div>`;
    }).join("") || `<p class="empty">No PnL data yet.</p>`;
  }
}

function finalRenderUserManualTrades() {
  const el = $("userManualTradesLog");
  if (!el) return;
  const rows = finalUserManualTrades();
  el.innerHTML = rows.map(t => {
    const cls = Number(t.pnl || 0) >= 0 ? "pnl-plus" : "pnl-minus";
    const currentOrClose = t.status === "CLOSED" ? (t.current || t.close || t.entry) : (t.current || t.entry);
    return `<tr>
      <td>${String(t.coin || "").replace("USDT","/USDT")}</td>
      <td>${t.side || "-"}</td>
      <td>${money(t.amount || 0)}</td>
      <td>${money(t.entry || 0)}</td>
      <td>${money(currentOrClose || 0)}</td>
      <td class="${cls}">${money(t.pnl || 0)}</td>
      <td>${t.status || "OPEN"}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="7" class="empty">No manual trades yet.</td></tr>`;
}

function finalRenderUserManagedTrades() {
  const el = $("userManagedTradesLog");
  if (!el) return;
  const rows = finalUserManagedClosedTrades();
  el.innerHTML = rows.map(t => {
    const cls = Number(t.pnl || 0) >= 0 ? "pnl-plus" : "pnl-minus";
    return `<tr>
      <td>${String(t.coin || "").replace("USDT","/USDT")}</td>
      <td>${t.side || "-"}</td>
      <td>${money(t.amount || 0)}</td>
      <td>${money(t.entry || 0)}</td>
      <td>${t.close ? money(t.close) : "-"}</td>
      <td class="${cls}">${money(t.pnl || 0)}</td>
      <td>${t.status || "CLOSED"}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="7" class="empty">No closed AI/Admin trades yet.</td></tr>`;
}

function finalRefreshAllUserAnalytics() {
  try {
    finalRenderPnLAnalytics();
    finalRenderUserManualTrades();
    finalRenderUserManagedTrades();
  } catch(e) {
    console.warn("Final PnL analytics render failed", e);
  }
}

setInterval(finalRefreshAllUserAnalytics, 1000);
window.addEventListener("load", () => setTimeout(finalRefreshAllUserAnalytics, 1200));


/* ===== FINAL AI/ADMIN TRADE LIMIT COUNT FIX ===== */
function finalTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function finalCurrentUserKey() {
  return String(state.user?.id || state.user?.email || "local");
}

function finalPlanName() {
  return String(state.user?.plan || getPlan?.() || "Free");
}

function finalGetPlanLimit(planName = finalPlanName()) {
  const plans = state.plans || [];
  const name = String(planName || "Free").toLowerCase();
  const plan = plans.find(p =>
    String(p.name || "").toLowerCase() === name ||
    String(p.id || "").toLowerCase() === name
  );

  if (plan) {
    const v = plan.aiTradeLimit ?? plan.ai_trade_limit ?? plan.aiLimit ?? plan.adminTradeLimit;
    if (v !== undefined && v !== null && String(v) !== "") return Number(v);
  }

  if (name === "free") return 5;
  return 5;
}

function finalAiUsageKey(userId = finalCurrentUserKey(), mode = "REAL") {
  return `${userId}_${mode}_${finalTodayKey()}`;
}

function finalAiUsedToday(userId = finalCurrentUserKey(), mode = "REAL") {
  state.aiTradeUsage = state.aiTradeUsage || {};
  return Number(state.aiTradeUsage[finalAiUsageKey(userId, mode)] || 0);
}

function finalIncrementAiUsage(userId = finalCurrentUserKey(), mode = "REAL") {
  state.aiTradeUsage = state.aiTradeUsage || {};
  const key = finalAiUsageKey(userId, mode);
  state.aiTradeUsage[key] = Number(state.aiTradeUsage[key] || 0) + 1;
  saveState?.();
}

function finalDecrementAiUsage(userId = finalCurrentUserKey(), mode = "REAL") {
  state.aiTradeUsage = state.aiTradeUsage || {};
  const key = finalAiUsageKey(userId, mode);
  state.aiTradeUsage[key] = Math.max(0, Number(state.aiTradeUsage[key] || 0) - 1);
  saveState?.();
}

function finalCanReceiveAiTrade(user, mode = "REAL") {
  const id = String(user?.id || user?.email || "local");
  const limit = finalGetPlanLimit(user?.plan || "Free");
  const used = finalAiUsedToday(id, mode);
  const auto = user?.autoTradePermission !== false;
  return auto && used < limit;
}

function finalRenderAiTradeUsage() {
  try {
    const used = finalAiUsedToday(finalCurrentUserKey(), "REAL");
    const limit = finalGetPlanLimit(finalPlanName());
    if ($("aiTradeUsedText")) $("aiTradeUsedText").textContent = used;
    if ($("aiTradeLimitText")) $("aiTradeLimitText").textContent = limit;
    if ($("autoTradePermission")) $("autoTradePermission").checked = state.user?.autoTradePermission !== false;
  } catch(e) {}
}

function finalRenderAdminAiEligibilityTable() {
  try {
    const el = $("adminAiEligibilityLog");
    if (!el || state.user?.role !== "admin") return;
    const users = (state.users || []).filter(u => u.role !== "admin");
    el.innerHTML = users.map(u => {
      const s = finalUserAiLimitStatus(u, "REAL");
      const statusText = s.eligible ? "Eligible" : (s.auto ? "Limit Complete" : "Auto OFF");
      return `<tr>
        <td>${u.email || u.name || "-"}</td>
        <td>${u.plan || "Free"}</td>
        <td>${s.used}</td>
        <td>${s.limit}</td>
        <td>${s.remaining}</td>
        <td>${statusText}</td>
      </tr>`;
    }).join("") || `<tr><td colspan="6" class="empty">No users found.</td></tr>`;
  } catch(e) {}
}

setInterval(() => {
  finalRenderAiTradeUsage();
  finalRenderAdminAiEligibilityTable();
  renderMassTradeAdmin();
}, 1000);
window.addEventListener("load", () => setTimeout(() => {
  finalRenderAiTradeUsage();
  finalRenderAdminAiEligibilityTable();
}, 1000));


/* AI limit compatibility redirects */
function aiTradeDailyLimit(planName = finalPlanName()) { return finalGetPlanLimit(planName); }
function aiTradesUsedToday(userId = finalCurrentUserKey(), mode = "REAL") { return finalAiUsedToday(userId, mode); }
function incrementAiTradeUsage(userId = finalCurrentUserKey(), mode = "REAL") { return finalIncrementAiUsage(userId, mode); }
function decrementAiTradeUsage(userId = finalCurrentUserKey(), mode = "REAL") { return finalDecrementAiUsage(userId, mode); }
function canReceiveAiTrade(user, mode = "REAL") { return finalCanReceiveAiTrade(user, mode); }
function currentAiTradeLimitText() { return finalGetPlanLimit(finalPlanName()); }


/* ===== STRICT AI LIMIT SKIP USERS FIX ===== */
function finalUserAiLimitStatus(user, mode = "REAL") {
  const id = String(user?.id || user?.email || "local");
  const limit = finalGetPlanLimit(user?.plan || "Free");
  const used = finalAiUsedToday(id, mode);
  const auto = user?.autoTradePermission !== false;

  return {
    id,
    limit,
    used,
    auto,
    remaining: Math.max(0, limit - used),
    eligible: auto && used < limit
  };
}

function finalEligibleUsersForAiTrade(target = "ALL") {
  const users = (state.users || []).filter(u => u.role !== "admin");

  if (target !== "ALL") {
    const u = users.find(x => String(x.id || x.email) === String(target));
    if (!u) return { eligible: [], skipped: [] };
    const s = finalUserAiLimitStatus(u, "REAL");
    return s.eligible ? { eligible: [u], skipped: [] } : { eligible: [], skipped: [{ user: u, reason: s.auto ? "Limit complete" : "Auto OFF" }] };
  }

  const eligible = [];
  const skipped = [];

  users.forEach(u => {
    const s = finalUserAiLimitStatus(u, "REAL");
    if (s.eligible) eligible.push(u);
    else skipped.push({ user: u, reason: s.auto ? "Limit complete" : "Auto OFF" });
  });

  return { eligible, skipped };
}

window.closeMassTradeById = closeMassTradeById;
window.closeSelectedMassTrade = closeSelectedMassTrade;
window.closeAllMassTrades = closeAllMassTrades;


/* More page internal buttons navigation fix */
function openUserPageDirect(pageId) {
  if (!pageId) return;

  const target = document.getElementById(pageId);
  if (!target) {
    console.warn("Page not found:", pageId);
    return;
  }

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active-page"));
  target.classList.add("active-page");

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === pageId);
  });

  try {
    if (pageId === "profilepage") {
      if ($("profileNameText")) $("profileNameText").textContent = state.user?.name || "User";
      if ($("profileEmailText")) $("profileEmailText").textContent = state.user?.email || "-";
      if ($("profilePlanText")) $("profilePlanText").textContent = state.user?.plan || getPlan?.() || "Free";
      if ($("profileModeText")) $("profileModeText").textContent = state.mode || "DEMO";
    }
    if (typeof render === "function") setTimeout(() => { try { render(); } catch(e){} }, 50);
  } catch(e) {}
}

document.addEventListener("click", function(e){
  const moreBtn = e.target.closest(".more-open-btn, #topMoreMenuBtn, .ghost-btn[data-page]");
  if (!moreBtn) return;
  const pageId = moreBtn.dataset.page;
  if (!pageId) return;
  e.preventDefault();
  e.stopPropagation();
  openUserPageDirect(pageId);
}, true);


/* SAFE MORE DROPDOWN FIX - does not touch login/register */
(function(){
  function safeOpenMorePage(pageId){
    var target = document.getElementById(pageId);
    if(!target) return false;

    // Only switch pages inside logged-in app area. Auth page remains untouched.
    document.querySelectorAll("#appPage .page").forEach(function(p){
      p.classList.remove("active-page");
    });
    target.classList.add("active-page");

    document.querySelectorAll(".nav-btn").forEach(function(btn){
      btn.classList.toggle("active", btn.getAttribute("data-page") === pageId);
    });

    if(pageId === "profilepage"){
      var s = window.state || {};
      var u = s.user || {};
      function set(id, val){ var el = document.getElementById(id); if(el) el.textContent = val; }
      set("profileNameText", u.name || "User");
      set("profileEmailText", u.email || "-");
      set("profilePlanText", u.plan || "Free");
      set("profileModeText", s.mode || "DEMO");
    }

    var dd = document.getElementById("topMoreDropdown");
    if(dd) dd.classList.remove("show");
    return false;
  }

  window.safeOpenMorePage = safeOpenMorePage;

  document.addEventListener("click", function(e){
    var moreBtn = e.target.closest("#topMoreMenuBtn");
    if(moreBtn){
      e.preventDefault();
      e.stopPropagation();
      var dd = document.getElementById("topMoreDropdown");
      if(dd) dd.classList.toggle("show");
      return;
    }

    var direct = e.target.closest("[data-direct-page]");
    if(direct){
      e.preventDefault();
      e.stopPropagation();
      safeOpenMorePage(direct.getAttribute("data-direct-page"));
      return;
    }

    var dd = document.getElementById("topMoreDropdown");
    if(dd && !e.target.closest(".top-more-wrap")) dd.classList.remove("show");
  });
})();


/* FINAL HISTORY ICON + HISTORY RENDER FIX */
function historyBelongsToCurrentUserFinal(t) {
  const uid = String(state.user?.id || "local");
  const email = String(state.user?.email || "").toLowerCase();
  const tid = String(t.userId || t.user_id || "");
  const temail = String(t.userEmail || t.user_email || "").toLowerCase();
  return tid === uid || (!!email && temail === email) || (!tid && !temail);
}

function renderManagedHistoryFinal() {
  const el = document.getElementById("userManagedTradesLog");
  if (!el) return;

  const rows = (state.managedTrades || [])
    .filter(t => historyBelongsToCurrentUserFinal(t))
    .filter(t => String(t.status || "").toUpperCase() === "CLOSED");

  el.innerHTML = rows.map(t => {
    const pnl = Number(t.pnl || 0);
    const cls = pnl >= 0 ? "pnl-plus" : "pnl-minus";
    return `<tr>
      <td>${String(t.coin || "").replace("USDT","/USDT")}</td>
      <td>${t.side || "-"}</td>
      <td>${money(Number(t.amount || 0))}</td>
      <td>${money(Number(t.entry || t.entry_price || 0))}</td>
      <td>${money(Number(t.close || t.close_price || 0))}</td>
      <td class="${cls}">${money(pnl)}</td>
      <td>CLOSED</td>
    </tr>`;
  }).join("") || `<tr><td colspan="7" class="empty">No closed AI/Admin trades yet.</td></tr>`;
}

function renderManualHistoryFinal() {
  const el = document.getElementById("userManualTradesLog");
  if (!el) return;

  normalizeAccounts?.();
  const acc = typeof currentAccount === "function" ? currentAccount() : state.accounts?.[state.mode || "DEMO"] || {};
  const openRows = (acc.trades || []).filter(t => !t.source || t.source === "USER" || t.source === "MANUAL");
  const closedRows = (acc.closedTrades || []).filter(t => !t.source || t.source === "USER" || t.source === "MANUAL");
  const rows = [...openRows.map(t => ({...t, status:t.status || "OPEN"})), ...closedRows.map(t => ({...t, status:t.status || "CLOSED"}))];

  el.innerHTML = rows.map(t => {
    if (String(t.status).toUpperCase() === "OPEN" && typeof updateTradePnl === "function") updateTradePnl(t);
    const pnl = Number(t.pnl || 0);
    const cls = pnl >= 0 ? "pnl-plus" : "pnl-minus";
    const current = Number(t.current || t.close || t.entry || 0);
    return `<tr>
      <td>${String(t.coin || "").replace("USDT","/USDT")}</td>
      <td>${t.side || "-"}</td>
      <td>${money(Number(t.amount || 0))}</td>
      <td>${money(Number(t.entry || 0))}</td>
      <td>${money(current)}</td>
      <td class="${cls}">${money(pnl)}</td>
      <td>${t.status || "OPEN"}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="7" class="empty">No manual trades yet.</td></tr>`;
}

function renderHistoryFinal() {
  try {
    renderManagedHistoryFinal();
    renderManualHistoryFinal();
  } catch(e) {
    console.warn("History render failed", e);
  }
}

function openHistoryPageFinal() {
  const target = document.getElementById("aiHistory");
  if (!target) return false;

  document.querySelectorAll("#appPage .page").forEach(p => p.classList.remove("active-page"));
  target.classList.add("active-page");

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === "aiHistory");
  });

  renderHistoryFinal();
  window.scrollTo({top:0, behavior:"smooth"});
  return false;
}

window.openHistoryPageFinal = openHistoryPageFinal;
setInterval(renderHistoryFinal, 1500);
window.addEventListener("load", () => setTimeout(renderHistoryFinal, 1000));


/* finalReferralRegisterPatch */
function finalCaptureReferralCodeOnRegister() {
  try {
    const code = $("regReferral")?.value?.trim?.() || $("referralInput")?.value?.trim?.() || "";
    if (!code) return;
    if (state.user) {
      state.user.referredBy = code;
      const u = (state.users || []).find(x => String(x.id) === String(state.user.id) || String(x.email).toLowerCase() === String(state.user.email || "").toLowerCase());
      if (u) u.referredBy = code;
      saveState?.();
    }
  } catch(e) {}
}
document.addEventListener("click", function(e){
  if (e.target && (e.target.id === "registerBtn" || e.target.closest?.("#registerBtn"))) {
    setTimeout(finalCaptureReferralCodeOnRegister, 800);
  }
});


/* referral profile field sync */
window.addEventListener("load", function(){
  setTimeout(() => { try { ensureProfileReferralFields(); } catch(e){} }, 1500);
});

document.addEventListener("click", function(e){
  if (e.target && (e.target.id === "registerBtn" || e.target.closest?.("#registerBtn"))) {
    setTimeout(async () => {
      try {
        await ensureProfileReferralFields();
        const refCode = $("regReferral")?.value?.trim?.() || $("referralInput")?.value?.trim?.() || "";
        if (refCode) await saveReferredByForCurrentUser(refCode);
      } catch(e){}
    }, 1000);
  }
});





/* REFERRAL 10 REGISTER SYNC */
window.addEventListener("load", function(){
  setTimeout(() => { try { refEnsureCurrentUserCode(); } catch(e){} }, 1500);
});

document.addEventListener("click", function(e){
  if (e.target && (e.target.id === "registerBtn" || e.target.closest?.("#registerBtn"))) {
    const refCode = $("regReferral")?.value?.trim?.() || $("referralInput")?.value?.trim?.() || "";
    setTimeout(async () => {
      try {
        await refEnsureCurrentUserCode();
        if (refCode) await refSaveReferredByForCurrentUser(refCode);
      } catch(e) {
        console.warn("register referral sync failed", e);
      }
    }, 1200);
  }
});
