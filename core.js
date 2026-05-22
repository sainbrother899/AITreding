(()=>{
const C=window.AITRADEX_CONFIG||{},has=!!(C.SUPABASE_URL&&C.SUPABASE_ANON_KEY&&window.supabase);
const db=has?window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY):null;
const SK="AITradeX_STATE_V1",SS="AITradeX_SESSION_V1";
const now=()=>new Date().toLocaleString("en-IN");
const uid=(p="id")=>`${p}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
const money=n=>"₹"+Number(n||0).toLocaleString("en-IN");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
function initial(){return{users:[{id:"control_root",name:"AITradeX Control",email:"control@aitradex.com",password:"admin123",role:"admin",status:"ACTIVE",createdAt:now()}],profiles:[],kycRequests:[],paymentMethods:[],depositRequests:[],withdrawalRequests:[],supportTickets:[],notifications:[],walletLedger:[],demoLedger:[],trades:[],aiTradeBatches:[],plans:[{id:"free",name:"Free Trial",price:0,signals:5,aiAccess:"Trial AI",durationDays:7,status:"ACTIVE",benefits:["5 AI auto trades per day for 7 days","1 AI auto trade per day after trial","Manual trading access","Live price cards"]},{id:"starter",name:"Standard",price:999,signals:15,aiAccess:"Standard AI",durationDays:30,status:"ACTIVE",benefits:["15 AI auto trades per day","Higher AI trading access","Priority dashboard visibility"]},{id:"pro",name:"Premium",price:2999,signals:50,aiAccess:"Premium AI",durationDays:30,status:"ACTIVE",benefits:["50 AI auto trades per day","Premium AI access","Faster plan priority"]},{id:"premium",name:"VIP",price:9999,signals:999999,aiAccess:"VIP Advanced AI",durationDays:30,status:"ACTIVE",benefits:["Unlimited AI auto trades per day","VIP advanced AI priority","Highest daily AI trades"]}],subscriptions:[],referrals:[],settings:{minDeposit:Number(C.MIN_DEPOSIT||500),minWithdrawal:Number(C.MIN_WITHDRAWAL||1000),referralFirstDepositPercent:Number(C.REFERRAL_FIRST_DEPOSIT_PERCENT||10),referralDepositPercent:Number(C.REFERRAL_DEPOSIT_PERCENT||10),referralSubscriptionPercent:Number(C.REFERRAL_SUBSCRIPTION_PERCENT||10),referralDepositEnabled:true,referralSubscriptionEnabled:true,demoBalance:Number(C.DEMO_BALANCE||100000),platformName:"AITradeX",depositUpiId:"aitradex@upi",depositQrImage:"",depositUpiEnabled:true,depositBankEnabled:true,depositBankName:"AITradeX Bank",depositAccountName:"AITradeX Private Wallet",depositAccountNumber:"123456789012",depositIfsc:"AITX0001234",freeAiTradesPerDay:5,postTrialFreeAiTradesPerDay:1,freeTrialDays:7,supportWhatsAppNumber:"919999999999",usdtInrRate:Number(C.USDT_INR_RATE||95)}}}
const load=()=>{try{return JSON.parse(localStorage.getItem(SK)||"null")||initial()}catch{return initial()}};
const loadSession=()=>{try{return JSON.parse(localStorage.getItem(SS)||"null")}catch{return null}};

const MARKET_PAIRS={
    CRYPTO: [
      { market: "CRYPTO", pair: "BTC/USDT", symbol: "BINANCE:BTCUSDT", price: "$76,737.55", inr: "₹64,15,894", change: "+2.84%", mood: "up", signal: "BUY" },
      { market: "CRYPTO", pair: "ETH/USDT", symbol: "BINANCE:ETHUSDT", price: "$2,111.72", inr: "₹1,76,434", change: "-1.04%", mood: "down", signal: "SELL" },
      { market: "CRYPTO", pair: "BNB/USDT", symbol: "BINANCE:BNBUSDT", price: "$639.82", inr: "₹53,484", change: "+0.42%", mood: "up", signal: "BUY" },
      { market: "CRYPTO", pair: "SOL/USDT", symbol: "BINANCE:SOLUSDT", price: "$184.46", inr: "₹15,415", change: "+1.20%", mood: "up", signal: "BUY" },
      { market: "CRYPTO", pair: "XRP/USDT", symbol: "BINANCE:XRPUSDT", price: "$2.47", inr: "₹206", change: "+0.62%", mood: "up", signal: "BUY" },
      { market: "CRYPTO", pair: "DOGE/USDT", symbol: "BINANCE:DOGEUSDT", price: "$0.1732", inr: "₹14.47", change: "-0.88%", mood: "down", signal: "SELL" },
      { market: "CRYPTO", pair: "ADA/USDT", symbol: "BINANCE:ADAUSDT", price: "$0.58", inr: "₹48.44", change: "+0.31%", mood: "up", signal: "WAIT" },
      { market: "CRYPTO", pair: "TRX/USDT", symbol: "BINANCE:TRXUSDT", price: "$0.124", inr: "₹10.36", change: "-0.22%", mood: "down", signal: "WAIT" },
      { market: "CRYPTO", pair: "AVAX/USDT", symbol: "BINANCE:AVAXUSDT", price: "$36.72", inr: "₹3,068", change: "+1.72%", mood: "up", signal: "BUY" },
      { market: "CRYPTO", pair: "LINK/USDT", symbol: "BINANCE:LINKUSDT", price: "$15.41", inr: "₹1,288", change: "-0.44%", mood: "down", signal: "SELL" }
    ],
    FOREX: [
      { market: "FOREX", pair: "EUR/USD", symbol: "FX:EURUSD", price: "1.0854", inr: "Euro vs Dollar", change: "+0.18%", mood: "up", signal: "BUY" },
      { market: "FOREX", pair: "GBP/USD", symbol: "FX:GBPUSD", price: "1.2712", inr: "Pound vs Dollar", change: "-0.11%", mood: "down", signal: "SELL" },
      { market: "FOREX", pair: "USD/JPY", symbol: "FX:USDJPY", price: "156.84", inr: "Dollar vs Yen", change: "+0.32%", mood: "up", signal: "BUY" },
      { market: "FOREX", pair: "USD/CHF", symbol: "FX:USDCHF", price: "0.9041", inr: "Dollar vs Franc", change: "-0.09%", mood: "down", signal: "SELL" },
      { market: "FOREX", pair: "USD/CAD", symbol: "FX:USDCAD", price: "1.3682", inr: "Dollar vs CAD", change: "+0.06%", mood: "up", signal: "WAIT" },
      { market: "FOREX", pair: "AUD/USD", symbol: "FX:AUDUSD", price: "0.6648", inr: "Aussie vs Dollar", change: "+0.14%", mood: "up", signal: "BUY" },
      { market: "FOREX", pair: "NZD/USD", symbol: "FX:NZDUSD", price: "0.6121", inr: "Kiwi vs Dollar", change: "-0.21%", mood: "down", signal: "SELL" },
      { market: "FOREX", pair: "USD/INR", symbol: "FX_IDC:USDINR", price: "83.42", inr: "Dollar vs Rupee", change: "+0.05%", mood: "up", signal: "WAIT" },
      { market: "FOREX", pair: "EUR/INR", symbol: "FX_IDC:EURINR", price: "90.52", inr: "Euro vs Rupee", change: "+0.16%", mood: "up", signal: "BUY" },
      { market: "FOREX", pair: "GBP/INR", symbol: "FX_IDC:GBPINR", price: "106.04", inr: "Pound vs Rupee", change: "-0.07%", mood: "down", signal: "WAIT" },
      { market: "FOREX", pair: "XAU/USD", symbol: "OANDA:XAUUSD", price: "$2,421.80", inr: "Gold Spot", change: "+0.74%", mood: "up", signal: "BUY" },
      { market: "FOREX", pair: "XAG/USD", symbol: "OANDA:XAGUSD", price: "$31.28", inr: "Silver Spot", change: "-0.36%", mood: "down", signal: "SELL" }
    ]
};


const FX_API_KEY=String(C.EXCHANGERATE_API_KEY||"25b67ee121b52d7058f61034").trim();
const LIVE_CACHE_KEY="AITradeX_LIVE_PRICE_CACHE_V1";
const LIVE_TTL_MS=30000;
const CHART_FEED_TTL_MS=30000;
const liveCache=(()=>{try{return JSON.parse(localStorage.getItem(LIVE_CACHE_KEY)||"{}")}catch{return {}}})();
const normPair=pair=>String(pair||"").trim().toUpperCase();
const baseQuote=pair=>{const [base,quote]=normPair(pair).split("/");return {base,quote};};
const pairMeta=pair=>Object.values(MARKET_PAIRS).flat().find(x=>normPair(x.pair)===normPair(pair))||null;
const isMetalPair=pair=>["XAU/USD","XAG/USD"].includes(normPair(pair));
const isCryptoPair=pair=>Object.values(MARKET_PAIRS).flat().some(x=>normPair(x.pair)===normPair(pair)&&x.market==="CRYPTO");
const isForexPair=pair=>Object.values(MARKET_PAIRS).flat().some(x=>normPair(x.pair)===normPair(pair)&&x.market==="FOREX");
const isChartFeedPair=pair=>isForexPair(pair)&&!isCryptoPair(pair);
const fmtPrice=(n,asset="")=>{const v=Number(n);if(!Number.isFinite(v))return "--";const max=v>=1000?2:v>=1?4:8;const text=v.toLocaleString("en-US",{maximumFractionDigits:max});return asset==="CRYPTO"||asset==="METAL"?`$${text}`:text;};
const fmtChange=n=>{const v=Number(n||0);const sign=v>0?"+":"";return `${sign}${v.toFixed(2)}%`;};
const cleanNumberText=value=>String(value??"").replace(/[^0-9.\-]/g,"");
const cryptoUsdValue=value=>{const n=Number(value);if(Number.isFinite(n)&&n>0)return n;const parsed=Number(cleanNumberText(value));return Number.isFinite(parsed)&&parsed>0?parsed:0;};
const usdtInrRate=()=>{const rate=Number(App.state?.settings?.usdtInrRate??95);return Number.isFinite(rate)&&rate>0?rate:95;};
const fmtInrPrice=n=>{const v=Number(n);if(!Number.isFinite(v)||v<=0)return "--";const max=v>=1000?2:v>=1?4:6;return `₹${v.toLocaleString("en-IN",{maximumFractionDigits:max})}`;};
const cryptoInrDisplay=value=>fmtInrPrice(cryptoUsdValue(value)*usdtInrRate());
const cryptoPairLabel=pair=>{const {base}=baseQuote(pair);return base?`${base}/INR`:normPair(pair);};
function saveLiveCache(){try{localStorage.setItem(LIVE_CACHE_KEY,JSON.stringify(liveCache))}catch{}}
function cachedLive(pair){const clean=normPair(pair);const row=liveCache[clean];if(!row)return null;const ttl=row.sourceType==="CHART_FEED"||isChartFeedPair(clean)?CHART_FEED_TTL_MS:LIVE_TTL_MS;return Date.now()-Number(row.fetchedMs||0)<ttl?row:null;}
async function fetchJson(url,options){const res=await fetch(url,{cache:"no-store",...(options||{})});if(!res.ok)throw new Error(`HTTP ${res.status}`);return res.json();}
async function fetchCryptoPrice(pair){const symbol=normPair(pair).replace("/","");const url=`https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`;let data;try{data=await fetchJson(url)}catch(e){data=await fetchJson(`https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`)}
  const price=Number(data.lastPrice);if(!Number.isFinite(price))throw new Error("Crypto price unavailable");
  return {ok:true,pair:normPair(pair),price,display:cryptoInrDisplay(price),inrRate:usdtInrRate(),displayPair:cryptoPairLabel(pair),rawUsdtDisplay:fmtPrice(price,"CRYPTO"),change:fmtChange(data.priceChangePercent),mood:Number(data.priceChangePercent||0)>=0?"up":"down",source:"Binance",sourceType:"LIVE_API",fetchedAt:new Date().toISOString(),fetchedMs:Date.now()};
}
async function fetchForexPrice(pair){const {base,quote}=baseQuote(pair);if(!base||!quote)throw new Error("Invalid forex pair");if(isMetalPair(pair))throw new Error("Manual rate required");
  const url=`https://v6.exchangerate-api.com/v6/${encodeURIComponent(FX_API_KEY)}/pair/${encodeURIComponent(base)}/${encodeURIComponent(quote)}`;
  const data=await fetchJson(url);const price=Number(data.conversion_rate);if(data.result!=="success"||!Number.isFinite(price))throw new Error("Forex price unavailable");
  return {ok:true,pair:normPair(pair),price,display:fmtPrice(price,"FOREX"),change:"Live",mood:"up",source:"ExchangeRate-API",sourceType:"LIVE_API",fetchedAt:new Date().toISOString(),fetchedMs:Date.now()};
}

