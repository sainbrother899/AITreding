-- AITradeX Phase 5.28 Storage Policies
-- Run this after creating buckets: kyc-documents, user-avatars, support-attachments.
-- Testing/client mode policy: allows the current browser app to upload and preview files with the anon key.
-- Before public launch, replace this with authenticated user/admin-only policies or Edge Functions.

insert into storage.buckets (id, name, public)
values
  ('kyc-documents', 'kyc-documents', false),
  ('user-avatars', 'user-avatars', false),
  ('support-attachments', 'support-attachments', false)
on conflict (id) do nothing;

drop policy if exists "AITradeX anon storage read" on storage.objects;
drop policy if exists "AITradeX anon storage insert" on storage.objects;
drop policy if exists "AITradeX anon storage update" on storage.objects;
drop policy if exists "AITradeX anon storage delete" on storage.objects;

create policy "AITradeX anon storage read"
on storage.objects
for select
to anon
using (bucket_id in ('kyc-documents', 'user-avatars', 'support-attachments'));

create policy "AITradeX anon storage insert"
on storage.objects
for insert
to anon
with check (bucket_id in ('kyc-documents', 'user-avatars', 'support-attachments'));

create policy "AITradeX anon storage update"
on storage.objects
for update
to anon
using (bucket_id in ('kyc-documents', 'user-avatars', 'support-attachments'))
with check (bucket_id in ('kyc-documents', 'user-avatars', 'support-attachments'));

create policy "AITradeX anon storage delete"
on storage.objects
for delete
to anon
using (bucket_id in ('kyc-documents', 'user-avatars', 'support-attachments'));
