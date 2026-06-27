-- Replace this with the id from public.verification_requests.
-- Run this in Supabase SQL Editor to simulate a completed manual Legi review.

begin;

insert into public.legi_review_checks (
  verification_request_id,
  has_face_photo,
  has_birthdate,
  has_first_and_last_name,
  has_faculty,
  has_student_number,
  student_number,
  reviewer_notes,
  reviewed_at
) values (
  'REPLACE_WITH_VERIFICATION_REQUEST_ID',
  true,
  true,
  true,
  true,
  true,
  '21-114-004',
  'Manual MVP review passed.',
  now()
)
on conflict (verification_request_id) do update set
  has_face_photo = excluded.has_face_photo,
  has_birthdate = excluded.has_birthdate,
  has_first_and_last_name = excluded.has_first_and_last_name,
  has_faculty = excluded.has_faculty,
  has_student_number = excluded.has_student_number,
  student_number = excluded.student_number,
  reviewer_notes = excluded.reviewer_notes,
  reviewed_at = excluded.reviewed_at;

update public.verification_requests
set status = 'verified',
    reviewed_at = now()
where id = 'REPLACE_WITH_VERIFICATION_REQUEST_ID';

commit;