const TRADINGVIEW_FEED_SYMBOLS={
  "EUR/USD":"FX:EURUSD",
  "GBP/USD":"FX:GBPUSD",
  "USD/JPY":"FX:USDJPY",
  "USD/CHF":"FX:USDCHF",
  "USD/CAD":"FX:USDCAD",
  "AUD/USD":"FX:AUDUSD",
  "NZD/USD":"FX:NZDUSD",
  "USD/INR":"FX_IDC:USDINR",
  "EUR/INR":"FX_IDC:EURINR",
  "GBP/INR":"FX_IDC:GBPINR",
  "XAU/USD":"OANDA:XAUUSD",
  "XAG/USD":"OANDA:XAGUSD"
};
async function fetchTradingViewSymbolPrice(tvSymbol){
  const encoded=encodeURIComponent(tvSymbol);
  try{
    const direct=await fetchJson(`https://scanner.tradingview.com/symbol?symbol=${encoded}&fields=close,change,change_abs`);
    const close=Number(direct?.close ?? direct?.data?.close ?? direct?.d?.[0]);
    const change=Number(direct?.change ?? direct?.data?.change ?? direct?.d?.[1]);
    if(Number.isFinite(close))return {price:close,change};
  }catch{}
  const market="forex";
  const body=JSON.stringify({symbols:{tickers:[tvSymbol],query:{types:[]}},columns:["close","change","change_abs"]});
  const scan=await fetchJson(`https://scanner.tradingview.com/${market}/scan`,{method:"POST",headers:{"Content-Type":"application/json"},body});
  const row=scan?.data?.[0]?.d||[];
  const close=Number(row[0]);
  const change=Number(row[1]);
  if(!Number.isFinite(close))throw new Error("Chart price unavailable");
  return {price:close,change};
}
async function fetchChartFeedPrice(pair){
  const clean=normPair(pair);
  const meta=pairMeta(clean);
  const tvSymbol=TRADINGVIEW_FEED_SYMBOLS[clean]||meta?.symbol;
  if(!tvSymbol)throw new Error("Chart feed symbol unavailable");
  const data=await fetchTradingViewSymbolPrice(tvSymbol);
  const change=Number(data.change||0);
  const asset=isMetalPair(clean)?"METAL":"FOREX";
  return {ok:true,pair:clean,price:data.price,display:fmtPrice(data.price,asset),change:Number.isFinite(change)?fmtChange(change):"Chart",mood:change<0?"down":"up",source:"TradingView Chart Feed",sourceType:"CHART_FEED",chartSymbol:tvSymbol,fetchedAt:new Date().toISOString(),fetchedMs:Date.now()};
}


