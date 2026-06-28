# UniMatch Handoff for Codex

Use this file when continuing the project in a new Codex session, especially on the Raspberry Pi.

## One-line prompt

Please continue UniMatch from this repository. First read `HANDOFF.md`, then inspect the current code before changing files.

## Project

UniMatch is a dating app MVP for students in Switzerland. The goal is an iPhone and Android app built with Expo, React Native and TypeScript, backed by Supabase.

Core product idea:

- Students sign up and verify student status with a Legi photo.
- The app has Nearby, Hotspots, Discover, Matches and Profile tabs.
- Users only become visible when they enable visibility and are near campus/hotspot contexts.
- Message requests are required before chatting. The receiving person should be able to view the profile before accepting or rejecting.
- Open outgoing message requests should expire after 48 hours if the other person does not react.

## Current Tech Stack

- Expo SDK 54
- React Native 0.81
- React 19
- TypeScript
- Supabase Auth, Database, Storage and Edge Functions
- Tesseract.js OCR worker for free/open-source Legi checks

## Important Local Context

The latest known Windows workspace was:

```text
C:\Users\spand\Documents\Codex\2026-06-25\ic\unimatch
```

The Raspberry Pi SSH target is:

```bash
ssh spandi@192.168.1.136
```

The GitHub repository is:

```text
https://github.com/Spandi99/unimatch.git
```

Do not commit `.env`.

Known Supabase public values used during development:

```env
EXPO_PUBLIC_SUPABASE_URL=https://pzqlplxxmcrwecsqrbxz.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_-_yIcUCR8NDIWc6RjLQjvA_M4KX-mv4
```

The auth redirect URL must match the machine running the auth callback server. On Windows it was:

```env
EXPO_PUBLIC_AUTH_REDIRECT_URL=http://192.168.1.5:8789/auth-callback.html
```

On the Raspberry Pi this should become something like:

```env
EXPO_PUBLIC_AUTH_REDIRECT_URL=http://192.168.1.136:8789/auth-callback.html
```

Also update Supabase Authentication URL Configuration to allow the Raspberry Pi redirect URLs:

```text
http://192.168.1.136:8789/auth-callback.html
http://192.168.1.136:8789/reset-password.html
```

## Current App State

The main app is currently in `App.tsx`.

Important files:

- `App.tsx`: main Expo app and current UI flow.
- `src/lib/profileApi.ts`: Supabase profile/photo/verification logic.
- `src/components/Theme.ts`: shared colors and theme values.
- `supabase/schema.sql`: database schema and RLS policies.
- `supabase/functions/review-legi/index.ts`: Supabase Edge Function for Legi review.
- `ocr-worker/`: local OCR worker using Tesseract.js.
- `scripts/start-dev.ps1`: Windows helper script for Expo, OCR worker, auth callback page and ngrok.
- `public/auth-callback.html`: email confirmation callback page.
- `public/reset-password.html`: password reset callback page.
- `Mockbilder/`: mock profile pictures used in the app.

Implemented product behavior:

- Email/password login with Supabase Auth.
- Separate email confirmation screen.
- Resend confirmation action.
- Password reset flow.
- Legi photo upload and review flow.
- Tesseract OCR-based provisional Legi check.
- Onboarding with profile details and one profile photo.
- Nearby, Hotspots, Discover, Matches and Profile tabs.
- Nearby visibility toggle with eye icon.
- Mock profiles and profile images.
- Discovery pass/reject action removes the current profile.
- Message request composer.
- Sending a message request returns to the originating screen instead of forcing the Matches tab.
- Matches screen shows open outgoing requests.
- Outgoing requests expire after 48 hours.
- UI has been moved toward the user-provided design reference: softer purple/lavender theme, rounded mobile feel, bottom icon navigation, hotspot concept.

## Known Issues / Next Work

Main next step:

- Make the project run cleanly on Raspberry Pi/Linux.

Likely needed implementation:

- Add a Linux equivalent of `scripts/start-dev.ps1`, for example `scripts/start-dev-linux.sh`.
- The Linux script should start:
  - OCR worker on port `8788`
  - auth callback server on port `8789`
  - ngrok tunnel, if available
  - Expo on LAN, likely port `8081`
- Keep the Windows script intact.
- Update README with Raspberry Pi setup/start steps.

Potential app improvements still planned:

- Continue polishing the UI toward the design reference.
- Add a proper Hotspots media/gallery tab later.
- Improve profile detail pages.
- Make message requests and accepting/rejecting feel smoother.
- Move more mock-only behavior into real Supabase-backed data.
- Make the Legi OCR more robust over time.

## Raspberry Pi Setup Notes

After cloning on the Pi:

```bash
git clone https://github.com/Spandi99/unimatch.git
cd unimatch
```

Create `.env` manually:

```bash
cp .env.example .env
nano .env
```

Temporary exact `.env` contents for first Raspberry Pi setup:

```env
EXPO_PUBLIC_SUPABASE_URL=https://pzqlplxxmcrwecsqrbxz.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_-_yIcUCR8NDIWc6RjLQjvA_M4KX-mv4
EXPO_PUBLIC_AUTH_REDIRECT_URL=http://192.168.1.136:8789/auth-callback.html
```

After `.env` is created locally on the Pi, remove this exact-value block from `HANDOFF.md` before continuing normal repo work. The `.env` file itself must stay uncommitted.

Install dependencies:

```bash
npm install --no-audit --no-fund
```

Run typecheck:

```bash
npm run typecheck
```

Until a Linux helper script exists, the likely manual services are:

```bash
cd ocr-worker
npm install --no-audit --no-fund
npm start
```

In another terminal:

```bash
node scripts/auth-callback-server.js
```

In another terminal:

```bash
npx expo start --host lan --port 8081 --clear
```

If using ngrok:

```bash
ngrok http 8788
```

Then copy the ngrok HTTPS URL into the Supabase secret:

```text
LEGI_OCR_SERVICE_URL=https://YOUR-NGROK-URL
```

The Edge Function should run with:

```text
LEGI_REVIEW_MODE=tesseract
```

## Git / Safety Notes

Before editing, run:

```bash
git status --short
```

Do not revert user changes. In the Windows working tree, `package-lock.json` had local SDK/dependency changes and `style/` was untracked. Treat similar changes carefully if they appear on the Pi.

Before finishing, run:

```bash
npm run typecheck
```

If possible, also start Expo and confirm the app opens on web or Expo Go.
