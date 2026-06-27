drop policy if exists "users read own profile photo" on storage.objects;
drop policy if exists "users read own verification document" on storage.objects;

create policy "users read own profile photo"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users read own verification document"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'verification-documents' and (storage.foldername(name))[1] = auth.uid()::text);
