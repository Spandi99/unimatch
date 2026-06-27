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
7. The app invokes the `review-legi` Supabase Edge Function.
8. In demo mode, the function confirms that an image exists and fills the criteria with test values.
9. In Tesseract mode, the function sends the Legi image to the open-source OCR worker and fills `legi_review_checks`.
10. In OpenAI mode, the function can optionally send the Legi image to a vision model.

## Review modes

The recommended MVP path is free/open-source Tesseract OCR:

```text
LEGI_REVIEW_MODE=tesseract
LEGI_OCR_SERVICE_URL=https://your-ocr-worker.example.com
```

For local testing, run the OCR worker:

```text
cd ocr-worker
npm install
npm start
```

Then expose it to Supabase with a tunnel or deploy it to a small host. The local worker listens on:

```text
http://localhost:8788
```

Tesseract OCR can read text and detect the student number/date/name/faculty heuristically. It cannot reliably verify that a face photo is visible, so the MVP treats the face-photo criterion as provisionally passed when an image was uploaded and records that limitation in the review notes.

For local/MVP testing without real OCR, either omit OCR/OpenAI secrets or set:

```text
LEGI_REVIEW_MODE=demo
```

To enable OpenAI vision later, set:

```text
LEGI_REVIEW_MODE=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
```

## Supabase setup

Create both Storage buckets as private:

- `profile-photos`
- `verification-documents`

If the main schema was already run before Legi review was added, run:

```text
supabase/legi-review-migration.sql
```

Deploy the automated review function with:

```text
supabase functions deploy review-legi
```
