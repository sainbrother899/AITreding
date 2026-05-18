AI Trading Clean Core Rebuild

UI/design same rakha gaya hai.
app.js clean rebuild hai, duplicate/old patch logic remove kiya gaya hai.

Core tested logic:
- Login/Register
- Demo/Real mode
- Deposit submit with 12 digit UTR + duplicate check
- Admin deposit approve/reject
- Real wallet ledger
- Withdrawal request + approve
- Manual trade unlimited
- Admin managed trade
- Mass trade
- Closed trade history
- AI/Admin daily plan limit
- First approved deposit referral bonus = 10%
- KYC basic submit
- Plan editor

SQL:
Run supabase-schema.sql once in Supabase SQL Editor.


DB Compatibility Fix:
- Fixed bigint id error by not sending string IDs to deposit_requests/withdrawal_requests when inserting.
- Added fallback for other tables: if bigint id error happens, insert is retried without id.
- Added SQL compatibility patch for missing metadata columns.
- Keep UI/design same.
- JS syntax check: OK


Deposit Bigint Hard Fix:
- Deposit submit now captures click before old handlers.
- Supabase insert never sends id to deposit_requests.
- Old submitDeposit/submitDepositFinal/createDepositRequest aliases overridden.
- 12 digit UTR validation and duplicate check kept.
- If same error appears, browser is still serving old cached app.js.
- JS syntax check: OK
