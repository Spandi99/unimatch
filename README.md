# UniMatch

Cross-platform dating app MVP for students in Switzerland.

The original prototype was native SwiftUI for iOS only. This repository starts the shared iPhone + Android codebase with Expo, React Native, TypeScript and Supabase.

## Current scope

- Student verification flow placeholder: SWITCH edu-ID or Legi review.
- Private email/password login with Supabase Auth.
- Legi photo review before provisional student access.
- Supabase Edge Function for automated Legi review, with free Tesseract OCR mode, free demo mode and optional OpenAI mode.
- Onboarding with name, birthdate, gender, preferences and one profile photo.
- Profile records stored in Supabase.
- Photo upload target via Supabase Storage.
- Nearby/discover/matches/message-request data model prepared.
- The previous SwiftUI prototype is kept in `legacy-ios/` for reference.

## Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Create private storage buckets named `profile-photos` and `verification-documents`.
4. Deploy the `review-legi` Edge Function.
5. For free OCR, run/deploy `ocr-worker` and set `LEGI_REVIEW_MODE=tesseract` plus `LEGI_OCR_SERVICE_URL`.
6. For fast no-OCR testing, set `LEGI_REVIEW_MODE=demo`.
7. Copy `.env.example` to `.env` and fill in the project URL and publishable key.
8. Install dependencies:

```bash
npm install
```

9. Start the app:

```bash
npm run start
```

Use Expo Go or a development build to run it on iPhone and Android.

## Email confirmation

Supabase Auth must be allowed to redirect back into the app after a user clicks the confirmation email.

In Supabase, open `Authentication` -> `URL Configuration` and set:

- Site URL: `http://localhost:8081`
- Redirect URLs:
  - `http://localhost:8789/auth-callback.html`
  - `http://localhost:8789/reset-password.html`
  - `http://YOUR_PC_LAN_IP:8789/auth-callback.html`
  - `http://YOUR_PC_LAN_IP:8789/reset-password.html`
  - `unimatch://auth/callback`

For iPhone testing with Expo Go, set this in `.env` before starting the app:

```powershell
EXPO_PUBLIC_AUTH_REDIRECT_URL=http://YOUR_PC_LAN_IP:8789/auth-callback.html
```

Replace `YOUR_PC_LAN_IP` with the LAN address shown by Expo, for example `192.168.1.42`. The helper script starts a tiny confirmation page on port `8789`, so the email link opens a normal page instead of the Expo Metro server.

## Expo SDK

This project targets Expo SDK 54 for compatibility with the current Expo Go app.

After pulling SDK changes, refresh local dependencies:

```powershell
$env:NPM_CONFIG_CACHE="C:\Users\spand\Documents\Codex\2026-06-25\ic\unimatch\.npm-cache"
$env:NPM_CONFIG_STRICT_SSL="false"
npm.cmd install --no-audit --no-fund
```

## Mobile testing

Fastest real-device loop:

```powershell
npm run dev:all:lan
```

Then open the Expo QR code with Expo Go on iPhone or Android. Your phone and PC should be on the same Wi-Fi.

For web preview on the PC with a mobile-sized browser:

```powershell
npm run dev:all
```

Open `http://localhost:8081`, then use your browser's responsive/device toolbar to preview iPhone-sized layouts.

For native device preview without the helper script:

```powershell
npx.cmd expo start --host lan --port 8081 --clear
```

### iPhone / Android on a PC

On Windows, Apple's real iPhone Simulator is not available because it requires Xcode on macOS.

Best options:

- iPhone: use Expo Go on the real phone.
- Android: use Android Studio Emulator on the PC, then run `npx.cmd expo start --android`.
- PC layout check: use Expo Web plus browser responsive mode for iPhone-sized screens.

The development helper starts:

- OCR worker on `localhost:8788`
- email confirmation page on `localhost:8789`
- ngrok tunnel for Supabase to reach OCR
- Expo web server on `localhost:8081`

When ngrok starts, copy the `https://...ngrok-free.app` URL into Supabase Secret `LEGI_OCR_SERVICE_URL`.

## GitHub

This folder is ready to become the GitHub repository. Suggested repo name: `unimatch`.