const App={config:C,db,state:load(),session:loadSession(),now,uid,money,escapeHtml:esc,storageKey:SK,sessionKey:SS};
App.reloadState=()=>{App.state=load();App.session=loadSession();return App.state;};
App.hasLedgerEntry=({accountType="REAL",type,referenceId,userId})=>{const list=accountType==="DEMO"?App.state.demoLedger:App.state.walletLedger;return (list||[]).some(x=>(!type||x.type===type)&&(!referenceId||x.referenceId===referenceId)&&(!userId||x.userId===userId));};
App.ensureNotifications=()=>{if(!Array.isArray(App.state.notifications))App.state.notifications=[];return App.state.notifications;};
App.addNotification=({audience="USER",userId="",title="Notification",message="",type="INFO",linkPage="",referenceId=""}={})=>{
  App.ensureNotifications();
  const cleanAudience=String(audience||"USER").toUpperCase();
  const id=referenceId?`notif_${cleanAudience}_${userId||"all"}_${type}_${referenceId}`:uid("notif");
  if(referenceId&&App.state.notifications.some(n=>n.id===id))return false;
  App.state.notifications.unshift({id,audience:cleanAudience,userId:userId||"",title:String(title||"Notification"),message:String(message||""),type:String(type||"INFO").toUpperCase(),linkPage:String(linkPage||""),referenceId:referenceId||"",read:false,createdAt:now()});
  App.saveState();
  return true;
};
App.notificationsFor=({audience="USER",userId=""}={})=>{
  App.ensureNotifications();
  const cleanAudience=String(audience||"USER").toUpperCase();
  return App.state.notifications.filter(n=>String(n.audience||"USER").toUpperCase()===cleanAudience&&(cleanAudience!=="USER"||!n.userId||n.userId===userId)).sort((a,b)=>Date.parse(b.createdAt||0)-Date.parse(a.createdAt||0));
};
App.unreadNotificationCount=({audience="USER",userId=""}={})=>App.notificationsFor({audience,userId}).filter(n=>!n.read).length;
App.markNotificationsRead=({audience="USER",userId=""}={})=>{
  const rows=App.notificationsFor({audience,userId});
  rows.forEach(n=>n.read=true);
  App.saveState();
  return rows.length;
};
App.deleteNotification=(id)=>{App.ensureNotifications();const before=App.state.notifications.length;App.state.notifications=App.state.notifications.filter(n=>n.id!==id);if(App.state.notifications.length!==before){App.saveState();return true;}return false;};
App.logoHtml=(variant="full",className="")=>{
  const mode=String(variant||"full").toLowerCase();
  const cls=esc(className||"");
  const id=uid("logo").replace(/[^a-zA-Z0-9_]/g,"");
  const blue=`${id}_blue`,green=`${id}_green`,dark=`${id}_dark`,glow=`${id}_glow`;
  const defs=`<defs>
    <linearGradient id="${blue}" x1="0" x2="1" y1="1" y2="0"><stop offset="0" stop-color="#1d5cff"/><stop offset=".52" stop-color="#15e5d3"/><stop offset="1" stop-color="#6fff35"/></linearGradient>
    <linearGradient id="${green}" x1="0" x2="1" y1="1" y2="0"><stop offset="0" stop-color="#15e5d3"/><stop offset="1" stop-color="#9dff32"/></linearGradient>
    <linearGradient id="${dark}" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#10233d"/><stop offset="1" stop-color="#06101f"/></linearGradient>
    <filter id="${glow}" x="-35%" y="-35%" width="170%" height="170%"><feGaussianBlur stdDeviation="1.55" result="blur"/><feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.08 0 0 0 0 0.88 0 0 0 0 0.82 0 0 0 .38 0"/><feBlend in="SourceGraphic"/></filter>
  </defs>`;
  const icon=`<g class="aitx-logo-mark">
    <rect x="7" y="7" width="50" height="50" rx="17" fill="url(#${dark})" stroke="rgba(255,255,255,.16)" stroke-width="1.2"/>
    <path d="M16.5 47.5 28.6 17.8c1.45-3.55 5.35-3.55 6.8 0l12.1 29.7" fill="none" stroke="url(#${blue})" stroke-width="5.6" stroke-linecap="round" stroke-linejoin="round" filter="url(#${glow})"/>
    <path d="M24.1 35.1h15.8" fill="none" stroke="#f5f8ff" stroke-width="3.6" stroke-linecap="round" opacity=".92"/>
    <path d="M38.2 25.4 49.6 14M41.1 14h8.5v8.5" fill="none" stroke="url(#${green})" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round" filter="url(#${glow})"/>
    <rect x="18" y="42" width="5.6" height="8" rx="2.8" fill="#1d5cff" opacity=".94"/>
    <rect x="28.8" y="38" width="5.6" height="12" rx="2.8" fill="#15e5d3" opacity=".94"/>
    <rect x="39.6" y="33" width="5.6" height="17" rx="2.8" fill="#6fff35" opacity=".94"/>
  </g>`;
  if(mode==="icon")return `<span class="aitx-logo-wrap aitx-logo-icon-wrap ${cls}" aria-label="AITradeX logo"><svg class="aitx-logo-svg" viewBox="0 0 64 64" role="img" aria-hidden="true">${defs}${icon}</svg></span>`;
  return `<span class="aitx-logo-wrap aitx-logo-full-wrap ${cls}" aria-label="AITradeX logo"><svg class="aitx-logo-svg" viewBox="0 0 286 64" role="img" aria-hidden="true">${defs}${icon}<text x="72" y="43" font-family="Inter,Arial Black,system-ui,-apple-system,Segoe UI,Arial,sans-serif" font-size="35" font-weight="1000" letter-spacing="-2.15" paint-order="stroke fill" stroke="rgba(5,8,20,.42)" stroke-width="1.05" stroke-linejoin="round"><tspan fill="url(#${blue})">AI</tspan><tspan fill="#ffffff">Trade</tspan><tspan fill="url(#${green})">X</tspan></text></svg></span>`;
};
App.state.settings={freeAiTradesPerDay:5,postTrialFreeAiTradesPerDay:1,freeTrialDays:7,usdtInrRate:Number(C.USDT_INR_RATE||95),...(App.state.settings||{})};
App.state.settings.usdtInrRate=Math.max(1,Number(App.state.settings.usdtInrRate||95));
if(!Array.isArray(App.state.plans))App.state.plans=initial().plans;
const freePlan=App.state.plans.find(p=>p.id==="free");
if(freePlan){
  if(!freePlan.durationDays)freePlan.durationDays=Number(App.state.settings.freeTrialDays||7);
  if(!freePlan.name||freePlan.name==="Free")freePlan.name="Free Trial";
  if(!Array.isArray(freePlan.benefits)||!freePlan.benefits.length)freePlan.benefits=["5 AI auto trades per day for 7 days","1 AI auto trade per day after trial","Manual trading access","Live price cards"];
}
App.marketPairs=MARKET_PAIRS;

