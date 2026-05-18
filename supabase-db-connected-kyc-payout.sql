-- =========================================================
-- DB CONNECTED KYC + PAYOUT + PAYMENT SETTINGS PATCH
-- Run this in Supabase SQL Editor.
-- NOTE: policies below are permissive for testing. For production, replace with auth-based RLS.
-- =========================================================

alter table public.kyc_requests add column if not exists full_name text;
alter table public.kyc_requests add column if not exists dob text;
alter table public.kyc_requests add column if not exists address text;
alter table public.kyc_requests add column if not exists documents jsonb default '{}'::jsonb;
alter table public.kyc_requests add column if not exists submitted_at timestamp with time zone default now();
alter table public.kyc_requests add column if not exists reviewed_at timestamp with time zone;
alter table public.kyc_requests add column if not exists reviewed_by text;

create table if not exists public.kyc_documents (
  id text primary key,
  kyc_id text,
  user_id text,
  doc_key text,
  file_name text,
  file_path text,
  file_url text,
  mime_type text,
  size_bytes bigint default 0,
  uploaded_at timestamp with time zone default now()
);

create table if not exists public.user_payout_methods (
  id text primary key,
  user_id text,
  method_type text,
  holder_name text,
  kyc_name_snapshot text,
  upi_id text,
  bank_name text,
  account_number text,
  ifsc text,
  status text default 'PENDING',
  name_match boolean default true,
  created_at_text text,
  created_at timestamp with time zone default now(),
  reviewed_at timestamp with time zone,
  reviewed_by text
);

create table if not exists public.payment_settings (
  id text primary key,
  method text,
  title text,
  upi_id text,
  qr_url text,
  account_name text,
  bank_name text,
  account_number text,
  ifsc text,
  branch text,
  is_active boolean default true,
  updated_at timestamp with time zone default now()
);

alter table public.kyc_documents enable row level security;
alter table public.user_payout_methods enable row level security;
alter table public.payment_settings enable row level security;

drop policy if exists "public all kyc_documents" on public.kyc_documents;
drop policy if exists "public all user_payout_methods" on public.user_payout_methods;
drop policy if exists "public all payment_settings" on public.payment_settings;

create policy "public all kyc_documents" on public.kyc_documents for all using (true) with check (true);
create policy "public all user_payout_methods" on public.user_payout_methods for all using (true) with check (true);
create policy "public all payment_settings" on public.payment_settings for all using (true) with check (true);

insert into public.payment_settings (id, method, title, upi_id, is_active)
values ('upi_default', 'UPI', 'UPI Payment', 'admin@upi', true)
on conflict (id) do nothing;

insert into public.payment_settings (id, method, title, account_name, bank_name, account_number, ifsc, branch, is_active)
values ('bank_default', 'BANK', 'Bank Transfer', 'AI Trading', 'Demo Bank', '0000000000', 'DEMO0000001', 'Main', true)
on conflict (id) do nothing;

-- Storage bucket for KYC documents
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kyc-documents',
  'kyc-documents',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do nothing;

drop policy if exists "public upload kyc documents" on storage.objects;
drop policy if exists "public read kyc documents" on storage.objects;
drop policy if exists "public update kyc documents" on storage.objects;
drop policy if exists "public delete kyc documents" on storage.objects;

create policy "public upload kyc documents"
on storage.objects for insert
with check (bucket_id = 'kyc-documents');

create policy "public read kyc documents"
on storage.objects for select
using (bucket_id = 'kyc-documents');

create policy "public update kyc documents"
on storage.objects for update
using (bucket_id = 'kyc-documents')
with check (bucket_id = 'kyc-documents');

create policy "public delete kyc documents"
on storage.objects for delete
using (bucket_id = 'kyc-documents');

create index if not exists idx_kyc_requests_user_status on public.kyc_requests(user_id, status);
create index if not exists idx_kyc_documents_user on public.kyc_documents(user_id, kyc_id);
create index if not exists idx_payout_methods_user_status on public.user_payout_methods(user_id, status);
