// Supabase Config
// 1) Supabase project create करो
// 2) Project Settings > API से URL और anon public key copy करो
// 3) नीचे paste करो
// Empty रहने पर app localStorage mode में चलेगा.

window.APP_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  // Local admin fallback login
  ADMIN_EMAIL: "admin@aitrade.local",
  ADMIN_PASSWORD: "admin123",

  // Manual gateway details
  UPI_ID: "yourupi@bank",
  ACCOUNT_NAME: "AI Trading Assistant",
  BANK_NAME: "Your Bank Name",
  ACCOUNT_NO: "000000000000",
  IFSC: "ABCD0000000"
};