App.livePrices=liveCache;
App.isMetalPair=isMetalPair;
App.isCryptoPair=isCryptoPair;
App.isForexPair=isForexPair;
App.isChartFeedPair=isChartFeedPair;
App.getCachedPairPrice=pair=>cachedLive(pair);
App.getLastPairPrice=pair=>liveCache[normPair(pair)]||null;
App.usdtInrRate=usdtInrRate;
App.cryptoInrDisplay=cryptoInrDisplay;
App.cryptoRawToInr=value=>cryptoUsdValue(value)*usdtInrRate();
App.cryptoInrToRaw=value=>{const rate=usdtInrRate();const n=Number(value||0);return rate>0?n/rate:n;};
App.displayPairLabel=pair=>isCryptoPair(pair)?cryptoPairLabel(pair):normPair(pair);
App.priceDisplayFor=(pair,value)=>isCryptoPair(pair)?cryptoInrDisplay(value):fmtPrice(value,isMetalPair(pair)?"METAL":isForexPair(pair)?"FOREX":"");
App.pairLiveView=item=>{
  const cached=cachedLive(item?.pair);
  if(cached)return {...item,live:true,displayPair:App.displayPairLabel(item.pair),price:cached.display,rawPrice:cached.price,rawUsdtDisplay:cached.rawUsdtDisplay||fmtPrice(cached.price,"CRYPTO"),inrRate:cached.inrRate||usdtInrRate(),inr:isCryptoPair(item?.pair)?`Rate ₹${usdtInrRate()}/USDT`:(item.inr||""),change:cached.change||item.change,mood:cached.mood||item.mood,priceSource:cached.source,priceFetchedAt:cached.fetchedAt};
  if(isCryptoPair(item?.pair)){
    const raw=cryptoUsdValue(item?.price);
    return {...item,displayPair:App.displayPairLabel(item.pair),rawPrice:raw,rawUsdtDisplay:fmtPrice(raw,"CRYPTO"),price:cryptoInrDisplay(raw),inr:`Rate ₹${usdtInrRate()}/USDT`,inrRate:usdtInrRate()};
  }
  return item;
};
App.getLivePairPrice=async(pair,manualPrice)=>{
  const clean=normPair(pair);
  const manual=Number(manualPrice||0);
  const cached=cachedLive(clean);if(cached&&!manual)return cached;
  if(isCryptoPair(clean)){
    const row=await fetchCryptoPrice(clean);
    liveCache[clean]=row;saveLiveCache();return row;
  }
  if(isForexPair(clean)){
    try{const row=await fetchChartFeedPrice(clean);liveCache[clean]=row;saveLiveCache();return row;}catch(error){
      if(isMetalPair(clean)){
        if(manual&&manual>0){const row={ok:true,pair:clean,price:manual,display:fmtPrice(manual,"METAL"),change:"Manual",mood:"up",source:"Manual Rate",sourceType:"MANUAL",fetchedAt:new Date().toISOString(),fetchedMs:Date.now()};liveCache[clean]=row;saveLiveCache();return row;}
        throw new Error(`${clean} chart feed unavailable. Add manual fallback price.`);
      }
      const row=await fetchForexPrice(clean);
      row.source="ExchangeRate-API Fallback";
      row.sourceType="LIVE_API_FALLBACK";
      liveCache[clean]=row;saveLiveCache();return row;
    }
  }
  const row=await fetchForexPrice(clean);
  liveCache[clean]=row;saveLiveCache();return row;
};
App.refreshLivePrices=async(pairs,onEach)=>{
  const unique=[...new Set((pairs||[]).map(x=>typeof x==="string"?x:x?.pair).filter(Boolean).map(normPair))];
  const out=[];
  for(const pair of unique){
    try{const row=await App.getLivePairPrice(pair);out.push(row);if(typeof onEach==="function")onEach(row);}catch(err){if(typeof onEach==="function")onEach({ok:false,pair,error:err.message||"Price unavailable"});}
  }
  return out;
};

