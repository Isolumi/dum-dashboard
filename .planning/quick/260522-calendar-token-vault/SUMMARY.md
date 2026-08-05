# Secure Calendar Token Vault Summary

## Outcome

Implemented a server-owned Google Calendar connection flow that stops relying on expiring browser `provider_token` values.

## Changes

- Dashboard Google login no longer asks for Calendar API scope or offline access.
- Calendar connection now starts from the Calendar page and uses Google OAuth code flow with a one-time hashed state.
- Google refresh tokens are exchanged server-side, encrypted with `GOOGLE_TOKEN_ENCRYPTION_KEY`, and stored in Supabase.
- Calendar event fetching now goes through server functions that verify the Supabase owner session before decrypting or refreshing Google tokens.
- Added locked-down `calendar_connections` and `calendar_oauth_states` tables with RLS enabled and no browser policies.
- Added `/calendar/oauth/callback` route for the direct Calendar OAuth completion flow.

## Verification

- PASS: `bun run test src/lib/-auth.test.ts src/lib/-secret-vault.test.ts src/routes/_layout/calendar/-calendar.functions.test.ts src/routes/_layout/calendar/-CalendarBentoCard.test.tsx`
- PASS: `bun run lint`
- PASS: `bun run build`
- PASS: `bunx oxfmt --check` on changed files
- BLOCKED: full `bun run test` still fails in unrelated existing tests:
  - `src/tools/-ClockBentoCard.test.tsx` expects a `24h` label that the component does not render.
  - `src/routes/_layout/todos/-AddTodoRow.test.tsx` expects an `Enter to save` hint that the component does not render.

## Required Setup

- Apply `supabase/migrations/20260522_calendar_token_vault.sql`.
- Configure a Google OAuth client redirect URL for `/calendar/oauth/callback`.
- Set Worker secrets:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_TOKEN_ENCRYPTION_KEY`
