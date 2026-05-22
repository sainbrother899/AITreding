(()=>{
const App=window.AITradeX;
const normEmail=e=>String(e||"").trim().toLowerCase();
const normMobile=m=>String(m||"").replace(/\D/g,"").slice(-10);
const byEmail=e=>App.state.users.find(u=>normEmail(u.email)===normEmail(e));
const byMobile=m=>{const clean=normMobile(m);return clean?App.state.users.find(u=>normMobile(u.mobile)===clean):null};
function registerUser({name,email,mobile,password,referralCode}){
  email=normEmail(email);
  mobile=normMobile(mobile);
  if(!name||!email||!mobile||!password)throw new Error("Please fill all required fields.");
  if(!/^\d{10}$/.test(mobile))throw new Error("Please enter a valid 10 digit mobile number.");
  if(byEmail(email))throw new Error("This email is already registered. Please login instead.");
  if(byMobile(mobile))throw new Error("This mobile number is already linked with another account.");
  const cleanReferral=String(referralCode||"").trim().toUpperCase();
  const referredBy=cleanReferral?App.state.users.find(u=>String(u.referralCode||"").toUpperCase()===cleanReferral)?.id||null:null;
  const user={id:App.uid("user"),name:name.trim(),email,mobile,password,role:"user",status:"ACTIVE",referralCode:"AITX"+Math.random().toString(36).slice(2,8).toUpperCase(),referredBy,aiTradeOn:true,aiTradePercent:75,freeTrialStartedAt:new Date().toISOString(),createdAt:App.now()};
  App.state.users.push(user);
  App.state.profiles.push({id:App.uid("profile"),userId:user.id,name:user.name,email:user.email,mobile:user.mobile,createdAt:App.now()});
  if(referredBy)App.state.referrals.push({id:App.uid("ref"),referrerUserId:referredBy,referredUserId:user.id,status:"REGISTERED",commissionPaid:false,bonuses:{},createdAt:new Date().toISOString()});
  App.saveState();App.setSession(user.id,"user");return user
}
function loginUser({email,password}){const u=byEmail(email);if(!u||u.password!==password||u.role!=="user")throw new Error("Invalid user login details.");const status=String(u.status||"ACTIVE").toUpperCase();if(status==="BLOCKED")throw new Error("Your account is blocked.");if(status==="SUSPENDED")throw new Error("Your account is suspended. Please contact support.");App.setSession(u.id,"user");return u}
function loginControl({email,password}){const u=byEmail(email);if(!u||u.password!==password||u.role!=="admin")throw new Error("Invalid control center login.");App.setSession(u.id,"admin");return u}
window.AITradeXAuth={registerUser,loginUser,loginControl};
})();


(() => {
  const Auth = window.AITradeXAuth;
  const App = window.AITradeX;
  if (!Auth || !App || Auth.loginAdmin) return;

  Auth.loginAdmin = function ({ email, password }) {
    const admin = App.state.users.find(
      u => u.role === "admin" && String(u.email).toLowerCase() === String(email).toLowerCase() && u.password === password
    );

    if (!admin) {
      throw new Error("Invalid admin login.");
    }

    App.setSession(admin.id);
    return admin;
  };
})();
