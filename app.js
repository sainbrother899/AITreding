const CONFIG = window.APP_CONFIG || {};
const IS_ADMIN_PAGE = document.body?.dataset?.adminPage === "true";
let supabaseClient = null;

if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY && window.supabase) {
  supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
}

const STORAGE_KEY = "ai_trading_final_v4";

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
  signal: "BUY",
  note: "Admin + AI engine combined signal.",
  trades: [],
  paymentRequests: [],
  selectedPaymentPlan: "Pro",
  referrals: [],
  prices: {}
};

let state = loadState();

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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

function signalLimit() {
  const p = getPlan();
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
  saveState();
  showApp();
  toast("Demo user started.");
}

async function logout() {
  if (supabaseClient && state.user?.role !== "admin") {
    try { await supabaseClient.auth.signOut(); } catch {}
  }
  state.user = null;
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
    }
  } catch (e) {
    console.warn("Profile refresh failed", e);
  }

  saveState();
}

function showApp() {
  $("authPage")?.classList.add("hidden");
  $("appPage")?.classList.remove("hidden");
  $("logoutBtn")?.classList.remove("hidden");

  if ($("userBadge")) $("userBadge").textContent = (state.user?.role === "admin" ? "Admin: " : "User: ") + (state.user?.name || "");

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

function showPage(page) {
  if (!$(page)) return;
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active-page"));
  $(page).classList.add("active-page");

  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.page === page));
  render();
}

