create table if not exists public.legi_review_checks (
  verification_request_id uuid primary key references public.verification_requests(id) on delete cascade,
  has_face_photo boolean,
  has_birthdate boolean,
  has_first_and_last_name boolean,
  has_faculty boolean,
  has_student_number boolean,
  student_number text check (student_number is null or student_number ~ '^[0-9]{2}-[0-9]{3}-[0-9]{3}$'),
  reviewer_notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz
);

alter table public.legi_review_checks enable row level security;

create policy "users read own legi review checks"
  on public.legi_review_checks for select
  to authenticated
  using (
    exists (
      select 1 from public.verification_requests vr
      where vr.id = verification_request_id and vr.user_id = auth.uid()
    )
  );

create policy "users upload own profile photo"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users update own profile photo"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users upload own verification document"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'verification-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users update own verification document"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'verification-documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'verification-documents' and (storage.foldername(name))[1] = auth.uid()::text);
