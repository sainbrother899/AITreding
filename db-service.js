(() => {
  const App = window.AITradeX;
  const C = window.AITRADEX_CONFIG || {};
  const ready = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY && window.supabase);
  const client = ready ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY) : null;
  const iso = v => { const n = Date.parse(v || ""); return Number.isFinite(n) ? new Date(n).toISOString() : new Date().toISOString(); };
  const num = v => Number(v || 0);
  const text = v => String(v ?? "");
  const lower = v => text(v).trim().toLowerCase();
  const cleanMobile = v => text(v).replace(/\D/g, "").slice(-10);
  const clone = v => { try { return JSON.parse(JSON.stringify(v || {})); } catch { return {}; } };
  const defaults = () => clone(App?.state || {});
  let syncTimer = null;
  let syncing = false;
  let loading = null;

  function status(message, ok = true) {
    const row = { ok, message, at: new Date().toISOString() };
    try { localStorage.setItem("AITradeX_DB_LAST_SYNC", JSON.stringify(row)); } catch {}
    return row;
  }
  function lastSyncStatus(){ try{return JSON.parse(localStorage.getItem("AITradeX_DB_LAST_SYNC")||"null");}catch{return null;} }
  function assertReady(){ if(!ready || !client) throw new Error("Supabase is not configured."); }
  function pauseLocalLiveSync(ms=1800){ try{ window.AITradeX?.pauseLiveSync?.(ms); }catch{} }
  const REALTIME_TABLES=["users","payment_methods","kyc_requests","deposit_requests","withdrawal_requests","wallet_ledger","trade_orders","ai_trade_batches","admin_action_logs","notifications","app_settings","plans","subscriptions","referrals","support_tickets"];
  async function safeSelect(table, query="*"){
    try{ const {data,error}=await client.from(table).select(query); if(error) throw error; return data||[]; }
    catch(err){ console.warn(`[AITradeX DB] ${table} load skipped:`, err?.message||err); return []; }
  }
  async function safeMaybe(table, query="*"){
    const rows = await safeSelect(table, query); return rows;
  }
  async function upsert(table, rows, options={}){
    if(!ready || !client || !rows || !rows.length) return {table,count:0};
    pauseLocalLiveSync();
    const {error}=await client.from(table).upsert(rows, options.onConflict ? {onConflict:options.onConflict} : undefined);
    if(error) throw new Error(`${table}: ${error.message}`);
    return {table,count:rows.length};
  }
  async function removeMissing(table, ids){
    if(!ready || !client) return {table,deleted:0};
    pauseLocalLiveSync();
    const keep = new Set((ids||[]).filter(Boolean).map(String));
    const {data,error}=await client.from(table).select("id");
    if(error) throw new Error(`${table} stale-row scan: ${error.message}`);
    const stale=(data||[]).map(r=>String(r.id)).filter(id=>!keep.has(id));
    for(let i=0;i<stale.length;i+=100){
      const chunk=stale.slice(i,i+100);
      const res=await client.from(table).delete().in("id", chunk);
      if(res.error) throw new Error(`${table} stale-row delete: ${res.error.message}`);
    }
    return {table,deleted:stale.length};
  }

  function rowUser(u){ return { id:text(u.id), name:text(u.name), email:lower(u.email), mobile:cleanMobile(u.mobile), role:text(u.role||"user"), status:text(u.status||"ACTIVE"), referral_code:text(u.referralCode||u.referral_code||""), referred_by:u.referredBy||u.referred_by||null, password_hash:u.passwordHash||u.password_hash||u.password||null, ai_trade_on:!!u.aiTradeOn, ai_trade_percent:num(u.aiTradePercent||25), free_trial_started_at:u.freeTrialStartedAt?iso(u.freeTrialStartedAt):null, last_login_at:(u.lastLoginAt||u.last_login_at)?iso(u.lastLoginAt||u.last_login_at):null, updated_at:new Date().toISOString(), avatar_url:u.avatarUrl||u.avatar_url||null, avatar_path:u.avatarPath||u.avatar_path||null, created_at:iso(u.createdAt||u.created_at)}; }
  function stateUser(r){ const pass=r.password_hash||""; return { id:r.id, name:r.name||"", email:r.email||"", mobile:r.mobile||"", role:r.role||"user", status:r.status||"ACTIVE", referralCode:r.referral_code||"", referredBy:r.referred_by||null, password:pass, passwordHash:pass, aiTradeOn:!!r.ai_trade_on, aiTradePercent:num(r.ai_trade_percent||25), freeTrialStartedAt:r.free_trial_started_at||"", lastLoginAt:r.last_login_at||"", avatarUrl:r.avatar_url||"", avatarPath:r.avatar_path||"", createdAt:r.created_at||"" }; }
  function rowLedger(x){ const raw=clone(x.raw||x.meta||{}); return {id:text(x.id), user_id:x.userId||x.user_id, account_type:x.accountType||x.account_type||"REAL", type:x.type||"WALLET", amount:num(x.amount), reference_id:text(x.referenceId||x.reference_id||x.id), note:text(x.note), balance_after:num(x.balanceAfter||x.balance_after), raw, created_at:iso(x.createdAt||x.created_at)}; }
  function stateLedger(r){ const raw=r.raw&&typeof r.raw==="object"?r.raw:{}; return {id:r.id,userId:r.user_id,accountType:r.account_type||"REAL",type:r.type,amount:num(r.amount),referenceId:r.reference_id,note:r.note||"",balanceAfter:num(r.balance_after),raw,createdAt:r.created_at}; }
  function rowKyc(x){ const raw=clone(x); return {id:text(x.id), user_id:x.userId||x.user_id, user_email:x.userEmail||x.user_email||x.personal?.email||"", full_name:x.personal?.fullName||x.fullName||x.full_name||"", mobile:x.personal?.mobile||x.mobile||"", id_number:x.idDetails?.number||x.id?.number||x.id_number||"", address:x.personal?.address||x.address||"", status:x.status||"PENDING", reviewed_at:x.approvedAt||x.rejectedAt?iso(x.approvedAt||x.rejectedAt):null, created_at:iso(x.submittedAt||x.createdAt||x.created_at), raw}; }
  function stateKyc(r){
    const raw=r.raw&&typeof r.raw==="object"?r.raw:{};
    const status=String(r.status||raw.status||"PENDING").toUpperCase();
    const reviewedAt=r.reviewed_at||raw.reviewedAt||raw.updatedAt||"";
    const rawIdDetails=(raw.idDetails&&typeof raw.idDetails==="object")?raw.idDetails:(raw.id&&typeof raw.id==="object")?raw.id:{type:"Aadhaar Card",number:r.id_number||raw.id_number||""};
    return {...raw,id:r.id,userId:r.user_id,userEmail:r.user_email,status,idDetails:rawIdDetails,submittedAt:raw.submittedAt||r.created_at,approvedAt:raw.approvedAt||(status==="APPROVED"?reviewedAt:""),rejectedAt:raw.rejectedAt||(status==="REJECTED"?reviewedAt:""),rejectReason:raw.rejectReason||r.admin_note||"",updatedAt:reviewedAt||r.created_at};
  }
  function rowMethod(x){ const raw=clone(x); return {id:text(x.id),user_id:x.userId||x.user_id,user_email:x.userEmail||x.user_email||"",type:x.type||"BANK",holder_name:x.holderName||x.holder_name||"",upi_id:x.upiId||x.upi_id||"",bank_name:x.bankName||x.bank_name||"",account_number:x.accountNumber||x.account_number||"",ifsc:x.ifsc||"",status:x.status||"PENDING",rejection_reason:x.rejectReason||x.rejection_reason||"",created_at:iso(x.createdAt||x.created_at),raw}; }
  function stateMethod(r){ const raw=r.raw&&typeof r.raw==="object"?r.raw:{}; return {...raw,id:r.id,userId:r.user_id,userEmail:r.user_email,type:r.type,status:r.status||raw.status||"PENDING",holderName:r.holder_name||raw.holderName||"",upiId:r.upi_id||raw.upiId||"",bankName:r.bank_name||raw.bankName||"",accountNumber:r.account_number||raw.accountNumber||"",ifsc:r.ifsc||raw.ifsc||"",rejectReason:r.rejection_reason||raw.rejectReason||"",createdAt:r.created_at||raw.createdAt}; }
  function rowDeposit(x){ const raw=clone(x); return {id:text(x.id),user_id:x.userId||x.user_id,user_email:x.userEmail||x.user_email||"",amount:num(x.amount),method:x.type||x.method||"UPI",utr:text(x.utr),status:x.status||"PENDING",balance_applied:!!(x.balanceApplied||x.balance_applied),first_deposit_referral_checked:!!(x.firstDepositReferralChecked||x.first_deposit_referral_checked),proof_image:x.proofImage||x.proof_image||null,admin_note:x.adminNote||x.rejectReason||x.admin_note||"",created_at:iso(x.createdAt||x.created_at),raw}; }
  function stateDeposit(r){ const raw=r.raw&&typeof r.raw==="object"?r.raw:{}; const status=String(r.status||raw.status||"PENDING").toUpperCase(); const reviewedAt=r.reviewed_at||raw.reviewedAt||raw.approvedAt||raw.rejectedAt||""; return {...raw,id:r.id,userId:r.user_id,userEmail:r.user_email,amount:num(r.amount),type:r.method||raw.type||"UPI",method:r.method||raw.method||"UPI",utr:r.utr||raw.utr||"",status,balanceApplied:!!r.balance_applied,firstDepositReferralChecked:!!r.first_deposit_referral_checked,adminNote:r.admin_note||raw.adminNote||"",rejectReason:raw.rejectReason||r.admin_note||"",approvedAt:raw.approvedAt||(status==="APPROVED"?reviewedAt:""),rejectedAt:raw.rejectedAt||(status==="REJECTED"?reviewedAt:""),reviewedAt,createdAt:r.created_at||raw.createdAt}; }
  function rowWithdrawal(x){ const raw=clone(x); return {id:text(x.id),user_id:x.userId||x.user_id,user_email:x.userEmail||x.user_email||"",amount:num(x.amount),payment_method_id:x.methodId||x.payment_method_id||"",status:x.status||"PENDING",hold_applied:x.holdApplied!==false,admin_note:x.adminNote||x.rejectReason||x.admin_note||"",created_at:iso(x.createdAt||x.created_at),raw}; }
  function stateWithdrawal(r){ const raw=r.raw&&typeof r.raw==="object"?r.raw:{}; const status=String(r.status||raw.status||"PENDING").toUpperCase(); const reviewedAt=r.reviewed_at||raw.reviewedAt||raw.approvedAt||raw.rejectedAt||""; return {...raw,id:r.id,userId:r.user_id,userEmail:r.user_email,amount:num(r.amount),methodId:r.payment_method_id||raw.methodId||"",status,holdApplied:r.hold_applied!==false,adminNote:r.admin_note||raw.adminNote||"",rejectReason:raw.rejectReason||r.admin_note||"",approvedAt:raw.approvedAt||(status==="APPROVED"?reviewedAt:""),rejectedAt:raw.rejectedAt||(status==="REJECTED"?reviewedAt:""),reviewedAt,createdAt:r.created_at||raw.createdAt}; }
  function rowTrade(x){ const raw=clone(x); return {id:text(x.id),user_id:x.userId||x.user_id,batch_id:x.batchId||x.batch_id||null,trade_type:x.tradeType||x.trade_type||"MANUAL",account_type:x.accountType||x.account_type||"REAL",order_type:x.orderType||x.order_type||"MARKET",market:x.market||"CRYPTO",pair:x.pair||"",side:x.side||"",status:x.status||"OPEN",source:x.source||"",entry_price:num(x.entryPrice||x.entry_price),entry_price_display:x.entryPriceDisplay||x.entry_price_display||"",exit_price:num(x.exitPrice||x.closePrice||x.exit_price),exit_price_display:x.exitPriceDisplay||x.closePriceDisplay||x.exit_price_display||"",limit_price:num(x.limitPrice||x.limit_price),limit_price_display:x.limitPriceDisplay||x.limit_price_display||"",leverage:num(x.leverage||1),margin_amount:num(x.marginAmount||x.amount||x.margin_amount),margin_locked:!!(x.marginLocked||x.margin_locked),position_size:num(x.positionSize||x.position_size),pnl:num(x.pnl),settlement_amount:num(x.settlementAmount||x.settlement_amount),target_type:x.targetType||x.target_type||"",target_percent:num(x.targetPercent||x.target_percent),close_reason:x.closeReason||x.close_reason||"",closed_by:x.closedBy||x.closed_by||"",note:x.note||"",raw,created_at:iso(x.createdAt||x.created_at),opened_at:x.openedAt?iso(x.openedAt):null,closed_at:x.closedAt?iso(x.closedAt):null}; }
  function stateTrade(r){ const raw=r.raw&&typeof r.raw==="object"?r.raw:{}; return {...raw,id:r.id,userId:r.user_id,batchId:r.batch_id||raw.batchId,tradeType:r.trade_type||raw.tradeType||"MANUAL",accountType:r.account_type||raw.accountType||"REAL",orderType:r.order_type||raw.orderType||"MARKET",market:r.market||raw.market||"CRYPTO",pair:r.pair||raw.pair,side:r.side||raw.side,status:r.status||raw.status,source:r.source||raw.source,entryPrice:num(r.entry_price||raw.entryPrice),entryPriceDisplay:r.entry_price_display||raw.entryPriceDisplay,exitPrice:num(r.exit_price||raw.exitPrice),exitPriceDisplay:r.exit_price_display||raw.exitPriceDisplay,limitPrice:num(r.limit_price||raw.limitPrice),limitPriceDisplay:r.limit_price_display||raw.limitPriceDisplay,leverage:num(r.leverage||raw.leverage||1),marginAmount:num(r.margin_amount||raw.marginAmount||raw.amount),marginLocked:!!r.margin_locked,positionSize:num(r.position_size||raw.positionSize),pnl:num(r.pnl||raw.pnl),settlementAmount:num(r.settlement_amount||raw.settlementAmount),targetType:r.target_type||raw.targetType, targetPercent:num(r.target_percent||raw.targetPercent),closeReason:r.close_reason||raw.closeReason,closedBy:r.closed_by||raw.closedBy,note:r.note||raw.note,createdAt:r.created_at||raw.createdAt,openedAt:r.opened_at||raw.openedAt,closedAt:r.closed_at||raw.closedAt}; }
  function rowNotification(x){ const raw=clone(x); return {id:text(x.id),audience:x.audience||"USER",user_id:x.userId||x.user_id||null,title:x.title||"",message:x.message||"",type:x.type||"INFO",link_page:x.linkPage||x.link_page||"",reference_id:x.referenceId||x.reference_id||"",read:!!x.read,raw,created_at:iso(x.createdAt||x.created_at)}; }
  function stateNotification(r){ const raw=r.raw&&typeof r.raw==="object"?r.raw:{}; return {...raw,id:r.id,audience:r.audience,userId:r.user_id,title:r.title,message:r.message,type:r.type,linkPage:r.link_page,referenceId:r.reference_id,read:!!r.read,createdAt:r.created_at}; }
  function rowAdminLog(x){ return {id:text(x.id),admin_user_id:x.adminUserId||x.admin_user_id||null,action:x.action||"ACTION",target_type:x.targetType||x.target_type||"",target_id:x.targetId||x.target_id||"",meta:x.meta||{},created_at:iso(x.createdAt||x.created_at)}; }
  function stateAdminLog(r){ return {id:r.id,adminUserId:r.admin_user_id,action:r.action,targetType:r.target_type,targetId:r.target_id,meta:r.meta||{},createdAt:r.created_at}; }
  function rowBatch(x){ const raw=clone(x); return {id:text(x.id),batch_type:x.batchType||x.batch_type||"INSTANT",market:x.market||"CRYPTO",pair:x.pair||"",side:x.side||"",leverage:num(x.leverage||1),status:x.status||"OPEN",entry_price:num(x.entryPrice||x.entry_price),entry_price_display:x.entryPriceDisplay||x.entry_price_display||"",target_type:x.targetType||x.target_type||"",target_percent:num(x.targetPercent||x.target_percent),min_balance:num(x.minBalance||x.min_balance),total_margin:num(x.totalMargin||x.total_margin),total_exposure:num(x.totalExposure||x.total_exposure),total_pnl:num(x.totalPnl||x.total_pnl),applied_count:num(x.appliedCount||x.applied_count),skipped_count:num(x.skippedCount||x.skipped_count),skip_reasons:x.skipReasons||x.skip_reasons||{},note:x.note||"",raw,created_at:iso(x.createdAt||x.created_at),closed_at:x.closedAt?iso(x.closedAt):null}; }
  function stateBatch(r){ const raw=r.raw&&typeof r.raw==="object"?r.raw:{}; return {...raw,id:r.id,batchType:r.batch_type||raw.batchType,market:r.market||raw.market,pair:r.pair||raw.pair,side:r.side||raw.side,leverage:num(r.leverage||raw.leverage),status:r.status||raw.status,entryPrice:num(r.entry_price||raw.entryPrice),entryPriceDisplay:r.entry_price_display||raw.entryPriceDisplay,targetType:r.target_type||raw.targetType,targetPercent:num(r.target_percent||raw.targetPercent),minBalance:num(r.min_balance||raw.minBalance),totalMargin:num(r.total_margin||raw.totalMargin),totalExposure:num(r.total_exposure||raw.totalExposure),totalPnl:num(r.total_pnl||raw.totalPnl),appliedCount:num(r.applied_count||raw.appliedCount),skippedCount:num(r.skipped_count||raw.skippedCount),skipReasons:r.skip_reasons||raw.skipReasons||{},note:r.note||raw.note,createdAt:r.created_at||raw.createdAt,closedAt:r.closed_at||raw.closedAt}; }
  function rowPlan(x){ const raw=clone(x); return {id:text(x.id),name:text(x.name||"Plan"),price:num(x.price),signals:num(x.signals||x.aiTradeLimit),ai_access:text(x.aiAccess||x.ai_access||"AI Access"),trade_limit:num(x.tradeLimit||x.trade_limit||x.signals),is_active:String(x.status||"ACTIVE").toUpperCase()!=="INACTIVE",raw}; }
  function statePlan(r){ const raw=r.raw&&typeof r.raw==="object"?r.raw:{}; return {...raw,id:r.id,name:r.name||raw.name||"Plan",price:num(r.price||raw.price),signals:num(r.signals||raw.signals||r.trade_limit||raw.tradeLimit),aiAccess:r.ai_access||raw.aiAccess||"AI Access",tradeLimit:num(r.trade_limit||raw.tradeLimit),status:r.is_active===false?"INACTIVE":(raw.status||"ACTIVE")}; }
  function rowSubscription(x){ const raw=clone(x); return {id:text(x.id),user_id:x.userId||x.user_id,plan_id:x.planId||x.plan_id,plan_name:x.planName||x.plan_name||"",amount:num(x.amount||x.price),status:x.status||"ACTIVE",starts_at:x.startsAt||x.starts_at?iso(x.startsAt||x.starts_at):null,expires_at:x.expiresAt||x.expires_at?iso(x.expiresAt||x.expires_at):null,raw,created_at:iso(x.createdAt||x.created_at)}; }
  function stateSubscription(r){ const raw=r.raw&&typeof r.raw==="object"?r.raw:{}; return {...raw,id:r.id,userId:r.user_id,planId:r.plan_id,planName:r.plan_name,amount:num(r.amount),price:num(raw.price||r.amount),status:r.status||raw.status||"ACTIVE",startsAt:r.starts_at||raw.startsAt,expiresAt:r.expires_at||raw.expiresAt,createdAt:r.created_at||raw.createdAt}; }
  function rowReferral(x){ const raw=clone(x); return {id:text(x.id),referrer_user_id:x.referrerUserId||x.referrer_user_id,referred_user_id:x.referredUserId||x.referred_user_id,status:x.status||"REGISTERED",commission_paid:!!(x.commissionPaid||x.commission_paid||x.bonuses?.deposit?.credited||x.bonuses?.subscription?.credited),commission_amount:num(x.commissionAmount||x.commission_amount||x.bonuses?.deposit?.amount||0)+num(x.bonuses?.subscription?.amount||0),raw,created_at:iso(x.createdAt||x.created_at)}; }
  function stateReferral(r){ const raw=r.raw&&typeof r.raw==="object"?r.raw:{}; return {...raw,id:r.id,referrerUserId:r.referrer_user_id,referredUserId:r.referred_user_id,status:r.status||raw.status||"REGISTERED",commissionPaid:!!r.commission_paid,commissionAmount:num(r.commission_amount),createdAt:r.created_at||raw.createdAt}; }
  function rowSupportTicket(x){ return {id:text(x.id),user_id:x.userId||x.user_id,user_email:x.userEmail||x.user_email||"",subject:text(x.subject),category:text(x.category||"Other"),message:text(x.message),status:x.status||"OPEN",replies:Array.isArray(x.replies)?x.replies:[],created_at:iso(x.createdAt||x.created_at),updated_at:iso(x.updatedAt||x.updated_at||x.createdAt||x.created_at)}; }
  function stateSupportTicket(r){ return {id:r.id,userId:r.user_id,userEmail:r.user_email,subject:r.subject,category:r.category,message:r.message,status:r.status,replies:r.replies||[],createdAt:r.created_at,updatedAt:r.updated_at}; }

  async function findUser(login){
    assertReady(); const key=lower(login), mob=cleanMobile(login);
    let query=client.from("users").select("*").limit(1);
    const filter = mob && /^\d{10}$/.test(mob) ? `email.eq.${key},mobile.eq.${mob}` : `email.eq.${key}`;
    const {data,error}=await client.from("users").select("*").or(filter).limit(1);
    if(error) throw error; return data?.[0]?stateUser(data[0]):null;
  }
  async function createUser(user){ assertReady(); pauseLocalLiveSync(); const row=rowUser(user); const {error}=await client.from("users").insert(row); if(error) throw error; return user; }
  async function updateUser(user){ assertReady(); pauseLocalLiveSync(); await upsert("users", [rowUser(user)], {onConflict:"id"}); return user; }
  async function loadAll(){
    assertReady();
    if(loading) return loading;
    loading=(async()=>{
      const base=defaults();
      const [users,methods,kyc,deposits,withdrawals,ledger,trades,batches,logs,notifications,settingsRows,plans,subs,refs,support]=await Promise.all([
        safeSelect("users"),safeSelect("payment_methods"),safeSelect("kyc_requests"),safeSelect("deposit_requests"),safeSelect("withdrawal_requests"),safeSelect("wallet_ledger"),safeSelect("trade_orders"),safeSelect("ai_trade_batches"),safeSelect("admin_action_logs"),safeSelect("notifications"),safeSelect("app_settings"),safeSelect("plans"),safeSelect("subscriptions"),safeSelect("referrals"),safeSelect("support_tickets")
      ]);
      const pulledUsers=users.map(stateUser);
      const localAdmin=(base.users||[]).filter(u=>u.role==="admin");
      const adminIds=new Set(pulledUsers.filter(u=>u.role==="admin").map(u=>u.id));
      App.state={...base,
        users:[...pulledUsers,...localAdmin.filter(a=>!adminIds.has(a.id))],
        paymentMethods:methods.map(stateMethod),
        kycRequests:kyc.map(stateKyc),
        depositRequests:deposits.map(stateDeposit),
        withdrawalRequests:withdrawals.map(stateWithdrawal),
        walletLedger:ledger.map(stateLedger).filter(x=>String(x.accountType||"REAL").toUpperCase()==="REAL"),
        demoLedger:ledger.map(stateLedger).filter(x=>String(x.accountType||"REAL").toUpperCase()==="DEMO"),
        trades:trades.map(stateTrade).sort((a,b)=>Date.parse(b.createdAt||0)-Date.parse(a.createdAt||0)),
        aiTradeBatches:batches.map(stateBatch).filter(b=>String(b.batchType||"").toUpperCase()!=="LIVE"),
        aiLiveBatches:batches.map(stateBatch).filter(b=>String(b.batchType||"").toUpperCase()==="LIVE"),
        adminActionLogs:logs.map(stateAdminLog).sort((a,b)=>Date.parse(b.createdAt||0)-Date.parse(a.createdAt||0)),
        notifications:notifications.map(stateNotification),
        supportTickets:(support||[]).map(stateSupportTicket),
        subscriptions:(subs||[]).map(stateSubscription),
        referrals:(refs||[]).map(stateReferral)
      };
      const settingsRow=settingsRows.find(x=>x.id==="main")||settingsRows.find(x=>x.id==="global");
      const settings=settingsRow?.settings; if(settings&&typeof settings==="object") App.state.settings={...base.settings,...settings};
      if(plans.length){
        const mergedPlans=(base.plans||[]).map(x=>App.normalizePlan?App.normalizePlan(x):x);
        const indexById=new Map(mergedPlans.map((row,idx)=>[String(row.id),idx]));
        plans.map(statePlan).forEach(row=>{
          const id=String(row.id||"");
          if(indexById.has(id)) mergedPlans[indexById.get(id)]={...mergedPlans[indexById.get(id)],...row};
          else mergedPlans.push(row);
        });
        App.state.plans=mergedPlans;
      }
      status(`Loaded database rows: users ${users.length}, KYC ${kyc.length}, deposits ${deposits.length}, withdrawals ${withdrawals.length}.`, true);
      loading=null; return App.state;
    })();
    return loading;
  }
  async function fullSync(){
    assertReady(); if(syncing) return {skipped:true}; syncing=true;
    try{
      const s=App.state||{};
      await upsert("users", (s.users||[]).map(rowUser), {onConflict:"id"});
      await upsert("payment_methods", (s.paymentMethods||[]).map(rowMethod), {onConflict:"id"});
      await removeMissing("payment_methods", (s.paymentMethods||[]).map(x=>x.id));
      await upsert("kyc_requests", (s.kycRequests||[]).map(rowKyc), {onConflict:"id"});
      await upsert("deposit_requests", (s.depositRequests||[]).map(rowDeposit), {onConflict:"id"});
      await upsert("withdrawal_requests", (s.withdrawalRequests||[]).map(rowWithdrawal), {onConflict:"id"});
      await upsert("wallet_ledger", [...(s.walletLedger||[]),...(s.demoLedger||[])].map(rowLedger), {onConflict:"id"});
      await upsert("trade_orders", (s.trades||[]).map(rowTrade), {onConflict:"id"});
      await upsert("ai_trade_batches", [...(s.aiTradeBatches||[]),...(s.aiLiveBatches||[])].map(rowBatch), {onConflict:"id"});
      await upsert("notifications", (s.notifications||[]).map(rowNotification), {onConflict:"id"});
      await upsert("admin_action_logs", (s.adminActionLogs||[]).map(rowAdminLog), {onConflict:"id"});
      await upsert("plans", (s.plans||[]).map(rowPlan), {onConflict:"id"});
      await upsert("subscriptions", (s.subscriptions||[]).map(rowSubscription), {onConflict:"id"});
      await upsert("referrals", (s.referrals||[]).map(rowReferral), {onConflict:"id"});
      await upsert("support_tickets", (s.supportTickets||[]).map(rowSupportTicket), {onConflict:"id"});
      await upsert("app_settings", [{id:"main",settings:clone(s.settings||{}),updated_at:new Date().toISOString()}], {onConflict:"id"});
      status("Database saved.", true); return {ok:true};
    }catch(err){ status(err?.message||"Database save failed", false); throw err; }
    finally{ syncing=false; }
  }
  function scheduleFullSync(){
    // Phase 5.17 strict database runtime: no hidden/background full-state sync.
    // Business actions use action-specific write* methods; manual fullSync remains only for admin repair/export workflows.
    return {disabled:true, reason:"Action-based database runtime"};
  }
  async function testConnection(){ if(!ready) return {ok:false,message:"Supabase is not configured."}; try{ const {error}=await client.from("users").select("id",{head:true,count:"exact"}); if(error) throw error; return {ok:true,message:"Supabase connected."}; }catch(err){ return {ok:false,message:err?.message||"Supabase connection failed."}; } }
  async function recordTelegramAlertSecure({status="PENDING",message="",error="",result=null,source="frontend"}={}){
    if(!ready) return {ok:false,skipped:true};
    try{
      const id=`tg_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      const row={id,status:String(status||"PENDING"),source:String(source||"frontend"),message:String(message||"").slice(0,3900),error:String(error||""),result:result||{},created_at:new Date().toISOString(),processed_at:["SENT","FAILED","SKIPPED"].includes(String(status||"").toUpperCase())?new Date().toISOString():null};
      const {error:dbErr}=await client.from("telegram_alert_logs").insert(row);
      if(dbErr) throw dbErr;
      return {ok:true,id};
    }catch(err){ console.warn("Telegram audit log failed", err?.message||err); return {ok:false,error:String(err?.message||err)}; }
  }

  async function sendTelegramMessage(textHtml){
    const st=App?.state?.settings||{};
    const cfg=window.AITRADEX_CONFIG||{};
    const text=String(textHtml||"").slice(0,3900);
    if(!st.telegramEnabled) { await recordTelegramAlertSecure({status:"SKIPPED",message:text,error:"Telegram disabled"}); return {ok:false,skipped:true}; }
    if(!st.telegramChatId) { await recordTelegramAlertSecure({status:"SKIPPED",message:text,error:"Telegram chat ID missing"}); return {ok:false,reason:"Telegram chat ID missing"}; }
    try{
      const edgeUrl=String(st.telegramEdgeFunctionUrl||cfg.TELEGRAM_EDGE_FUNCTION_URL||"").trim();
      let json={};
      if(edgeUrl){
        const res=await fetch(edgeUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:st.telegramChatId,text,parse_mode:"HTML",disable_web_page_preview:true})});
        json=await res.json().catch(()=>({}));
        if(!res.ok||json.ok===false) throw new Error(json.description||json.error||`Telegram edge HTTP ${res.status}`);
        await recordTelegramAlertSecure({status:"SENT",message:text,result:json,source:"edge-function"});
        return {ok:true,data:json,source:"edge-function"};
      }
      await recordTelegramAlertSecure({status:"SKIPPED",message:text,error:"Telegram Edge Function URL missing. Frontend bot-token fallback is disabled for safety."});
      return {ok:false,skipped:true,reason:"Telegram Edge Function URL missing. Set TELEGRAM_EDGE_FUNCTION_URL or settings.telegramEdgeFunctionUrl."};
    }catch(err){
      await recordTelegramAlertSecure({status:"FAILED",message:text,error:String(err?.message||err)});
      throw err;
    }
  }

  async function getAuthSession(){ assertReady(); if(!client.auth) return {session:null,user:null}; const {data,error}=await client.auth.getSession(); if(error) throw error; return {session:data?.session||null,user:data?.session?.user||null}; }
  async function signOutAuthSession(){ assertReady(); if(!client.auth) return {ok:false,skipped:true}; const {error}=await client.auth.signOut(); if(error) throw error; return {ok:true}; }
  async function linkAuthUserToAppUser(appUserId, authUserId){ assertReady(); pauseLocalLiveSync(); if(!appUserId||!authUserId) throw new Error("App user ID and auth user ID are required."); const {error}=await client.from("users").update({auth_user_id:String(authUserId),updated_at:new Date().toISOString()}).eq("id",String(appUserId)); if(error) throw error; return {ok:true,appUserId,authUserId}; }

  async function writeUser(row){ assertReady(); pauseLocalLiveSync(); const clean=rowUser(row); const {error}=await client.from("users").upsert(clean,{onConflict:"id"}); if(error) throw error; return clean; }
  async function writeKycRequest(row){ assertReady(); pauseLocalLiveSync(); const clean=rowKyc(row); const {error}=await client.from("kyc_requests").upsert(clean,{onConflict:"id"}); if(error) throw error; return clean; }
  async function writePaymentMethod(row){ assertReady(); pauseLocalLiveSync(); const clean=rowMethod(row); const {error}=await client.from("payment_methods").upsert(clean,{onConflict:"id"}); if(error) throw error; return clean; }
  async function writeDepositRequest(row){ assertReady(); pauseLocalLiveSync(); const clean=rowDeposit(row); const {error}=await client.from("deposit_requests").upsert(clean,{onConflict:"id"}); if(error) throw error; return clean; }
  async function approveDepositSecure({requestId,adminUserId="control_root",adminEmail="",adminName="Admin"}={}){ assertReady(); pauseLocalLiveSync(); const {data,error}=await client.rpc("aitradex_approve_deposit",{p_request_id:text(requestId),p_admin_user_id:text(adminUserId),p_admin_email:text(adminEmail),p_admin_name:text(adminName)}); if(error) throw error; return data||{}; }
  async function rejectDepositSecure({requestId,reason="Rejected by admin.",adminUserId="control_root",adminEmail="",adminName="Admin"}={}){ assertReady(); pauseLocalLiveSync(); const {data,error}=await client.rpc("aitradex_reject_deposit",{p_request_id:text(requestId),p_reason:text(reason),p_admin_user_id:text(adminUserId),p_admin_email:text(adminEmail),p_admin_name:text(adminName)}); if(error) throw error; return data||{}; }
  async function approveWithdrawalSecure({requestId,adminUserId="control_root",adminEmail="",adminName="Admin"}={}){ assertReady(); pauseLocalLiveSync(); const {data,error}=await client.rpc("aitradex_approve_withdrawal",{p_request_id:text(requestId),p_admin_user_id:text(adminUserId),p_admin_email:text(adminEmail),p_admin_name:text(adminName)}); if(error) throw error; return data||{}; }
  async function rejectWithdrawalSecure({requestId,reason="Rejected by admin.",adminUserId="control_root",adminEmail="",adminName="Admin"}={}){ assertReady(); pauseLocalLiveSync(); const {data,error}=await client.rpc("aitradex_reject_withdrawal",{p_request_id:text(requestId),p_reason:text(reason),p_admin_user_id:text(adminUserId),p_admin_email:text(adminEmail),p_admin_name:text(adminName)}); if(error) throw error; return data||{}; }
  async function approveKycSecure({kycId,adminUserId="control_root",adminEmail="",adminName="Admin"}={}){ assertReady(); pauseLocalLiveSync(); const {data,error}=await client.rpc("aitradex_approve_kyc",{p_kyc_id:text(kycId),p_admin_user_id:text(adminUserId),p_admin_email:text(adminEmail),p_admin_name:text(adminName)}); if(error) throw error; return data||{}; }
  async function rejectKycSecure({kycId,reason="Rejected by admin.",adminUserId="control_root",adminEmail="",adminName="Admin"}={}){ assertReady(); pauseLocalLiveSync(); const {data,error}=await client.rpc("aitradex_reject_kyc",{p_kyc_id:text(kycId),p_reason:text(reason),p_admin_user_id:text(adminUserId),p_admin_email:text(adminEmail),p_admin_name:text(adminName)}); if(error) throw error; return data||{}; }
  async function approvePaymentMethodSecure({methodId,adminUserId="control_root",adminEmail="",adminName="Admin"}={}){ assertReady(); pauseLocalLiveSync(); const {data,error}=await client.rpc("aitradex_approve_payment_method",{p_method_id:text(methodId),p_admin_user_id:text(adminUserId),p_admin_email:text(adminEmail),p_admin_name:text(adminName)}); if(error) throw error; return data||{}; }
  async function rejectPaymentMethodSecure({methodId,reason="Rejected by admin.",adminUserId="control_root",adminEmail="",adminName="Admin"}={}){ assertReady(); pauseLocalLiveSync(); const {data,error}=await client.rpc("aitradex_reject_payment_method",{p_method_id:text(methodId),p_reason:text(reason),p_admin_user_id:text(adminUserId),p_admin_email:text(adminEmail),p_admin_name:text(adminName)}); if(error) throw error; return data||{}; }
  async function closeAiLiveBatchSecure({batchId,reason="ADMIN_BATCH_CLOSE",exitPrice=0,exitPriceDisplay="",exitPriceSource="Admin close",adminUserId="control_root",adminEmail="",adminName="Admin"}={}){ assertReady(); pauseLocalLiveSync(); const {data,error}=await client.rpc("aitradex_close_ai_live_batch",{p_batch_id:text(batchId),p_reason:text(reason),p_exit_price:num(exitPrice),p_exit_price_display:text(exitPriceDisplay),p_exit_price_source:text(exitPriceSource),p_admin_user_id:text(adminUserId),p_admin_email:text(adminEmail),p_admin_name:text(adminName)}); if(error) throw error; return data||{}; }
  async function openManualTradeSecure({tradeId,userId,accountType="REAL",orderType="MARKET",market="CRYPTO",pair="",side="BUY",margin=0,leverage=1,entryPrice=0,entryPriceDisplay="",limitPrice=0,limitPriceDisplay="",priceSource="Live price cache"}={}){ assertReady(); pauseLocalLiveSync(); const {data,error}=await client.rpc("aitradex_open_manual_trade",{p_trade_id:text(tradeId),p_user_id:text(userId),p_account_type:text(accountType),p_order_type:text(orderType),p_market:text(market),p_pair:text(pair),p_side:text(side),p_margin:num(margin),p_leverage:num(leverage),p_entry_price:num(entryPrice),p_entry_price_display:text(entryPriceDisplay),p_limit_price:num(limitPrice),p_limit_price_display:text(limitPriceDisplay),p_price_source:text(priceSource)}); if(error) throw error; return data||{}; }
  async function closeManualTradeSecure({tradeId,userId,exitPrice=0,exitPriceDisplay="",exitPriceSource="Live price cache",reason="USER_CLOSE"}={}){ assertReady(); pauseLocalLiveSync(); const {data,error}=await client.rpc("aitradex_close_manual_trade",{p_trade_id:text(tradeId),p_user_id:text(userId),p_exit_price:num(exitPrice),p_exit_price_display:text(exitPriceDisplay),p_exit_price_source:text(exitPriceSource),p_reason:text(reason)}); if(error) throw error; return data||{}; }
  async function cancelManualLimitSecure({tradeId,userId}={}){ assertReady(); pauseLocalLiveSync(); const {data,error}=await client.rpc("aitradex_cancel_manual_limit",{p_trade_id:text(tradeId),p_user_id:text(userId)}); if(error) throw error; return data||{}; }
  async function purchasePlanSecure({subscriptionId,userId,planId,source="USER_PURCHASE"}={}){ assertReady(); pauseLocalLiveSync(); const {data,error}=await client.rpc("aitradex_purchase_plan",{p_subscription_id:text(subscriptionId),p_user_id:text(userId),p_plan_id:text(planId),p_source:text(source)}); if(error) throw error; return data||{}; }
  async function repairReferralBonusesSecure({adminUserId="control_root",adminEmail="",adminName="Admin"}={}){ assertReady(); pauseLocalLiveSync(); const {data,error}=await client.rpc("aitradex_repair_referral_bonuses",{p_admin_user_id:text(adminUserId),p_admin_email:text(adminEmail),p_admin_name:text(adminName)}); if(error) throw error; return data||{}; }
  async function changeUserPlanSecure({userId,planId,adminUserId="control_root",adminEmail="",adminName="Admin"}={}){ assertReady(); pauseLocalLiveSync(); const {data,error}=await client.rpc("aitradex_change_user_plan",{p_user_id:text(userId),p_plan_id:text(planId),p_admin_user_id:text(adminUserId),p_admin_email:text(adminEmail),p_admin_name:text(adminName)}); if(error) throw error; return data||{}; }
  async function adjustWalletSecure({userId,action="ADD",amount=0,note="",referenceId="",adminUserId="control_root",adminEmail="",adminName="Admin"}={}){ assertReady(); pauseLocalLiveSync(); const {data,error}=await client.rpc("aitradex_admin_wallet_adjust",{p_user_id:text(userId),p_action:text(action),p_amount:num(amount),p_note:text(note),p_reference_id:text(referenceId),p_admin_user_id:text(adminUserId),p_admin_email:text(adminEmail),p_admin_name:text(adminName)}); if(error) throw error; return data||{}; }
  async function writeWithdrawalRequest(row){ assertReady(); pauseLocalLiveSync(); const clean=rowWithdrawal(row); const {error}=await client.from("withdrawal_requests").upsert(clean,{onConflict:"id"}); if(error) throw error; return clean; }
  async function writeLedger(row){ assertReady(); pauseLocalLiveSync(); const clean=rowLedger(row); const {error}=await client.from("wallet_ledger").upsert(clean,{onConflict:"id"}); if(error) throw error; return clean; }
  async function writeTrade(row){ assertReady(); pauseLocalLiveSync(); const clean=rowTrade(row); const {error}=await client.from("trade_orders").upsert(clean,{onConflict:"id"}); if(error) throw error; return clean; }
  async function deleteTrade(id){ assertReady(); pauseLocalLiveSync(); const clean=text(id); if(!clean) return false; const {error}=await client.from("trade_orders").delete().eq("id", clean); if(error) throw error; return true; }
  async function writeAiBatch(row){ assertReady(); pauseLocalLiveSync(); const clean=rowBatch(row); const {error}=await client.from("ai_trade_batches").upsert(clean,{onConflict:"id"}); if(error) throw error; return clean; }
  async function deleteAiBatch(id){ assertReady(); pauseLocalLiveSync(); const clean=text(id); if(!clean) return false; const {error}=await client.from("ai_trade_batches").delete().eq("id", clean); if(error) throw error; return true; }
  async function writePlan(row){ assertReady(); pauseLocalLiveSync(); const clean=rowPlan(row); const {error}=await client.from("plans").upsert(clean,{onConflict:"id"}); if(error) throw error; return clean; }
  async function writeSubscription(row){ assertReady(); pauseLocalLiveSync(); const clean=rowSubscription(row); const {error}=await client.from("subscriptions").upsert(clean,{onConflict:"id"}); if(error) throw error; return clean; }
  async function writeReferral(row){ assertReady(); pauseLocalLiveSync(); const clean=rowReferral(row); const {error}=await client.from("referrals").upsert(clean,{onConflict:"id"}); if(error) throw error; return clean; }
  async function writeSupportTicket(row){ assertReady(); pauseLocalLiveSync(); const clean=rowSupportTicket(row); const {error}=await client.from("support_tickets").upsert(clean,{onConflict:"id"}); if(error) throw error; return clean; }
  async function writeNotification(row){ assertReady(); pauseLocalLiveSync(); const clean=rowNotification(row); const {error}=await client.from("notifications").upsert(clean,{onConflict:"id"}); if(error) throw error; return clean; }
  async function writeAdminAction(row){ assertReady(); pauseLocalLiveSync(); const clean=rowAdminLog(row); const {error}=await client.from("admin_action_logs").upsert(clean,{onConflict:"id"}); if(error) throw error; return clean; }
  async function deletePaymentMethod(id){ assertReady(); pauseLocalLiveSync(); const cleanId=text(id); if(!cleanId) throw new Error("Payment method ID missing."); const {error}=await client.from("payment_methods").delete().eq("id",cleanId); if(error) throw error; return {ok:true,id:cleanId}; }
  async function deleteNotification(id){ assertReady(); pauseLocalLiveSync(); const cleanId=text(id); if(!cleanId) throw new Error("Notification ID missing."); const {error}=await client.from("notifications").delete().eq("id",cleanId); if(error) throw error; return {ok:true,id:cleanId}; }
  async function writeSettings(settings){ assertReady(); pauseLocalLiveSync(); const row={id:"main",settings:{...clone(settings||App.state.settings||{}),databaseRuntimeVersion:"6.9.2",updatedBy:"admin"},updated_at:new Date().toISOString()}; const {error}=await client.from("app_settings").upsert(row,{onConflict:"id"}); if(error) throw error; return row; }
  function fire(promise,label){ if(!ready) return; Promise.resolve(promise).catch(err=>{ console.warn(`[AITradeX DB] ${label||"write"} failed:`, err?.message||err); status(`${label||"DB write"} failed: ${err?.message||err}`, false); }); }

  async function uploadUserFile({bucket,folder="uploads",label="file",file,userId}){
    assertReady();
    if(!file) throw new Error("No file selected.");
    const safeBucket=text(bucket).trim();
    if(!safeBucket) throw new Error("Storage bucket missing.");
    const ext=(String(file.name||"file").split(".").pop()||"bin").replace(/[^a-z0-9]/gi,"").toLowerCase()||"bin";
    const cleanFolder=text(folder||"uploads").replace(/[^a-z0-9/_-]/gi,"-").replace(/-+/g,"-");
    const cleanLabel=text(label||"file").replace(/[^a-z0-9_-]/gi,"-").replace(/-+/g,"-");
    const path=`${cleanFolder}/${text(userId||"guest")}/${Date.now()}_${cleanLabel}.${ext}`;
    const {error}=await client.storage.from(safeBucket).upload(path,file,{upsert:true,contentType:file.type||"application/octet-stream"});
    if(error) throw error;
    const {data}=client.storage.from(safeBucket).getPublicUrl(path);
    return {bucket:safeBucket,path,url:data?.publicUrl||"",name:file.name||`${cleanLabel}.${ext}`,size:file.size||0,type:file.type||"",uploadedAt:new Date().toISOString()};
  }

  async function backupFullState({savedBy="admin",note="Manual backup"}={}){ assertReady(); const payload={app_version:"AITradeX-Phase6.7",saved_by:savedBy,note,counts:{users:(App.state.users||[]).length},state:clone(App.state)}; const {data,error}=await client.from("app_state_snapshots").insert(payload).select("id,saved_at,counts,note").single(); if(error) throw error; return data; }
  async function latestSnapshot(){ assertReady(); const {data,error}=await client.from("app_state_snapshots").select("id,saved_at,saved_by,note,counts,state").order("saved_at",{ascending:false}).limit(1).maybeSingle(); if(error) throw error; return data; }
  async function restoreLatestSnapshot(){ const snap=await latestSnapshot(); if(!snap?.state) throw new Error("No database backup found."); App.state=snap.state; await fullSync(); return snap; }
  function downloadLocalBackup(){ const blob=new Blob([JSON.stringify({app:"AITradeX",exportedAt:new Date().toISOString(),state:clone(App.state)},null,2)],{type:"application/json"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`aitradex-backup-${new Date().toISOString().slice(0,10)}.json`; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},400); }
  function importLocalBackup(file){ return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=async()=>{ try{ const json=JSON.parse(String(r.result||"{}")); App.state=json.state||json; await fullSync(); resolve(true); }catch(e){reject(e);} }; r.onerror=()=>reject(new Error("Unable to read backup file.")); r.readAsText(file); }); }

  function subscribeRealtimeChanges(onChange, opts={}){
    if(!ready || !client?.channel) return {unsubscribe(){},status:"unavailable"};
    const name=`aitradex_live_sync_${opts.role||"app"}_${Date.now()}`;
    const channel=client.channel(name);
    REALTIME_TABLES.forEach(table=>{
      channel.on("postgres_changes",{event:"*",schema:"public",table},payload=>{
        try{ if(typeof onChange==="function") onChange({table,payload,at:new Date().toISOString()}); }
        catch(err){ console.warn("Live Sync event handler failed",err?.message||err); }
      });
    });
    channel.subscribe(statusText=>{
      if(statusText==="SUBSCRIBED") console.info("AITradeX Live Sync listening", opts.role||"app");
      if(["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(statusText)) console.warn("AITradeX Live Sync channel status", statusText);
    });
    return {channel,status:"subscribed",unsubscribe(){ try{return client.removeChannel(channel);}catch{return null;} }};
  }

  const api={ready,client,loadAll,pullCoreTables:loadAll,syncCoreTables:fullSync,fullSync,scheduleFullSync,testConnection,getAuthSession,signOutAuthSession,linkAuthUserToAppUser,findUser,createUser,updateUser,writeUser,writeKycRequest,writePaymentMethod,writeDepositRequest,approveDepositSecure,rejectDepositSecure,approveWithdrawalSecure,rejectWithdrawalSecure,approveKycSecure,rejectKycSecure,approvePaymentMethodSecure,rejectPaymentMethodSecure,closeAiLiveBatchSecure,openManualTradeSecure,closeManualTradeSecure,cancelManualLimitSecure,purchasePlanSecure,repairReferralBonusesSecure,changeUserPlanSecure,adjustWalletSecure,recordTelegramAlertSecure,writeWithdrawalRequest,writeLedger,writeTrade,deleteTrade,writeAiBatch,deleteAiBatch,writePlan,writeSubscription,writeReferral,writeSupportTicket,writeNotification,writeAdminAction,deletePaymentMethod,deleteNotification,writeSettings,uploadUserFile,fire,lastSyncStatus,sendTelegramMessage,backupFullState,latestSnapshot,restoreLatestSnapshot,downloadLocalBackup,importLocalBackup,subscribeRealtimeChanges};
  window.AITradeXDB=api; window.AppDB=api;
})();
