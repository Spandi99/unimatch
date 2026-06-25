# SWITCH edu-ID Login

UniMatch should use SWITCH edu-ID as the real account login before profile registration.

## Flow

1. The app calls Supabase Enterprise SSO with the configured SWITCH edu-ID provider ID.
2. Supabase returns an authorization URL.
3. The app opens that URL with the system browser using Expo WebBrowser.
4. SWITCH edu-ID authenticates the student and redirects to `unimatch://auth/callback`.
5. The app exchanges the returned code for a Supabase session.
6. Only then does profile onboarding start.

## Required setup

1. Register UniMatch as an OIDC relying party/client with SWITCH edu-ID.
2. Configure the Supabase Auth Enterprise SSO provider with the SWITCH issuer, client ID and client secret.
3. Add this redirect URI to Supabase and the SWITCH client:

```text
unimatch://auth/callback
```

4. Copy the Supabase SSO provider ID into `.env`:

```text
EXPO_PUBLIC_SUPABASE_SWITCH_EDU_ID_PROVIDER_ID=...
```

## Notes

- The current Legi path should remain a manual fallback, not the primary account login.
- Use a development build for deep-link testing; Expo Go redirect behavior can differ from standalone builds.
- Keep exact university claims from SWITCH edu-ID in private profile/verification metadata, not public dating profile text.
