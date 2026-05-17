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
    { id: "free", name: "Free", price: 0, duration: "Lifetime", signalLimit: 5, features: ["5 signals/day", "Demo dashboard", "Live prices"], active: true },
    { id: "pro", name: "Pro", price: 499, duration: "30 days", signalLimit: 50, features: ["50 signals/day", "Advanced AI indicator", "Referral bonus tracking"], active: true },
    { id: "elite", name: "Elite", price: 999, duration: "30 days", signalLimit: 999999, features: ["Unlimited signals UI", "PnL analytics", "Priority dashboard"], active: true }
  ],
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

async function loadRemoteData() {
  if (!supabaseClient) return;

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

function accountEquity(mode = state.mode) {
  normalizeAccounts();
  const key = mode === "REAL" ? "REAL" : "DEMO";
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
  if (currentAccount().signalsUsed >= numericSignalLimit()) {
    toast("Signal limit complete. Upgrade plan.");
    showPage("subscription");
    return;
  }

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

  acc.balance -= amount;
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

function closeTrade(id) {
  const acc = currentAccount();
  const index = acc.trades.findIndex(t => t.id === id);
  if (index === -1) return;

  const trade = acc.trades[index];
  updateTradePnl(trade);

  const margin = Number(trade.amount || 0);
  const pnl = Number(trade.pnl || 0);
  const refund = Math.max(0, margin + pnl);

  // Close trade effect:
  // Profit adds to wallet, loss reduces returned margin.
  acc.balance = Number(acc.balance || 0) + refund;

  trade.status = "CLOSED";
  trade.closedAt = new Date().toLocaleString();

  acc.closedTrades = acc.closedTrades || [];
  acc.closedTrades.unshift({ ...trade });

  if (state.mode === "REAL") {
    state.realTradeVolumeTotal = Number(state.realTradeVolumeTotal || 0) + 0;
    if (pnl > 0 && !trade.profitCounted) {
      state.realProfitTotal = Number(state.realProfitTotal || 0) + pnl;
      trade.profitCounted = true;
    }
  }

  acc.recentFills = acc.recentFills || [];
  acc.recentFills.unshift({ side: "CLOSE", coin: trade.coin, price: trade.current, amount: trade.amount, time: new Date().toLocaleTimeString() });

  acc.trades.splice(index, 1);
  syncAccountBackups();
  saveState();
  render();

  const msg = pnl >= 0
    ? `Trade closed. Profit added: ${money(pnl)}`
    : `Trade closed. Loss deducted: ${money(Math.abs(pnl))}`;
  toast(msg + " | Trade closed and wallet updated.");
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

function renderAnalytics() {
  if (!$("totalTradesMetric")) return;

  const acc = currentAccount();
  const allTrades = [...(acc.trades || []), ...(acc.closedTrades || [])];
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

  return Math.max(Number(state.realProfitTotal || 0), liveProfit);
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

  toast("Withdrawal request submitted for approval.");
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

  const acc = currentAccount();
  const allTrades = [...(acc.trades || []), ...(acc.closedTrades || [])];
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
      <td>${Number(p.signalLimit) >= 999999 ? "∞" : p.signalLimit}</td>
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
  if ($("planFeaturesInput")) $("planFeaturesInput").value = "";
}

async function savePlan() {
  const editId = $("planEditId")?.value || "";
  const name = $("planNameInput")?.value.trim();
  const price = Number($("planPriceInput")?.value || 0);
  const duration = $("planDurationInput")?.value.trim() || "30 days";
  const signalLimit = Number($("planSignalLimitInput")?.value || 5);
  const features = ($("planFeaturesInput")?.value || "").split("\n").map(x => x.trim()).filter(Boolean);

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

  const acc = currentAccount();
  const allTrades = [...(acc.trades || []), ...(acc.closedTrades || [])];
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
      if (document.getElementById("mockRealBalance")) document.getElementById("mockRealBalance").textContent = money(state.accounts?.REAL?.balance || state.realBalance || 0);
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
