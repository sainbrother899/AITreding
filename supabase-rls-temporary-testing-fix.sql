-- =========================================================
-- TEMPORARY TESTING FIX FOR REPEATED RLS ERRORS
-- Use only while testing. Production me strict RLS/Auth lagani hogi.
-- =========================================================

-- 1) Public app tables: temporarily disable RLS so inserts don't fail.
alter table if exists public.kyc_requests disable row level security;
alter table if exists public.kyc_documents disable row level security;
alter table if exists public.user_payout_methods disable row level security;
alter table if exists public.payment_settings disable row level security;

grant usage on schema public to anon, authenticated;
grant all on table public.kyc_requests to anon, authenticated;
grant all on table public.kyc_documents to anon, authenticated;
grant all on table public.user_payout_methods to anon, authenticated;
grant all on table public.payment_settings to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- 2) Storage: keep only insert policy for kyc-documents bucket.
-- Code now uses upsert:false, so SELECT/UPDATE is not required for upload.
drop policy if exists "public upload kyc documents" on storage.objects;
drop policy if exists "public update kyc documents" on storage.objects;
drop policy if exists "public read kyc documents" on storage.objects;
drop policy if exists "public delete kyc documents" on storage.objects;

create policy "public upload kyc documents"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'kyc-documents');
