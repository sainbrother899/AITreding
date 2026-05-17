AI Trading Assistant Pro Update

Added:
- Login/Register UI
- Local admin login: admin@aitrade.local / admin123
- Supabase-ready config and SQL schema
- Real crypto prices using Binance public ticker API
- Manual payment gateway, UTR and screenshot input
- Admin payment approval
- User referral code and referral link
- PnL analytics dashboard
- AI-style indicator engine using live BTC 24h movement
- Mobile app style UI
- Dark neon animated background

Not Added:
- Razorpay subscription
- Telegram signal bot

Files:
- index.html
- styles.css
- app.js
- config.js
- supabase-schema.sql

How to upload:
1. Extract ZIP.
2. Upload all files to GitHub repo root or Hostinger public_html.
3. Open index.html / website URL.
4. For Supabase:
   - Create Supabase project
   - Run supabase-schema.sql in SQL editor
   - Copy Project URL + anon public key into config.js

Important:
This is still a frontend/static + Supabase-ready build. For production you should add:
- Secure server-side admin verification
- Proper Supabase Auth
- Storage bucket for payment screenshots
- Legal disclaimers and compliance
- Exchange API only if licensed/allowed


Separate Admin Login Added:
- User website: index.html
- Admin website: admin.html
- Admin credentials: admin@aitrade.local / admin123
- User side no longer shows Admin tab.
- Admin cannot login from index.html.
- Normal users cannot login from admin.html.
