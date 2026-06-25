create extension if not exists pgcrypto;

create type public.gender_identity as enum (
  'woman',
  'man',
  'non_binary',
  'genderqueer',
  'agender',
  'trans_woman',
  'trans_man',
  'prefer_not_to_say'
);

create type public.verification_method as enum ('switch_edu_id', 'legi_card');
create type public.verification_status as enum ('pending', 'verified', 'rejected');
create type public.message_request_status as enum ('pending', 'accepted', 'declined');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  birthdate date not null,
  gender public.gender_identity not null,
  wants_to_meet text[] not null default array['everyone'],
  university text,
  degree text,
  bio text default '',
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  method public.verification_method not null,
  status public.verification_status not null default 'pending',
  legi_document_path text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.legi_review_checks (
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

create table public.nearby_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  coarse_lat double precision not null,
  coarse_lng double precision not null,
  area_label text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.message_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  note text not null check (char_length(note) between 1 and 500),
  status public.message_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique(sender_id, recipient_id)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_from_request uuid references public.message_requests(id),
  created_at timestamptz not null default now(),
  unique(user_a, user_b),
  check (user_a <> user_b)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.verification_requests enable row level security;
alter table public.legi_review_checks enable row level security;
alter table public.nearby_sessions enable row level security;
alter table public.message_requests enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;

create policy "profiles are visible to authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users manage their own profile"
  on public.profiles for all
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "users create verification requests"
  on public.verification_requests for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users read own verification requests"
  on public.verification_requests for select
  to authenticated
  using (auth.uid() = user_id);

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

create policy "users manage own nearby session"
  on public.nearby_sessions for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "authenticated users read active nearby sessions"
  on public.nearby_sessions for select
  to authenticated
  using (expires_at > now());

create policy "message request participants can read"
  on public.message_requests for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "users send message requests"
  on public.message_requests for insert
  to authenticated
  with check (auth.uid() = sender_id and sender_id <> recipient_id);

create policy "recipients answer message requests"
  on public.message_requests for update
  to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

create policy "match participants read"
  on public.matches for select
  to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);

create policy "message participants read"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_id and (m.user_a = auth.uid() or m.user_b = auth.uid())
    )
  );

create policy "message participants send"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id and exists (
      select 1 from public.matches m
      where m.id = match_id and (m.user_a = auth.uid() or m.user_b = auth.uid())
    )
  );