let chartFeedTimer=null,chartFeedKey="";
App.stopChartFeedTicker=()=>{if(chartFeedTimer){clearInterval(chartFeedTimer);chartFeedTimer=null;}chartFeedKey="";};
App.startChartFeedTicker=(pairs,onEach)=>{
  const chartPairs=[...new Set((pairs||[]).map(x=>typeof x==="string"?x:x?.pair).filter(Boolean).map(normPair).filter(isChartFeedPair))];
  if(!chartPairs.length)return false;
  const key=chartPairs.sort().join("|");
  if(key===chartFeedKey&&chartFeedTimer)return true;
  App.stopChartFeedTicker();
  chartFeedKey=key;
  const pull=()=>{chartPairs.forEach(async pair=>{try{const row=await fetchChartFeedPrice(pair);liveCache[pair]=row;saveLiveCache();if(typeof onEach==="function")onEach(row);}catch(err){
    if(!isMetalPair(pair)){try{const row=await fetchForexPrice(pair);row.source="ExchangeRate-API Fallback";row.sourceType="LIVE_API_FALLBACK";liveCache[pair]=row;saveLiveCache();if(typeof onEach==="function")onEach(row);return;}catch{}}
    if(typeof onEach==="function")onEach({ok:false,pair,error:err.message||"Chart feed unavailable"});
  }});};
  pull();
  chartFeedTimer=setInterval(pull,5000);
  return true;
};
App.stopMetalChartTicker=App.stopChartFeedTicker;
App.startMetalChartTicker=(pairs,onEach)=>App.startChartFeedTicker((pairs||[]).filter(x=>isMetalPair(typeof x==="string"?x:x?.pair)),onEach);
App.startForexChartTicker=(pairs,onEach)=>App.startChartFeedTicker((pairs||[]).filter(x=>isForexPair(typeof x==="string"?x:x?.pair)),onEach);


