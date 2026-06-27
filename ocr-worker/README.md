# UniMatch OCR Worker

Free/open-source OCR service for Legi review using Tesseract.js.

## Local start

```bash
npm install
npm start
```

The worker listens on:

```text
http://localhost:8788
```

Health check:

```text
GET /health
```

OCR endpoint:

```text
POST /ocr
Content-Type: application/json

{
  "imageBase64": "..."
}
```

## Supabase Edge Function

Set these secrets for the `review-legi` function:

```text
LEGI_REVIEW_MODE=tesseract
LEGI_OCR_SERVICE_URL=https://your-public-ocr-worker-url
```

If the Supabase function runs in Supabase Cloud, `localhost` points to Supabase's server, not your laptop. Use a public deploy or a tunnel for testing.
