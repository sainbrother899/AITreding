(()=>{
const C=window.AITRADEX_CONFIG||{},has=!!(C.SUPABASE_URL&&C.SUPABASE_ANON_KEY&&window.supabase);
const db=has?window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY):null;
const SK="AITradeX_STATE_V1",SS="AITradeX_SESSION_V1";
const now=()=>new Date().toLocaleString("en-IN");
const uid=(p="id")=>`${p}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
const money=n=>"₹"+Number(n||0).toLocaleString("en-IN");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
function initial(){return{users:[{id:"control_root",name:"AITradeX Control",email:"control@aitradex.com",password:"admin123",role:"admin",status:"ACTIVE",createdAt:now()}],profiles:[],kycRequests:[],paymentMethods:[],depositRequests:[],withdrawalRequests:[],walletLedger:[],demoLedger:[],trades:[],plans:[{id:"free",name:"Free",price:0,signals:5,aiAccess:"Basic",tradeLimit:0},{id:"starter",name:"Starter",price:999,signals:25,aiAccess:"Signals",tradeLimit:10000},{id:"pro",name:"Pro",price:2999,signals:100,aiAccess:"AI Assisted",tradeLimit:50000},{id:"premium",name:"Premium",price:9999,signals:500,aiAccess:"Priority AI",tradeLimit:200000}],subscriptions:[],referrals:[],settings:{minDeposit:Number(C.MIN_DEPOSIT||500),minWithdrawal:Number(C.MIN_WITHDRAWAL||2000),referralFirstDepositPercent:Number(C.REFERRAL_FIRST_DEPOSIT_PERCENT||10),demoBalance:Number(C.DEMO_BALANCE||100000),platformName:"AITradeX"}}}
const load=()=>{try{return JSON.parse(localStorage.getItem(SK)||"null")||initial()}catch{return initial()}};
const loadSession=()=>{try{return JSON.parse(localStorage.getItem(SS)||"null")}catch{return null}};
const App={config:C,db,state:load(),session:loadSession(),now,uid,money,escapeHtml:esc};
App.saveState=()=>localStorage.setItem(SK,JSON.stringify(App.state));
App.setSession=(userId,role)=>{App.session={userId,role,savedAt:Date.now()};localStorage.setItem(SS,JSON.stringify(App.session))};
App.clearSession=()=>{App.session=null;localStorage.removeItem(SS)};
App.currentUser=()=>App.state.users.find(u=>u.id===App.session?.userId)||null;
App.realBalance=id=>App.state.walletLedger.filter(x=>x.userId===id).reduce((s,x)=>s+Number(x.amount||0),0);
App.demoBalance=id=>{const rows=App.state.demoLedger.filter(x=>x.userId===id);return rows.reduce((s,x)=>s+Number(x.amount||0),Number(App.state.settings.demoBalance||100000))};
App.pendingDeposit=id=>App.state.depositRequests.filter(x=>x.userId===id&&x.status==="PENDING").reduce((s,x)=>s+Number(x.amount||0),0);
App.pendingWithdrawal=id=>App.state.withdrawalRequests.filter(x=>x.userId===id&&x.status==="PENDING").reduce((s,x)=>s+Number(x.amount||0),0);
App.kycStatus=id=>([...App.state.kycRequests].reverse().find(x=>x.userId===id)?.status)||"NOT_SUBMITTED";
App.activeSubscription=id=>App.state.subscriptions.filter(x=>x.userId===id&&x.status==="ACTIVE").sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0]||null;
App.addLedger=({userId,accountType="REAL",type,amount,referenceId,note=""})=>{const list=accountType==="DEMO"?App.state.demoLedger:App.state.walletLedger;if(list.some(x=>x.type===type&&x.referenceId===referenceId))return false;const before=accountType==="DEMO"?App.demoBalance(userId):App.realBalance(userId),after=before+Number(amount||0);if(after<0)throw new Error("Insufficient balance");list.push({id:uid("ledger"),userId,accountType,type,amount:Number(amount||0),referenceId,note,balanceAfter:after,createdAt:now()});App.saveState();return true};
App.toast=m=>{let e=document.querySelector(".toast");if(e)e.remove();e=document.createElement("div");e.className="toast";e.textContent=m;document.body.appendChild(e);setTimeout(()=>e.classList.add("show"),10);setTimeout(()=>{e.classList.remove("show");setTimeout(()=>e.remove(),250)},2600)};
App.saveState();window.AITradeX=App;
})();