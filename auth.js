(() => {
  const App = window.AITradeX;
  const DB = window.AITradeXDB;
  const normEmail = e => String(e || "").trim().toLowerCase();
  const normMobile = m => String(m || "").replace(/\D/g, "").slice(-10);
  const byEmail = e => App.state.users.find(u => normEmail(u.email) === normEmail(e));
  const byMobile = m => { const clean = normMobile(m); return clean ? App.state.users.find(u => normMobile(u.mobile) === clean) : null; };
  const isDb = () => !!(DB && DB.ready);
  const uid = p => App.uid ? App.uid(p) : `${p}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const HASH_PREFIX = "sha256$";

  function userLockKey(email){return "AITradeX_USER_LOGIN_LOCK_"+normEmail(email)}
  function userLockInfo(email){try{return JSON.parse(localStorage.getItem(userLockKey(email))||"{}")||{}}catch{return {}}}
  function saveUserLock(email,row){localStorage.setItem(userLockKey(email),JSON.stringify(row||{}))}
  function clearUserLock(email){localStorage.removeItem(userLockKey(email))}
  function registerUserFailure(email){const row=userLockInfo(email);const attempts=Number(row.attempts||0)+1;const lockedUntil=attempts>=6?Date.now()+10*60*1000:0;saveUserLock(email,{attempts,lockedUntil,lastFailedAt:Date.now()});return {attempts,lockedUntil}}
  function guardUserLock(email){const row=userLockInfo(email);const lockedUntil=Number(row.lockedUntil||0);if(lockedUntil&&Date.now()<lockedUntil){const mins=Math.ceil((lockedUntil-Date.now())/60000);throw new Error(`Too many wrong login attempts. Try again in ${mins} minute(s).`)}}
  function adminLockKey(email){return "AITradeX_ADMIN_LOGIN_LOCK_"+normEmail(email)}
  function adminLockInfo(email){try{return JSON.parse(localStorage.getItem(adminLockKey(email))||"{}")||{}}catch{return {}}}
  function saveAdminLock(email,row){localStorage.setItem(adminLockKey(email),JSON.stringify(row||{}))}
  function clearAdminLock(email){localStorage.removeItem(adminLockKey(email))}
  function registerAdminFailure(email){const row=adminLockInfo(email);const attempts=Number(row.attempts||0)+1;const lockedUntil=attempts>=5?Date.now()+15*60*1000:0;saveAdminLock(email,{attempts,lockedUntil,lastFailedAt:Date.now()});return {attempts,lockedUntil}}
  function guardAdminLock(email){const row=adminLockInfo(email);const lockedUntil=Number(row.lockedUntil||0);if(lockedUntil&&Date.now()<lockedUntil){const mins=Math.ceil((lockedUntil-Date.now())/60000);throw new Error(`Too many wrong admin login attempts. Try again in ${mins} minute(s).`)}}

  function randomSalt(){
    try{ const bytes=new Uint8Array(16); crypto.getRandomValues(bytes); return Array.from(bytes).map(b=>b.toString(16).padStart(2,"0")).join(""); }
    catch{ return `${Date.now().toString(36)}${Math.random().toString(36).slice(2,14)}`; }
  }
  function fallbackHash(str){
    let h1=0x811c9dc5,h2=0x9e3779b9;
    for(let i=0;i<str.length;i++){ const c=str.charCodeAt(i); h1^=c; h1=Math.imul(h1,16777619); h2^=(c+i); h2=Math.imul(h2,1597334677); }
    return `${(h1>>>0).toString(16).padStart(8,"0")}${(h2>>>0).toString(16).padStart(8,"0")}`;
  }
  async function sha256Hex(text){
    const value=String(text||"");
    if(window.crypto?.subtle && window.TextEncoder){
      const data=new TextEncoder().encode(value);
      const hash=await crypto.subtle.digest("SHA-256",data);
      return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");
    }
    return fallbackHash(value);
  }
  async function hashPassword(password, salt=randomSalt()){
    const clean=String(password||"");
    const digest=await sha256Hex(`${salt}:${clean}`);
    return `${HASH_PREFIX}${salt}$${digest}`;
  }
  function isPasswordHash(value){ return String(value||"").startsWith(HASH_PREFIX); }
  async function verifyPassword(user,password){
    const stored=String(user?.passwordHash||user?.password_hash||user?.password||"");
    const input=String(password||"");
    if(!stored) return {ok:false,needsMigration:false};
    if(isPasswordHash(stored)){
      const parts=stored.split("$");
      const salt=parts[1]||"";
      const check=await hashPassword(input,salt);
      return {ok:check===stored,needsMigration:false};
    }
    return {ok:stored===input,needsMigration:stored===input};
  }
  async function setPassword(user,password,{updatedBy="user"}={}){
    if(!user) throw new Error("User not found.");
    const computedHash=await hashPassword(password,user.id||randomSalt());
    // Phase 6.1 foundation: keep legacy + normalized DB password fields aligned until Supabase Auth migration is enabled.
    user.password=computedHash;
    user.passwordHash=computedHash;
    user.password_hash=computedHash;
    user.passwordUpdatedAt=App.now?.()||new Date().toISOString();
    user.passwordUpdatedBy=updatedBy;
    return user;
  }
  async function migratePasswordIfNeeded(user, password, verification){
    if(user && verification?.needsMigration){
      await setPassword(user,password,{updatedBy:"auto-migration"});
      if(isDb()&&DB.writeUser) await DB.writeUser(user);
    }
  }

  async function ensureDbLoaded(){ if(isDb()) await DB.loadAll(); }
  async function registerUser({name,email,mobile,password,referralCode}){
    email=normEmail(email); mobile=normMobile(mobile);
    if(!name||!email||!mobile||!password) throw new Error("Please fill all required fields.");
    if(!/^\d{10}$/.test(mobile)) throw new Error("Please enter a valid 10 digit mobile number.");
    if(isDb()){
      const existingEmail=await DB.findUser(email);
      const existingMobile=await DB.findUser(mobile);
      const existing=existingEmail || existingMobile;
      if(existing){
        const verification=await verifyPassword(existing,password);
        if(verification.ok && existing.role==="user") { await migratePasswordIfNeeded(existing,password,verification); App.setSession(existing.id,"user"); await DB.loadAll(); return existing; }
        throw new Error(existingEmail?"This email is already registered. Please login instead.":"This mobile number is already linked with another account.");
      }
    } else {
      if(byEmail(email)) throw new Error("This email is already registered. Please login instead.");
      if(byMobile(mobile)) throw new Error("This mobile number is already linked with another account.");
    }
    const cleanReferral=String(referralCode||"").trim().toUpperCase();
    if(isDb()) await DB.loadAll();
    const referredBy=cleanReferral?(App.state.users.find(u=>String(u.referralCode||"").toUpperCase()===cleanReferral)?.id||null):null;
    const user={id:uid("user"),name:name.trim(),email,mobile,role:"user",status:"ACTIVE",referralCode:"AITX"+Math.random().toString(36).slice(2,8).toUpperCase(),referredBy,aiTradeOn:true,aiTradePercent:75,freeTrialStartedAt:new Date().toISOString(),createdAt:App.now()};
    await setPassword(user,password,{updatedBy:"register"});
    if(isDb()) await DB.createUser(user);
    App.state.users=App.state.users.filter(u=>u.id!==user.id && normEmail(u.email)!==email && normMobile(u.mobile)!==mobile);
    App.state.users.push(user);
    App.state.profiles=App.state.profiles||[];
    App.state.profiles.push({id:uid("profile"),userId:user.id,name:user.name,email:user.email,mobile:user.mobile,createdAt:App.now()});
    if(referredBy){
      App.state.referrals=App.state.referrals||[];
      const refRow={id:uid("ref"),referrerUserId:referredBy,referredUserId:user.id,status:"REGISTERED",commissionPaid:false,bonuses:{},createdAt:new Date().toISOString()};
      App.state.referrals.push(refRow);
      if(isDb()&&DB.writeReferral) await DB.writeReferral(refRow);
    }
    App.setSession(user.id,"user");
    App.saveState();
    return user;
  }
  async function loginUser({email,password}){
    email=normEmail(email); guardUserLock(email);
    let u=null;
    if(isDb()){ u=await DB.findUser(email); if(u){ App.state.users=App.state.users.filter(x=>x.id!==u.id); App.state.users.push(u); } }
    else u=byEmail(email);
    const verification=await verifyPassword(u,password);
    if(!u||!verification.ok||u.role!=="user"){
      const row=registerUserFailure(email); const left=Math.max(0,6-Number(row.attempts||0));
      throw new Error(left?`Invalid user login details. ${left} attempt(s) left before temporary lock.`:"Invalid user login details. Login temporarily locked.");
    }
    const status=String(u.status||"ACTIVE").toUpperCase(); if(status==="BLOCKED") throw new Error("Your account is blocked."); if(status==="SUSPENDED") throw new Error("Your account is suspended. Please contact support.");
    clearUserLock(email); await migratePasswordIfNeeded(u,password,verification); u.lastLoginAt=new Date().toISOString(); if(isDb()&&DB.writeUser) await DB.writeUser(u); App.setSession(u.id,"user"); if(isDb()) await DB.loadAll(); App.saveState(); return u;
  }
  async function ensureDefaultAdminInDb(email,password){
    if(!isDb()) return null;
    const rootEmail="control@aitradex.com";
    if((window.AITRADEX_CONFIG||{}).ALLOW_DEFAULT_ADMIN_FALLBACK !== true) return null;
    if(normEmail(email)!==rootEmail || String(password||"")!=="admin123") return null;
    const admin={id:"control_root",name:"AITradeX Control",email:rootEmail,mobile:"",role:"admin",status:"ACTIVE",referralCode:"CONTROL",password:"sha256$control_root$4777731d2f274363db7e3be6b9f78af08f0210a102cf2b137445d4daf9b13c02",passwordHash:"sha256$control_root$4777731d2f274363db7e3be6b9f78af08f0210a102cf2b137445d4daf9b13c02",createdAt:new Date().toISOString()};
    if(DB.writeUser) await DB.writeUser(admin);
    App.state.users=App.state.users.filter(x=>x.id!==admin.id&&normEmail(x.email)!==rootEmail);
    App.state.users.push(admin);
    return admin;
  }

  async function loginControl({email,password}){
    email=normEmail(email); guardAdminLock(email);
    let u=null;
    if(isDb()){ u=await DB.findUser(email); if(!u) u=await ensureDefaultAdminInDb(email,password); if(u){ App.state.users=App.state.users.filter(x=>x.id!==u.id); App.state.users.push(u); } }
    else u=byEmail(email);
    const verification=await verifyPassword(u,password);
    if(!u||!verification.ok||u.role!=="admin"){
      const row=registerAdminFailure(email); const left=Math.max(0,5-Number(row.attempts||0));
      throw new Error(left?`Invalid control center login. ${left} attempt(s) left before temporary lock.`:"Invalid control center login. Admin login temporarily locked.");
    }
    clearAdminLock(email); await migratePasswordIfNeeded(u,password,verification); u.lastLoginAt=new Date().toISOString(); if(isDb()&&DB.writeUser) await DB.writeUser(u); App.setSession(u.id,"admin"); if(isDb()) await DB.loadAll(); return u;
  }
  async function authReadiness(){
    const client=window.AITradeXDB?.client;
    if(!client?.auth) return {ok:false,mode:"legacy-testing",message:"Supabase Auth client is not available; legacy testing auth is active."};
    try{
      const {data,error}=await client.auth.getSession();
      if(error) throw error;
      return {ok:true,mode:"legacy-testing",hasSession:!!data?.session,message:"Supabase Auth SDK reachable. Phase6.1 keeps legacy login active until backend functions are migrated."};
    }catch(err){
      return {ok:false,mode:"legacy-testing",message:err?.message||"Supabase Auth readiness check failed."};
    }
  }
  window.AITradeXAuth={registerUser,loginUser,loginControl,loginAdmin:loginControl,hashPassword,verifyPassword,setPassword,isPasswordHash,authReadiness};
})();