const cryptoStreamSymbol=pair=>normPair(pair).replace("/","").toLowerCase();
let cryptoTickerSocket=null,cryptoTickerKey="",cryptoTickerRetry=null,cryptoTickerSaveTimer=0;
function cryptoPairBySymbol(symbol){
  const clean=String(symbol||"").toUpperCase();
  return (MARKET_PAIRS.CRYPTO||[]).find(x=>normPair(x.pair).replace("/","")===clean)||null;
}
function cryptoTickerRow(data){
  const symbol=String(data?.s||"").toUpperCase();
  const item=cryptoPairBySymbol(symbol);
  if(!item)return null;
  const eventType=String(data?.e||"").toLowerCase();
  const cached=liveCache[normPair(item.pair)]||{};
  const rawPrice=eventType==="trade"?data.p:data.c;
  const price=Number(rawPrice);
  if(!Number.isFinite(price))return null;
  const changePct=eventType==="trade"?Number(String(cached.change||"0").replace("%","").replace("+","")):Number(data.P||0);
  const row={
    ok:true,
    pair:normPair(item.pair),
    price,
    display:cryptoInrDisplay(price),
    inrRate:usdtInrRate(),
    displayPair:cryptoPairLabel(item.pair),
    rawUsdtDisplay:fmtPrice(price,"CRYPTO"),
    change:eventType==="trade"?(cached.change||"Live"):fmtChange(changePct),
    mood:eventType==="trade"?(cached.mood||"up"):(changePct>=0?"up":"down"),
    source:eventType==="trade"?"Binance Trade Stream":"Binance Ticker Stream",
    sourceType:eventType==="trade"?"LIVE_TRADE_STREAM":"LIVE_TICKER_STREAM",
    fetchedAt:new Date().toISOString(),
    fetchedMs:Date.now()
  };
  if(eventType!=="trade")return {...cached,...row,price:cached.price||row.price,display:cached.display||row.display,source:cached.source||row.source,sourceType:cached.sourceType||row.sourceType,fetchedAt:cached.fetchedAt||row.fetchedAt,fetchedMs:cached.fetchedMs||row.fetchedMs,change:row.change,mood:row.mood};
  return row;
}
function saveTickerCacheSoon(){
  const t=Date.now();
  if(t-cryptoTickerSaveTimer<8000)return;
  cryptoTickerSaveTimer=t;
  saveLiveCache();
}
App.stopCryptoLiveTicker=()=>{
  if(cryptoTickerRetry){clearTimeout(cryptoTickerRetry);cryptoTickerRetry=null;}
  if(cryptoTickerSocket){try{cryptoTickerSocket.close();}catch{}}
  cryptoTickerSocket=null;cryptoTickerKey="";
};
App.startCryptoLiveTicker=(pairs,onEach)=>{
  const cryptoPairs=[...new Set((pairs||[]).map(x=>typeof x==="string"?x:x?.pair).filter(Boolean).map(normPair).filter(isCryptoPair))];
  if(!cryptoPairs.length||!("WebSocket" in window)){return false;}
  const streams=cryptoPairs.flatMap(p=>[`${cryptoStreamSymbol(p)}@trade`,`${cryptoStreamSymbol(p)}@ticker`]).sort();
  const key=streams.join("/");
  if(key===cryptoTickerKey&&cryptoTickerSocket&&[WebSocket.OPEN,WebSocket.CONNECTING].includes(cryptoTickerSocket.readyState))return true;
  App.stopCryptoLiveTicker();
  cryptoTickerKey=key;
  const url=`wss://data-stream.binance.vision:443/stream?streams=${streams.join("/")}`;
  const connect=()=>{
    try{
      cryptoTickerSocket=new WebSocket(url);
      cryptoTickerSocket.onmessage=event=>{
        try{
          const payload=JSON.parse(event.data||"{}");
          const data=payload.data||payload;
          const row=cryptoTickerRow(data);
          if(!row)return;
          liveCache[row.pair]=row;
          saveTickerCacheSoon();
          if(typeof onEach==="function")onEach(row);
        }catch{}
      };
      cryptoTickerSocket.onclose=()=>{
        if(cryptoTickerKey===key){
          cryptoTickerRetry=setTimeout(connect,3500);
        }
      };
      cryptoTickerSocket.onerror=()=>{
        try{cryptoTickerSocket.close();}catch{}
      };
    }catch{
      cryptoTickerRetry=setTimeout(connect,5000);
    }
  };
  connect();
  return true;
};

