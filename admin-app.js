(() => {
  const App = window.AITradeX;
  const Auth = window.AITradeXAuth;
  const root = document.getElementById("adminApp");

  let page = localStorage.getItem("AITradeX_ADMIN_PAGE") || "dashboard";
  let kycSearch = localStorage.getItem("AITradeX_ADMIN_KYC_SEARCH") || "";
  let kycFilter = localStorage.getItem("AITradeX_ADMIN_KYC_FILTER") || "ALL";
  let paymentSearch = localStorage.getItem("AITradeX_ADMIN_PAYMENT_SEARCH") || "";
  let paymentStatusFilter = localStorage.getItem("AITradeX_ADMIN_PAYMENT_STATUS") || "ALL";
  let financeSearch = localStorage.getItem("AITradeX_ADMIN_FINANCE_SEARCH") || "";
  let financeStatusFilter = localStorage.getItem("AITradeX_ADMIN_FINANCE_STATUS") || "ALL";
  let usersSearch = localStorage.getItem("AITradeX_ADMIN_USERS_SEARCH") || "";
  let usersStatusFilter = localStorage.getItem("AITradeX_ADMIN_USERS_STATUS") || "ALL";
  let supportSearch = localStorage.getItem("AITradeX_ADMIN_SUPPORT_SEARCH") || "";
  let supportStatusFilter = localStorage.getItem("AITradeX_ADMIN_SUPPORT_STATUS") || "ALL";
  let walletHistoryPage = Math.max(1, Number(localStorage.getItem("AITradeX_ADMIN_WALLET_HISTORY_PAGE") || 1));
  let usersPageNo = Math.max(1, Number(localStorage.getItem("AITradeX_ADMIN_USERS_PAGE") || 1));
  let depositHistoryPage = Math.max(1, Number(localStorage.getItem("AITradeX_ADMIN_DEPOSIT_HISTORY_PAGE") || 1));
  let withdrawalHistoryPage = Math.max(1, Number(localStorage.getItem("AITradeX_ADMIN_WITHDRAWAL_HISTORY_PAGE") || 1));

  function adminUser() {
    return App.currentUser();
  }

  function allUsers() {
    return App.state.users.filter(u => u.role === "user");
  }

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || "") || fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function userKey(userId, name) {
    return `AITradeX_${name}_${userId}`;
  }

  function displayNameFor(user) {
    return localStorage.getItem(`AITradeX_DISPLAY_NAME_${user.id}`) || user.name || "User";
  }

  function kycFor(user) {
    const local = readJson(userKey(user.id, "KYC"), null);
    if (local) return local;

    const stateRow = (App.state.kycRequests || []).find(x => x.userId === user.id);
    if (stateRow) {
      return {
        status: stateRow.status || "NOT_SUBMITTED",
        personal: stateRow.personal || {
          fullName: displayNameFor(user),
          mobile: user.mobile || "",
          email: user.email || "",
          dob: ""
        },
        id: stateRow.idDetails || stateRow.id || {
          type: "PAN Card",
          number: ""
        },
        uploads: stateRow.uploads || {
          frontName: "",
          backName: "",
          selfieName: ""
        },
        submittedAt: stateRow.submittedAt || "",
        approvedAt: stateRow.approvedAt || "",
        rejectedAt: stateRow.rejectedAt || "",
        rejectReason: stateRow.rejectReason || ""
      };
    }

    return {
      status: "NOT_SUBMITTED",
      personal: {
        fullName: displayNameFor(user),
        mobile: user.mobile || "",
        email: user.email || "",
        dob: ""
      },
      id: {
        type: "PAN Card",
        number: ""
      },
      uploads: {
        frontName: "",
        backName: "",
        selfieName: ""
      },
      submittedAt: "",
      approvedAt: "",
      rejectedAt: "",
      rejectReason: ""
    };
  }

  function saveKyc(user, kyc) {
    writeJson(userKey(user.id, "KYC"), kyc);

    const existing = (App.state.kycRequests || []).find(x => x.userId === user.id);
    const row = {
      id: existing?.id || App.uid("kyc"),
      userId: user.id,
      status: kyc.status,
      personal: kyc.personal,
      idDetails: kyc.id,
      uploads: kyc.uploads,
      submittedAt: kyc.submittedAt || "",
      approvedAt: kyc.approvedAt || "",
      rejectedAt: kyc.rejectedAt || "",
      rejectReason: kyc.rejectReason || "",
      updatedAt: App.now()
    };

    if (existing) Object.assign(existing, row);
    else App.state.kycRequests.push(row);

    App.saveState();
  }

  function paymentMethodsFor(user) {
    const local = readJson(userKey(user.id, "PAYMENT_METHODS"), []);
    if (local.length) return local;

    return (App.state.paymentMethods || [])
      .filter(m => m.userId === user.id)
      .map(m => ({ ...m }));
  }

  function savePaymentMethods(user, methods) {
    writeJson(userKey(user.id, "PAYMENT_METHODS"), methods);

    App.state.paymentMethods = (App.state.paymentMethods || []).filter(m => m.userId !== user.id);
    methods.forEach(m => {
      App.state.paymentMethods.push({
        ...m,
        userId: user.id,
        source: "ADMIN_PAYMENT_METHOD"
      });
    });

    App.saveState();
  }


  function depositRequestsFor(user) {
    const local = readJson(userKey(user.id, "DEPOSIT_REQUESTS"), []);
    if (local.length) return local;
    return (App.state.depositRequests || [])
      .filter(r => r.userId === user.id)
      .map(r => ({ ...r }));
  }

  function saveDepositRequests(user, requests) {
    writeJson(userKey(user.id, "DEPOSIT_REQUESTS"), requests);
    App.state.depositRequests = (App.state.depositRequests || []).filter(r => r.userId !== user.id);
    requests.forEach(r => App.state.depositRequests.push({ ...r, userId: user.id, userEmail: user.email }));
    App.saveState();
  }

  function withdrawalRequestsFor(user) {
    const local = readJson(userKey(user.id, "WITHDRAWAL_REQUESTS"), []);
    if (local.length) return local;
    return (App.state.withdrawalRequests || [])
      .filter(r => r.userId === user.id)
      .map(r => ({ ...r }));
  }

  function saveWithdrawalRequests(user, requests) {
    writeJson(userKey(user.id, "WITHDRAWAL_REQUESTS"), requests);
    App.state.withdrawalRequests = (App.state.withdrawalRequests || []).filter(r => r.userId !== user.id);
    requests.forEach(r => App.state.withdrawalRequests.push({ ...r, userId: user.id, userEmail: user.email }));
    App.saveState();
  }

  function allWalletRequests() {
    const deposits = allUsers().flatMap(user => depositRequestsFor(user).map(request => ({ user, request, type: "DEPOSIT" })));
    const withdrawals = allUsers().flatMap(user => withdrawalRequestsFor(user).map(request => ({ user, request, type: "WITHDRAWAL" })));
    return [...deposits, ...withdrawals].sort((a, b) => Date.parse(b.request.createdAt || 0) - Date.parse(a.request.createdAt || 0));
  }

  function financeStats(type) {
    const items = allWalletRequests().filter(x => x.type === type);
    const todayKey = new Date().toISOString().slice(0, 10);
    const statusItems = status => items.filter(x => String(x.request.status || "").toUpperCase() === status);
    const sumAmount = rows => rows.reduce((sum, row) => sum + Number(row.request.amount || 0), 0);
    const todayItems = items.filter(x => String(x.request.createdAt || "").slice(0, 10) === todayKey);
    const approvedItems = statusItems("APPROVED");
    const pendingItems = statusItems("PENDING");
    const rejectedItems = statusItems("REJECTED");
    return {
      total: items.length,
      pending: pendingItems.length,
      approved: approvedItems.length,
      rejected: rejectedItems.length,
      totalAmount: sumAmount(items),
      pendingAmount: sumAmount(pendingItems),
      approvedAmount: sumAmount(approvedItems),
      rejectedAmount: sumAmount(rejectedItems),
      today: todayItems.length,
      todayAmount: sumAmount(todayItems)
    };
  }

  function financeMethodText(request, type) {
    const isDeposit = type === "DEPOSIT";
    const method = request.methodSnapshot || {};
    if (isDeposit) return `${request.type || "UPI"} · UTR ${request.utr || "-"}`;
    return method.type === "UPI"
      ? `UPI · ${method.upiId || "-"} · ${method.holderName || "-"}`
      : `${method.bankName || "Bank"} · ${method.accountNumber || "-"} · ${method.holderName || "-"}`;
  }

  function depositUtrDuplicateInfo(request) {
    const clean = String(request?.utr || "").replace(/\D/g, "");
    if (!clean) return null;
    const matches = allWalletRequests().filter(x =>
      x.type === "DEPOSIT" &&
      String(x.request.id) !== String(request.id) &&
      String(x.request.utr || "").replace(/\D/g, "") === clean
    );
    const approved = matches.filter(x => String(x.request.status || "").toUpperCase() === "APPROVED");
    return matches.length ? { total: matches.length, approved: approved.length } : null;
  }

  function financeProofHtml(request) {
    const src = request.proofImage || request.screenshot || request.receiptImage || request.paymentProof || request.proofUrl || request.image || "";
    if (!src) return `<div class="finance-proof-empty">No screenshot uploaded in this build. UTR/manual verification required.</div>`;
    return `<a class="finance-proof-preview" href="${esc(src)}" target="_blank" rel="noopener"><img src="${esc(src)}" alt="Payment proof"/><span>Open proof</span></a>`;
  }

  function financeRequestDetailPanel(user, request, type) {
    const isDeposit = type === "DEPOSIT";
    const method = request.methodSnapshot || {};
    const duplicate = isDeposit ? depositUtrDuplicateInfo(request) : null;
    const safeBalance = App.realBalance(user.id);
    const afterWithdrawal = isDeposit ? safeBalance : safeBalance - Number(request.amount || 0);
    return `
      <section class="finance-detail-panel">
        <div class="finance-detail-title">
          <div><b>${isDeposit ? "Deposit Detail" : "Withdrawal Detail"}</b><span>${isDeposit ? "Check UTR/proof before crediting wallet" : "Check payout details before debiting wallet"}</span></div>
          ${duplicate ? `<span class="finance-warning-pill">Duplicate UTR: ${duplicate.total}${duplicate.approved ? ` · ${duplicate.approved} approved` : ""}</span>` : `<span class="finance-safe-pill">No duplicate UTR found</span>`}
        </div>
        <div class="finance-detail-grid">
          <article><span>User</span><b>${esc(displayNameFor(user))}</b></article>
          <article><span>Email</span><b>${esc(user.email || "-")}</b></article>
          <article><span>Mobile</span><b>${esc(user.mobile || "-")}</b></article>
          <article><span>Request Amount</span><b>${App.money(request.amount || 0)}</b></article>
          <article><span>Current Real Balance</span><b>${App.money(safeBalance)}</b></article>
          <article><span>${isDeposit ? "UTR / Method" : "Balance After Approval"}</span><b>${isDeposit ? esc(financeMethodText(request, type)) : App.money(afterWithdrawal)}</b></article>
          <article><span>Request ID</span><b>${esc(request.id || "-")}</b></article>
          <article><span>Created</span><b>${request.createdAt ? new Date(request.createdAt).toLocaleString() : "-"}</b></article>
        </div>
        ${isDeposit ? `<div class="finance-proof-wrap">${financeProofHtml(request)}</div>` : `
          <div class="finance-payout-mini">
            <b>Payout Details</b>
            <span>${esc(financeMethodText(request, type))}</span>
            ${method.ifsc ? `<span>IFSC: ${esc(method.ifsc)}</span>` : ""}
          </div>`}
        <div class="finance-safety-note">
          ${isDeposit ? "Approve will credit real wallet once only. Duplicate approved UTR is blocked." : "Approve will debit real wallet at approval time. If balance is insufficient, approval is blocked."}
        </div>
      </section>`;
  }

  function pendingFinanceCount(type) {
    return allWalletRequests().filter(x => x.type === type && x.request.status === "PENDING").length;
  }

  function statusPill(status) {
    const clean = String(status || "NOT_SUBMITTED").replaceAll("_", " ");
    const cls = String(status || "").toLowerCase().replaceAll("_", "-");
    return `<span class="status-pill ${cls}">${clean}</span>`;
  }


  function statusPriority(status) {
    const value = String(status || "").toUpperCase();
    if (value === "PENDING") return 0;
    if (value === "APPROVED") return 1;
    if (value === "REJECTED") return 2;
    return 3;
  }

  function timeValue(value) {
    const parsed = Date.parse(value || "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function kycSortValue(kyc) {
    return timeValue(kyc.submittedAt || kyc.approvedAt || kyc.rejectedAt);
  }

  function bankMethodSortValue(method) {
    return timeValue(method.createdAt || method.approvedAt || method.rejectedAt || method.deletedAt);
  }

  function userStatus(user) {
    return String(user.status || "ACTIVE").toUpperCase();
  }

  function userStatusText(status) {
    const value = String(status || "ACTIVE").toUpperCase();
    if (value === "BLOCKED") return "Login blocked";
    if (value === "SUSPENDED") return "Temporarily suspended";
    return "Allowed to login";
  }

  function avatar(name) {
    return `<span class="admin-avatar">${String(name || "A").trim().charAt(0).toUpperCase()}</span>`;
  }

  function esc(value) {
    return App.escapeHtml(value || "");
  }


  function digitsOnly(value, max = 99) {
    return String(value || "").replace(/\D/g, "").slice(0, max);
  }

  function maskAadhaar(value) {
    const digits = digitsOnly(value, 12);
    return digits ? `XXXX XXXX ${digits.slice(-4)}` : "-";
  }

  function duplicateAadhaarWarning(user, kyc) {
    const aadhaar = digitsOnly(kyc?.id?.number || kyc?.idDetails?.number, 12);
    if (!aadhaar) return "";
    const matches = (App.state.kycRequests || []).filter(row => {
      if (row.userId === user.id) return false;
      const status = String(row.status || "").toUpperCase();
      if (!["PENDING", "APPROVED"].includes(status)) return false;
      return digitsOnly(row.idDetails?.number || row.id?.number, 12) === aadhaar;
    });
    return matches.length ? `<div class="duplicate-warning-box">Duplicate Aadhaar warning: this Aadhaar is already used in another pending/approved KYC.</div>` : "";
  }

  function includesText(value, query) {
    return String(value || "").toLowerCase().includes(String(query || "").toLowerCase());
  }
  function platformSettings() {
    const defaults = {
      minDeposit: 500,
      minWithdrawal: 1000,
      referralFirstDepositPercent: 10,
      demoBalance: 100000,
      platformName: "AITradeX",
      depositUpiId: "aitradex@upi",
      depositQrImage: "",
      depositUpiEnabled: true,
      depositBankEnabled: true,
      depositBankName: "AITradeX Bank",
      depositAccountName: "AITradeX Private Wallet",
      depositAccountNumber: "123456789012",
      depositIfsc: "AITX0001234"
    };
    App.state.settings = { ...defaults, ...(App.state.settings || {}) };
    return App.state.settings;
  }

  function inputValue(id) {
    return (document.getElementById(id)?.value || "").trim();
  }


  function marketPairs() {
    return App.marketPairs || { CRYPTO: [], FOREX: [] };
  }

  function allTradePairs() {
    const pairs = marketPairs();
    return Object.keys(pairs).flatMap(market => (pairs[market] || []).map(item => ({ ...item, market })));
  }

  function activeAiTradePairs() {
    const pairs = marketPairs();
    return (pairs.CRYPTO || []).map(item => ({ ...item, market: "CRYPTO" }));
  }

  function pairDataByPair(pair) {
    const cleanPair = String(pair || "").trim().toUpperCase();
    const activePairs = activeAiTradePairs();
    return activePairs.find(item => String(item.pair || "").toUpperCase() === cleanPair) || activePairs[0] || { market: "CRYPTO", pair: "BTC/USDT" };
  }

  function aiTradePairOptions(selected = "BTC/USDT") {
    const activePairs = activeAiTradePairs();
    return `
      <optgroup label="CRYPTO · LIVE">
        ${activePairs.map(item => `
          <option value="${esc(item.pair)}" ${String(item.pair).toUpperCase() === String(selected).toUpperCase() ? "selected" : ""}>${esc(App.displayPairLabel ? App.displayPairLabel(item.pair) : item.pair)} · ${esc(item.inr || item.symbol || "CRYPTO")}</option>
        `).join("")}
      </optgroup>
    `;
  }

  function aiLeverageOptions(selected = 10) {
    const selectedLev = String(Math.max(1, Math.min(2000, Number(selected || 10))));
    const values = [1, 2, 5, 10, 25, 50, 100, 200, 500, 1000, 2000];
    return values.map(value => `<option value="${value}" ${String(value) === selectedLev ? "selected" : ""}>${value}x</option>`).join("");
  }

  function normalizeAdminLeverage(value) {
    const lev = Number(value || 1);
    if (!Number.isFinite(lev)) return 1;
    return Math.max(1, Math.min(2000, lev));
  }

  function aiPairPriceView(pair = "BTC/USDT") {
    const item = pairDataByPair(pair);
    const view = App.pairLiveView ? App.pairLiveView(item) : item;
    const chartFeed = App.isChartFeedPair && App.isChartFeedPair(view.pair);
    return {
      pair: view.pair,
      price: view.price || "--",
      source: chartFeed ? (view.priceSource || "TradingView Chart Feed") : (view.priceSource || "Not fetched"),
      change: view.change || "--",
      metal: App.isMetalPair && App.isMetalPair(view.pair)
    };
  }

  function setAiPriceView(row) {
    const priceEl = document.getElementById("aiEntryPriceValue");
    const sourceEl = document.getElementById("aiEntryPriceSource");
    const statusEl = document.getElementById("aiEntryPriceStatus");
    const manualWrap = document.getElementById("aiManualPriceWrap");
    const pair = inputValue("aiTradePair") || "BTC/USDT";
    const meta = aiPairPriceView(pair);
    const finalRow = row || meta;
    if (priceEl) priceEl.textContent = finalRow.display || finalRow.price || "--";
    if (sourceEl) sourceEl.textContent = finalRow.source || "Not fetched";
    if (statusEl) statusEl.textContent = row?.ok ? "Live locked" : (meta.metal ? "Chart feed ready" : "Ready");
    if (manualWrap) manualWrap.classList.toggle("show", !!meta.metal);
  }


  function dateLine(label, value) {
    if (!value) return "";
    return `<div class="admin-date-line"><span>${label}</span><b>${new Date(value).toLocaleString()}</b></div>`;
  }

  function jsArg(value) {
    return JSON.stringify(String(value ?? "")).replace(/</g, "\\u003c");
  }

  function detailCopyRow(label, value, copyValue = value) {
    const clean = value || "-";
    const hasValue = !!value && value !== "-";
    return `
      <article class="withdrawal-detail-row">
        <span>${esc(label)}</span>
        <b>${esc(clean)}</b>
        ${hasValue ? `<button type="button" onclick="AITradeXAdmin.copyText(${jsArg(copyValue)})">Copy</button>` : ""}
      </article>`;
  }

  function withdrawalPayoutDetails(request) {
    const method = request.methodSnapshot || {};
    const type = String(method.type || request.methodType || "").toUpperCase();

    if (type === "UPI") {
      return `
        <section class="withdrawal-detail-panel legacy-upi-panel">
          <div class="withdrawal-detail-title"><span>Legacy UPI Payout Details</span><b>Old Request</b></div>
          <div class="withdrawal-detail-grid">
            ${detailCopyRow("Holder Name", method.holderName)}
            ${detailCopyRow("UPI ID", method.upiId)}
            ${detailCopyRow("Method ID", request.methodId)}
          </div>
        </section>`;
    }

    return `
      <section class="withdrawal-detail-panel">
        <div class="withdrawal-detail-title"><span>Bank Payout Details</span><b>Verified Bank Account</b></div>
        <div class="withdrawal-detail-grid">
          ${detailCopyRow("Account Holder", method.holderName)}
          ${detailCopyRow("Bank Name", method.bankName)}
          ${detailCopyRow("Account Number", method.accountNumber)}
          ${detailCopyRow("IFSC Code", method.ifsc)}
          ${detailCopyRow("Account Type", method.accountType || method.bankType)}
          ${detailCopyRow("Method ID", request.methodId)}
        </div>
      </section>`;
  }

  function adminNotifications() {
    return App.notificationsFor ? App.notificationsFor({ audience: "ADMIN" }) : [];
  }

  function adminUnreadCount() {
    return App.unreadNotificationCount ? App.unreadNotificationCount({ audience: "ADMIN" }) : 0;
  }

  function adminUnreadBadgeText() {
    const count = adminUnreadCount();
    return count ? ` (${count > 99 ? "99+" : count})` : "";
  }

  function adminNotificationBadgeHtml() {
    const count = adminUnreadCount();
    return count ? `<span class="notification-badge">${count > 99 ? "99+" : count}</span>` : "";
  }

  function notificationIcon(type) {
    const map = { DEPOSIT: "⬇️", WITHDRAWAL: "⬆️", AI: "🤖", WALLET: "💳", PLAN: "⭐", KYC: "🛡️", SUPPORT: "🎧", USER: "👤" };
    return map[String(type || "INFO").toUpperCase()] || "🔔";
  }

  function shell(content) {
    const admin = adminUser();
    const stats = adminDashboardStats();
    root.innerHTML = `
      <div class="app-shell control-shell admin-pro-shell">
        <aside class="sidebar admin-pro-sidebar">
          <div class="side-brand brand aitx-admin-logo">${App.logoHtml("full", "aitx-logo-admin")}</div>
          <div class="admin-side-profile-card">
            ${avatar(admin?.name || "A")}
            <div><b>${esc(admin?.name || "Admin")}</b><span>Control Center</span></div>
          </div>
          <div class="admin-side-mini-stats">
            <span><b>${stats.users.length}</b> users</span>
            <span><b>${stats.livePositions}</b> live AI</span>
          </div>
          <nav class="admin-nav-groups">
            ${navGroup("Overview", [
              navButton("dashboard", "📊", "Dashboard", "Control room"),
              navButton("notifications", "🔔", `Notifications${adminUnreadBadgeText()}`, "Alerts")
            ])}
            ${navGroup("Users & Verification", [
              navButton("users", "👥", "Users", "Wallet, plan, status"),
              navButton("kyc", "🛡️", "KYC Requests", "Identity review"),
              navButton("payments", "🏦", "Bank Accounts", "Payout methods")
            ])}
            ${navGroup("Finance", [
              navButton("deposits", "⬇️", "Deposits", "UTR/proof"),
              navButton("withdrawals", "⬆️", "Withdrawals", "Payout control")
            ])}
            ${navGroup("AI Trading", [
              navButton("instantAi", "⚡", "Instant AI Trade", "Direct result"),
              navButton("liveAi", "📈", "Live Position Trade", "Running positions")
            ])}
            ${navGroup("System", [
              navButton("plans", "⭐", "Plans", "AI limits"),
              navButton("referrals", "🎁", "Referrals", "Rewards"),
              navButton("support", "🎧", "Support Tickets", "Inbox"),
              navButton("settings", "⚙️", "Payment Settings", "UPI/bank")
            ])}
          </nav>
          <button class="logout-btn admin-pro-logout" onclick="AITradeXAdmin.logout()">🚪 Logout</button>
        </aside>
        <main class="main-area admin-pro-main">
          <div class="page-title admin-pro-title">
            <div>
              <p>AITradeX Admin</p>
              <h1>${pageTitle()}</h1>
            </div>
            <div class="admin-header-actions"><button class="notification-bell admin-bell" onclick="AITradeXAdmin.go('notifications')" aria-label="Notifications">🔔${adminNotificationBadgeHtml()}</button><div class="admin-profile-chip">${avatar(admin?.name || "A")}<b>${esc(admin?.name || "Admin")}</b></div></div>
          </div>
          ${content}
        </main>
      </div>`;
  }

  function navGroup(title, items) {
    return `<div class="admin-nav-group"><span>${esc(title)}</span>${items.join("")}</div>`;
  }

  function navButton(key, icon, label, subtitle = "") {
    return `<button class="admin-nav-button ${page === key ? "active" : ""}" onclick="AITradeXAdmin.go('${key}')"><i>${icon}</i><b>${label}</b>${subtitle ? `<small>${esc(subtitle)}</small>` : ""}</button>`;
  }

  function pageTitle() {
    const titles = {
      dashboard: "Dashboard",
      notifications: "Notifications",
      users: "User Management",
      kyc: "KYC Requests",
      payments: "Bank Account Requests",
      deposits: "Deposits",
      withdrawals: "Withdrawals",
      trades: "AI Trade Control",
      instantAi: "Instant AI Trade",
      liveAi: "Live Position Trade",
      plans: "Subscription Plans",
      referrals: "Referrals",
      support: "Support Tickets",
      settings: "Payment Settings"
    };
    return titles[page] || "Dashboard";
  }

  function loginPage() {
    root.innerHTML = `
      <main class="control-login">
        <section class="control-card">
          <div class="brand center aitx-login-logo">${App.logoHtml("full", "aitx-logo-login")}</div>
          <p class="eyebrow">AI Control Center</p>
          <h1>Admin Login</h1>
          <form onsubmit="AITradeXAdmin.login(event)" class="form-grid">
            <label>Email<input id="adminEmail" type="email" required placeholder="control@aitradex.com"/></label>
            <label>Password<input id="adminPassword" type="password" required placeholder="admin123"/></label>
            <button class="btn">Login</button>
          </form>
        </section>
      </main>`;
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function isTodayDate(value) {
    return String(value || "").slice(0, 10) === todayKey();
  }

  function notificationsPage() {
    const rows = adminNotifications();
    const unread = rows.filter(n => !n.read).length;
    shell(`
      <section class="premium-card notification-center-card admin-notification-center">
        <div class="section-head">
          <div><h3>Notification Center</h3><span>New users, deposits, withdrawals, AI trades, wallet and support alerts</span></div>
          <div class="notification-actions">
            <span class="admin-count-pill">${unread} unread</span>
            <button class="ghost-action" onclick="AITradeXAdmin.markNotificationsRead()">Mark all read</button>
          </div>
        </div>
        <div class="notification-list admin-notification-list">
          ${rows.length ? rows.map(n => `
            <article class="notification-row ${n.read ? "read" : "unread"}">
              <div class="notification-icon">${notificationIcon(n.type)}</div>
              <div>
                <b>${esc(n.title || "Notification")}</b>
                <p>${esc(n.message || "")}</p>
                <small>${n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}</small>
              </div>
              ${n.linkPage ? `<button class="mini-action" onclick="AITradeXAdmin.openNotificationLink('${n.id}', '${n.linkPage}')">Open</button>` : `<button class="ghost-action" onclick="AITradeXAdmin.markSingleNotification('${n.id}')">Read</button>`}
            </article>`).join("") : `<div class="empty-state">No notifications yet.</div>`}
        </div>
      </section>`);
  }

  function adminDashboardStats() {
    const users = allUsers();
    const activeUsers = users.filter(u => userStatus(u) === "ACTIVE");
    const blockedUsers = users.filter(u => userStatus(u) === "BLOCKED");
    const suspendedUsers = users.filter(u => userStatus(u) === "SUSPENDED");
    const deposits = financeStats("DEPOSIT");
    const withdrawals = financeStats("WITHDRAWAL");
    const liveRows = aiLivePositions();
    const livePnl = liveRows.reduce((sum, row) => sum + aiLivePositionPnl(row), 0);
    const lockedAmount = liveRows.reduce((sum, row) => sum + Number(row.marginAmount || 0), 0);
    const todayTrades = (App.state.trades || []).filter(t => isTodayDate(t.createdAt || t.openedAt || t.closedAt));
    const todayAiPnl = todayTrades
      .filter(t => String(t.tradeType || "").startsWith("AI") || String(t.source || "").includes("AI"))
      .reduce((sum, t) => sum + Number(t.pnl || t.profitLoss || 0), 0);
    const totalAiPnl = (App.state.trades || [])
      .filter(t => String(t.tradeType || "").startsWith("AI") || String(t.source || "").includes("AI"))
      .reduce((sum, t) => sum + Number(t.pnl || t.profitLoss || 0), 0);
    return {
      users,
      activeUsers: activeUsers.length,
      blockedUsers: blockedUsers.length,
      suspendedUsers: suspendedUsers.length,
      aiOnUsers: users.filter(u => u.aiTradeOn && userStatus(u) === "ACTIVE").length,
      totalWallet: users.reduce((sum, u) => sum + App.realBalance(u.id), 0),
      deposits,
      withdrawals,
      livePositions: liveRows.length,
      livePnl: Number(livePnl.toFixed(2)),
      lockedAmount: Number(lockedAmount.toFixed(2)),
      todayAiTrades: todayTrades.filter(t => String(t.tradeType || "").startsWith("AI") || String(t.source || "").includes("AI")).length,
      todayAiPnl: Number(todayAiPnl.toFixed(2)),
      totalAiPnl: Number(totalAiPnl.toFixed(2)),
      openSupportTickets: (App.state.supportTickets || []).filter(t => String(t.status || "OPEN").toUpperCase() !== "CLOSED").length
    };
  }

  function pendingActionRow(icon, title, subtitle, count, targetPage) {
    return `
      <article class="dashboard-action-row">
        <i>${icon}</i>
        <div><b>${esc(title)}</b><span>${esc(subtitle)}</span></div>
        <strong>${count}</strong>
        <button class="mini-action" onclick="AITradeXAdmin.go('${targetPage}')">Open</button>
      </article>`;
  }

  function recentActivityRows(limit = 8) {
    const userName = userId => displayNameFor(allUsers().find(u => u.id === userId) || {});
    const financeRows = allWalletRequests().map(x => ({
      at: x.request.updatedAt || x.request.approvedAt || x.request.rejectedAt || x.request.createdAt,
      title: `${x.type === "DEPOSIT" ? "Deposit" : "Withdrawal"} ${String(x.request.status || "PENDING").toLowerCase()}`,
      detail: `${displayNameFor(x.user)} · ${App.money(x.request.amount || 0)}`,
      tag: x.type,
      page: x.type === "DEPOSIT" ? "deposits" : "withdrawals"
    }));
    const tradeRows = (App.state.trades || [])
      .filter(t => String(t.tradeType || "").startsWith("AI") || String(t.source || "").includes("AI"))
      .map(t => ({
        at: t.closedAt || t.openedAt || t.createdAt,
        title: `${String(t.status || "AI Trade").toUpperCase()} · ${t.pair || "AI"}`,
        detail: `${userName(t.userId)} · P/L ${App.money(t.pnl || t.profitLoss || 0)}`,
        tag: t.tradeType === "AI_LIVE" ? "LIVE" : "INSTANT",
        page: t.tradeType === "AI_LIVE" ? "liveAi" : "instantAi"
      }));
    const ledgerRows = (App.state.walletLedger || []).map(row => ({
      at: row.createdAt,
      title: String(row.type || "Wallet Entry").replaceAll("_", " "),
      detail: `${userName(row.userId)} · ${App.money(row.amount || 0)}`,
      tag: "WALLET",
      page: "users"
    }));
    return [...financeRows, ...tradeRows, ...ledgerRows]
      .filter(row => row.at)
      .sort((a, b) => Date.parse(b.at || 0) - Date.parse(a.at || 0))
      .slice(0, limit);
  }

  function recentActivityHtml() {
    const rows = recentActivityRows();
    return rows.length ? rows.map(row => `
      <article class="dashboard-activity-row">
        <div><b>${esc(row.title)}</b><span>${esc(row.detail)} · ${new Date(row.at).toLocaleString("en-IN")}</span></div>
        <button class="mini-action" onclick="AITradeXAdmin.go('${row.page}')">${esc(row.tag)}</button>
      </article>`).join("") : `<div class="empty-state">No recent activity yet.</div>`;
  }

  function dashboardPage() {
    const users = allUsers();
    const kycRequests = users.map(u => ({ user: u, kyc: kycFor(u) })).filter(x => x.kyc.status === "PENDING");
    const paymentPending = users.flatMap(u => paymentMethodsFor(u).map(m => ({ user: u, method: m }))).filter(x => x.method.status === "PENDING");
    const stats = adminDashboardStats();

    shell(`
      <section class="admin-dashboard-hero">
        <div>
          <span>Admin Control Room</span>
          <h2>Live platform analytics</h2>
          <p>Total users, wallet exposure, pending finance actions and AI trade risk are now visible on one screen.</p>
        </div>
        <button class="mini-action" onclick="AITradeXAdmin.go('dashboard')">Refresh</button>
      </section>

      <section class="metrics-grid dashboard-analytics-grid admin-dashboard-primary-metrics">
        ${metric("👥", "Total Users", stats.users.length)}
        ${metric("✅", "Active Users", stats.activeUsers)}
        ${metric("🚫", "Blocked / Suspended", `${stats.blockedUsers}/${stats.suspendedUsers}`)}
        ${metric("💰", "Total Real Wallet", App.money(stats.totalWallet))}
        ${metric("⬇️", "Today Deposits", App.money(stats.deposits.todayAmount))}
        ${metric("⬆️", "Today Withdrawals", App.money(stats.withdrawals.todayAmount))}
        ${metric("⌛", "Pending Deposits", `${stats.deposits.pending} · ${App.money(stats.deposits.pendingAmount)}`)}
        ${metric("⌛", "Pending Withdrawals", `${stats.withdrawals.pending} · ${App.money(stats.withdrawals.pendingAmount)}`)}
        ${metric("📈", "Running AI Positions", stats.livePositions)}
        ${metric("🔒", "Locked AI Amount", App.money(stats.lockedAmount))}
        ${metric("🤖", "Today AI P/L", `${stats.todayAiPnl >= 0 ? "+" : ""}${App.money(stats.todayAiPnl)}`, stats.todayAiPnl >= 0 ? "profit" : "loss")}
        ${metric("📊", "Total AI P/L", `${stats.totalAiPnl >= 0 ? "+" : ""}${App.money(stats.totalAiPnl)}`, stats.totalAiPnl >= 0 ? "profit" : "loss")}
      </section>

      <section class="admin-grid-two dashboard-control-grid">
        <div class="panel-card dashboard-pending-panel">
          <div class="section-head"><div><h3>Pending Action Panel</h3><span>Important items that need admin attention</span></div></div>
          <div class="admin-list">
            ${pendingActionRow("🛡️", "Pending KYC", "Users waiting for verification", kycRequests.length, "kyc")}
            ${pendingActionRow("💳", "Bank Account Requests", "Payment methods waiting for approval", paymentPending.length, "payments")}
            ${pendingActionRow("⬇️", "Pending Deposits", "Deposit requests to approve/reject", stats.deposits.pending, "deposits")}
            ${pendingActionRow("⬆️", "Pending Withdrawals", "Withdrawal requests to approve/reject", stats.withdrawals.pending, "withdrawals")}
            ${pendingActionRow("📈", "Running Live AI", "Open AI positions to monitor/close", stats.livePositions, "liveAi")}
            ${pendingActionRow("🎧", "Open Support Tickets", "User support messages", stats.openSupportTickets, "support")}
          </div>
        </div>

        <div class="panel-card dashboard-activity-panel">
          <div class="section-head"><div><h3>Recent Activity Feed</h3><span>Latest wallet, finance and AI trade events</span></div></div>
          <div class="admin-list">${recentActivityHtml()}</div>
        </div>
      </section>

      <section class="admin-grid-two">
        <div class="panel-card">
          <div class="section-head"><div><h3>Latest KYC Requests</h3><span>Pending verification</span></div><button onclick="AITradeXAdmin.go('kyc')" class="mini-action">View All</button></div>
          <div class="admin-list">
            ${kycRequests.length ? kycRequests.slice(0, 5).map(({ user, kyc }) => smallRequestRow(user, kyc.status, kyc.personal.fullName, "KYC")).join("") : `<div class="empty-state">No pending KYC requests.</div>`}
          </div>
        </div>

        <div class="panel-card">
          <div class="section-head"><div><h3>Bank Account Requests</h3><span>Pending approval</span></div><button onclick="AITradeXAdmin.go('payments')" class="mini-action">View All</button></div>
          <div class="admin-list">
            ${paymentPending.length ? paymentPending.slice(0, 5).map(({ user, method }) => smallRequestRow(user, method.status, method.bankName, method.type)).join("") : `<div class="empty-state">No pending bank accounts.</div>`}
          </div>
        </div>
      </section>
    `);
  }

  function metric(icon, label, value, tone = "") {
    const toneClass = tone === "profit" ? "profit-text" : tone === "loss" ? "loss-text" : "";
    return `
      <article class="metric-card">
        <div class="metric-top"><span>${label}</span><i>${icon}</i></div>
        <strong class="${toneClass}">${value}</strong>
        <small>AITradeX control</small>
      </article>`;
  }

  function smallRequestRow(user, status, title, type) {
    return `
      <article class="admin-small-row">
        ${avatar(displayNameFor(user))}
        <div><b>${esc(title || displayNameFor(user))}</b><span>${esc(user.email)} · ${type}</span></div>
        ${statusPill(status)}
      </article>`;
  }

  function userFilterBar() {
    return `
      <section class="admin-filter-bar users-filter-bar">
        <input value="${esc(usersSearch)}" oninput="AITradeXAdmin.setUsersSearch(this.value)" placeholder="Search name, email, mobile..."/>
        <div class="filter-chips">
          ${["ALL", "ACTIVE", "SUSPENDED", "BLOCKED"].map(s => `<button class="${usersStatusFilter === s ? "active" : ""}" onclick="AITradeXAdmin.setUsersStatusFilter('${s}')">${s}</button>`).join("")}
        </div>
      </section>`;
  }

  function userSearchScore(user, query) {
    if (!query) return 999;
    const name = String(displayNameFor(user) || "").toLowerCase();
    const email = String(user.email || "").toLowerCase();
    const mobile = String(user.mobile || "").toLowerCase();
    const referral = String(user.referralCode || "").toLowerCase();
    if (email === query || mobile === query || referral === query) return 0;
    if (name === query) return 1;
    if (email.startsWith(query) || mobile.startsWith(query)) return 2;
    if (name.startsWith(query)) return 3;
    return 10;
  }

  function usersPage() {
    const query = usersSearch.trim().toLowerCase();
    const users = allUsers()
      .filter(u => usersStatusFilter === "ALL" || userStatus(u) === usersStatusFilter)
      .filter(u => {
        if (!query) return true;
        return [displayNameFor(u), u.email, u.mobile, userStatus(u), u.referralCode, App.currentPlan(u.id)?.name].some(v => includesText(v, query));
      })
      .sort((a, b) => {
        const score = userSearchScore(a, query) - userSearchScore(b, query);
        if (score !== 0) return score;
        return displayNameFor(a).localeCompare(displayNameFor(b));
      });

    const userPageSize = 1;
    const totalPages = Math.max(1, Math.ceil(users.length / userPageSize));
    usersPageNo = Math.min(Math.max(1, usersPageNo), totalPages);
    localStorage.setItem("AITradeX_ADMIN_USERS_PAGE", String(usersPageNo));
    const visibleUsers = users.slice((usersPageNo - 1) * userPageSize, usersPageNo * userPageSize);

    shell(`
      ${userFilterBar()}
      <section class="metrics-grid user-wallet-metrics">
        ${metric("👥", "Filtered Users", users.length)}
        ${metric("💰", "Total Real Balance", App.money(users.reduce((sum, u) => sum + App.realBalance(u.id), 0)))}
        ${metric("🤖", "AI Enabled", users.filter(u => u.aiTradeOn).length)}
        ${metric("⛔", "Blocked", allUsers().filter(u => userStatus(u) === "BLOCKED").length)}
      </section>
      <section class="panel-card admin-user-manager-panel">
        <div class="section-head">
          <div><h3>User & Wallet Control</h3><span>One user card per page. Search/filter brings matching users to the top for quick wallet, plan and status control.</span></div>
          <span class="admin-count-pill">${users.length} result</span>
        </div>
        <div class="admin-user-page-meta">
          <b>${visibleUsers.length ? `Showing user ${((usersPageNo - 1) * userPageSize) + 1} of ${users.length}` : "No user selected"}</b>
          <span>${query ? `Search priority: ${esc(usersSearch)}` : "Use search to jump to a user quickly."}</span>
        </div>
        <div class="admin-user-card-list paged-user-card-list">
          ${visibleUsers.map(u => userControlCard(u)).join("") || `<div class="empty-state">No users found.</div>`}
        </div>
        ${users.length > userPageSize ? `<div class="admin-pagination users-main-pagination"><button class="ghost-action" ${usersPageNo <= 1 ? "disabled" : ""} onclick="AITradeXAdmin.changeUsersPage(-1)">Prev User</button><span>Page ${usersPageNo} of ${totalPages}</span><button class="ghost-action" ${usersPageNo >= totalPages ? "disabled" : ""} onclick="AITradeXAdmin.changeUsersPage(1)">Next User</button></div>` : ""}
      </section>
      ${walletHistoryPanel(users)}
    `);
  }

  function planSelectHtml(user) {
    const current = App.currentPlan(user.id) || {};
    const plans = App.getPlans ? App.getPlans() : (App.state.plans || []);
    return plans.map(plan => `<option value="${esc(plan.id)}" ${plan.id === current.id ? "selected" : ""}>${esc(plan.name)} · ${Number(plan.signals || 0)} AI/day</option>`).join("");
  }

  function userWalletRows(user, limit = 5) {
    return (App.state.walletLedger || [])
      .filter(row => row.userId === user.id)
      .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0))
      .slice(0, limit);
  }

  function userControlCard(user) {
    const kyc = kycFor(user);
    const status = userStatus(user);
    const deposits = depositRequestsFor(user);
    const withdrawals = withdrawalRequestsFor(user);
    const pendingDeposits = deposits.filter(r => r.status === "PENDING").length;
    const pendingWithdrawals = withdrawals.filter(r => r.status === "PENDING").length;
    const plan = App.currentPlan(user.id) || {};
    const aiLimit = App.aiDailyLimit ? App.aiDailyLimit(user.id) : Number(plan.signals || 0);
    const aiUsed = App.aiTradesToday ? App.aiTradesToday(user.id) : 0;
    const activeAi = (App.state.trades || []).filter(t => t.userId === user.id && t.tradeType === "AI_LIVE" && String(t.status || "OPEN").toUpperCase() !== "CLOSED").length;
    const walletRows = userWalletRows(user, 4);
    return `
      <article class="admin-user-control-card status-${status.toLowerCase()}">
        <div class="user-control-head">
          <div class="request-user">
            ${avatar(displayNameFor(user))}
            <div>
              <b>${esc(displayNameFor(user))}</b>
              <span>${esc(user.email)} · ${esc(user.mobile || "No mobile")}</span>
            </div>
          </div>
          <div class="user-status-stack">
            ${statusPill(status)}
            <small>${userStatusText(status)}</small>
          </div>
        </div>

        <div class="user-control-grid admin-user-premium-grid">
          <article><span>Real Balance</span><b>${App.money(App.realBalance(user.id))}</b></article>
          <article><span>Demo Balance</span><b>${App.money(App.demoBalance(user.id))}</b></article>
          <article><span>Plan</span><b>${esc(plan.name || "Free")}</b></article>
          <article><span>AI Limit</span><b>${aiUsed}/${aiLimit}</b></article>
          <article><span>Active AI</span><b>${activeAi}</b></article>
          <article><span>KYC</span><b>${statusPill(kyc.status)}</b></article>
          <article><span>Pending Deposit</span><b>${pendingDeposits}</b></article>
          <article><span>Pending Withdrawal</span><b>${pendingWithdrawals}</b></article>
        </div>

        <div class="admin-user-tools-grid">
          <form class="admin-inline-tool wallet-adjust-tool" onsubmit="AITradeXAdmin.adjustUserWallet(event, '${user.id}')">
            <b>Wallet Add / Deduct</b>
            <div class="admin-tool-row">
              <input id="walletAmount_${user.id}" type="number" min="1" step="0.01" placeholder="Amount" required />
              <select id="walletAction_${user.id}">
                <option value="ADD">Add</option>
                <option value="DEDUCT">Deduct</option>
              </select>
            </div>
            <input id="walletNote_${user.id}" placeholder="Admin note / reason" />
            <button class="approve-btn" type="submit">Update Wallet</button>
          </form>

          <form class="admin-inline-tool plan-change-tool" onsubmit="AITradeXAdmin.changeUserPlan(event, '${user.id}')">
            <b>Plan Change</b>
            <select id="planSelect_${user.id}">${planSelectHtml(user)}</select>
            <small>Admin plan change does not cut wallet balance.</small>
            <button class="ghost-action" type="submit">Save Plan</button>
          </form>

          <form class="admin-inline-tool password-reset-tool" onsubmit="AITradeXAdmin.resetUserPassword(event, '${user.id}')">
            <b>Password Reset</b>
            <input id="newPassword_${user.id}" type="text" minlength="4" placeholder="New password" required />
            <button class="ghost-action" type="submit">Reset Password</button>
          </form>
        </div>

        <div class="admin-action-row user-status-actions">
          <button class="approve-btn" ${status === "ACTIVE" ? "disabled" : ""} onclick="AITradeXAdmin.setUserStatus('${user.id}', 'ACTIVE', this)">Make Active</button>
          <button class="suspend-btn" ${status === "SUSPENDED" ? "disabled" : ""} onclick="AITradeXAdmin.setUserStatus('${user.id}', 'SUSPENDED', this)">Suspend</button>
          <button class="reject-btn" ${status === "BLOCKED" ? "disabled" : ""} onclick="AITradeXAdmin.setUserStatus('${user.id}', 'BLOCKED', this)">Block</button>
        </div>

        <details class="admin-user-details-box">
          <summary>View user details & recent wallet history</summary>
          <div class="user-control-grid admin-user-detail-grid">
            <article><span>User ID</span><b>${esc(user.id)}</b></article>
            <article><span>Referral Code</span><b>${esc(user.referralCode || "-")}</b></article>
            <article><span>Joined</span><b>${esc(user.createdAt || "-")}</b></article>
            <article><span>AI Allocation</span><b>${Number(user.aiTradePercent || 25)}%</b></article>
            <article><span>AI Trade</span><b>${user.aiTradeOn ? "ON" : "OFF"}</b></article>
            <article><span>Status Updated</span><b>${esc(user.statusUpdatedAt || "-")}</b></article>
          </div>
          <div class="admin-mini-table wallet-mini-table">
            ${walletRows.length ? walletRows.map(row => `<div><span>${esc(row.type || "LEDGER")}</span><b class="${Number(row.amount || 0) >= 0 ? "profit-text" : "loss-text"}">${Number(row.amount || 0) >= 0 ? "+" : ""}${App.money(row.amount || 0)}</b><small>${esc(row.note || "-")} · ${row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}</small></div>`).join("") : `<div class="empty-state">No wallet history yet.</div>`}
          </div>
        </details>
      </article>`;
  }

  function walletHistoryPanel(users) {
    const ids = new Set(users.map(u => u.id));
    const rows = (App.state.walletLedger || [])
      .filter(row => ids.has(row.userId))
      .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
    const pageSize = 8;
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    walletHistoryPage = Math.min(Math.max(1, walletHistoryPage), totalPages);
    const visible = rows.slice((walletHistoryPage - 1) * pageSize, walletHistoryPage * pageSize);
    return `
      <section class="panel-card admin-wallet-history-panel">
        <div class="section-head"><div><h3>Wallet History</h3><span>Paginated ledger for the filtered users above.</span></div><span class="admin-count-pill">${rows.length} rows</span></div>
        <div class="admin-history-table">
          ${visible.length ? visible.map(row => {
            const target = allUsers().find(u => u.id === row.userId) || {};
            return `<article class="admin-history-row">
              <div><b>${esc(displayNameFor(target))}</b><span>${esc(target.email || row.userId)}</span></div>
              <div><b>${esc(row.type || "LEDGER")}</b><span>${esc(row.note || "-")}</span></div>
              <div><b class="${Number(row.amount || 0) >= 0 ? "profit-text" : "loss-text"}">${Number(row.amount || 0) >= 0 ? "+" : ""}${App.money(row.amount || 0)}</b><span>Balance: ${App.money(row.balanceAfter || 0)}</span></div>
              <div><b>${row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}</b><span>${esc(row.referenceId || "-")}</span></div>
            </article>`;
          }).join("") : `<div class="empty-state">No wallet ledger found for selected users.</div>`}
        </div>
        ${totalPages > 1 ? `<div class="admin-pagination"><button class="ghost-action" ${walletHistoryPage <= 1 ? "disabled" : ""} onclick="AITradeXAdmin.changeWalletHistoryPage(-1)">Prev</button><span>Page ${walletHistoryPage} of ${totalPages}</span><button class="ghost-action" ${walletHistoryPage >= totalPages ? "disabled" : ""} onclick="AITradeXAdmin.changeWalletHistoryPage(1)">Next</button></div>` : ""}
      </section>`;
  }

  function filterBarKyc() {
    return `
      <section class="admin-filter-bar">
        <input value="${esc(kycSearch)}" oninput="AITradeXAdmin.setKycSearch(this.value)" placeholder="Search name, email, mobile, document no."/>
        <div class="filter-chips">
          ${["ALL", "PENDING", "APPROVED", "REJECTED"].map(s => `<button class="${kycFilter === s ? "active" : ""}" onclick="AITradeXAdmin.setKycFilter('${s}')">${s}</button>`).join("")}
        </div>
      </section>`;
  }

  function kycPage() {
    const query = kycSearch.trim().toLowerCase();
    const items = allUsers()
      .map(user => ({ user, kyc: kycFor(user) }))
      .filter(x => x.kyc.status !== "NOT_SUBMITTED")
      .filter(x => kycFilter === "ALL" || x.kyc.status === kycFilter)
      .filter(({ user, kyc }) => {
        if (!query) return true;
        return [
          displayNameFor(user),
          user.email,
          user.mobile,
          kyc.personal.fullName,
          kyc.personal.mobile,
          kyc.id.number,
          kyc.id.type
        ].some(v => includesText(v, query));
      })
      .sort((a, b) => {
        const priorityDiff = statusPriority(a.kyc.status) - statusPriority(b.kyc.status);
        if (priorityDiff) return priorityDiff;
        return kycSortValue(b.kyc) - kycSortValue(a.kyc);
      });

    const allKyc = allUsers().map(u => kycFor(u)).filter(k => k.status !== "NOT_SUBMITTED");
    shell(`
      <section class="admin-module-hero kyc-admin-hero">
        <div><span>Verification Desk</span><h2>KYC Review Center</h2><p>Compact request review with duplicate Aadhaar warnings and reject reason presets.</p></div>
        <div class="admin-hero-stats"><b>${allKyc.filter(k => k.status === "PENDING").length}</b><span>Pending</span></div>
      </section>
      <section class="metrics-grid compact-metrics">
        ${metric("⌛", "Pending", allKyc.filter(k => k.status === "PENDING").length)}
        ${metric("✅", "Approved", allKyc.filter(k => k.status === "APPROVED").length)}
        ${metric("❌", "Rejected", allKyc.filter(k => k.status === "REJECTED").length)}
      </section>
      ${filterBarKyc()}
      <section class="panel-card admin-review-panel">
        <div class="section-head">
          <div><h3>KYC Requests</h3><span>Approve or reject user identity verification</span></div>
          <span class="admin-count-pill">${items.length} result</span>
        </div>
        <div class="admin-request-list admin-compact-request-list">
          ${items.length ? items.map(({ user, kyc }) => kycRequestCard(user, kyc)).join("") : `<div class="empty-state">No KYC requests found.</div>`}
        </div>
      </section>
    `);
  }

  function kycRequestCard(user, kyc) {
    const isPending = kyc.status === "PENDING";
    return `
      <article class="admin-request-card">
        <div class="request-head">
          <div class="request-user">
            ${avatar(kyc.personal.fullName || displayNameFor(user))}
            <div>
              <b>${esc(kyc.personal.fullName || displayNameFor(user))}</b>
              <span>${esc(user.email)} · ${esc(kyc.personal.mobile || user.mobile || "-")}</span>
            </div>
          </div>
          ${statusPill(kyc.status)}
        </div>

        ${duplicateAadhaarWarning(user, kyc)}
        <div class="request-grid">
          <article><span>DOB</span><b>${esc(kyc.personal.dob || "-")}</b></article>
          <article><span>Gender</span><b>${esc(kyc.personal.gender || "-")}</b></article>
          <article><span>City</span><b>${esc(kyc.personal.city || "-")}</b></article>
          <article><span>State</span><b>${esc(kyc.personal.state || "-")}</b></article>
          <article><span>Pincode</span><b>${esc(kyc.personal.pincode || "-")}</b></article>
          <article><span>Document</span><b>Aadhaar Card</b></article>
          <article><span>Aadhaar No.</span><b>${esc(maskAadhaar(kyc.id.number))}</b></article>
          <article><span>Submitted</span><b>${kyc.submittedAt ? new Date(kyc.submittedAt).toLocaleString() : "-"}</b></article>
          <article><span>Aadhaar Front</span><b>${esc(kyc.uploads.frontName || "-")}</b></article>
          <article><span>Aadhaar Back</span><b>${esc(kyc.uploads.backName || "-")}</b></article>
          <article><span>Selfie</span><b>${esc(kyc.uploads.selfieName || "-")}</b></article>
        </div>

        ${dateLine("Approved", kyc.approvedAt)}
        ${dateLine("Rejected", kyc.rejectedAt)}
        ${kyc.rejectReason ? `<div class="reject-box">${esc(kyc.rejectReason)}</div>` : ""}

        ${isPending ? `
          <div class="admin-action-row">
            <button class="approve-btn" onclick="AITradeXAdmin.approveKyc('${user.id}', this)">Approve KYC</button>
            <button class="reject-btn" onclick="AITradeXAdmin.rejectKyc('${user.id}', this)">Reject</button>
          </div>
          <div class="kyc-reject-inline" id="kycRejectBox-${user.id}" hidden>
            <select id="kycRejectReason-${user.id}">
              <option value="">Select reject reason</option>
              <option>Blurry Aadhaar</option>
              <option>Name mismatch</option>
              <option>Invalid Aadhaar</option>
              <option>Duplicate Aadhaar</option>
              <option>Selfie mismatch</option>
              <option>Other</option>
            </select>
            <input id="kycRejectOther-${user.id}" placeholder="Extra note, if needed"/>
            <button class="reject-btn" onclick="AITradeXAdmin.confirmRejectKyc('${user.id}', this)">Confirm Reject</button>
          </div>
        ` : `<div class="action-locked">Action completed. Status cannot be changed again from this card.</div>`}
      </article>`;
  }

  function filterBarPayments() {
    return `
      <section class="admin-filter-bar payment-filter-bar">
        <input value="${esc(paymentSearch)}" oninput="AITradeXAdmin.setPaymentSearch(this.value)" placeholder="Search name, email, bank, account last 4"/>
        <div class="filter-chips">
          ${["ALL", "PENDING", "APPROVED", "REJECTED"].map(s => `<button class="${paymentStatusFilter === s ? "active" : ""}" onclick="AITradeXAdmin.setPaymentStatusFilter('${s}')">${s}</button>`).join("")}
        </div>
      </section>`;
  }

  function paymentsPage() {
    const query = paymentSearch.trim().toLowerCase();
    const items = allUsers()
      .flatMap(user => {
        const kyc = kycFor(user);
        return paymentMethodsFor(user).filter(method => method.type === "BANK").map(method => ({ user, kyc, method }));
      })
      .filter(x => paymentStatusFilter === "ALL" || x.method.status === paymentStatusFilter)
      .filter(({ user, kyc, method }) => {
        if (!query) return true;
        return [
          displayNameFor(user),
          user.email,
          user.mobile,
          kyc.personal.fullName,
          method.holderName,
          method.upiId,
          method.bankName,
          method.accountNumber,
          String(method.accountNumber || "").slice(-4),
          method.ifsc
        ].some(v => includesText(v, query));
      })
      .sort((a, b) => {
        const priorityDiff = statusPriority(a.method.status) - statusPriority(b.method.status);
        if (priorityDiff) return priorityDiff;
        return bankMethodSortValue(b.method) - bankMethodSortValue(a.method);
      });

    const allMethods = allUsers().flatMap(user => paymentMethodsFor(user).filter(method => method.type === "BANK"));
    shell(`
      <section class="admin-module-hero bank-admin-hero">
        <div><span>Payout Verification</span><h2>Bank Account Review</h2><p>Check KYC name match, masked account details and payout readiness in one compact queue.</p></div>
        <div class="admin-hero-stats"><b>${allMethods.filter(m => m.status === "PENDING").length}</b><span>Pending</span></div>
      </section>
      <section class="metrics-grid compact-metrics">
        ${metric("⌛", "Pending", allMethods.filter(m => m.status === "PENDING").length)}
        ${metric("✅", "Approved", allMethods.filter(m => m.status === "APPROVED").length)}
        ${metric("❌", "Rejected", allMethods.filter(m => m.status === "REJECTED").length)}
      </section>
      ${filterBarPayments()}
      <section class="panel-card admin-review-panel">
        <div class="section-head">
          <div><h3>Bank Account Requests</h3><span>Approve bank accounts after matching KYC name</span></div>
          <span class="admin-count-pill">${items.length} result</span>
        </div>
        <div class="admin-request-list admin-compact-request-list">
          ${items.length ? items.map(({ user, kyc, method }) => paymentRequestCard(user, kyc, method)).join("") : `<div class="empty-state">No bank accounts found.</div>`}
        </div>
      </section>
    `);
  }

  function paymentRequestCard(user, kyc, method) {
    const kycName = kyc?.personal?.fullName || displayNameFor(user);
    const holderMatch = String(method.holderName || "").trim().toLowerCase() === String(kycName || "").trim().toLowerCase();
    const isPending = method.status === "PENDING";

    return `
      <article class="admin-request-card">
        <div class="request-head">
          <div class="request-user">
            ${avatar(method.holderName || displayNameFor(user))}
            <div>
              <b>Bank Account</b>
              <span>${esc(user.email)} · BANK</span>
            </div>
          </div>
          ${statusPill(method.status)}
        </div>

        <div class="request-grid">
          <article><span>KYC Name</span><b>${esc(kycName)}</b></article>
          <article><span>Holder Name</span><b>${esc(method.holderName || "-")}</b></article>
          <article><span>Name Match</span><b class="${holderMatch ? "profit-text" : "loss-text"}">${holderMatch ? "Matched" : "Mismatch"}</b></article>
          <article><span>Bank</span><b>${esc(method.bankName || "-")}</b></article>
          <article><span>Account</span><b>****${String(method.accountNumber || "").slice(-4)}</b></article>
          <article><span>IFSC</span><b>${esc(method.ifsc || "-")}</b></article>
          <article><span>Type</span><b>${esc(method.accountType || "-")}</b></article>
        </div>

        ${dateLine("Approved", method.approvedAt)}
        ${dateLine("Rejected", method.rejectedAt)}
        ${method.deletedAt ? dateLine("Deleted", method.deletedAt) : ""}
        ${method.rejectReason ? `<div class="reject-box">${esc(method.rejectReason)}</div>` : ""}

        <div class="admin-action-row ${isPending ? "" : "single-delete"}">
          ${isPending ? `
            <button class="approve-btn" onclick="AITradeXAdmin.approvePaymentMethod('${user.id}', '${method.id}', this)">Approve Method</button>
            <button class="reject-btn" onclick="AITradeXAdmin.rejectPaymentMethod('${user.id}', '${method.id}', this)">Reject</button>
          ` : ""}
          <button class="delete-btn" onclick="AITradeXAdmin.deletePaymentMethod('${user.id}', '${method.id}', this)">Delete Method</button>
        </div>
      </article>`;
  }

  function filterBarFinance(sectionType) {
    const placeholder = sectionType === "DEPOSIT" ? "Search user, email, UTR, amount..." : "Search user, email, method, account...";
    return `
      <section class="admin-filter-card">
        <input value="${esc(financeSearch)}" oninput="AITradeXAdmin.setFinanceSearch(this.value)" placeholder="${placeholder}"/>
        <select onchange="AITradeXAdmin.setFinanceStatusFilter(this.value)">
          <option value="ALL" ${financeStatusFilter === "ALL" ? "selected" : ""}>All Status</option>
          <option value="PENDING" ${financeStatusFilter === "PENDING" ? "selected" : ""}>Pending</option>
          <option value="APPROVED" ${financeStatusFilter === "APPROVED" ? "selected" : ""}>Approved</option>
          <option value="REJECTED" ${financeStatusFilter === "REJECTED" ? "selected" : ""}>Rejected</option>
        </select>
      </section>`;
  }

  function financeRequestPage(sectionType) {
    const isDepositSection = sectionType === "DEPOSIT";
    const stats = financeStats(sectionType);
    const query = financeSearch.trim().toLowerCase();
    const items = allWalletRequests()
      .filter(x => x.type === sectionType)
      .filter(x => financeStatusFilter === "ALL" || x.request.status === financeStatusFilter)
      .filter(({ user, request, type }) => {
        if (!query) return true;
        const haystack = [
          displayNameFor(user),
          user.email,
          user.mobile,
          type,
          request.status,
          request.utr,
          request.type,
          request.amount,
          request.methodSnapshot?.upiId,
          request.methodSnapshot?.bankName,
          request.methodSnapshot?.accountNumber,
          request.methodSnapshot?.holderName
        ];
        return haystack.some(v => includesText(v, query));
      });

    shell(`
      <section class="metrics-grid wallet-admin-metrics finance-command-metrics">
        ${metric("⌛", "Pending", `${stats.pending} · ${App.money(stats.pendingAmount)}`)}
        ${metric("✅", "Approved", `${stats.approved} · ${App.money(stats.approvedAmount)}`)}
        ${metric("📅", "Today", `${stats.today} · ${App.money(stats.todayAmount)}`)}
        ${metric(isDepositSection ? "⬇️" : "⬆️", "Total Volume", App.money(stats.totalAmount))}
      </section>
      ${filterBarFinance(sectionType)}
      <section class="panel-card finance-control-panel">
        <div class="section-head">
          <div><h3>${isDepositSection ? "Deposit Control" : "Withdrawal Control"}</h3><span>${isDepositSection ? "Review UTR/proof, prevent duplicate approval, then credit wallet" : "Review bank/UPI payout, verify balance, then approve debit"}</span></div>
          <span class="admin-count-pill">${items.length} result</span>
        </div>
        <div class="finance-process-strip">
          <article><b>1</b><span>${isDepositSection ? "Check UTR" : "Check payout"}</span></article>
          <article><b>2</b><span>${isDepositSection ? "Verify proof" : "Verify balance"}</span></article>
          <article><b>3</b><span>${isDepositSection ? "Approve credit" : "Approve payout"}</span></article>
          <article><b>4</b><span>Ledger saved</span></article>
        </div>
        ${financeHistoryPagedList(items, sectionType)}
      </section>
    `);
  }

  function financeHistoryPagedList(items, sectionType) {
    const isDepositSection = sectionType === "DEPOSIT";
    const pageSize = 5;
    const pageKey = isDepositSection ? "AITradeX_ADMIN_DEPOSIT_HISTORY_PAGE" : "AITradeX_ADMIN_WITHDRAWAL_HISTORY_PAGE";
    const currentPage = isDepositSection ? depositHistoryPage : withdrawalHistoryPage;
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    if (isDepositSection) depositHistoryPage = safePage; else withdrawalHistoryPage = safePage;
    localStorage.setItem(pageKey, String(safePage));
    const visible = items.slice((safePage - 1) * pageSize, safePage * pageSize);
    return `
      <div class="finance-page-meta admin-user-page-meta">
        <b>${items.length ? `Showing ${((safePage - 1) * pageSize) + 1}-${Math.min(safePage * pageSize, items.length)} of ${items.length}` : "No records"}</b>
        <span>${financeSearch ? `Filter active: ${esc(financeSearch)}` : "Filter is available above. History stays paginated to avoid long scroll."}</span>
      </div>
      <div class="admin-request-list paged-finance-list">
        ${visible.length ? visible.map(({ user, request, type }) => walletRequestCard(user, request, type)).join("") : `<div class="empty-state">No ${isDepositSection ? "deposit" : "withdrawal"} requests found.</div>`}
      </div>
      ${items.length > pageSize ? `<div class="admin-pagination finance-history-pagination"><button class="ghost-action" ${safePage <= 1 ? "disabled" : ""} onclick="AITradeXAdmin.changeFinanceHistoryPage('${sectionType}', -1)">Prev</button><span>Page ${safePage} of ${totalPages}</span><button class="ghost-action" ${safePage >= totalPages ? "disabled" : ""} onclick="AITradeXAdmin.changeFinanceHistoryPage('${sectionType}', 1)">Next</button></div>` : ""}
    `;
  }

  function walletRequestCard(user, request, type) {
    const isDeposit = type === "DEPOSIT";
    const isPending = String(request.status || "").toUpperCase() === "PENDING";
    const method = request.methodSnapshot || {};
    const methodTitle = isDeposit ? `${request.type || "UPI"} Payment` : `${method.type === "UPI" ? "Legacy UPI" : "Bank"} Withdrawal`;
    const methodText = financeMethodText(request, type);
    const duplicate = isDeposit ? depositUtrDuplicateInfo(request) : null;
    const ledgerDone = App.hasLedgerEntry?.({ accountType: "REAL", type: isDeposit ? "DEPOSIT" : "WITHDRAWAL", referenceId: request.id, userId: user.id });

    return `
      <article class="admin-request-card wallet-admin-card finance-review-card ${String(request.status || "").toLowerCase()}">
        <div class="request-head finance-review-head">
          <div class="request-user">
            ${avatar(displayNameFor(user))}
            <div>
              <b>${type === "DEPOSIT" ? "Deposit Request" : "Withdrawal Request"}</b>
              <span>${esc(user.email)} · ${esc(methodTitle)}</span>
            </div>
          </div>
          <div class="finance-head-badges">
            ${statusPill(request.status)}
            ${ledgerDone ? `<span class="finance-safe-pill">Ledger applied</span>` : `<span class="finance-muted-pill">Ledger pending</span>`}
          </div>
        </div>

        <div class="request-grid wallet-request-grid finance-quick-grid">
          <article><span>User</span><b>${esc(displayNameFor(user))}</b></article>
          <article><span>Amount</span><b>${App.money(request.amount || 0)}</b></article>
          <article><span>Real Balance</span><b>${App.money(App.realBalance(user.id))}</b></article>
          <article><span>${isDeposit ? "UTR" : "Pay To"}</span><b>${esc(isDeposit ? (request.utr || "-") : methodText)}</b></article>
        </div>

        ${duplicate ? `<div class="finance-warning-box">⚠️ Same UTR found in ${duplicate.total} other deposit request(s). ${duplicate.approved ? `${duplicate.approved} already approved.` : "No approved duplicate yet."}</div>` : ""}

        ${financeRequestDetailPanel(user, request, type)}
        ${isDeposit ? "" : withdrawalPayoutDetails(request)}

        ${dateLine("Approved", request.approvedAt)}
        ${dateLine("Rejected", request.rejectedAt)}
        ${request.rejectReason ? `<div class="reject-box">${esc(request.rejectReason)}</div>` : ""}

        <div class="admin-action-row ${isPending ? "" : "single-delete"}">
          ${isPending ? `
            <button class="approve-btn" onclick="AITradeXAdmin.confirmFinanceAction('${isDeposit ? "approveDeposit" : "approveWithdrawal"}', '${user.id}', '${request.id}', '${esc(displayNameFor(user))}', '${App.money(request.amount || 0)}', this)">${isDeposit ? "Approve & Credit" : "Approve Payout"}</button>
            <button class="reject-btn" onclick="AITradeXAdmin.confirmFinanceAction('${isDeposit ? "rejectDeposit" : "rejectWithdrawal"}', '${user.id}', '${request.id}', '${esc(displayNameFor(user))}', '${App.money(request.amount || 0)}', this)">Reject</button>
          ` : `<span class="finance-complete-note">Action completed. Full detail stays in history.</span>`}
        </div>
      </article>`;
  }
  function aiTradeBatches() {
    return (App.state.aiTradeBatches || []).sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
  }

  function aiEligibilityReport(minBalance = 0) {
    const report = {
      eligible: [],
      skipped: [],
      reasons: {
        inactive: 0,
        aiOff: 0,
        limit: 0,
        lowBalance: 0,
        noPool: 0
      }
    };

    allUsers().forEach(u => {
      const status = userStatus(u);
      const balance = App.realBalance(u.id);
      const used = App.aiTradesToday(u.id);
      const limit = App.aiDailyLimit(u.id);
      const allowedPool = App.aiAllowedAmount(u);

      if (status !== "ACTIVE") {
        report.skipped.push({ userId: u.id, reason: "Inactive / suspended / blocked" });
        report.reasons.inactive += 1;
        return;
      }
      if (!u.aiTradeOn) {
        report.skipped.push({ userId: u.id, reason: "AI Auto Trading OFF" });
        report.reasons.aiOff += 1;
        return;
      }
      if (used >= limit) {
        report.skipped.push({ userId: u.id, reason: "Daily AI trade limit completed" });
        report.reasons.limit += 1;
        return;
      }
      if (balance < minBalance) {
        report.skipped.push({ userId: u.id, reason: "Below minimum real balance" });
        report.reasons.lowBalance += 1;
        return;
      }
      if (allowedPool <= 0) {
        report.skipped.push({ userId: u.id, reason: "No AI trade pool available" });
        report.reasons.noPool += 1;
        return;
      }

      report.eligible.push(u);
    });

    return report;
  }

  function skipReasonLine(reasons = {}) {
    const rows = [
      ["AI OFF", reasons.aiOff],
      ["Limit done", reasons.limit],
      ["Low balance", reasons.lowBalance],
      ["Inactive", reasons.inactive],
      ["No pool", reasons.noPool]
    ].filter(([, value]) => Number(value || 0) > 0);
    return rows.length ? rows.map(([label, value]) => `${label}: ${value}`).join(" · ") : "No skipped users";
  }

  function aiRemainingForUser(userId) {
    const used = App.aiTradesToday(userId);
    const limit = App.aiDailyLimit(userId);
    return Math.max(0, Number(limit || 0) - Number(used || 0));
  }

  function aiValidationOverviewHtml(report) {
    const users = (report?.eligible || []).slice(0, 8);
    const skipped = report?.skipped || [];
    return `
      <section class="panel-card ai-validation-panel">
        <div class="section-head">
          <div><h3>Eligible AI Users</h3><span>Shows users who can receive the next AI trade: active, AI ON, wallet available, and limit remaining.</span></div>
          <span class="admin-count-pill">${users.length} shown · ${skipped.length} skipped</span>
        </div>
        <div class="admin-list">
          ${users.length ? users.map(target => {
            const plan = App.currentPlan ? App.currentPlan(target.id) : {};
            const balance = App.realBalance(target.id);
            const pool = App.aiAllowedAmount(target);
            const used = App.aiTradesToday(target.id);
            const limit = App.aiDailyLimit(target.id);
            return `
              <article class="admin-user-card ai-validation-card">
                <div class="admin-user-main">
                  <div><b>${esc(displayNameFor(target))}</b><span>${esc(plan.name || "Free")} · AI ${target.aiTradeOn ? "ON" : "OFF"} · ${Number(target.aiTradePercent || 25)}% allocation</span></div>
                  <div class="admin-user-stats"><span>Wallet</span><b>${App.money(balance)}</b></div>
                  <div class="admin-user-stats"><span>AI Pool</span><b>${App.money(pool)}</b></div>
                  <div class="admin-user-stats"><span>Remaining</span><b>${aiRemainingForUser(target.id)}/${limit}</b></div>
                  <div class="admin-user-stats"><span>Used</span><b>${used}</b></div>
                </div>
              </article>`;
          }).join("") : `<div class="empty-state">No eligible AI users found. Check user status, AI ON, wallet balance and plan limit.</div>`}
        </div>
      </section>`;
  }


  function aiPreviewStats(resultPercent = 2, leverage = 1, minBalance = 0, resultType = "PROFIT") {
    const percent = Math.max(0, Number(resultPercent || 0));
    const lev = normalizeAdminLeverage(leverage || 1);
    const report = aiEligibilityReport(Math.max(0, Number(minBalance || 0)));
    let totalMargin = 0;
    let totalExposure = 0;
    let totalPnl = 0;

    report.eligible.forEach(user => {
      const balance = App.realBalance(user.id);
      const margin = Math.min(balance, App.aiAllowedAmount(user));
      if (!margin || margin <= 0) return;
      const exposure = margin * lev;
      let pnl = exposure * percent / 100;
      if (String(resultType || "PROFIT").toUpperCase() === "LOSS") pnl = -Math.min(balance, pnl);
      if (balance + pnl < 0) pnl = -balance;
      totalMargin += margin;
      totalExposure += exposure;
      totalPnl += pnl;
    });

    const perOneThousand = (1000 * lev * percent / 100) * (String(resultType || "PROFIT").toUpperCase() === "LOSS" ? -1 : 1);
    const perTenThousand = (10000 * lev * percent / 100) * (String(resultType || "PROFIT").toUpperCase() === "LOSS" ? -1 : 1);

    return {
      report,
      totalMargin: Number(totalMargin.toFixed(2)),
      totalExposure: Number(totalExposure.toFixed(2)),
      totalPnl: Number(totalPnl.toFixed(2)),
      perOneThousand: Number(perOneThousand.toFixed(2)),
      perTenThousand: Number(perTenThousand.toFixed(2)),
      leverage: lev,
      percent
    };
  }



  function aiLivePositions() {
    return (App.state.trades || [])
      .filter(t => t.tradeType === "AI_LIVE" && String(t.status || "").toUpperCase() === "OPEN")
      .sort((a, b) => Date.parse(b.openedAt || b.createdAt || 0) - Date.parse(a.openedAt || a.createdAt || 0));
  }


  function aiLiveMarginLockExists(position) {
    return !!(position && App.hasLedgerEntry && App.hasLedgerEntry({
      userId: position.userId,
      accountType: "REAL",
      type: "AI_LIVE_MARGIN_LOCK",
      referenceId: position.id
    }));
  }

  function lockAiLiveMargin(position, balanceBeforeOverride = null) {
    if (!position || !position.userId) return false;
    const margin = Number(Number(position.marginAmount || 0).toFixed(2));
    if (!Number.isFinite(margin) || margin <= 0) return false;
    if (aiLiveMarginLockExists(position)) {
      position.marginLocked = true;
      return true;
    }
    const before = balanceBeforeOverride === null ? App.realBalance(position.userId) : Number(balanceBeforeOverride || 0);
    const added = App.addLedger({
      userId: position.userId,
      accountType: "REAL",
      type: "AI_LIVE_MARGIN_LOCK",
      amount: -margin,
      referenceId: position.id,
      note: `${position.pair} AI live ${position.side || "BUY"} amount locked`
    });
    if (added === false && !aiLiveMarginLockExists(position)) throw new Error("AI amount lock was not applied");
    position.marginLocked = true;
    position.balanceBefore = Number(before.toFixed(2));
    position.balanceAfterOpen = Number(App.realBalance(position.userId).toFixed(2));
    position.marginLockedAt = position.marginLockedAt || new Date().toISOString();
    return true;
  }

  function reconcileAiLiveMarginLocks() {
    let fixed = 0;
    aiLivePositions().forEach(position => {
      if (aiLiveMarginLockExists(position)) {
        position.marginLocked = true;
        return;
      }
      try {
        lockAiLiveMargin(position);
        fixed += 1;
      } catch (error) {
        position.marginLockError = error.message || "AI amount lock failed";
      }
    });
    if (fixed) App.saveState();
    return fixed;
  }

  function aiLiveBatches() {
    const rows = aiLivePositions();
    const map = new Map();
    rows.forEach(pos => {
      const id = pos.batchId || pos.id;
      if (!map.has(id)) {
        map.set(id, {
          id,
          pair: pos.pair,
          side: pos.side,
          market: pos.market,
          entryPrice: pos.entryPrice,
          entryPriceDisplay: pos.entryPriceDisplay,
          leverage: pos.leverage,
          targetType: pos.targetType,
          targetPercent: pos.targetPercent,
          openedAt: pos.openedAt || pos.createdAt,
          users: 0,
          totalMargin: 0,
          totalExposure: 0,
          totalLivePnl: 0
        });
      }
      const batch = map.get(id);
      batch.users += 1;
      batch.totalMargin += Number(pos.marginAmount || 0);
      batch.totalExposure += Number(pos.positionSize || 0);
      batch.totalLivePnl += aiLivePositionPnl(pos);
    });
    return [...map.values()].sort((a, b) => Date.parse(b.openedAt || 0) - Date.parse(a.openedAt || 0));
  }

  function aiLivePositionPnl(position) {
    const entry = Number(position.entryPrice || 0);
    const cached = App.getCachedPairPrice ? App.getCachedPairPrice(position.pair) : null;
    const current = Number(cached?.price || position.entryPrice || 0);
    const exposure = Number(position.positionSize || 0);
    if (!entry || !current || !exposure) return 0;
    const direction = String(position.side || "BUY").toUpperCase() === "SELL" ? -1 : 1;
    let pnl = exposure * ((current - entry) / entry) * direction;
    const margin = Math.max(0, Number(position.marginAmount || 0));
    const maxLoss = position.marginLocked ? margin : Math.max(0, App.realBalance(position.userId));
    if (pnl < 0) pnl = Math.max(pnl, -maxLoss);
    return Number(pnl.toFixed(2));
  }

  function aiLivePreviewStats(leverage = 1, minBalance = 0) {
    const report = aiEligibilityReport(Math.max(0, Number(minBalance || 0)));
    const lev = normalizeAdminLeverage(leverage || 1);
    let totalMargin = 0;
    let totalExposure = 0;
    report.eligible.forEach(user => {
      const balance = App.realBalance(user.id);
      const margin = Math.min(balance, App.aiAllowedAmount(user));
      if (!margin || margin <= 0) return;
      totalMargin += margin;
      totalExposure += margin * lev;
    });
    return { report, totalMargin: Number(totalMargin.toFixed(2)), totalExposure: Number(totalExposure.toFixed(2)) };
  }

  function aiLiveRunningHtml() {
    const batches = aiLiveBatches();
    return `
      <section class="panel-card">
        <div class="section-head"><div><h3>Running AI Live Positions</h3><span>Market-connected AI positions remain active until target hit or admin closes them</span></div></div>
        <div class="admin-list">
          ${batches.length ? batches.map(batch => `
            <article class="admin-user-card ai-live-batch-card">
              <div class="admin-user-main">
                <div><b>${esc(batch.pair)} · ${esc(batch.side)}</b><span>Entry ${esc(batch.entryPriceDisplay || batch.entryPrice || "-")} · ${Number(batch.leverage || 1)}x · Target ${esc(batch.targetType || "PROFIT")} ${Number(batch.targetPercent || 0)}%</span></div>
                <div class="admin-user-stats"><span>Users</span><b>${batch.users}</b></div>
                <div class="admin-user-stats"><span>AI Amount</span><b>${App.money(batch.totalMargin)}</b></div>
                <div class="admin-user-stats"><span>Exposure</span><b>${App.money(batch.totalExposure)}</b></div>
                <div class="admin-user-stats"><span>Live P/L</span><b class="${batch.totalLivePnl >= 0 ? "profit-text" : "loss-text"}">${batch.totalLivePnl >= 0 ? "+" : ""}${App.money(batch.totalLivePnl)}</b></div>
                <button class="ghost-action" type="button" onclick="AITradeXAdmin.closeAiLiveBatch('${batch.id}', this)">Close Trade</button>
              </div>
            </article>
          `).join("") : `<div class="empty-state">No AI live positions running.</div>`}
        </div>
      </section>`;
  }

  function aiRecentTrades() {
    return (App.state.trades || [])
      .filter(t => t.tradeType === "AI_AUTO")
      .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
  }

  const AI_HISTORY_PAGE_SIZE = 5;

  function getAiHistoryPage(kind) {
    return Math.max(1, Number(localStorage.getItem(`AITradeX_ADMIN_${kind}_PAGE`) || 1));
  }

  function sliceAiHistory(rows, kind) {
    const totalPages = Math.max(1, Math.ceil(rows.length / AI_HISTORY_PAGE_SIZE));
    const currentPage = Math.min(getAiHistoryPage(kind), totalPages);
    if (currentPage !== getAiHistoryPage(kind)) localStorage.setItem(`AITradeX_ADMIN_${kind}_PAGE`, String(currentPage));
    const start = (currentPage - 1) * AI_HISTORY_PAGE_SIZE;
    return { totalPages, currentPage, rows: rows.slice(start, start + AI_HISTORY_PAGE_SIZE) };
  }

  function aiPagerHtml(kind, pageData) {
    if (pageData.totalPages <= 1) return "";
    return `
      <div class="admin-pagination ai-history-pagination">
        <button type="button" class="ghost-action" ${pageData.currentPage <= 1 ? "disabled" : ""} onclick="AITradeXAdmin.changeAiHistoryPage('${kind}', -1)">Prev</button>
        <span>Page ${pageData.currentPage} of ${pageData.totalPages}</span>
        <button type="button" class="ghost-action" ${pageData.currentPage >= pageData.totalPages ? "disabled" : ""} onclick="AITradeXAdmin.changeAiHistoryPage('${kind}', 1)">Next</button>
      </div>`;
  }

  function aiLiveHistoryRows() {
    return (App.state.trades || [])
      .filter(t => (t.tradeType === "AI_LIVE" || t.source === "ADMIN_AI_LIVE_CLOSE") && String(t.status || "").toUpperCase() === "CLOSED")
      .sort((a, b) => Date.parse(b.closedAt || b.createdAt || 0) - Date.parse(a.closedAt || a.createdAt || 0));
  }

  function aiInstantHistoryHtml() {
    const batches = aiTradeBatches();
    const pageData = sliceAiHistory(batches, "AI_INSTANT_HISTORY");
    return `
      <section class="panel-card ai-history-panel instant-history-panel">
        <div class="section-head"><div><h3>Instant AI Trade History</h3><span>One-click AI result batches. This history is separate from Live Position Trade.</span></div><span class="admin-count-pill">${batches.length} total</span></div>
        <div class="admin-list">
          ${pageData.rows.length ? pageData.rows.map(batch => `
            <article class="admin-user-card ai-batch-card">
              <div class="admin-user-main">
                <div><b>${esc(batch.pair)} · ${esc(batch.side)}</b><span>${esc(batch.market)} · ${esc(batch.resultType)} ${Number(batch.resultPercent || 0)}% · ${Number(batch.leverage || 1)}x · Entry ${esc(batch.entryPriceDisplay || batch.entryPrice || "-")}</span></div>
                <div class="admin-user-stats"><span>Applied</span><b>${batch.appliedCount || 0}</b></div>
                <div class="admin-user-stats"><span>Skipped</span><b>${batch.skippedCount || 0}</b></div>
                <div class="admin-user-stats"><span>Exposure</span><b>${App.money(batch.totalExposure || 0)}</b></div>
                <div class="admin-user-stats"><span>Total P/L</span><b class="${Number(batch.totalPnl || 0) >= 0 ? "profit-text" : "loss-text"}">${App.money(batch.totalPnl || 0)}</b></div>
              </div>
              <div class="ai-skip-line">${esc(skipReasonLine(batch.skipReasons || {}))}</div>
            </article>
          `).join("") : `<div class="empty-state">No Instant AI trade history yet.</div>`}
        </div>
        ${aiPagerHtml("AI_INSTANT_HISTORY", pageData)}
      </section>`;
  }

  function aiLiveHistoryHtml() {
    const rows = aiLiveHistoryRows();
    const pageData = sliceAiHistory(rows, "AI_LIVE_HISTORY");
    return `
      <section class="panel-card ai-history-panel live-history-panel">
        <div class="section-head"><div><h3>Live Position Trade History</h3><span>Closed running AI positions only. Instant AI trades will not show here.</span></div><span class="admin-count-pill">${rows.length} closed</span></div>
        <div class="admin-list">
          ${pageData.rows.length ? pageData.rows.map(pos => {
            const target = allUsers().find(u => u.id === pos.userId) || {};
            return `
              <article class="admin-user-card ai-live-history-card">
                <div class="admin-user-main">
                  <div><b>${esc(pos.pair)} · ${esc(pos.side)}</b><span>${esc(displayNameFor(target))} · ${Number(pos.leverage || 1)}x · Entry ${esc(pos.entryPriceDisplay || pos.entryPrice || "-")} → Exit ${esc(pos.exitPriceDisplay || pos.exitPrice || "-")}</span></div>
                  <div class="admin-user-stats"><span>AI Amount</span><b>${App.money(pos.marginAmount || 0)}</b></div>
                  <div class="admin-user-stats"><span>Exposure</span><b>${App.money(pos.positionSize || 0)}</b></div>
                  <div class="admin-user-stats"><span>P/L</span><b class="${Number(pos.pnl || 0) >= 0 ? "profit-text" : "loss-text"}">${Number(pos.pnl || 0) >= 0 ? "+" : ""}${App.money(pos.pnl || 0)}</b></div>
                  <div class="admin-user-stats"><span>Settled</span><b>${App.money(pos.settlementAmount || 0)}</b></div>
                </div>
                <div class="ai-skip-line">Closed: ${pos.closedAt ? new Date(pos.closedAt).toLocaleString() : "-"} · Reason: ${esc(pos.closeReason || "Target/Admin")}</div>
              </article>`;
          }).join("") : `<div class="empty-state">No closed Live Position trade history yet.</div>`}
        </div>
        ${aiPagerHtml("AI_LIVE_HISTORY", pageData)}
      </section>`;
  }

  function aiRecentEntriesHtml() {
    const rows = aiRecentTrades();
    const pageData = sliceAiHistory(rows, "AI_INSTANT_ENTRIES");
    return `
      <section class="panel-card ai-history-panel">
        <div class="section-head"><div><h3>Instant AI User Entries</h3><span>User-wise entries created by Instant AI Trade only.</span></div><span class="admin-count-pill">${rows.length} entries</span></div>
        <div class="admin-list">
          ${pageData.rows.length ? pageData.rows.map(t => {
            const target = allUsers().find(u => u.id === t.userId);
            return `
              <article class="admin-user-card">
                <div class="admin-user-main">
                  <div><b>${esc(t.pair)} · ${esc(t.side)}</b><span>${esc(displayNameFor(target || {}))} · Entry ${esc(t.entryPriceDisplay || t.entryPrice || "-")} · ${esc(t.priceSource || "-")}</span></div>
                  <div class="admin-user-stats"><span>AI Amount</span><b>${App.money(t.marginAmount || 0)}</b></div>
                  <div class="admin-user-stats"><span>Exposure</span><b>${App.money(t.positionSize || 0)}</b></div>
                  <div class="admin-user-stats"><span>P/L</span><b class="${Number(t.pnl || 0) >= 0 ? "profit-text" : "loss-text"}">${App.money(t.pnl || 0)}</b></div>
                  <div class="admin-user-stats"><span>Leverage</span><b>${Number(t.leverage || 1)}x</b></div>
                </div>
              </article>`;
          }).join("") : `<div class="empty-state">Instant AI user entries will appear here after execution.</div>`}
        </div>
        ${aiPagerHtml("AI_INSTANT_ENTRIES", pageData)}
      </section>`;
  }

  function aiTradeModeBars(activeMode) {
    return `
      <section class="ai-control-split-bars ai-control-mode-switch">
        <article class="ai-control-mode-bar instant ${activeMode === "instant" ? "active" : ""}" onclick="AITradeXAdmin.go('instantAi')">
          <p>SECTION A</p>
          <h3>Instant AI Trade</h3>
          <span>Direct result entry. Wallet P/L updates immediately.</span>
        </article>
        <article class="ai-control-mode-bar live ${activeMode === "live" ? "active" : ""}" onclick="AITradeXAdmin.go('liveAi')">
          <p>SECTION B</p>
          <h3>Live Position Trade</h3>
          <span>Running position. Wallet amount cuts on open and settles on close.</span>
        </article>
      </section>`;
  }

  function instantAiPage() {
    const settings = App.state.settings || {};
    const initialStats = aiPreviewStats(2, 1, 0, "PROFIT");
    const previewReport = initialStats.report;
    const aiOnCount = allUsers().filter(u => u.aiTradeOn && userStatus(u) === "ACTIVE").length;
    const eligibleNow = previewReport.eligible.length;
    const batches = aiTradeBatches();
    const lastBatch = batches[0];

    shell(`
      <section class="metrics-grid">
        ${metric("🤖", "AI ON Users", aiOnCount)}
        ${metric("✅", "Valid Now", eligibleNow)}
        ${metric("⏭️", "Skipped Now", previewReport.skipped.length)}
        ${metric("🎁", "Free AI / Day", Number(settings.freeAiTradesPerDay || 5))}
      </section>

      ${aiTradeModeBars("instant")}

      ${aiValidationOverviewHtml(previewReport)}

      <section class="panel-card ai-desk-panel instant-ai-control-panel">
        <div class="section-head ai-desk-head">
          <div><h3>Instant AI Trade Control</h3><span>Separate instant-result trade only. This will not open a running live position.</span></div>
          <span class="admin-count-pill">Instant section</span>
        </div>

        <div class="admin-grid-two ai-desk-grid">
          <form class="payment-form-card ai-desk-form" onsubmit="AITradeXAdmin.executeAiTrade(event)">
            <p>OPTIONAL INSTANT RESULT</p>
            <h2>Instant AI Trade</h2>

            <div class="ai-step-card">
              <div class="ai-step-label"><b>1</b><span>Select pair</span></div>
              <label>Market Pair
                <select id="aiTradePair" required onchange="AITradeXAdmin.onAiPairChange()">
                  ${aiTradePairOptions("BTC/USDT")}
                </select>
                <small>Same full pair list as user trade page.</small>
              </label>
            </div>

            <div class="ai-step-card live-entry-card">
              <div class="ai-step-label"><b>2</b><span>Entry price</span></div>
              <div class="entry-price-box">
                <div><span>Selected Entry</span><b id="aiEntryPriceValue">${aiPairPriceView("BTC/USDT").price}</b><small id="aiEntryPriceSource">${aiPairPriceView("BTC/USDT").source}</small></div>
                <button type="button" onclick="AITradeXAdmin.fetchAiEntryPrice()">Fetch Price</button>
              </div>
              <div id="aiManualPriceWrap" class="manual-price-wrap">
                <label>Manual Fallback Price
                  <input id="aiManualEntryPrice" type="number" min="0" step="0.0001" placeholder="Optional fallback if chart feed is unavailable" oninput="AITradeXAdmin.updateAiPreview()"/>
                </label>
              </div>
              <small id="aiEntryPriceStatus">Ready</small>
            </div>

            <div class="ai-step-card">
              <div class="ai-step-label"><b>3</b><span>Choose side</span></div>
              <div class="ai-toggle-grid two">
                <label class="ai-radio-card buy"><input type="radio" name="aiTradeSide" value="BUY" checked onchange="AITradeXAdmin.updateAiPreview()"/><span>BUY</span><small>Long / upward trade</small></label>
                <label class="ai-radio-card sell"><input type="radio" name="aiTradeSide" value="SELL" onchange="AITradeXAdmin.updateAiPreview()"/><span>SELL</span><small>Short / downward trade</small></label>
              </div>
            </div>

            <div class="ai-step-card">
              <div class="ai-step-label"><b>4</b><span>Result & leverage up to 2000x</span></div>
              <div class="ai-toggle-grid two">
                <label class="ai-radio-card profit"><input type="radio" name="aiTradeResultType" value="PROFIT" checked onchange="AITradeXAdmin.updateAiPreview()"/><span>Profit</span><small>Add P/L to real wallet</small></label>
                <label class="ai-radio-card loss"><input type="radio" name="aiTradeResultType" value="LOSS" onchange="AITradeXAdmin.updateAiPreview()"/><span>Loss</span><small>Deduct P/L from real wallet</small></label>
              </div>
              <div class="ai-inline-fields">
                <label>Profit / Loss %
                  <input id="aiTradeResultPercent" type="number" min="0" step="0.01" value="2" required oninput="AITradeXAdmin.updateAiPreview()"/>
                </label>
                <label>Leverage
                  <select id="aiTradeLeverage" onchange="AITradeXAdmin.updateAiPreview()">
                    ${aiLeverageOptions(10)}
                  </select>
                </label>
              </div>
            </div>

            <div class="ai-step-card">
              <div class="ai-step-label"><b>5</b><span>Final check</span></div>
              <label>Minimum Real Balance
                <input id="aiTradeMinBalance" type="number" min="0" value="0" oninput="AITradeXAdmin.updateAiPreview()"/>
                <small>Users below this balance will be skipped. Keep 0 for all valid users.</small>
              </label>
              <label>Trade Note
                <input id="aiTradeNote" value="Expert AI auto trade executed" placeholder="Internal note"/>
              </label>
            </div>

            <button class="save-profile-btn ai-execute-btn">Execute Instant AI Trade</button>
          </form>

          <section class="payment-form-card ai-control-preview ai-desk-summary">
            <p>RISK & P/L PREVIEW</p>
            <h2>Before Execute</h2>
            <div class="review-grid compact-review ai-preview-grid">
              <article><span>Valid users</span><b id="aiPreviewValid">${eligibleNow}</b></article>
              <article><span>Skipped users</span><b id="aiPreviewSkipped">${previewReport.skipped.length}</b></article>
              <article><span>Base AI amount</span><b id="aiPreviewMargin">${App.money(initialStats.totalMargin)}</b></article>
              <article><span>Leverage exposure</span><b id="aiPreviewExposure">${App.money(initialStats.totalExposure)}</b></article>
              <article><span>Per ₹1,000 impact</span><b id="aiPreviewOneK" class="${initialStats.perOneThousand >= 0 ? "profit-text" : "loss-text"}">${App.money(initialStats.perOneThousand)}</b></article>
              <article><span>Per ₹10,000 impact</span><b id="aiPreviewTenK" class="${initialStats.perTenThousand >= 0 ? "profit-text" : "loss-text"}">${App.money(initialStats.perTenThousand)}</b></article>
              <article><span>Total P/L estimate</span><b id="aiPreviewTotalPnl" class="${initialStats.totalPnl >= 0 ? "profit-text" : "loss-text"}">${App.money(initialStats.totalPnl)}</b></article>
              <article><span>Skip reasons</span><b id="aiPreviewReasons">${esc(skipReasonLine(previewReport.reasons))}</b></article>
            </div>
            <div class="premium-bank-card ai-last-card">
              ${lastBatch ? `<div class="copy-row"><b>Last execution</b><span>${lastBatch.appliedCount || 0} applied · ${lastBatch.skippedCount || 0} skipped · ${Number(lastBatch.leverage || 1)}x</span><button type="button">Done</button></div>` : `<div class="copy-row"><b>Last execution</b><span>No AI trade executed yet</span><button type="button">Ready</button></div>`}
            </div>
          </section>
        </div>
      </section>

      ${aiInstantHistoryHtml()}

      ${aiRecentEntriesHtml()}
    `);
  }

  function liveAiPage() {
    const settings = App.state.settings || {};
    const initialStats = aiPreviewStats(2, 1, 0, "PROFIT");
    const previewReport = initialStats.report;
    const aiOnCount = allUsers().filter(u => u.aiTradeOn && userStatus(u) === "ACTIVE").length;
    const eligibleNow = previewReport.eligible.length;

    shell(`
      <section class="metrics-grid">
        ${metric("🤖", "AI ON Users", aiOnCount)}
        ${metric("✅", "Valid Now", eligibleNow)}
        ${metric("⏭️", "Skipped Now", previewReport.skipped.length)}
        ${metric("🎁", "Free AI / Day", Number(settings.freeAiTradesPerDay || 5))}
      </section>

      ${aiTradeModeBars("live")}

      ${aiLiveRunningHtml()}

      ${aiValidationOverviewHtml(previewReport)}

      <section class="panel-card ai-desk-panel ai-live-open-panel">
        <div class="section-head ai-desk-head">
          <div><h3>Open New Live Position</h3><span>Running positions stay above. New position opens only after wallet lock validation.</span></div>
          <span class="admin-count-pill">Live section</span>
        </div>
        <div class="admin-grid-two ai-desk-grid">
          <form class="payment-form-card ai-desk-form" onsubmit="AITradeXAdmin.openLiveAiPosition(event)">
            <p>LIVE AI POSITION</p>
            <h2>New Live Position</h2>
            <div class="ai-step-card">
              <div class="ai-step-label"><b>1</b><span>Pair & side</span></div>
              <label>Crypto Pair
                <select id="aiLivePair" required onchange="AITradeXAdmin.updateAiLivePreview()">
                  ${aiTradePairOptions("BTC/USDT")}
                </select>
              </label>
              <div class="ai-toggle-grid two">
                <label class="ai-radio-card buy"><input type="radio" name="aiLiveSide" value="BUY" checked onchange="AITradeXAdmin.updateAiLivePreview()"/><span>BUY</span><small>Long position</small></label>
                <label class="ai-radio-card sell"><input type="radio" name="aiLiveSide" value="SELL" onchange="AITradeXAdmin.updateAiLivePreview()"/><span>SELL</span><small>Short position</small></label>
              </div>
            </div>
            <div class="ai-step-card">
              <div class="ai-step-label"><b>2</b><span>Target & leverage up to 2000x</span></div>
              <div class="ai-toggle-grid two">
                <label class="ai-radio-card profit"><input type="radio" name="aiLiveTargetType" value="PROFIT" checked onchange="AITradeXAdmin.updateAiLivePreview()"/><span>Profit Target</span><small>Auto-close on profit</small></label>
                <label class="ai-radio-card loss"><input type="radio" name="aiLiveTargetType" value="LOSS" onchange="AITradeXAdmin.updateAiLivePreview()"/><span>Loss Target</span><small>Auto-close on loss</small></label>
              </div>
              <div class="ai-inline-fields">
                <label>Target %
                  <input id="aiLiveTargetPercent" type="number" min="0.01" step="0.01" value="2" required oninput="AITradeXAdmin.updateAiLivePreview()"/>
                </label>
                <label>Leverage
                  <select id="aiLiveLeverage" onchange="AITradeXAdmin.updateAiLivePreview()">
                    ${aiLeverageOptions(10)}
                  </select>
                </label>
              </div>
            </div>
            <div class="ai-step-card">
              <div class="ai-step-label"><b>3</b><span>Admin close rule</span></div>
              <div class="ai-inline-fields">
                <label>Minimum Real Balance
                  <input id="aiLiveMinBalance" type="number" min="0" value="0" oninput="AITradeXAdmin.updateAiLivePreview()"/>
                </label>
                <label>Close Mode
                  <input value="Target hit or Admin Close" readonly/>
                </label>
              </div>
              <label>Position Note
                <input id="aiLiveNote" value="AI live position opened" placeholder="Internal note"/>
              </label>
            </div>
            <button class="save-profile-btn ai-execute-btn">Open Live AI Position</button>
          </form>

          <section class="payment-form-card ai-control-preview ai-desk-summary">
            <p>LIVE POSITION PREVIEW</p>
            <h2>Before Open</h2>
            <div class="review-grid compact-review ai-preview-grid">
              <article><span>Valid users</span><b id="aiLivePreviewValid">${eligibleNow}</b></article>
              <article><span>Skipped users</span><b id="aiLivePreviewSkipped">${previewReport.skipped.length}</b></article>
              <article><span>Total AI amount</span><b id="aiLivePreviewMargin">${App.money(aiLivePreviewStats(1,0).totalMargin)}</b></article>
              <article><span>Exposure</span><b id="aiLivePreviewExposure">${App.money(aiLivePreviewStats(1,0).totalExposure)}</b></article>
              <article><span>Target</span><b id="aiLivePreviewTarget">Profit 2%</b></article>
              <article><span>Close rule</span><b id="aiLivePreviewDuration">Target/Admin</b></article>
              <article><span>Plan limit check</span><b id="aiLivePreviewLimitCheck">${previewReport.reasons.limit ? previewReport.reasons.limit + " blocked" : "Passed"}</b></article>
              <article><span>Wallet check</span><b id="aiLivePreviewWalletCheck">${previewReport.reasons.lowBalance || previewReport.reasons.noPool ? "Needs review" : "Passed"}</b></article>
            </div>
            <div class="premium-bank-card ai-last-card">
              <div class="copy-row"><b>Simple rule</b><span>Open = wallet amount cut. Close = locked amount plus/minus live P/L settled.</span><button type="button">Ready</button></div>
            </div>
          </section>
        </div>
      </section>

      ${aiLiveHistoryHtml()}
    `);
  }

  function tradesPage() {
    return instantAiPage();
  }

  function planBenefitsText(plan) {
    return Array.isArray(plan?.benefits) ? plan.benefits.join("\n") : String(plan?.benefits || "");
  }

  function planEditorCard(plan) {
    const clean = App.normalizePlan(plan);
    const activeSubs = (App.state.subscriptions || []).filter(sub => sub.planId === clean.id && sub.status === "ACTIVE" && !App.subscriptionExpired(sub)).length;
    return `
      <form class="admin-plan-card" onsubmit="AITradeXAdmin.savePlan(event, '${clean.id}')">
        <div class="admin-plan-head">
          <div>
            <p>${clean.id === "free" ? "DEFAULT ACCESS" : "SUBSCRIPTION PLAN"}</p>
            <h3>${esc(clean.name)}</h3>
          </div>
          <span class="admin-count-pill">${activeSubs} active</span>
        </div>
        <div class="admin-plan-grid">
          <label>Plan Name
            <input id="plan_${clean.id}_name" value="${esc(clean.name)}" required/>
          </label>
          <label>Price
            <input id="plan_${clean.id}_price" type="number" min="0" value="${Number(clean.price || 0)}" ${clean.id === "free" ? "readonly" : ""}/>
          </label>
          <label>${clean.id === "free" ? "Trial AI Trades / Day" : "AI Trades / Day"}
            <input id="plan_${clean.id}_signals" type="number" min="0" value="${Number(clean.signals || 0)}" required/>
          </label>
          <label>${clean.id === "free" ? "Free Trial Days" : "Duration Days"}
            <input id="plan_${clean.id}_duration" type="number" min="0" value="${Number(clean.durationDays || 0)}"/>
          </label>
          ${clean.id === "free" ? `<label>After Trial AI Trades / Day
            <input id="plan_${clean.id}_postTrial" type="number" min="0" value="${Number(App.state.settings?.postTrialFreeAiTradesPerDay || 1)}" required/>
          </label>` : ""}
          <label>AI Access Label
            <input id="plan_${clean.id}_access" value="${esc(clean.aiAccess)}" required/>
          </label>
          <label>Status
            <select id="plan_${clean.id}_status" ${clean.id === "free" ? "disabled" : ""}>
              <option value="ACTIVE" ${clean.status === "ACTIVE" ? "selected" : ""}>Active</option>
              <option value="INACTIVE" ${clean.status === "INACTIVE" ? "selected" : ""}>Inactive</option>
            </select>
          </label>
        </div>
        <label>Benefits <small>One per line</small>
          <textarea id="plan_${clean.id}_benefits" rows="4">${esc(planBenefitsText(clean))}</textarea>
        </label>
        <button class="save-profile-btn">Save ${esc(clean.name)}</button>
      </form>`;
  }

  function plansPage() {
    const plans = App.getPlans();
    const activeSubs = (App.state.subscriptions || []).filter(sub => sub.status === "ACTIVE" && !App.subscriptionExpired(sub));
    const revenue = (App.state.walletLedger || []).filter(x => x.type === "SUBSCRIPTION_PURCHASE").reduce((sum, x) => sum + Math.abs(Number(x.amount || 0)), 0);
    shell(`
      <section class="metrics-grid">
        ${metric("⭐", "Plans", plans.length)}
        ${metric("👑", "Active Subs", activeSubs.length)}
        ${metric("💰", "Plan Revenue", App.money(revenue))}
        ${metric("🎁", "Trial AI / Day", Number(App.state.settings?.freeAiTradesPerDay || 5))}
      </section>

      <section class="panel-card admin-plans-panel">
        <div class="section-head">
          <div><h3>Subscription Plans</h3><span>Edit plan price, daily AI trades, free trial duration and benefits shown to users.</span></div>
          <span class="admin-count-pill">Wallet purchase enabled</span>
        </div>
        <div class="admin-plan-list">${plans.map(planEditorCard).join("")}</div>
      </section>

      <section class="panel-card">
        <div class="section-head"><div><h3>Recent Subscriptions</h3><span>Latest user plan purchases</span></div></div>
        <div class="admin-list">
          ${(App.state.subscriptions || []).slice().sort((a,b)=>Date.parse(b.createdAt||0)-Date.parse(a.createdAt||0)).slice(0,8).map(sub => {
            const target = allUsers().find(u => u.id === sub.userId) || {};
            return `<article class="admin-user-card">
              <div class="admin-user-main">
                <div><b>${esc(sub.planName || sub.planId)}</b><span>${esc(displayNameFor(target))} · ${esc(target.email || "-")}</span></div>
                <div class="admin-user-stats"><span>Price</span><b>${App.money(sub.price || 0)}</b></div>
                <div class="admin-user-stats"><span>Daily AI Trades</span><b>${Number(sub.aiTradeLimit || sub.signals || 0)}/day</b></div>
                <div class="admin-user-stats"><span>Status</span><b>${esc(sub.status || "ACTIVE")}</b></div>
              </div>
            </article>`;
          }).join("") || `<div class="empty-state">No subscription purchases yet.</div>`}
        </div>
      </section>
    `);
  }

  function referralsPage() {
    const settings = App.referralSettings ? App.referralSettings() : (App.state.settings || {});
    const referrals = (App.state.referrals || []).slice().sort((a, b) => Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0));
    const users = allUsers();
    const nameForId = id => {
      const target = users.find(u => u.id === id) || {};
      return `${displayNameFor(target)} · ${target.email || "-"}`;
    };
    const totalDepositBonus = referrals.reduce((sum, row) => sum + Number(row.bonuses?.deposit?.amount || 0), 0);
    const totalSubscriptionBonus = referrals.reduce((sum, row) => sum + Number(row.bonuses?.subscription?.amount || 0), 0);
    const creditedRows = referrals.filter(row => row.bonuses?.deposit?.credited || row.bonuses?.subscription?.credited).length;
    const referralCard = row => {
      const deposit = row.bonuses?.deposit;
      const subscription = row.bonuses?.subscription;
      const referred = users.find(u => u.id === row.referredUserId) || {};
      return `<article class="admin-user-card referral-admin-card">
        <div class="admin-user-main">
          <div><b>${esc(displayNameFor(referred))}</b><span>Referred by ${esc(nameForId(row.referrerUserId))}</span><small>${esc(referred.email || "-")} · Joined ${row.createdAt ? new Date(row.createdAt).toLocaleString("en-IN") : "-"}</small></div>
          <div class="admin-user-stats"><span>Deposit Bonus</span><b>${deposit?.credited ? App.money(deposit.amount) : "Pending"}</b><small>${deposit?.credited ? `${deposit.percent}% credited` : "First approved deposit"}</small></div>
          <div class="admin-user-stats"><span>Subscription Bonus</span><b>${subscription?.credited ? App.money(subscription.amount) : "Pending"}</b><small>${subscription?.credited ? `${subscription.percent}% credited` : "First paid plan"}</small></div>
          <div class="admin-user-stats"><span>Status</span><b>${esc(row.status || "REGISTERED")}</b><small>${row.updatedAt ? new Date(row.updatedAt).toLocaleString("en-IN") : "Auto tracking"}</small></div>
        </div>
      </article>`;
    };

    shell(`
      <section class="metrics-grid">
        ${metric("🎁", "Referrals", referrals.length)}
        ${metric("✅", "Rewarded", creditedRows)}
        ${metric("⬇️", "Deposit Bonus", App.money(totalDepositBonus))}
        ${metric("⭐", "Plan Bonus", App.money(totalSubscriptionBonus))}
      </section>

      <section class="panel-card referral-settings-panel">
        <div class="section-head"><div><h3>Referral Bonus Settings</h3><span>Bonus is credited automatically to real wallet. No manual approval is required.</span></div><span class="admin-count-pill">Auto Credit</span></div>
        <form class="admin-settings-grid" onsubmit="AITradeXAdmin.saveReferralSettings(event)">
          <label>Deposit Bonus %
            <input id="referralDepositPercent" type="number" min="0" step="0.01" value="${Number(settings.referralDepositPercent ?? settings.referralFirstDepositPercent ?? 10)}" required/>
          </label>
          <label>Subscription Bonus %
            <input id="referralSubscriptionPercent" type="number" min="0" step="0.01" value="${Number(settings.referralSubscriptionPercent ?? 10)}" required/>
          </label>
          <label>Deposit Bonus
            <select id="referralDepositEnabled">
              <option value="true" ${settings.referralDepositEnabled !== false ? "selected" : ""}>Enabled</option>
              <option value="false" ${settings.referralDepositEnabled === false ? "selected" : ""}>Disabled</option>
            </select>
          </label>
          <label>Subscription Bonus
            <select id="referralSubscriptionEnabled">
              <option value="true" ${settings.referralSubscriptionEnabled !== false ? "selected" : ""}>Enabled</option>
              <option value="false" ${settings.referralSubscriptionEnabled === false ? "selected" : ""}>Disabled</option>
            </select>
          </label>
          <button class="save-profile-btn">Save Referral Settings</button>
        </form>
      </section>

      <section class="panel-card">
        <div class="section-head"><div><h3>Referral Tracking</h3><span>Registered referrals, automatic deposit bonuses and subscription bonuses.</span></div><span class="admin-count-pill">${referrals.length} rows</span></div>
        <div class="admin-list">${referrals.length ? referrals.map(referralCard).join("") : `<div class="empty-state">No referral signups yet.</div>`}</div>
      </section>
    `);
  }

  function supportUserFor(ticket) {
    return allUsers().find(u => u.id === ticket.userId) || { name: ticket.userName || "User", email: ticket.userEmail || "", mobile: ticket.userMobile || "" };
  }

  function supportRows() {
    App.state.supportTickets = App.state.supportTickets || [];
    const q = supportSearch.trim().toLowerCase();
    return App.state.supportTickets
      .filter(ticket => supportStatusFilter === "ALL" || String(ticket.status || "OPEN").toUpperCase() === supportStatusFilter)
      .filter(ticket => {
        if (!q) return true;
        const u = supportUserFor(ticket);
        return [ticket.id, ticket.category, ticket.subject, ticket.message, ticket.status, u.name, u.email, u.mobile].some(value => String(value || "").toLowerCase().includes(q));
      })
      .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0));
  }

  function supportTicketCard(ticket) {
    const u = supportUserFor(ticket);
    const replies = Array.isArray(ticket.replies) ? ticket.replies : [];
    const status = String(ticket.status || "OPEN").toUpperCase();
    return `
      <article class="admin-support-ticket-card">
        <div class="support-admin-head">
          <div>
            <p>${esc(ticket.category || "Support")}</p>
            <h3>${esc(ticket.subject || "Support request")}</h3>
            <span>${esc(displayNameFor(u))} · ${esc(u.email || "No email")} · ${esc(u.mobile || "No mobile")}</span>
          </div>
          ${statusPill(status)}
        </div>
        <div class="support-admin-message">${esc(ticket.message || "-")}</div>
        ${replies.length ? `<div class="support-admin-thread">${replies.map(reply => `
          <div class="ticket-thread-row ${reply.by === "admin" ? "admin" : "user"}">
            <b>${reply.by === "admin" ? "Support" : "User"}</b>
            <span>${esc(reply.message || "")}</span>
            <small>${esc(reply.createdAt || "")}</small>
          </div>`).join("")}</div>` : ""}
        <div class="ticket-meta-grid admin-ticket-meta">
          <span>ID: ${esc(ticket.id)}</span>
          <span>Created: ${esc(ticket.createdAt || "-")}</span>
          <span>Updated: ${esc(ticket.updatedAt || "-")}</span>
        </div>
        ${status !== "CLOSED" ? `
          <form class="support-reply-form" onsubmit="AITradeXAdmin.replySupportTicket(event,'${ticket.id}')">
            <textarea id="reply_${ticket.id}" rows="3" placeholder="Write admin reply..."></textarea>
            <div class="support-action-row">
              <button class="mini-action" type="submit">Send Reply</button>
              <button class="ghost-action" type="button" onclick="AITradeXAdmin.closeSupportTicket('${ticket.id}', this)">Close Ticket</button>
            </div>
          </form>` : `<div class="support-closed-note">Ticket closed.</div>`}
      </article>`;
  }

  function supportPage() {
    const settings = App.state.settings || {};
    const rows = supportRows();
    const total = App.state.supportTickets || [];
    const open = total.filter(t => String(t.status || "OPEN").toUpperCase() === "OPEN").length;
    const replied = total.filter(t => String(t.status || "OPEN").toUpperCase() === "REPLIED").length;
    const closed = total.filter(t => String(t.status || "OPEN").toUpperCase() === "CLOSED").length;
    shell(`
      <section class="metrics-grid compact-metrics">
        ${metric("🎧", "Open", open)}
        ${metric("↩️", "Replied", replied)}
        ${metric("✅", "Closed", closed)}
      </section>

      <section class="panel-card support-settings-card">
        <div class="section-head">
          <div><h3>Support Settings</h3><span>WhatsApp is used for urgent quick help. Tickets stay as official support records.</span></div>
        </div>
        <form class="admin-inline-form" onsubmit="AITradeXAdmin.saveSupportSettings(event)">
          <label>WhatsApp Support Number
            <input id="supportWhatsAppNumber" value="${esc(settings.supportWhatsAppNumber || "919999999999")}" placeholder="919999999999"/>
          </label>
          <button class="mini-action">Save</button>
        </form>
      </section>

      <section class="admin-filter-bar users-filter-bar">
        <input value="${esc(supportSearch)}" oninput="AITradeXAdmin.setSupportSearch(this.value)" placeholder="Search ticket, user, email, category..."/>
        <select onchange="AITradeXAdmin.setSupportStatusFilter(this.value)">
          ${["ALL", "OPEN", "REPLIED", "CLOSED"].map(status => `<option value="${status}" ${supportStatusFilter === status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
      </section>

      <section class="panel-card">
        <div class="section-head"><div><h3>Support Tickets</h3><span>${rows.length} matching tickets</span></div></div>
        <div class="support-admin-list">
          ${rows.length ? rows.map(supportTicketCard).join("") : `<div class="empty-state">No support tickets found.</div>`}
        </div>
      </section>
    `);
  }

  function settingsPage() {
    const settings = platformSettings();
    shell(`
      <section class="panel-card payment-settings-panel">
        <div class="section-head">
          <div><h3>Payment Settings</h3><span>Control the deposit UPI, QR, bank details and wallet limits shown to users.</span></div>
          <span class="admin-count-pill">Admin editable</span>
        </div>

        <div class="admin-grid-two payment-settings-grid">
          <form class="payment-form-card form-grid" onsubmit="AITradeXAdmin.savePaymentSettings(event)">
            <p>DEPOSIT METHOD ACCESS</p>
            <h2>Deposit Payment Setup</h2>
            <div class="method-toggle-grid">
              <label>UPI / QR Method
                <select id="settingUpiEnabled">
                  <option value="true" ${settings.depositUpiEnabled !== false ? "selected" : ""}>Enabled</option>
                  <option value="false" ${settings.depositUpiEnabled === false ? "selected" : ""}>Disabled</option>
                </select>
                <small>Disable this if UPI/QR is unavailable.</small>
              </label>
              <label>Bank Transfer Method
                <select id="settingBankEnabled">
                  <option value="true" ${settings.depositBankEnabled !== false ? "selected" : ""}>Enabled</option>
                  <option value="false" ${settings.depositBankEnabled === false ? "selected" : ""}>Disabled</option>
                </select>
                <small>Disable this if bank transfer is unavailable.</small>
              </label>
            </div>

            <p>UPI / QR DETAILS</p>
            <label>UPI ID
              <input id="settingUpiId" value="${esc(settings.depositUpiId)}" placeholder="aitradex@upi" required/>
            </label>
            <label>QR Image
              <input id="settingQrImage" type="file" accept="image/*"/>
            </label>
            <div class="profile-note">Upload a new QR only when you want to replace the current QR. Saved QR is stored in this browser for now.</div>

            <p>BANK DETAILS</p>
            <label>Bank Name
              <input id="settingBankName" value="${esc(settings.depositBankName)}" placeholder="Bank name" required/>
            </label>
            <label>Account Holder Name
              <input id="settingAccountName" value="${esc(settings.depositAccountName)}" placeholder="Account holder name" required/>
            </label>
            <label>Account Number
              <input id="settingAccountNumber" value="${esc(settings.depositAccountNumber)}" placeholder="Account number" required/>
            </label>
            <label>IFSC Code
              <input id="settingIfsc" value="${esc(settings.depositIfsc)}" placeholder="IFSC code" required/>
            </label>

            <p>WALLET LIMITS</p>
            <label>Minimum Deposit
              <input id="settingMinDeposit" type="number" min="1" value="${Number(settings.minDeposit || 500)}" required/>
            </label>
            <label>Minimum Withdrawal
              <input id="settingMinWithdrawal" type="number" min="1" value="${Number(settings.minWithdrawal || 1000)}" required/>
            </label>

            <p>CRYPTO INR DISPLAY</p>
            <label>USDT to INR Rate
              <input id="settingUsdtInrRate" type="number" min="1" step="0.01" value="${Number(settings.usdtInrRate || 95)}" required/>
              <small>This controls INR-only crypto price display. Default is ₹95 per USDT.</small>
            </label>
            <button class="save-profile-btn">Save Payment Settings</button>
          </form>

          <section class="payment-form-card payment-settings-preview">
            <p>USER SIDE PREVIEW</p>
            <h2>Deposit Details Preview</h2>
            <div class="upi-pay-card settings-upi-preview">
              <div class="qr-large-box">
                ${settings.depositQrImage ? `<img src="${esc(settings.depositQrImage)}" alt="Deposit QR"/>` : `<div class="qr-grid-mark">QR</div>`}
              </div>
              <div class="upi-pay-info">
                <p>PAY VIA UPI</p>
                <h2>${esc(settings.depositUpiId)}</h2>
                <span>This is what users will see on deposit step 3.</span>
              </div>
            </div>
            <div class="premium-bank-card">
              <div class="copy-row"><b>Bank Name</b><span>${esc(settings.depositBankName)}</span><button type="button">Copy</button></div>
              <div class="copy-row"><b>Account Name</b><span>${esc(settings.depositAccountName)}</span><button type="button">Copy</button></div>
              <div class="copy-row"><b>Account No.</b><span>${esc(settings.depositAccountNumber)}</span><button type="button">Copy</button></div>
              <div class="copy-row"><b>IFSC Code</b><span>${esc(settings.depositIfsc)}</span><button type="button">Copy</button></div>
            </div>
            <div class="review-grid compact-review">
              <article><span>UPI / QR</span><b class="${settings.depositUpiEnabled !== false ? "text-profit" : "text-loss"}">${settings.depositUpiEnabled !== false ? "Enabled" : "Disabled"}</b></article>
              <article><span>Bank Transfer</span><b class="${settings.depositBankEnabled !== false ? "text-profit" : "text-loss"}">${settings.depositBankEnabled !== false ? "Enabled" : "Disabled"}</b></article>
              <article><span>Minimum Deposit</span><b>${App.money(settings.minDeposit)}</b></article>
              <article><span>Minimum Withdrawal</span><b>${App.money(settings.minWithdrawal)}</b></article>
              <article><span>USDT-INR Rate</span><b>₹${Number(settings.usdtInrRate || 95).toLocaleString("en-IN")}</b></article>
            </div>
          </section>
        </div>
      </section>
    `);
  }

  function markButton(button, text) {
    if (!button) return;
    button.disabled = true;
    button.dataset.oldText = button.textContent;
    button.textContent = text;
  }

  function render() {
    if (App.reloadState) App.reloadState();
    reconcileAiLiveMarginLocks();
    page = localStorage.getItem("AITradeX_ADMIN_PAGE") || "dashboard";
    const current = adminUser();
    if (!current || current.role !== "admin") return loginPage();

    if (page === "dashboard") return dashboardPage();
    if (page === "notifications") return notificationsPage();
    if (page === "users") return usersPage();
    if (page === "kyc") return kycPage();
    if (page === "payments") return paymentsPage();
    if (page === "wallet") { page = "deposits"; localStorage.setItem("AITradeX_ADMIN_PAGE", page); }
    if (page === "deposits") return financeRequestPage("DEPOSIT");
    if (page === "withdrawals") return financeRequestPage("WITHDRAWAL");
    if (page === "trades") { page = "instantAi"; localStorage.setItem("AITradeX_ADMIN_PAGE", page); }
    if (page === "instantAi") return instantAiPage();
    if (page === "liveAi") return liveAiPage();
    if (page === "plans") return plansPage();
    if (page === "referrals") return referralsPage();
    if (page === "support") return supportPage();
    if (page === "settings") return settingsPage();
    return dashboardPage();
  }


  function settleAiLivePositionByAdmin(position, reason = "ADMIN_CLOSE") {
    if (!position || String(position.status || "").toUpperCase() !== "OPEN") return false;
    const cached = App.getCachedPairPrice ? App.getCachedPairPrice(position.pair) : null;
    const current = Number(cached?.price || position.entryPrice || 0);
    let pnl = aiLivePositionPnl(position);
    const balanceBefore = App.realBalance(position.userId);
    const margin = Math.max(0, Number(position.marginAmount || 0));
    if (position.marginLocked && pnl < -margin) pnl = -margin;
    if (!position.marginLocked && pnl < 0 && Math.abs(pnl) > balanceBefore) pnl = -balanceBefore;
    const settlementAmount = position.marginLocked ? Math.max(0, margin + pnl) : pnl;
    const now = new Date().toISOString();
    position.tradeType = "AI_AUTO";
    position.status = "CLOSED";
    position.exitPrice = current;
    position.exitPriceDisplay = cached?.display || String(current || position.entryPrice || "-");
    position.exitPriceSource = cached?.source || position.priceSource || "Live market";
    position.closedAt = now;
    position.closeReason = reason;
    position.resultType = pnl >= 0 ? "PROFIT" : "LOSS";
    position.resultPercent = Number(position.targetPercent || 0);
    position.pnl = Number(pnl.toFixed(2));
    position.settlementAmount = Number(settlementAmount.toFixed(2));
    position.balanceAfter = Number((balanceBefore + position.settlementAmount).toFixed(2));
    position.source = "ADMIN_AI_LIVE_CLOSE";
    if (position.settlementAmount !== 0) {
      App.addLedger({
        userId: position.userId,
        accountType: "REAL",
        type: position.marginLocked ? "AI_LIVE_SETTLEMENT" : (position.pnl >= 0 ? "AI_LIVE_PROFIT" : "AI_LIVE_LOSS"),
        amount: position.settlementAmount,
        referenceId: position.id,
        note: position.marginLocked
          ? `${position.pair} AI live ${position.side} closed by admin · AI amount ${App.money(margin)} · P/L ${position.pnl >= 0 ? "+" : ""}${App.money(position.pnl)}`
          : `${position.pair} AI live ${position.side} closed by admin`
      });
    } else {
      App.saveState();
    }
    App.addNotification?.({ audience: "USER", userId: position.userId, title: "AI live position closed", message: `${position.pair} ${position.side} closed. P/L ${position.pnl >= 0 ? "+" : ""}${App.money(position.pnl)}. Settlement ${App.money(position.settlementAmount)}.`, type: "AI", linkPage: "orders", referenceId: `ai_close_${position.id}` });
    App.addNotification?.({ audience: "ADMIN", title: "AI live trade closed", message: `${position.pair} ${position.side} closed for user ${position.userId}. P/L ${position.pnl >= 0 ? "+" : ""}${App.money(position.pnl)}.`, type: "AI", linkPage: "liveAi", referenceId: `admin_ai_close_${position.id}` });
    return true;
  }

  window.AITradeXAdmin = {
    changeAiHistoryPage(kind, delta) {
      const key = `AITradeX_ADMIN_${kind}_PAGE`;
      const current = Math.max(1, Number(localStorage.getItem(key) || 1));
      localStorage.setItem(key, String(Math.max(1, current + Number(delta || 0))));
      render();
    },
    changeUsersPage(delta) {
      usersPageNo = Math.max(1, usersPageNo + Number(delta || 0));
      localStorage.setItem("AITradeX_ADMIN_USERS_PAGE", String(usersPageNo));
      render();
    },
    changeFinanceHistoryPage(sectionType, delta) {
      const isDeposit = sectionType === "DEPOSIT";
      if (isDeposit) {
        depositHistoryPage = Math.max(1, depositHistoryPage + Number(delta || 0));
        localStorage.setItem("AITradeX_ADMIN_DEPOSIT_HISTORY_PAGE", String(depositHistoryPage));
      } else {
        withdrawalHistoryPage = Math.max(1, withdrawalHistoryPage + Number(delta || 0));
        localStorage.setItem("AITradeX_ADMIN_WITHDRAWAL_HISTORY_PAGE", String(withdrawalHistoryPage));
      }
      render();
    },
    confirmFinanceAction(action, userId, requestId, userName, amountText, button) {
      const actionTitle = String(action || "").includes("approve") ? "Approve" : "Reject";
      const isWithdrawal = String(action || "").toLowerCase().includes("withdrawal");
      const impact = isWithdrawal ? "This may debit the user's real wallet on approval." : "This may credit the user's real wallet on approval.";
      const ok = confirm(`${actionTitle} request for ${userName || "user"}?\nAmount: ${amountText || "-"}\n${impact}`);
      if (!ok) return;
      if (typeof this[action] === "function") this[action](userId, requestId, button);
    },
    login(event) {
      event.preventDefault();
      try {
        const login = Auth.loginAdmin || Auth.loginControl;
        login({
          email: adminEmail.value,
          password: adminPassword.value
        });
        page = "dashboard";
        localStorage.setItem("AITradeX_ADMIN_PAGE", page);
        App.toast("Admin logged in.");
        render();
      } catch (err) {
        App.toast(err.message);
      }
    },
    logout() {
      App.clearSession();
      localStorage.removeItem("AITradeX_ADMIN_PAGE");
      page = "dashboard";
      loginPage();
    },
    go(next) {
      page = next;
      localStorage.setItem("AITradeX_ADMIN_PAGE", page);
      render();
    },
    markNotificationsRead() {
      App.markNotificationsRead?.({ audience: "ADMIN" });
      App.toast("Notifications marked as read.");
      render();
    },
    markSingleNotification(id) {
      const row = (App.state.notifications || []).find(n => n.id === id);
      if (row) row.read = true;
      App.saveState();
      render();
    },
    openNotificationLink(id, linkPage) {
      const row = (App.state.notifications || []).find(n => n.id === id);
      if (row) row.read = true;
      App.saveState();
      page = linkPage || "notifications";
      localStorage.setItem("AITradeX_ADMIN_PAGE", page);
      render();
    },
    setKycSearch(value) {
      kycSearch = value;
      localStorage.setItem("AITradeX_ADMIN_KYC_SEARCH", kycSearch);
      render();
    },
    setKycFilter(value) {
      kycFilter = value;
      localStorage.setItem("AITradeX_ADMIN_KYC_FILTER", kycFilter);
      render();
    },
    setPaymentSearch(value) {
      paymentSearch = value;
      localStorage.setItem("AITradeX_ADMIN_PAYMENT_SEARCH", paymentSearch);
      render();
    },
    setPaymentStatusFilter(value) {
      paymentStatusFilter = value;
      localStorage.setItem("AITradeX_ADMIN_PAYMENT_STATUS", paymentStatusFilter);
      render();
    },
    setFinanceSearch(value) {
      financeSearch = value;
      depositHistoryPage = 1;
      withdrawalHistoryPage = 1;
      localStorage.setItem("AITradeX_ADMIN_FINANCE_SEARCH", financeSearch);
      localStorage.setItem("AITradeX_ADMIN_DEPOSIT_HISTORY_PAGE", "1");
      localStorage.setItem("AITradeX_ADMIN_WITHDRAWAL_HISTORY_PAGE", "1");
      render();
    },
    setFinanceStatusFilter(value) {
      financeStatusFilter = value;
      depositHistoryPage = 1;
      withdrawalHistoryPage = 1;
      localStorage.setItem("AITradeX_ADMIN_FINANCE_STATUS", financeStatusFilter);
      localStorage.setItem("AITradeX_ADMIN_DEPOSIT_HISTORY_PAGE", "1");
      localStorage.setItem("AITradeX_ADMIN_WITHDRAWAL_HISTORY_PAGE", "1");
      render();
    },
    setUsersSearch(value) {
      usersSearch = value;
      usersPageNo = 1;
      walletHistoryPage = 1;
      localStorage.setItem("AITradeX_ADMIN_USERS_SEARCH", usersSearch);
      localStorage.setItem("AITradeX_ADMIN_USERS_PAGE", "1");
      localStorage.setItem("AITradeX_ADMIN_WALLET_HISTORY_PAGE", "1");
      render();
    },
    setUsersStatusFilter(value) {
      usersStatusFilter = value;
      usersPageNo = 1;
      walletHistoryPage = 1;
      localStorage.setItem("AITradeX_ADMIN_USERS_STATUS", usersStatusFilter);
      localStorage.setItem("AITradeX_ADMIN_USERS_PAGE", "1");
      localStorage.setItem("AITradeX_ADMIN_WALLET_HISTORY_PAGE", "1");
      render();
    },
    setUserStatus(userId, status, button) {
      const target = allUsers().find(u => u.id === userId);
      if (!target) return;
      const nextStatus = String(status || "ACTIVE").toUpperCase();
      if (!["ACTIVE", "SUSPENDED", "BLOCKED"].includes(nextStatus)) return;
      if (userStatus(target) === nextStatus) {
        App.toast(`User is already ${nextStatus.toLowerCase()}.`);
        return;
      }
      const actionText = nextStatus === "ACTIVE" ? "activate" : nextStatus === "SUSPENDED" ? "suspend" : "block";
      if (!confirm(`Are you sure you want to ${actionText} ${displayNameFor(target)}?`)) return;
      markButton(button, "Updating...");
      target.status = nextStatus;
      target.statusUpdatedAt = App.now();
      App.saveState();
      App.toast(`User status changed to ${nextStatus}.`);
      render();
    },
    adjustUserWallet(event, userId) {
      event.preventDefault();
      const target = allUsers().find(u => u.id === userId);
      if (!target) return;
      const amount = Math.max(0, Number(document.getElementById(`walletAmount_${userId}`)?.value || 0));
      const action = String(document.getElementById(`walletAction_${userId}`)?.value || "ADD").toUpperCase();
      const note = String(document.getElementById(`walletNote_${userId}`)?.value || "").trim();
      if (!amount) {
        App.toast("Enter wallet amount.");
        return;
      }
      const signed = action === "DEDUCT" ? -amount : amount;
      const label = action === "DEDUCT" ? "deduct" : "add";
      if (!confirm(`Confirm ${label} ${App.money(amount)} for ${displayNameFor(target)}?`)) return;
      try {
        const referenceId = App.uid("admin_wallet");
        App.addLedger({
          userId,
          accountType: "REAL",
          type: action === "DEDUCT" ? "ADMIN_WALLET_DEBIT" : "ADMIN_WALLET_CREDIT",
          amount: signed,
          referenceId,
          note: note || `Admin wallet ${action.toLowerCase()}`
        });
        App.addNotification?.({ audience: "USER", userId, title: action === "DEDUCT" ? "Wallet debited by admin" : "Wallet credited by admin", message: `${App.money(amount)} ${action === "DEDUCT" ? "deducted from" : "added to"} your real wallet.${note ? ` Note: ${note}` : ""}`, type: "WALLET", linkPage: "wallet", referenceId });
        App.toast(`Wallet ${action === "DEDUCT" ? "deducted" : "credited"} successfully.`);
        render();
      } catch (error) {
        App.toast(error.message || "Wallet update failed.");
      }
    },
    changeUserPlan(event, userId) {
      event.preventDefault();
      const target = allUsers().find(u => u.id === userId);
      if (!target) return;
      const planId = String(document.getElementById(`planSelect_${userId}`)?.value || "free");
      const plan = App.planById(planId) || App.planById("free");
      if (!plan) return;
      if (!confirm(`Change ${displayNameFor(target)} plan to ${plan.name}?`)) return;
      App.state.subscriptions = App.state.subscriptions || [];
      App.state.subscriptions.forEach(sub => {
        if (sub.userId === userId && sub.status === "ACTIVE") {
          sub.status = "ADMIN_REPLACED";
          sub.replacedAt = App.now();
        }
      });
      if (plan.id !== "free") {
        const days = Math.max(1, Number(plan.durationDays || 30));
        const created = new Date();
        const expires = new Date(created.getTime() + days * 86400000);
        App.state.subscriptions.push({
          id: App.uid("sub"),
          userId,
          planId: plan.id,
          planName: plan.name,
          price: Number(plan.price || 0),
          aiTradeLimit: Number(plan.signals || 0),
          signals: Number(plan.signals || 0),
          durationDays: days,
          status: "ACTIVE",
          source: "ADMIN_PLAN_CHANGE",
          createdAt: created.toISOString(),
          expiresAt: expires.toISOString()
        });
      }
      target.planChangedAt = App.now();
      target.planChangedBy = "admin";
      App.addNotification?.({ audience: "USER", userId, title: "Subscription plan updated", message: `Your plan was changed to ${plan.name} by admin.`, type: "PLAN", linkPage: "subscription", referenceId: `plan_${userId}_${Date.now()}` });
      App.saveState();
      App.toast(`${displayNameFor(target)} plan updated to ${plan.name}.`);
      render();
    },
    resetUserPassword(event, userId) {
      event.preventDefault();
      const target = allUsers().find(u => u.id === userId);
      if (!target) return;
      const next = String(document.getElementById(`newPassword_${userId}`)?.value || "").trim();
      if (next.length < 4) {
        App.toast("Password must be at least 4 characters.");
        return;
      }
      if (!confirm(`Reset password for ${displayNameFor(target)}?`)) return;
      target.password = next;
      target.passwordUpdatedAt = App.now();
      target.passwordUpdatedBy = "admin";
      App.saveState();
      App.toast("Password reset successfully.");
      render();
    },
    changeWalletHistoryPage(delta) {
      walletHistoryPage = Math.max(1, walletHistoryPage + Number(delta || 0));
      localStorage.setItem("AITradeX_ADMIN_WALLET_HISTORY_PAGE", String(walletHistoryPage));
      render();
    },
    copyText(value) {
      const text = String(value || "");
      if (!text) return;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(() => App.toast("Copied."));
      } else {
        const input = document.createElement("input");
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
        App.toast("Copied.");
      }
    },
    setSupportSearch(value) {
      supportSearch = value;
      localStorage.setItem("AITradeX_ADMIN_SUPPORT_SEARCH", supportSearch);
      render();
    },
    setSupportStatusFilter(value) {
      supportStatusFilter = value;
      localStorage.setItem("AITradeX_ADMIN_SUPPORT_STATUS", supportStatusFilter);
      render();
    },
    saveSupportSettings(event) {
      event.preventDefault();
      const raw = String(document.getElementById("supportWhatsAppNumber")?.value || "").replace(/\D/g, "");
      if (!raw || raw.length < 10) {
        App.toast("Enter a valid WhatsApp support number with country code.");
        return;
      }
      App.state.settings = { ...(App.state.settings || {}), supportWhatsAppNumber: raw };
      App.saveState();
      App.toast("Support settings saved.");
      render();
    },
    replySupportTicket(event, ticketId) {
      event.preventDefault();
      App.state.supportTickets = App.state.supportTickets || [];
      const ticket = App.state.supportTickets.find(t => t.id === ticketId);
      if (!ticket) return;
      const input = document.getElementById(`reply_${ticketId}`);
      const message = String(input?.value || "").trim();
      if (!message) {
        App.toast("Reply message required.");
        return;
      }
      ticket.replies = Array.isArray(ticket.replies) ? ticket.replies : [];
      ticket.replies.push({ by: "admin", message, createdAt: App.now() });
      ticket.status = "REPLIED";
      ticket.updatedAt = App.now();
      App.saveState();
      App.toast("Reply sent.");
      render();
    },
    closeSupportTicket(ticketId, button) {
      App.state.supportTickets = App.state.supportTickets || [];
      const ticket = App.state.supportTickets.find(t => t.id === ticketId);
      if (!ticket) return;
      if (!confirm("Close this support ticket?")) return;
      markButton(button, "Closing...");
      ticket.status = "CLOSED";
      ticket.closedAt = App.now();
      ticket.updatedAt = App.now();
      App.saveState();
      App.toast("Ticket closed.");
      render();
    },
    savePlan(event, planId) {
      event.preventDefault();
      const plan = App.planById(planId);
      if (!plan) {
        App.toast("Plan not found.");
        return;
      }
      const get = id => document.getElementById(`plan_${planId}_${id}`);
      const next = {
        ...plan,
        name: String(get("name")?.value || plan.name || "Plan").trim(),
        price: planId === "free" ? 0 : Math.max(0, Number(get("price")?.value || 0)),
        signals: Math.max(0, Number(get("signals")?.value || 0)),
        durationDays: Math.max(0, Number(get("duration")?.value || 0)),
        aiAccess: String(get("access")?.value || "AI Access").trim(),
        status: planId === "free" ? "ACTIVE" : String(get("status")?.value || "ACTIVE").toUpperCase(),
        benefits: String(get("benefits")?.value || "").split("\n").map(x => x.trim()).filter(Boolean)
      };
      if (!next.name) {
        App.toast("Plan name required.");
        return;
      }
      App.state.plans = App.getPlans().map(row => row.id === planId ? App.normalizePlan(next) : row);
      if (planId === "free") {
        App.state.settings = {
          ...(App.state.settings || {}),
          freeAiTradesPerDay: Number(next.signals || 5),
          freeTrialDays: Number(next.durationDays || 7),
          postTrialFreeAiTradesPerDay: Math.max(0, Number(get("postTrial")?.value || 1))
        };
      }
      App.saveState();
      App.toast(`${next.name} plan saved.`);
      render();
    },
    saveReferralSettings(event) {
      event.preventDefault();
      App.state.settings = {
        ...(App.state.settings || {}),
        referralDepositPercent: Math.max(0, Number(document.getElementById("referralDepositPercent")?.value || 0)),
        referralFirstDepositPercent: Math.max(0, Number(document.getElementById("referralDepositPercent")?.value || 0)),
        referralSubscriptionPercent: Math.max(0, Number(document.getElementById("referralSubscriptionPercent")?.value || 0)),
        referralDepositEnabled: document.getElementById("referralDepositEnabled")?.value !== "false",
        referralSubscriptionEnabled: document.getElementById("referralSubscriptionEnabled")?.value !== "false"
      };
      App.saveState();
      App.toast("Referral settings saved.");
      render();
    },
    savePaymentSettings(event) {
      event.preventDefault();
      const settings = platformSettings();
      const file = document.getElementById("settingQrImage")?.files?.[0];
      const apply = qrImage => {
        App.state.settings = {
          ...settings,
          depositUpiId: inputValue("settingUpiId") || "aitradex@upi",
          depositQrImage: qrImage ?? (settings.depositQrImage || ""),
          depositUpiEnabled: document.getElementById("settingUpiEnabled")?.value !== "false",
          depositBankEnabled: document.getElementById("settingBankEnabled")?.value !== "false",
          depositBankName: inputValue("settingBankName") || "AITradeX Bank",
          depositAccountName: inputValue("settingAccountName") || "AITradeX Private Wallet",
          depositAccountNumber: inputValue("settingAccountNumber") || "123456789012",
          depositIfsc: inputValue("settingIfsc").toUpperCase() || "AITX0001234",
          minDeposit: Math.max(1, Number(inputValue("settingMinDeposit") || 500)),
          minWithdrawal: Math.max(1, Number(inputValue("settingMinWithdrawal") || 1000)),
          usdtInrRate: Math.max(1, Number(inputValue("settingUsdtInrRate") || 95))
        };
        App.saveState();
        App.toast("Payment settings saved.");
        render();
      };

      if (file) {
        const reader = new FileReader();
        reader.onload = () => apply(String(reader.result || ""));
        reader.onerror = () => App.toast("QR image could not be saved.");
        reader.readAsDataURL(file);
      } else {
        apply(settings.depositQrImage || "");
      }
    },
    onAiPairChange() {
      this.updateAiPreview();
      setAiPriceView();
      this.fetchAiEntryPrice(false);
    },
    async fetchAiEntryPrice(showToast = true) {
      const pair = inputValue("aiTradePair") || "BTC/USDT";
      const manual = Number(inputValue("aiManualEntryPrice") || 0);
      try {
        const row = await App.getLivePairPrice(pair, manual);
        setAiPriceView(row);
        if (showToast) App.toast(`${App.displayPairLabel ? App.displayPairLabel(pair) : pair} entry price locked from ${row.source}.`);
        return row;
      } catch (error) {
        setAiPriceView({ price: "--", source: "Unavailable", display: "--" });
        if (showToast) App.toast(error.message || "Live price unavailable.");
        throw error;
      }
    },
    updateAiPreview() {
      const resultType = document.querySelector('input[name="aiTradeResultType"]:checked')?.value || "PROFIT";
      const resultPercent = Math.max(0, Number(inputValue("aiTradeResultPercent") || 0));
      const leverage = normalizeAdminLeverage(inputValue("aiTradeLeverage") || 1);
      const minBalance = Math.max(0, Number(inputValue("aiTradeMinBalance") || 0));
      const stats = aiPreviewStats(resultPercent, leverage, minBalance, resultType);
      const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
      const setMoney = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = App.money(value || 0); };
      const setPnl = (id, value) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = App.money(value || 0);
        el.classList.toggle("profit-text", Number(value || 0) >= 0);
        el.classList.toggle("loss-text", Number(value || 0) < 0);
      };
      setText("aiPreviewValid", stats.report.eligible.length);
      setText("aiPreviewSkipped", stats.report.skipped.length);
      setMoney("aiPreviewMargin", stats.totalMargin);
      setMoney("aiPreviewExposure", stats.totalExposure);
      setPnl("aiPreviewOneK", stats.perOneThousand);
      setPnl("aiPreviewTenK", stats.perTenThousand);
      setPnl("aiPreviewTotalPnl", stats.totalPnl);
      setText("aiPreviewReasons", skipReasonLine(stats.report.reasons));
    },
    async executeAiTrade(event) {
      event.preventDefault();
      const selectedPairData = pairDataByPair(inputValue("aiTradePair") || "BTC/USDT");
      const market = selectedPairData.market || "CRYPTO";
      const pair = String(selectedPairData.pair || "BTC/USDT").toUpperCase();
      if (market !== "CRYPTO") {
        App.toast("AI Trading Desk currently supports crypto pairs only.");
        return;
      }
      const side = document.querySelector('input[name="aiTradeSide"]:checked')?.value || "BUY";
      const leverage = normalizeAdminLeverage(inputValue("aiTradeLeverage") || 1);
      const resultType = document.querySelector('input[name="aiTradeResultType"]:checked')?.value || "PROFIT";
      const resultPercent = Math.max(0, Number(inputValue("aiTradeResultPercent") || 0));
      const minBalance = Math.max(0, Number(inputValue("aiTradeMinBalance") || 0));
      const note = inputValue("aiTradeNote") || "Expert AI auto trade executed";
      let priceRow;
      try {
        priceRow = await this.fetchAiEntryPrice(false);
      } catch (error) {
        App.toast(error.message || "Entry price unavailable. Trade not executed.");
        return;
      }

      const batchId = App.uid("ai_batch");
      const report = aiEligibilityReport(minBalance);
      let appliedCount = 0;
      let totalMargin = 0;
      let totalExposure = 0;
      let totalPnl = 0;

      report.eligible.forEach(target => {
        const balanceBefore = App.realBalance(target.id);
        const margin = Math.min(balanceBefore, App.aiAllowedAmount(target));
        if (!margin || margin <= 0) {
          report.skipped.push({ userId: target.id, reason: "No AI trade pool available" });
          report.reasons.noPool += 1;
          return;
        }

        const exposure = margin * leverage;
        let pnl = exposure * resultPercent / 100;
        if (resultType === "LOSS") pnl = -Math.min(balanceBefore, pnl);
        if (balanceBefore + pnl < 0) pnl = -balanceBefore;

        const tradeId = App.uid("ai_trd");
        const trade = {
          id: tradeId,
          batchId,
          userId: target.id,
          tradeType: "AI_AUTO",
          accountType: "REAL",
          market,
          pair,
          side,
          entryPrice: Number(priceRow.price || 0),
          entryPriceDisplay: priceRow.display || String(priceRow.price || ""),
          priceSource: priceRow.source || "Live API",
          priceSourceType: priceRow.sourceType || "LIVE_API",
          priceLockedAt: priceRow.fetchedAt || new Date().toISOString(),
          leverage,
          marginAmount: Number(margin.toFixed(2)),
          positionSize: Number(exposure.toFixed(2)),
          resultType,
          resultPercent,
          pnl: Number(pnl.toFixed(2)),
          status: "CLOSED",
          source: "ADMIN_AI_TRADING_DESK",
          note,
          balanceBefore: Number(balanceBefore.toFixed(2)),
          balanceAfter: Number((balanceBefore + pnl).toFixed(2)),
          aiPercent: Number(target.aiTradePercent || 25),
          createdAt: new Date().toISOString(),
          createdDate: App.todayKey()
        };

        App.state.trades.unshift(trade);
        if (trade.pnl !== 0) {
          App.addLedger({
            userId: target.id,
            accountType: "REAL",
            type: trade.pnl >= 0 ? "AI_TRADE_PROFIT" : "AI_TRADE_LOSS",
            amount: trade.pnl,
            referenceId: trade.id,
            note: `${pair} ${side} AI auto trade · ${resultType} ${resultPercent}% · ${leverage}x`
          });
        }
        App.addNotification?.({ audience: "USER", userId: target.id, title: "Instant AI trade completed", message: `${pair} ${side} ${resultType}. P/L ${trade.pnl >= 0 ? "+" : ""}${App.money(trade.pnl)}.`, type: "AI", linkPage: "orders", referenceId: `instant_${trade.id}` });
        appliedCount += 1;
        totalMargin += margin;
        totalExposure += exposure;
        totalPnl += trade.pnl;
      });

      if (!App.state.aiTradeBatches) App.state.aiTradeBatches = [];
      App.state.aiTradeBatches.unshift({
        id: batchId,
        market,
        pair,
        side,
        entryPrice: Number(priceRow.price || 0),
        entryPriceDisplay: priceRow.display || String(priceRow.price || ""),
        priceSource: priceRow.source || "Live API",
        priceSourceType: priceRow.sourceType || "LIVE_API",
        priceLockedAt: priceRow.fetchedAt || new Date().toISOString(),
        leverage,
        resultType,
        resultPercent,
        minBalance,
        note,
        totalMargin: Number(totalMargin.toFixed(2)),
        totalExposure: Number(totalExposure.toFixed(2)),
        appliedCount,
        skippedCount: report.skipped.length,
        skipReasons: report.reasons,
        totalPnl: Number(totalPnl.toFixed(2)),
        createdAt: new Date().toISOString()
      });
      App.addNotification?.({ audience: "ADMIN", title: "Instant AI trade applied", message: `${pair} ${side} applied to ${appliedCount} user(s). Total P/L ${totalPnl >= 0 ? "+" : ""}${App.money(totalPnl)}.`, type: "AI", linkPage: "instantAi", referenceId: batchId });
      App.saveState();
      App.toast(appliedCount ? `AI trade applied to ${appliedCount} valid user(s). ${report.skipped.length} skipped.` : "No valid AI users found. Trade was not applied.");
      render();
    },

    updateAiLivePreview() {
      const leverage = normalizeAdminLeverage(inputValue("aiLiveLeverage") || 1);
      const minBalance = Math.max(0, Number(inputValue("aiLiveMinBalance") || 0));
      const targetType = document.querySelector('input[name="aiLiveTargetType"]:checked')?.value || "PROFIT";
      const targetPercent = Math.max(0, Number(inputValue("aiLiveTargetPercent") || 0));
      const stats = aiLivePreviewStats(leverage, minBalance);
      const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
      setText("aiLivePreviewValid", stats.report.eligible.length);
      setText("aiLivePreviewSkipped", stats.report.skipped.length);
      setText("aiLivePreviewMargin", App.money(stats.totalMargin));
      setText("aiLivePreviewExposure", App.money(stats.totalExposure));
      setText("aiLivePreviewTarget", `${targetType === "LOSS" ? "Loss" : "Profit"} ${targetPercent}%`);
      setText("aiLivePreviewDuration", "Target/Admin");
      setText("aiLivePreviewLimitCheck", stats.report.reasons.limit ? `${stats.report.reasons.limit} blocked` : "Passed");
      setText("aiLivePreviewWalletCheck", (stats.report.reasons.lowBalance || stats.report.reasons.noPool) ? "Needs review" : "Passed");
    },
    async openLiveAiPosition(event) {
      event.preventDefault();
      const selectedPairData = pairDataByPair(inputValue("aiLivePair") || "BTC/USDT");
      const market = selectedPairData.market || "CRYPTO";
      const pair = String(selectedPairData.pair || "BTC/USDT").toUpperCase();
      if (market !== "CRYPTO") {
        App.toast("Live AI Position currently supports crypto pairs only.");
        return;
      }
      const side = document.querySelector('input[name="aiLiveSide"]:checked')?.value || "BUY";
      const leverage = normalizeAdminLeverage(inputValue("aiLiveLeverage") || 1);
      const targetType = document.querySelector('input[name="aiLiveTargetType"]:checked')?.value || "PROFIT";
      const targetPercent = Math.max(0.01, Number(inputValue("aiLiveTargetPercent") || 0));
      const minBalance = Math.max(0, Number(inputValue("aiLiveMinBalance") || 0));
      const note = inputValue("aiLiveNote") || "AI live position opened";
      let priceRow;
      try {
        priceRow = await App.getLivePairPrice(pair);
      } catch (error) {
        priceRow = App.getCachedPairPrice ? App.getCachedPairPrice(pair) : null;
      }
      const entryPrice = Number(priceRow?.price || 0);
      if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
        App.toast("Live entry price unavailable. AI live position not opened.");
        return;
      }
      const batchId = App.uid("ai_live_batch");
      const report = aiEligibilityReport(minBalance);
      let appliedCount = 0;
      let totalMargin = 0;
      let totalExposure = 0;
      const openedAt = new Date().toISOString();
      report.eligible.forEach(target => {
        const balanceBefore = App.realBalance(target.id);
        const margin = Math.min(balanceBefore, App.aiAllowedAmount(target));
        if (!margin || margin <= 0) {
          report.skipped.push({ userId: target.id, reason: "No AI trade pool available" });
          report.reasons.noPool += 1;
          return;
        }
        const exposure = margin * leverage;
        const positionId = App.uid("ai_live");
        const position = {
          id: positionId,
          batchId,
          userId: target.id,
          tradeType: "AI_LIVE",
          accountType: "REAL",
          market,
          pair,
          side,
          entryPrice,
          entryPriceDisplay: priceRow?.display || String(entryPrice),
          priceSource: priceRow?.source || "Live Market",
          priceSourceType: priceRow?.sourceType || "LIVE_MARKET",
          priceLockedAt: priceRow?.fetchedAt || openedAt,
          leverage,
          marginAmount: Number(margin.toFixed(2)),
          marginLocked: true,
          positionSize: Number(exposure.toFixed(2)),
          targetType,
          targetPercent,
          status: "OPEN",
          source: "ADMIN_AI_LIVE_POSITION",
          note,
          aiPercent: Number(target.aiTradePercent || 75),
          openedAt,
          createdAt: openedAt,
          createdDate: App.todayKey(),
          balanceBefore: Number(balanceBefore.toFixed(2))
        };
        try {
          lockAiLiveMargin(position, balanceBefore);
        } catch (error) {
          report.skipped.push({ userId: target.id, reason: error.message || "Insufficient wallet balance" });
          report.reasons.noPool += 1;
          return;
        }
        App.state.trades.unshift(position);
        App.addNotification?.({ audience: "USER", userId: target.id, title: "AI live position opened", message: `${pair} ${side} opened with ${App.money(position.marginAmount)} AI amount at ${leverage}x.`, type: "AI", linkPage: "orders", referenceId: `live_open_${position.id}` });
        appliedCount += 1;
        totalMargin += margin;
        totalExposure += exposure;
      });
      if (!App.state.aiLiveBatches) App.state.aiLiveBatches = [];
      App.state.aiLiveBatches.unshift({
        id: batchId,
        market,
        pair,
        side,
        entryPrice,
        entryPriceDisplay: priceRow?.display || String(entryPrice),
        priceSource: priceRow?.source || "Live Market",
        leverage,
        targetType,
        targetPercent,
        minBalance,
        note,
        appliedCount,
        skippedCount: report.skipped.length,
        skipReasons: report.reasons,
        totalMargin: Number(totalMargin.toFixed(2)),
        totalExposure: Number(totalExposure.toFixed(2)),
        status: "OPEN",
        createdAt: openedAt
      });
      App.addNotification?.({ audience: "ADMIN", title: "Live AI position opened", message: `${pair} ${side} opened for ${appliedCount} user(s). Locked ${App.money(totalMargin)}.`, type: "AI", linkPage: "liveAi", referenceId: batchId });
      App.saveState();
      App.toast(appliedCount ? `Live AI position opened for ${appliedCount} valid user(s).` : "No valid AI users found. Live position not opened.");
      render();
    },
    closeAiLiveBatch(batchId, button) {
      const positions = aiLivePositions().filter(position => (position.batchId || position.id) === batchId);
      if (!positions.length) {
        App.toast("No open AI live positions found.");
        render();
        return;
      }
      if (!confirm(`Close this AI live trade for ${positions.length} user(s)? Current profit/loss will be settled in real wallet.`)) return;
      markButton(button, "Closing...");
      let closed = 0;
      positions.forEach(position => {
        try { if (settleAiLivePositionByAdmin(position, "ADMIN_CLOSE")) closed += 1; } catch (error) {}
      });
      const batch = (App.state.aiLiveBatches || []).find(row => row.id === batchId);
      if (batch) {
        batch.status = "CLOSED";
        batch.closedAt = new Date().toISOString();
        batch.closeReason = "ADMIN_CLOSE";
      }
      App.saveState();
      App.toast(closed ? `Closed AI live trade for ${closed} user(s).` : "Unable to close trade.");
      render();
    },
    approveDeposit(userId, requestId, button) {
      const target = allUsers().find(u => u.id === userId);
      if (!target) return;
      const requests = depositRequestsFor(target);
      const request = requests.find(r => r.id === requestId);
      if (!request) return;
      if (String(request.status || "").toUpperCase() !== "PENDING") {
        App.toast("Deposit action already completed.");
        render();
        return;
      }
      const amount = Number(request.amount || 0);
      if (!amount || amount <= 0) {
        App.toast("Invalid deposit amount.");
        render();
        return;
      }
      const duplicate = depositUtrDuplicateInfo(request);
      if (duplicate?.approved) {
        App.toast("Duplicate approved UTR found. Approval blocked for safety.");
        render();
        return;
      }
      const ledgerExists = App.hasLedgerEntry?.({ accountType: "REAL", type: "DEPOSIT", referenceId: request.id, userId: target.id });
      if (!ledgerExists && !confirm(`Approve ${App.money(amount)} deposit for ${displayNameFor(target)}? Wallet will be credited once.`)) return;
      markButton(button, "Approving...");

      try {
        let ledgerAdded = true;
        if (!ledgerExists) {
          ledgerAdded = App.addLedger({
            userId: target.id,
            accountType: "REAL",
            type: "DEPOSIT",
            amount,
            referenceId: request.id,
            note: `DEPOSIT_APPROVED · UTR ${request.utr || "-"}`
          });
        }
        request.status = "APPROVED";
        request.approvedAt = new Date().toISOString();
        request.reviewedAt = request.approvedAt;
        request.rejectReason = "";
        request.balanceApplied = true;
        request.adminNote = duplicate?.total ? `Checked duplicate UTR warning: ${duplicate.total} similar request(s).` : "Approved by admin.";
        saveDepositRequests(target, requests);
        App.addNotification?.({ audience: "USER", userId: target.id, title: "Deposit approved", message: `${App.money(amount)} deposit approved and credited to your wallet.`, type: "DEPOSIT", linkPage: "wallet", referenceId: `dep_ok_${request.id}` });
        if (ledgerAdded && !ledgerExists) {
          App.creditReferralBonus?.({ referredUserId: target.id, eventType: "DEPOSIT", amount, referenceId: request.id, sourceLabel: `Deposit UTR ${request.utr || "-"}` });
        }
        App.toast(ledgerExists ? "Deposit marked approved. Ledger was already applied." : "Deposit approved and balance credited.");
      } catch (err) {
        App.toast(err.message || "Unable to approve deposit.");
      }
      render();
    },
    rejectDeposit(userId, requestId, button) {
      const target = allUsers().find(u => u.id === userId);
      if (!target) return;
      const requests = depositRequestsFor(target);
      const request = requests.find(r => r.id === requestId);
      if (!request) return;
      if (String(request.status || "").toUpperCase() !== "PENDING") {
        App.toast("Deposit action already completed.");
        render();
        return;
      }
      const reason = prompt("Reject reason:", "Payment proof / UTR could not be verified.");
      if (reason === null) return;
      markButton(button, "Rejecting...");
      request.status = "REJECTED";
      request.rejectReason = reason || "Deposit rejected by admin.";
      request.rejectedAt = new Date().toISOString();
      request.reviewedAt = request.rejectedAt;
      request.balanceApplied = false;
      request.adminNote = request.rejectReason;
      saveDepositRequests(target, requests);
      App.addNotification?.({ audience: "USER", userId: target.id, title: "Deposit rejected", message: request.rejectReason, type: "DEPOSIT", linkPage: "wallet", referenceId: `dep_no_${request.id}` });
      App.toast("Deposit rejected.");
      render();
    },
    approveWithdrawal(userId, requestId, button) {
      const target = allUsers().find(u => u.id === userId);
      if (!target) return;
      const requests = withdrawalRequestsFor(target);
      const request = requests.find(r => r.id === requestId);
      if (!request) return;
      if (String(request.status || "").toUpperCase() !== "PENDING") {
        App.toast("Withdrawal action already completed.");
        render();
        return;
      }

      const amount = Number(request.amount || 0);
      if (!amount || amount <= 0) {
        App.toast("Invalid withdrawal amount.");
        render();
        return;
      }
      const ledgerExists = App.hasLedgerEntry?.({ accountType: "REAL", type: "WITHDRAWAL", referenceId: request.id, userId: target.id });
      if (!ledgerExists && App.realBalance(target.id) < amount) {
        App.toast("Insufficient real balance for withdrawal.");
        render();
        return;
      }
      if (!ledgerExists && !confirm(`Approve ${App.money(amount)} withdrawal for ${displayNameFor(target)}? Wallet will be debited once.`)) return;
      markButton(button, "Approving...");

      try {
        if (!ledgerExists) {
          App.addLedger({
            userId: target.id,
            accountType: "REAL",
            type: "WITHDRAWAL",
            amount: -amount,
            referenceId: request.id,
            note: "WITHDRAWAL_APPROVED · Admin payout confirmed"
          });
        }
        request.status = "APPROVED";
        request.approvedAt = new Date().toISOString();
        request.reviewedAt = request.approvedAt;
        request.rejectReason = "";
        request.balanceApplied = true;
        request.adminNote = "Approved payout by admin.";
        saveWithdrawalRequests(target, requests);
        App.addNotification?.({ audience: "USER", userId: target.id, title: "Withdrawal approved", message: `${App.money(amount)} withdrawal payout approved.`, type: "WITHDRAWAL", linkPage: "wallet", referenceId: `wd_ok_${request.id}` });
        App.toast(ledgerExists ? "Withdrawal marked approved. Ledger was already applied." : "Withdrawal approved and balance debited.");
      } catch (err) {
        App.toast(err.message || "Unable to approve withdrawal.");
      }
      render();
    },
    rejectWithdrawal(userId, requestId, button) {
      const target = allUsers().find(u => u.id === userId);
      if (!target) return;
      const requests = withdrawalRequestsFor(target);
      const request = requests.find(r => r.id === requestId);
      if (!request) return;
      if (String(request.status || "").toUpperCase() !== "PENDING") {
        App.toast("Withdrawal action already completed.");
        render();
        return;
      }
      const reason = prompt("Reject reason:", "Withdrawal details could not be verified.");
      if (reason === null) return;
      markButton(button, "Rejecting...");
      request.status = "REJECTED";
      request.rejectReason = reason || "Withdrawal rejected by admin.";
      request.rejectedAt = new Date().toISOString();
      request.reviewedAt = request.rejectedAt;
      request.balanceApplied = false;
      request.adminNote = request.rejectReason;
      saveWithdrawalRequests(target, requests);
      App.addNotification?.({ audience: "USER", userId: target.id, title: "Withdrawal rejected", message: request.rejectReason, type: "WITHDRAWAL", linkPage: "wallet", referenceId: `wd_no_${request.id}` });
      App.toast("Withdrawal rejected.");
      render();
    },
    approveKyc(userId, button) {
      markButton(button, "Approving...");
      const target = allUsers().find(u => u.id === userId);
      if (!target) return;
      const kyc = kycFor(target);
      if (kyc.status !== "PENDING") {
        App.toast("KYC action already completed.");
        render();
        return;
      }
      kyc.status = "APPROVED";
      kyc.rejectReason = "";
      kyc.approvedAt = new Date().toISOString();
      kyc.rejectedAt = "";
      saveKyc(target, kyc);
      App.toast("KYC approved successfully.");
      render();
    },
    rejectKyc(userId, button) {
      const box = document.getElementById(`kycRejectBox-${userId}`);
      if (box) {
        box.hidden = !box.hidden;
        return;
      }
      App.toast("Reject panel unavailable.");
    },
    confirmRejectKyc(userId, button) {
      const target = allUsers().find(u => u.id === userId);
      if (!target) return;
      const kyc = kycFor(target);
      if (kyc.status !== "PENDING") {
        App.toast("KYC action already completed.");
        render();
        return;
      }
      const reason = document.getElementById(`kycRejectReason-${userId}`)?.value || "";
      const note = document.getElementById(`kycRejectOther-${userId}`)?.value?.trim() || "";
      if (!reason) {
        App.toast("Select reject reason.");
        return;
      }
      markButton(button, "Rejecting...");
      kyc.status = "REJECTED";
      kyc.rejectReason = note ? `${reason}: ${note}` : reason;
      kyc.rejectedAt = new Date().toISOString();
      kyc.approvedAt = "";
      saveKyc(target, kyc);
      App.toast("KYC rejected successfully.");
      render();
    },
    approvePaymentMethod(userId, methodId, button) {
      markButton(button, "Approving...");
      const target = allUsers().find(u => u.id === userId);
      if (!target) return;
      const methods = paymentMethodsFor(target);
      const method = methods.find(m => m.id === methodId);
      if (!method) return;
      if (method.status !== "PENDING") {
        App.toast("Payment method action already completed.");
        render();
        return;
      }
      method.status = "APPROVED";
      method.rejectReason = "";
      method.approvedAt = new Date().toISOString();
      method.rejectedAt = "";
      savePaymentMethods(target, methods);
      App.toast("Payment method approved successfully.");
      render();
    },
    rejectPaymentMethod(userId, methodId, button) {
      const target = allUsers().find(u => u.id === userId);
      if (!target) return;
      const methods = paymentMethodsFor(target);
      const method = methods.find(m => m.id === methodId);
      if (!method) return;
      if (method.status !== "PENDING") {
        App.toast("Payment method action already completed.");
        render();
        return;
      }
      const reason = prompt("Reject reason:", "Holder name does not match KYC.");
      if (reason === null) return;
      markButton(button, "Rejecting...");
      method.status = "REJECTED";
      method.rejectReason = reason || "Rejected by admin.";
      method.rejectedAt = new Date().toISOString();
      method.approvedAt = "";
      savePaymentMethods(target, methods);
      App.toast("Payment method rejected successfully.");
      render();
    },
    deletePaymentMethod(userId, methodId, button) {
      const target = allUsers().find(u => u.id === userId);
      if (!target) return;
      const methods = paymentMethodsFor(target);
      const method = methods.find(m => m.id === methodId);
      if (!method) return;

      const label = method.type === "UPI" ? method.upiId : `${method.bankName} ****${String(method.accountNumber || "").slice(-4)}`;
      if (!confirm(`Delete this payment method?\n${label}`)) return;

      markButton(button, "Deleting...");
      const next = methods.filter(m => m.id !== methodId);
      savePaymentMethods(target, next);
      App.toast("Payment method deleted.");
      render();
    }
  };

  render();
})();