function render() {
  if (!state.user) return;

  if ($("walletBalance")) $("walletBalance").textContent = money(state.mode === "DEMO" ? state.demoBalance : state.realBalance);
  $("demoBtn")?.classList.toggle("active", state.mode === "DEMO");
  $("realBtn")?.classList.toggle("active", state.mode === "REAL");

  if ($("signalCounter")) $("signalCounter").textContent = state.signalsUsed;
  if ($("signalLimitText")) $("signalLimitText").textContent = signalLimit();
  if ($("planText")) $("planText").textContent = getPlan();

  if ($("signalBox")) $("signalBox").className = "signal-box " + state.signal.toLowerCase();
  if ($("aiSignalText")) $("aiSignalText").textContent = state.signal === "WAIT" ? "WAIT / NO TRADE" : `${state.signal} BTC NOW`;
  if ($("signalNote")) $("signalNote").textContent = state.note;

  if ($("adminSignal")) $("adminSignal").value = state.signal;
  if ($("adminNote")) $("adminNote").value = state.note;
  if ($("adminFreeLimit")) $("adminFreeLimit").value = state.freeSignalLimit;

  renderTickers();
  renderTrades();
  renderPayments();
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

function executeTrade() {
  if (state.signalsUsed >= numericSignalLimit()) {
    toast("Signal limit complete. Upgrade plan.");
    showPage("subscription");
    return;
  }

  if (state.signal === "WAIT") {
    toast("Signal is WAIT. Trade not added.");
    return;
  }

  const amount = Number($("tradeAmountInput")?.value);
  const bal = state.mode === "DEMO" ? state.demoBalance : state.realBalance;

  if (!amount || amount <= 0 || amount > bal) {
    toast("Invalid amount or insufficient balance.");
    return;
  }

  const entry = state.prices.BTCUSDT?.price || 65000;

  if (state.mode === "DEMO") state.demoBalance -= amount;
  else state.realBalance -= amount;

  state.signalsUsed++;

  const trade = {
    id: "t_" + Date.now(),
    coin: "BTCUSDT",
    side: state.signal,
    amount,
    entry,
    current: entry,
    pnl: 0,
    status: "RUNNING",
    time: new Date().toLocaleString()
  };

  state.trades.unshift(trade);
  saveTradeToSupabase(trade);
  saveState();
  render();
  toast("Trade added.");
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

  const btc = state.prices.BTCUSDT?.price || 0;

  state.trades.forEach(t => {
    if (t.coin === "BTCUSDT" && btc) {
      t.current = btc;
      const diff = t.side === "BUY" ? (btc - t.entry) : (t.entry - btc);
      t.pnl = (diff / t.entry) * t.amount;
    }
  });

  const rows = state.trades.map(t => `
    <tr>
      <td>${t.coin}</td>
      <td class="${t.side === "BUY" ? "buy-text" : "sell-text"}">${t.side}</td>
      <td>${money(t.amount)}</td>
      <td>${money(t.entry)}</td>
      <td>${money(t.current)}</td>
      <td class="${t.pnl >= 0 ? "pnl-plus" : "pnl-minus"}">${t.pnl >= 0 ? "+" : ""}${money(t.pnl)}</td>
      <td>${t.status}</td>
    </tr>
  `).join("");

  table.innerHTML = rows || `<tr><td colspan="7" class="empty">No trades yet.</td></tr>`;
  saveState();
}

function renderAnalytics() {
  if (!$("totalTradesMetric")) return;

  const total = state.trades.length;
  const pnl = state.trades.reduce((a, t) => a + Number(t.pnl || 0), 0);
  const wins = state.trades.filter(t => t.pnl > 0).length;

  $("totalTradesMetric").textContent = total;
  $("totalPnlMetric").textContent = money(pnl);
  $("totalPnlMetric").className = pnl >= 0 ? "pnl-plus" : "pnl-minus";
  $("winRateMetric").textContent = total ? Math.round(wins / total * 100) + "%" : "0%";

  const myRef = state.user?.referralCode;
  const bonus = state.referrals.filter(r => r.code === myRef).reduce((a, r) => a + Number(r.bonus || 0), 0);
  $("refBonusMetric").textContent = rupee(bonus);

  $("pnlBars").innerHTML = (
    state.trades.slice(0, 8).map((t, i) => `
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

function renderPayments() {
  const tbody = $("paymentRequestsLog");
  if (!tbody || state.user?.role !== "admin") return;

  tbody.innerHTML = state.paymentRequests.map(p => `
    <tr>
      <td>${p.plan}</td>
      <td>${p.name}</td>
      <td>${p.mobile}</td>
      <td>${p.txn}</td>
      <td>${p.status === "PENDING" ? `<button class="ghost-btn" onclick="approvePayment('${p.id}')">Approve</button>` : p.status}</td>
    </tr>
  `).join("") || `<tr><td colspan="5" class="empty">No payment requests.</td></tr>`;
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
  state.note = $("adminNote")?.value.trim() || "Admin signal updated.";
  state.freeSignalLimit = Math.max(1, Number($("adminFreeLimit")?.value || 5));
  saveState();
  render();
  showPage(IS_ADMIN_PAGE ? "admin" : "dashboard");
  toast("Admin signal saved.");
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

function bind() {
  document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => showAuthTab(b.dataset.authTab)));
  if ($("registerBtn")) $("registerBtn").addEventListener("click", register);
  if ($("loginBtn")) $("loginBtn").addEventListener("click", login);
  if ($("guestBtn")) $("guestBtn").addEventListener("click", guestLogin);
  if ($("logoutBtn")) $("logoutBtn").addEventListener("click", logout);

  document.querySelectorAll(".nav-btn").forEach(b => b.addEventListener("click", () => showPage(b.dataset.page)));

  if ($("demoBtn")) $("demoBtn").addEventListener("click", () => { state.mode = "DEMO"; saveState(); render(); });
  if ($("realBtn")) $("realBtn").addEventListener("click", () => { state.mode = "REAL"; saveState(); render(); toast("Real UI selected. Exchange API not connected."); });

  if ($("executeTradeBtn")) $("executeTradeBtn").addEventListener("click", executeTrade);
  if ($("clearTradesBtn")) $("clearTradesBtn").addEventListener("click", () => { state.trades = []; saveState(); render(); });

  if ($("saveAdminBtn")) $("saveAdminBtn").addEventListener("click", saveAdminSettings);
  if ($("clearPaymentsBtn")) $("clearPaymentsBtn").addEventListener("click", () => { state.paymentRequests = []; saveState(); render(); });

  document.querySelectorAll(".plan-btn").forEach(b => b.addEventListener("click", () => openPaymentModal(b.dataset.plan)));

  if ($("closePaymentModal")) $("closePaymentModal").addEventListener("click", closePaymentModal);
  if ($("submitManualPayment")) $("submitManualPayment").addEventListener("click", submitManualPayment);
  if ($("copyReferralBtn")) $("copyReferralBtn").addEventListener("click", copyReferral);
}

window.addEventListener("load", async () => {
  bind();
  initReferralFromUrl();

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
      }
    } catch {}
  }

  if (state.user) {
    if (IS_ADMIN_PAGE && state.user.role !== "admin") await logout();
    else if (!IS_ADMIN_PAGE && state.user.role === "admin") await logout();
    else {
      await loadRemoteData();
      showApp();
    }
  }

  fetchRealPrices();
  setInterval(fetchRealPrices, 30000);
  setInterval(loadRemoteData, 45000);
});
