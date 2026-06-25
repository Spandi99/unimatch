# Legi Review

For the MVP, student verification uses a photographed student Legi instead of SWITCH edu-ID.

## Required visible criteria

A reviewer should confirm that the Legi photo visibly contains:

- a face photo
- birthdate
- first and last name
- faculty
- an 8-digit student number in this format: `21-114-004`

The database enforces the student number format with:

```text
^[0-9]{2}-[0-9]{3}-[0-9]{3}$
```

## Product behavior

1. User signs in with a private email and password.
2. User creates their profile.
3. User takes a Legi photo with the camera.
4. The app uploads the dating profile photo to `profile-photos`.
5. The app uploads the Legi photo to `verification-documents`.
6. A `verification_requests` row is created with `status = pending`.
7. After a short manual review, an admin can mark the request verified/rejected and fill `legi_review_checks`.

## Supabase setup

Create both Storage buckets as private:

- `profile-photos`
- `verification-documents`

If the main schema was already run before Legi review was added, run:

```text
supabase/legi-review-migration.sql
```
