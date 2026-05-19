-- WALLET BALANCE / HOLD LOGIC COLUMNS
alter table public.deposit_requests add column if not exists balance_applied boolean default false;
alter table public.withdrawal_requests add column if not exists hold_applied boolean default false;
alter table public.deposit_requests add column if not exists reviewed_at timestamptz;
alter table public.withdrawal_requests add column if not exists reviewed_at timestamptz;
