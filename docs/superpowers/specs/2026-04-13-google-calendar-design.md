# Google Calendar Integration — Design Spec

**Date:** 2026-04-13
**Status:** Approved

## Overview

A read-only Google Calendar integration that displays the user's primary calendar events. Follows the existing tool pattern: a dedicated full page plus a bento card on the overview. Auth piggybacks on the existing Google OAuth login — no separate auth flow.

---

## 1. Auth

**File:** `src/lib/auth.ts`

Extend the existing `signInWithGoogle` call to request an additional OAuth scope:

```ts
scopes: 'https://www.googleapis.com/auth/calendar.readonly'
```

No other auth changes. After re-login, `session.provider_token` carries a Google access token with calendar read access. Existing sessions lack this scope; the user must sign out and back in once. The `/auth/callback` flow is unchanged.

---

## 2. Data Layer

**File:** `src/routes/_layout/calendar/-calendar.api.ts`

A single client-side utility. No server functions, no Supabase storage.

### `fetchCalendarEvents(providerToken: string, month: Date): Promise<CalendarEvent[]>`

Calls the Google Calendar REST API:

```
GET https://www.googleapis.com/calendar/v3/calendars/primary/events
  ?timeMin=<first of month, ISO8601>
  &timeMax=<first of next month, ISO8601>
  &singleEvents=true
  &orderBy=startTime
```

Authorization: `Bearer <providerToken>`

### `CalendarEvent` type

```ts
interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}
```

### Error handling

- HTTP 401 → throws `{ type: 'auth_expired' }` — UI shows reconnect prompt
- Other errors → throws `{ type: 'network_error' }` — UI shows generic error state

---

## 3. Calendar Page

**File:** `src/routes/_layout/calendar/index.tsx`

### Route loader

No data fetching in the loader. The loader only guards against unauthenticated access (redirects to `/login` if no session). All calendar data is fetched client-side because `provider_token` lives in the browser-side Supabase session and is not available server-side.

On mount, the page component calls `supabase.auth.getSession()` to retrieve `provider_token`, then fetches events.

### State

- `currentMonth: Date` — defaults to today's month
- `selectedDay: Date` — defaults to today
- `events: CalendarEvent[]` — fetched for `currentMonth`
- `status: 'loading' | 'ready' | 'auth_expired' | 'error'`

Navigating to a new month updates `currentMonth` and triggers a fresh fetch.

### Layout

Side-by-side, max-width container:

**Left column — Calendar grid**

Uses the existing shadcn `Calendar` component (`src/components/ui/calendar.tsx`, built on `react-day-picker`). Custom `modifiers` add a small dot indicator beneath any day that has at least one event. Clicking a day sets `selectedDay`.

**Right column — Event list**

Shows the next 5+ upcoming events starting from `selectedDay`, across as many days as needed. Events are grouped under date headers (e.g. "Today", "Apr 15", "Apr 18"). Each event row shows:
- A left accent bar (3px wide)
- Event title
- Time (formatted from `dateTime`) or "All day" (when only `date` is present)

If there are no upcoming events from `selectedDay` forward: "No upcoming events."

### Auth-expired state

A full-width banner replaces the calendar content: "Your calendar session has expired." + "Reconnect Calendar" button that re-calls `signInWithGoogle`.

### Loading state

Skeleton placeholders in both columns while fetching.

---

## 4. Bento Card

**File:** `src/routes/_layout/calendar/-CalendarBentoCard.tsx`

Links to `/calendar`. Shows the next 5 upcoming events from today, across however many days are needed to reach 5 events.

Each row:
- Compact date chip (e.g. "Apr 15")
- Event title (truncated)
- Time or "All day"

**States:**
- Loading: skeleton rows
- Empty: "No upcoming events"
- Auth expired: "Calendar disconnected — sign in again" (no link, no crash)

### `loadData`

Calls `supabase.auth.getSession()` to retrieve `provider_token`, then calls `fetchCalendarEvents` for a 30-day window starting today, then slices to the first 5 results. If the token is absent or the call returns `auth_expired`, returns `{ error: 'auth_expired', events: [] }` instead of throwing — so the overview page degrades gracefully without breaking other bento cards.

---

## 5. Tool Registry

**File:** `src/tools/registry.ts`

New entry:

```ts
{
  id: 'calendar',
  label: 'Calendar',
  route: '/calendar',
  icon: CalendarDays,   // from lucide-react
  BentoCard: CalendarBentoCard,
  loadData: loadCalendarData,
}
```

---

## File Map

| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | Add `calendar.readonly` scope to `signInWithGoogle` |
| `src/routes/_layout/calendar/-calendar.api.ts` | Google Calendar REST API utility |
| `src/routes/_layout/calendar/index.tsx` | Full calendar page |
| `src/routes/_layout/calendar/-CalendarBentoCard.tsx` | Overview bento card |
| `src/tools/registry.ts` | Register calendar tool |

---

## Out of Scope

- Creating or editing events
- Multiple calendar support (primary only)
- Caching or persisting events in Supabase
- Notifications or reminders
