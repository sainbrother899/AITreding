const CONFIG = window.APP_CONFIG || {};
const STORAGE_KEY = "ai_trading_pro_v3";
let supabaseClient = null;

if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY && window.supabase) {
  supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
}

const defaultState = {
  user: null,
  users: [
    { id: "admin-local", name: "Admin", email: CONFIG.ADMIN_EMAIL || "admin@aitrade.local", mobile: "", password: CONFIG.ADMIN_PASSWORD || "admin123", role: "admin", plan: "Elite", referralCode: "ADMINAI", referredBy: "" }
  ],
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
let marketCache = [];

function loadState(){try{return {...defaultState,...JSON.parse(localStorage.getItem(STORAGE_KEY))}}catch{return {...defaultState}}}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function $(id){return document.getElementById(id)}
function money(v){return "$"+Number(v||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
function rupee(v){return "₹"+Number(v||0).toLocaleString("en-IN")}
function toast(msg){const el=$("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600)}
function makeReferralCode(name){return (name||"USER").replace(/[^a-z0-9]/gi,"").slice(0,5).toUpperCase()+Math.floor(1000+Math.random()*9000)}

async function register(){
  const name=$("regName").value.trim(), email=$("regEmail").value.trim().toLowerCase(), mobile=$("regMobile").value.trim(), password=$("regPassword").value, referredBy=$("regReferral").value.trim().toUpperCase();
  if(!name||!email||!mobile||!password){toast("All register fields required.");return}
  if(state.users.some(u=>u.email===email)){toast("Email already registered.");return}
  const user={id:"u_"+Date.now(),name,email,mobile,password,role:"user",plan:"Free",referralCode:makeReferralCode(name),referredBy};
  state.users.push(user);
  if(referredBy){state.referrals.push({code:referredBy,userEmail:email,bonus:50,status:"JOINED"})}
  state.user={...user,password:undefined};
  saveState();
  await saveProfileToSupabase(user);
  showApp();
  toast("Account created.");
}

async function login(){
  const email=$("loginEmail").value.trim().toLowerCase(), password=$("loginPassword").value;
  const user=state.users.find(u=>u.email===email&&u.password===password);
  if(!user){toast("Invalid login details.");return}
  state.user={...user,password:undefined};
  saveState();showApp();toast("Logged in.");
}

function guestLogin(){
  let user=state.users.find(u=>u.email==="demo@user.local");
  if(!user){user={id:"guest",name:"Demo User",email:"demo@user.local",mobile:"",password:"demo",role:"user",plan:"Free",referralCode:"DEMO1234",referredBy:""};state.users.push(user)}
  state.user={...user,password:undefined};saveState();showApp();toast("Demo user started.");
}

function logout(){state.user=null;saveState();$("authPage").classList.remove("hidden");$("appPage").classList.add("hidden");$("logoutBtn").classList.add("hidden");$("userBadge").textContent="Guest"}

async function saveProfileToSupabase(user){
  if(!supabaseClient) return;
  try{
    await supabaseClient.from("profiles").upsert({id:user.id,name:user.name,email:user.email,mobile:user.mobile,role:user.role,plan:user.plan,referral_code:user.referralCode,referred_by:user.referredBy});
  }catch(e){console.warn("Supabase profile save failed",e)}
}

function showApp(){
  $("authPage").classList.add("hidden");$("appPage").classList.remove("hidden");$("logoutBtn").classList.remove("hidden");
  $("userBadge").textContent=(state.user?.role==="admin"?"Admin: ":"User: ")+(state.user?.name||"");
  $("adminNavBtn").classList.toggle("hidden",state.user?.role!=="admin");
  $("myReferralCode").textContent=state.user?.referralCode||"----";
  showPage("dashboard");render();setTimeout(initTradingViewChart,100);
}

function showAuthTab(tab){
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.authTab===tab));
  $("loginForm").classList.toggle("active-form",tab==="login");$("registerForm").classList.toggle("active-form",tab==="register");
}

function showPage(page){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active-page"));$(page).classList.add("active-page");
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  render();
}

function getCurrentUserFull(){return state.users.find(u=>u.id===state.user?.id)||state.user}
function getPlan(){return getCurrentUserFull()?.plan||"Free"}
function signalLimit(){const p=getPlan(); if(p==="Elite")return "∞"; if(p==="Pro")return 50; return Number(state.freeSignalLimit||5)}
function numericSignalLimit(){const l=signalLimit();return l==="∞"?999999:Number(l)}

function render(){
  if(!state.user) return;
  $("walletBalance").textContent=money(state.mode==="DEMO"?state.demoBalance:state.realBalance);
  $("demoBtn").classList.toggle("active",state.mode==="DEMO");$("realBtn").classList.toggle("active",state.mode==="REAL");
  $("signalCounter").textContent=state.signalsUsed;$("signalLimitText").textContent=signalLimit();$("planText").textContent=getPlan();
  $("signalBox").className="signal-box "+state.signal.toLowerCase();
  $("aiSignalText").textContent=state.signal==="WAIT"?"WAIT / NO TRADE":`${state.signal} BTC NOW`;
  $("signalNote").textContent=state.note;
  $("adminSignal").value=state.signal;$("adminNote").value=state.note;$("adminFreeLimit").value=state.freeSignalLimit;
  renderTickers();renderTrades();renderPayments();renderAnalytics();renderReferral();
}

async function fetchRealPrices(){
  try{
    const symbols=["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT"];
    const res=await fetch("https://api.binance.com/api/v3/ticker/24hr?symbols="+encodeURIComponent(JSON.stringify(symbols)));
    const data=await res.json();
    data.forEach(x=>state.prices[x.symbol]={price:Number(x.lastPrice),change:Number(x.priceChangePercent)});
    saveState();marketCache=data;runIndicatorEngine();render();
  }catch(e){console.warn(e);runIndicatorEngine();render()}
}

function renderTickers(){
  const coins=["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT"];
  $("tickerGrid").innerHTML=coins.map(s=>{
    const p=state.prices[s]||{price:0,change:0};
    return `<div class="ticker"><h3>${s.replace("USDT","/USDT")}</h3><strong>${money(p.price)}</strong><p class="${p.change>=0?'up':'down'}">${p.change>=0?'+':''}${p.change.toFixed(2)}%</p></div>`
  }).join("");
}

function runIndicatorEngine(){
  const btc=state.prices.BTCUSDT || {price:0,change:0};
  let signal="WAIT", confidence=50, reason="Market neutral. Wait for better confirmation.";
  if(btc.change>1.2){signal="BUY";confidence=Math.min(92,65+btc.change*6);reason="BTC 24h momentum positive. Engine suggests BUY bias."}
  else if(btc.change<-1.2){signal="SELL";confidence=Math.min(92,65+Math.abs(btc.change)*6);reason="BTC 24h momentum negative. Engine suggests SELL/avoid long."}
  if(state.signal!=="WAIT") signal=state.signal;
  $("engineSignal").textContent=signal+" SIGNAL";
  $("engineConfidence").textContent=Math.round(confidence)+"%";
  $("confidenceMeter").style.width=Math.round(confidence)+"%";
  $("engineReason").textContent=reason;
}

function executeTrade(){
  if(state.signalsUsed>=numericSignalLimit()){toast("Signal limit complete. Upgrade plan.");showPage("subscription");return}
  if(state.signal==="WAIT"){toast("Signal is WAIT. Trade not added.");return}
  const amount=Number($("tradeAmountInput").value);
  const bal=state.mode==="DEMO"?state.demoBalance:state.realBalance;
  if(!amount||amount<=0||amount>bal){toast("Invalid amount or insufficient balance.");return}
  const entry=state.prices.BTCUSDT?.price || 65000;
  if(state.mode==="DEMO")state.demoBalance-=amount;else state.realBalance-=amount;
  state.signalsUsed++;
  state.trades.unshift({id:"t_"+Date.now(),coin:"BTCUSDT",side:state.signal,amount,entry,current:entry,pnl:0,status:"RUNNING",time:new Date().toLocaleString()});
  saveTradeToSupabase(state.trades[0]);saveState();render();toast("Trade added.");
}

async function saveTradeToSupabase(trade){if(!supabaseClient||!state.user)return;try{await supabaseClient.from("trades").insert({user_id:state.user.id,coin:trade.coin,side:trade.side,amount:trade.amount,entry_price:trade.entry,current_price:trade.current,pnl:trade.pnl,status:trade.status})}catch(e){console.warn(e)}}

function renderTrades(){
  const btc=state.prices.BTCUSDT?.price || 0;
  state.trades.forEach(t=>{ if(t.coin==="BTCUSDT"&&btc){t.current=btc; const diff=t.side==="BUY"?(btc-t.entry):(t.entry-btc); t.pnl=(diff/t.entry)*t.amount; }});
  const rows=state.trades.map(t=>`<tr><td>${t.coin}</td><td class="${t.side==='BUY'?'buy-text':'sell-text'}">${t.side}</td><td>${money(t.amount)}</td><td>${money(t.entry)}</td><td>${money(t.current)}</td><td class="${t.pnl>=0?'pnl-plus':'pnl-minus'}">${t.pnl>=0?'+':''}${money(t.pnl)}</td><td>${t.status}</td></tr>`).join("");
  $("activeTradesLog").innerHTML=rows||`<tr><td colspan="7" class="empty">No trades yet.</td></tr>`;
  saveState();
}

function renderAnalytics(){
  const total=state.trades.length, pnl=state.trades.reduce((a,t)=>a+Number(t.pnl||0),0), wins=state.trades.filter(t=>t.pnl>0).length;
  $("totalTradesMetric").textContent=total;$("totalPnlMetric").textContent=money(pnl);$("totalPnlMetric").className=pnl>=0?"pnl-plus":"pnl-minus";$("winRateMetric").textContent=total?Math.round(wins/total*100)+"%":"0%";
  const myRef=state.user?.referralCode; const bonus=state.referrals.filter(r=>r.code===myRef).reduce((a,r)=>a+r.bonus,0);$("refBonusMetric").textContent=rupee(bonus);
  $("pnlBars").innerHTML=(state.trades.slice(0,8).map((t,i)=>`<div class="pnl-bar"><span>Trade ${i+1}</span><div class="pnl-track"><i class="${t.pnl<0?'loss':''}" style="width:${Math.min(100,Math.abs(t.pnl)*8+8)}%"></i></div><strong class="${t.pnl>=0?'pnl-plus':'pnl-minus'}">${money(t.pnl)}</strong></div>`).join("")||"<p class='muted'>No analytics data yet.</p>");
}

function renderReferral(){
  const code=state.user?.referralCode; const refs=state.referrals.filter(r=>r.code===code); const bonus=refs.reduce((a,r)=>a+r.bonus,0);
  $("refCount").textContent=refs.length;$("refBonus").textContent=rupee(bonus);
}

function openPaymentModal(plan){state.selectedPaymentPlan=plan;saveState();$("paymentPlanTitle").textContent=`${plan} Subscription Manual Payment`;$("paymentModal").classList.add("show")}
function closePaymentModal(){$("paymentModal").classList.remove("show")}
function submitManualPayment(){
  const name=$("payerName").value.trim(), mobile=$("payerMobile").value.trim(), txn=$("transactionId").value.trim(), file=$("paymentScreenshot").files[0];
  if(!name||!mobile||!txn){toast("Name, mobile and UTR required.");return}
  state.paymentRequests.unshift({id:"p_"+Date.now(),userId:state.user.id,plan:state.selectedPaymentPlan,name,mobile,txn,screenshot:file?file.name:"Not uploaded",status:"PENDING"});
  saveState();render();closePaymentModal();toast("Payment request submitted.");
}

function renderPayments(){
  const tbody=$("paymentRequestsLog"); if(!tbody) return;
  if(state.user?.role!=="admin"){return}
  tbody.innerHTML=state.paymentRequests.map(p=>`<tr><td>${p.plan}</td><td>${p.name}</td><td>${p.mobile}</td><td>${p.txn}</td><td>${p.status==="PENDING"?`<button class="ghost-btn" onclick="approvePayment('${p.id}')">Approve</button>`:p.status}</td></tr>`).join("")||`<tr><td colspan="5" class="empty">No payment requests.</td></tr>`;
}

function approvePayment(id){
  const req=state.paymentRequests.find(p=>p.id===id); if(!req)return;
  req.status="APPROVED";
  const user=state.users.find(u=>u.id===req.userId); if(user){user.plan=req.plan;if(state.user.id===user.id)state.user.plan=req.plan}
  saveState();render();toast("Payment approved and plan activated.");
}

function saveAdminSettings(){state.signal=$("adminSignal").value;state.note=$("adminNote").value.trim()||"Admin signal updated.";state.freeSignalLimit=Math.max(1,Number($("adminFreeLimit").value||5));saveState();render();showPage("dashboard");toast("Admin signal saved.")}
function copyReferral(){const link=location.origin+location.pathname+"?ref="+(state.user?.referralCode||"");navigator.clipboard?.writeText(link);toast("Referral link copied.");}
function initReferralFromUrl(){const ref=new URLSearchParams(location.search).get("ref");if(ref)$("regReferral").value=ref.toUpperCase()}

function initTradingViewChart(){
  if(typeof TradingView==="undefined")return;
  const el=$("crypto_live_chart"); if(!el || el.dataset.loaded) return; el.dataset.loaded="1";
  new TradingView.widget({autosize:true,symbol:"BINANCE:BTCUSDT",interval:"5",timezone:"Asia/Kolkata",theme:"dark",style:"1",locale:"en",enable_publishing:false,hide_side_toolbar:false,allow_symbol_change:true,container_id:"crypto_live_chart"});
}

function bind(){
  document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>showAuthTab(b.dataset.authTab)));
  $("registerBtn").addEventListener("click",register);$("loginBtn").addEventListener("click",login);$("guestBtn").addEventListener("click",guestLogin);$("logoutBtn").addEventListener("click",logout);
  document.querySelectorAll(".nav-btn").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
  $("demoBtn").addEventListener("click",()=>{state.mode="DEMO";saveState();render()});$("realBtn").addEventListener("click",()=>{state.mode="REAL";saveState();render();toast("Real UI selected. Exchange API not connected.")});
  $("executeTradeBtn").addEventListener("click",executeTrade);$("clearTradesBtn").addEventListener("click",()=>{state.trades=[];saveState();render()});
  $("saveAdminBtn").addEventListener("click",saveAdminSettings);$("clearPaymentsBtn").addEventListener("click",()=>{state.paymentRequests=[];saveState();render()});
  document.querySelectorAll(".plan-btn").forEach(b=>b.addEventListener("click",()=>openPaymentModal(b.dataset.plan)));
  $("closePaymentModal").addEventListener("click",closePaymentModal);$("submitManualPayment").addEventListener("click",submitManualPayment);$("copyReferralBtn").addEventListener("click",copyReferral);
}

window.addEventListener("load",()=>{
  bind();initReferralFromUrl();
  if(state.user)showApp();
  fetchRealPrices();setInterval(fetchRealPrices,30000);
});
