---
quick_task: 260522-calendar-token-vault
type: execute
autonomous: true
wave: sequential
---

# Secure Calendar Token Vault Plan

## Objective

Stop Google Calendar from requiring repeated re-login when the Google access token expires, while improving the security boundary around Google OAuth tokens.

## Security Model

- The browser may hold the normal Supabase session token, but it must not persist or read the long-lived Google refresh token after initial OAuth capture.
- The Google refresh token is stored server-side only, encrypted before it is written to Supabase.
- Calendar fetching goes through TanStack server functions.
- Server functions verify the Supabase session access token and require the signed-in user to match `VITE_OWNER_ID` before touching stored Google tokens.
- Server functions return calendar events and connection status only; they never return Google access tokens or refresh tokens.
- Calendar responses use `Cache-Control: no-store`.
- Google scope stays narrow: `https://www.googleapis.com/auth/calendar.readonly`.

## Tasks

1. Add tests for secure calendar token helpers and server-backed fetch behavior.
2. Add encrypted token helper utilities using a runtime secret.
3. Add Supabase migration and generated type entry for a locked-down `calendar_connections` table.
4. Add calendar server functions for connection capture, status, event fetch, and token refresh.
5. Replace direct browser Google Calendar API calls in the calendar page and bento card.
6. Verify with focused tests, full test suite, lint, and build.

## Verification

- `bun run test`
- `bun run lint`
- `bun run build`
