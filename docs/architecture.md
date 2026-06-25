# Architecture

## Product direction

UniMatch should feel local and low-pressure. Nearby mode is opt-in, approximate and temporary. Conversations begin as message requests so the recipient can review the sender profile before accepting.

## Recommended stack

- App: Expo + React Native + TypeScript.
- Backend: Supabase Auth, Postgres, Row Level Security and Storage.
- Location: approximate geohash or coarse coordinates only while nearby mode is enabled.
- Verification: use a Legi photo review for the MVP. SWITCH edu-ID can be added later when official access is available.

## Core entities

- `profiles`: public-ish dating profile, linked to an auth user.
- `verification_requests`: SWITCH/Legi verification state.
- `legi_review_checks`: reviewer checklist for visible Legi criteria.
- `nearby_sessions`: temporary visibility records.
- `message_requests`: pending intro messages.
- `matches`: accepted connections.
- `messages`: chat messages after acceptance.

## Privacy defaults

- Store only one profile photo for the MVP.
- Store Legi photos in a separate private `verification-documents` bucket.
- Never expose exact GPS coordinates to other users.
- Delete or expire nearby sessions automatically.
- Require an accepted message request before chat.
- Keep verification documents separate from public profile data.
