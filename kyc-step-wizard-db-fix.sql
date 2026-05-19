-- =========================================================
-- KYC STEP WIZARD DB COLUMNS FIX
-- Run in Supabase SQL Editor if KYC wizard save fails.
-- =========================================================

create table if not exists public.kyc_requests (
  id bigint primary key,
  user_id text,
  name text,
  mobile text,
  doc_type text,
  doc_number text,
  status text default 'PENDING',
  created_at timestamptz default now()
);

alter table public.kyc_requests add column if not exists user_email text;
alter table public.kyc_requests add column if not exists full_name text;
alter table public.kyc_requests add column if not exists dob text;
alter table public.kyc_requests add column if not exists address text;
alter table public.kyc_requests add column if not exists documents jsonb default '{}'::jsonb;
alter table public.kyc_requests add column if not exists submitted_at timestamptz default now();
alter table public.kyc_requests add column if not exists reviewed_at timestamptz;
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
  uploaded_at timestamptz default now()
);

alter table public.kyc_requests enable row level security;
alter table public.kyc_documents enable row level security;

drop policy if exists "Allow kyc_requests insert" on public.kyc_requests;
drop policy if exists "Allow kyc_requests select" on public.kyc_requests;
drop policy if exists "Allow kyc_requests update" on public.kyc_requests;
drop policy if exists "Allow kyc_documents insert" on public.kyc_documents;
drop policy if exists "Allow kyc_documents select" on public.kyc_documents;

create policy "Allow kyc_requests insert" on public.kyc_requests for insert to anon, authenticated with check (true);
create policy "Allow kyc_requests select" on public.kyc_requests for select to anon, authenticated using (true);
create policy "Allow kyc_requests update" on public.kyc_requests for update to anon, authenticated using (true) with check (true);

create policy "Allow kyc_documents insert" on public.kyc_documents for insert to anon, authenticated with check (true);
create policy "Allow kyc_documents select" on public.kyc_documents for select to anon, authenticated using (true);