App.saveState=()=>localStorage.setItem(SK,JSON.stringify(App.state));
App.setSession=(userId,role)=>{App.session={userId,role,savedAt:Date.now()};localStorage.setItem(SS,JSON.stringify(App.session))};
App.clearSession=()=>{App.session=null;localStorage.removeItem(SS)};
App.currentUser=()=>App.state.users.find(u=>u.id===App.session?.userId)||null;
App.realBalance=id=>App.state.walletLedger.filter(x=>x.userId===id).reduce((s,x)=>s+Number(x.amount||0),0);
App.demoBalance=id=>{const rows=App.state.demoLedger.filter(x=>x.userId===id);return rows.reduce((s,x)=>s+Number(x.amount||0),Number(App.state.settings.demoBalance||100000))};
App.pendingDeposit=id=>App.state.depositRequests.filter(x=>x.userId===id&&x.status==="PENDING").reduce((s,x)=>s+Number(x.amount||0),0);
App.pendingWithdrawal=id=>App.state.withdrawalRequests.filter(x=>x.userId===id&&x.status==="PENDING").reduce((s,x)=>s+Number(x.amount||0),0);
App.kycStatus=id=>([...App.state.kycRequests].reverse().find(x=>x.userId===id)?.status)||"NOT_SUBMITTED";
App.normalizePlan=plan=>({
  id:String(plan?.id||uid("plan")),
  name:String(plan?.name||"Plan"),
  price:Math.max(0,Number(plan?.price||0)),
  signals:Math.max(0,Number(plan?.signals||plan?.aiTradeLimit||0)),
  aiAccess:String(plan?.aiAccess||"AI Access"),
  durationDays:Math.max(0,Number(plan?.durationDays||0)),
  status:String(plan?.status||"ACTIVE").toUpperCase()==="INACTIVE"?"INACTIVE":"ACTIVE",
  benefits:Array.isArray(plan?.benefits)?plan.benefits: String(plan?.benefits||"").split("\n").map(x=>x.trim()).filter(Boolean)
});
App.getPlans=()=>{App.state.plans=(App.state.plans||[]).map(App.normalizePlan);return App.state.plans};
App.planById=id=>App.getPlans().find(p=>p.id===id)||null;
App.subscriptionExpired=sub=>!!(sub?.expiresAt&&Date.parse(sub.expiresAt)<Date.now());
App.activeSubscription=id=>{
  const rows=(App.state.subscriptions||[]).filter(x=>x.userId===id&&x.status==="ACTIVE").sort((a,b)=>Date.parse(b.createdAt||0)-Date.parse(a.createdAt||0));
  const active=rows.find(x=>!App.subscriptionExpired(x));
  return active||null;
};
App.freeTrialInfo=userId=>{
  const target=App.state.users.find(u=>u.id===userId)||{};
  const free=App.planById("free")||{};
  const trialDays=Math.max(0,Number(free.durationDays||App.state.settings.freeTrialDays||7));
  let startedMs=Date.parse(target.freeTrialStartedAt||target.createdAt||"");
  if(!Number.isFinite(startedMs))startedMs=Date.now();
  const endsMs=startedMs+trialDays*86400000;
  const active=trialDays>0&&Date.now()<endsMs;
  const daysLeft=active?Math.max(1,Math.ceil((endsMs-Date.now())/86400000)):0;
  return {active,expired:trialDays>0&&!active,trialDays,daysLeft,startsAt:new Date(startedMs).toISOString(),endsAt:trialDays?new Date(endsMs).toISOString():""};
};
App.currentPlan=id=>{
  const sub=App.activeSubscription(id);
  if(sub)return App.planById(sub.planId)||{id:sub.planId,name:sub.planName||"Active Plan",signals:sub.aiTradeLimit||sub.signals||0,price:sub.price||0,durationDays:sub.durationDays||0,status:"ACTIVE"};
  const free=App.planById("free")||{id:"free",name:"Free Trial",price:0,signals:Number(App.state.settings.freeAiTradesPerDay||5),durationDays:Number(App.state.settings.freeTrialDays||7),status:"ACTIVE"};
  const trial=App.freeTrialInfo(id);
  return {...free,name:trial.active?"Free Trial":"Free",signals:App.aiDailyLimit(id),trialInfo:trial};
};

App.todayKey=()=>new Date().toISOString().slice(0,10);
App.aiTradesToday=userId=>App.state.trades.filter(t=>t.userId===userId&&["AI_AUTO","AI_LIVE"].includes(String(t.tradeType||""))&&String(t.createdDate||"")===App.todayKey()).length;
App.aiDailyLimit=userId=>{const sub=App.activeSubscription(userId);if(sub){const plan=App.planById(sub.planId)||{};return Number(sub.aiTradeLimit||sub.signals||plan.signals||50)||50}const trial=App.freeTrialInfo(userId);return trial.active?Number(App.state.settings.freeAiTradesPerDay||5):Number(App.state.settings.postTrialFreeAiTradesPerDay||1)};
App.aiSettings=user=>({enabled:!!user?.aiTradeOn,percent:Number(user?.aiTradePercent||25)});
App.aiAllowedAmount=user=>{const settings=App.aiSettings(user);if(!settings.enabled)return 0;return Math.max(0,App.realBalance(user.id))*settings.percent/100};
App.addLedger=({userId,accountType="REAL",type,amount,referenceId,note=""})=>{const list=accountType==="DEMO"?App.state.demoLedger:App.state.walletLedger;if(list.some(x=>x.type===type&&x.referenceId===referenceId))return false;const before=accountType==="DEMO"?App.demoBalance(userId):App.realBalance(userId),after=before+Number(amount||0);if(after<0)throw new Error("Insufficient balance");list.push({id:uid("ledger"),userId,accountType,type,amount:Number(amount||0),referenceId,note,balanceAfter:after,createdAt:now()});App.saveState();return true};

