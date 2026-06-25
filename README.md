# UniMatch

Cross-platform dating app MVP for students in Switzerland.

The original prototype was native SwiftUI for iOS only. This repository starts the shared iPhone + Android codebase with Expo, React Native, TypeScript and Supabase.

## Current scope

- Student verification flow placeholder: SWITCH edu-ID or Legi review.
- SWITCH edu-ID browser login required before profile registration.
- Onboarding with name, birthdate, gender, preferences and one profile photo.
- Profile records stored in Supabase.
- Photo upload target via Supabase Storage.
- Nearby/discover/matches/message-request data model prepared.
- The previous SwiftUI prototype is kept in `legacy-ios/` for reference.

## Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Create a private storage bucket named `profile-photos`.
4. Copy `.env.example` to `.env` and fill in the project URL and publishable key.
5. Configure SWITCH edu-ID SSO. See `docs/switch-edu-id.md`.
6. Install dependencies:

```bash
npm install
```

7. Start the app:

```bash
npm run start
```

Use Expo Go or a development build to run it on iPhone and Android.

## GitHub

This folder is ready to become the GitHub repository. Suggested repo name: `unimatch`.