App.referralSettings=()=>{
  App.state.settings=App.state.settings||{};
  if(App.state.settings.referralDepositPercent===undefined)App.state.settings.referralDepositPercent=Number(App.state.settings.referralFirstDepositPercent||10);
  if(App.state.settings.referralSubscriptionPercent===undefined)App.state.settings.referralSubscriptionPercent=10;
  if(App.state.settings.referralDepositEnabled===undefined)App.state.settings.referralDepositEnabled=true;
  if(App.state.settings.referralSubscriptionEnabled===undefined)App.state.settings.referralSubscriptionEnabled=true;
  return App.state.settings;
};
App.referralRowsForUser=userId=>{
  App.state.referrals=App.state.referrals||[];
  return App.state.referrals.filter(r=>r.referrerUserId===userId||r.referredUserId===userId);
};
App.referralByReferredUser=userId=>{
  App.state.referrals=App.state.referrals||[];
  return App.state.referrals.find(r=>r.referredUserId===userId)||null;
};
App.referralBonusAlreadyCredited=(referral,type)=>!!(referral&&referral.bonuses&&referral.bonuses[type]&&referral.bonuses[type].credited);
App.creditReferralBonus=({referredUserId,eventType,amount,referenceId,sourceLabel})=>{
  const settings=App.referralSettings();
  const referral=App.referralByReferredUser(referredUserId);
  const baseAmount=Number(amount||0);
  if(!referral||!baseAmount||baseAmount<=0)return {credited:false,reason:"No eligible referral"};
  if(referral.referrerUserId===referral.referredUserId)return {credited:false,reason:"Self referral blocked"};
  const key=eventType==="SUBSCRIPTION"?"subscription":"deposit";
  if(key==="deposit"&&!settings.referralDepositEnabled)return {credited:false,reason:"Deposit referral disabled"};
  if(key==="subscription"&&!settings.referralSubscriptionEnabled)return {credited:false,reason:"Subscription referral disabled"};
  if(App.referralBonusAlreadyCredited(referral,key))return {credited:false,reason:"Bonus already credited"};
  const percent=key==="subscription"?Number(settings.referralSubscriptionPercent||0):Number(settings.referralDepositPercent||settings.referralFirstDepositPercent||0);
  const bonus=Number((baseAmount*percent/100).toFixed(2));
  if(!bonus||bonus<=0)return {credited:false,reason:"Bonus percent is zero"};
  const ledgerRef=`ref_${key}_${referral.id}_${referenceId||Date.now()}`;
  try{
    const added=App.addLedger({userId:referral.referrerUserId,accountType:"REAL",type:key==="subscription"?"REFERRAL_SUBSCRIPTION_BONUS":"REFERRAL_DEPOSIT_BONUS",amount:bonus,referenceId:ledgerRef,note:`Referral ${key} bonus · ${percent}% of ${money(baseAmount)}${sourceLabel?` · ${sourceLabel}`:""}`});
    if(!referral.bonuses)referral.bonuses={};
    referral.bonuses[key]={credited:true,amount:bonus,percent,baseAmount,referenceId,ledgerReferenceId:ledgerRef,creditedAt:new Date().toISOString(),eventType:key.toUpperCase()};
    referral.status=referral.bonuses.deposit?.credited&&referral.bonuses.subscription?.credited?"BONUSES_CREDITED":key==="deposit"?"DEPOSIT_BONUS_CREDITED":"SUBSCRIPTION_BONUS_CREDITED";
    referral.updatedAt=new Date().toISOString();
    App.saveState();
    return {credited:!!added,amount:bonus,percent,referral};
  }catch(err){return {credited:false,reason:err.message||"Unable to credit referral bonus"};}
};
App.referralStats=userId=>{
  const rows=(App.state.referrals||[]).filter(r=>r.referrerUserId===userId);
  const depositBonus=rows.reduce((s,r)=>s+Number(r.bonuses?.deposit?.amount||0),0);
  const subscriptionBonus=rows.reduce((s,r)=>s+Number(r.bonuses?.subscription?.amount||0),0);
  return {totalInvited:rows.length,depositBonus,subscriptionBonus,totalBonus:depositBonus+subscriptionBonus,credited:rows.filter(r=>r.bonuses?.deposit?.credited||r.bonuses?.subscription?.credited).length};
};
App.toast=m=>{let e=document.querySelector(".toast");if(e)e.remove();e=document.createElement("div");e.className="toast";e.textContent=m;document.body.appendChild(e);setTimeout(()=>e.classList.add("show"),10);setTimeout(()=>{e.classList.remove("show");setTimeout(()=>e.remove(),250)},2600)};
App.saveState();window.AITradeX=App;
})();