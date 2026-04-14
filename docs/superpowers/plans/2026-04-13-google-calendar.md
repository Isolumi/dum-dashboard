# Google Calendar Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only Google Calendar integration showing primary calendar events on a dedicated page and in the bento overview card.

**Architecture:** Auth is extended at login time by adding `calendar.readonly` scope to the existing Google OAuth flow. All calendar data is fetched client-side using `provider_token` from the Supabase session. No server functions or Supabase storage needed. The bento card fetches its own data via `useEffect` (not via the registry `loadData`) because `provider_token` is only available client-side.

**Tech Stack:** TanStack Start, React 19, `@supabase/supabase-js` (auth session), Google Calendar REST API v3, `react-day-picker` (via existing shadcn `Calendar` component), Tailwind CSS v4, Vitest + Testing Library

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/routes/_layout/calendar/-calendar.api.ts` | Create | `CalendarEvent` type, `fetchCalendarEvents` |
| `src/routes/_layout/calendar/-calendarUtils.ts` | Create | `getUpcomingEvents`, `groupEventsByDay`, `formatEventTime` |
| `src/routes/_layout/calendar/-CalendarBentoCard.tsx` | Create | Bento overview card (self-fetching) |
| `src/routes/_layout/calendar/index.tsx` | Create | Full calendar page |
| `src/lib/auth.ts` | Modify | Add `calendar.readonly` scope to `signInWithGoogle` |
| `src/tools/registry.ts` | Modify | Register calendar tool |

**Test files:**

| File | Environment |
|------|-------------|
| `src/routes/_layout/calendar/-calendar.api.test.ts` | Unit (node) |
| `src/routes/_layout/calendar/-calendarUtils.test.ts` | Unit (node) |
| `src/routes/_layout/calendar/-CalendarBentoCard.test.tsx` | Component (jsdom) |
| `src/lib/-auth.test.ts` | Unit (node) |

---

## Task 1: Calendar API utility

**Files:**
- Create: `src/routes/_layout/calendar/-calendar.api.ts`
- Test: `src/routes/_layout/calendar/-calendar.api.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/routes/_layout/calendar/-calendar.api.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarEvent } from "./-calendar.api";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const { fetchCalendarEvents } = await import("./-calendar.api");

function mockResponse(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("fetchCalendarEvents", () => {
  it("calls Google Calendar API with correct URL params and auth header", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, { items: [] }));

    const timeMin = new Date("2026-04-01T00:00:00.000Z");
    const timeMax = new Date("2026-05-01T00:00:00.000Z");
    await fetchCalendarEvents("test-token", timeMin, timeMax);

    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain("googleapis.com/calendar/v3/calendars/primary/events");
    expect(String(url)).toContain("singleEvents=true");
    expect(String(url)).toContain("orderBy=startTime");
    expect(String(url)).toContain(encodeURIComponent(timeMin.toISOString()));
    expect((options as RequestInit).headers as Record<string, string>).toMatchObject({
      Authorization: "Bearer test-token",
    });
  });

  it("returns parsed CalendarEvent array from response items", async () => {
    const items: CalendarEvent[] = [
      {
        id: "abc",
        summary: "Team standup",
        start: { dateTime: "2026-04-14T09:00:00Z" },
        end: { dateTime: "2026-04-14T09:30:00Z" },
      },
    ];
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, { items }));

    const events = await fetchCalendarEvents("token", new Date(), new Date());
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe("abc");
    expect(events[0].summary).toBe("Team standup");
  });

  it("returns empty array when response has no items field", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, {}));
    const events = await fetchCalendarEvents("token", new Date(), new Date());
    expect(events).toEqual([]);
  });

  it("throws { type: 'auth_expired' } on HTTP 401", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(401));
    await expect(
      fetchCalendarEvents("bad-token", new Date(), new Date()),
    ).rejects.toMatchObject({ type: "auth_expired" });
  });

  it("throws { type: 'network_error' } on non-401 HTTP error", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(500));
    await expect(
      fetchCalendarEvents("token", new Date(), new Date()),
    ).rejects.toMatchObject({ type: "network_error" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test --project unit src/routes/_layout/calendar/-calendar.api.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the API utility**

Create `src/routes/_layout/calendar/-calendar.api.ts`:

```ts
export interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

export interface CalendarApiError {
  type: "auth_expired" | "network_error";
}

export async function fetchCalendarEvents(
  providerToken: string,
  timeMin: Date,
  timeMax: Date,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${providerToken}` } },
  );

  if (!res.ok) {
    const error: CalendarApiError = {
      type: res.status === 401 ? "auth_expired" : "network_error",
    };
    throw error;
  }

  const json = await res.json();
  return (json.items ?? []) as CalendarEvent[];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test --project unit src/routes/_layout/calendar/-calendar.api.test.ts
```
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/routes/_layout/calendar/-calendar.api.ts src/routes/_layout/calendar/-calendar.api.test.ts
git commit -m "feat: add Google Calendar API utility"
```

---

## Task 2: Calendar utility functions

**Files:**
- Create: `src/routes/_layout/calendar/-calendarUtils.ts`
- Test: `src/routes/_layout/calendar/-calendarUtils.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/routes/_layout/calendar/-calendarUtils.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "./-calendar.api";
import { formatEventTime, getUpcomingEvents, groupEventsByDay } from "./-calendarUtils";

function makeEvent(
  id: string,
  summary: string,
  start: CalendarEvent["start"],
): CalendarEvent {
  return { id, summary, start, end: {} };
}

describe("getUpcomingEvents", () => {
  const events: CalendarEvent[] = [
    makeEvent("1", "Past", { dateTime: "2026-04-10T10:00:00" }),
    makeEvent("2", "Today", { dateTime: "2026-04-14T10:00:00" }),
    makeEvent("3", "Future", { dateTime: "2026-04-15T10:00:00" }),
  ];

  it("returns events whose start is on or after the from date", () => {
    const result = getUpcomingEvents(events, new Date("2026-04-14T00:00:00"), 10);
    expect(result.map((e) => e.id)).toEqual(["2", "3"]);
  });

  it("respects the limit", () => {
    const result = getUpcomingEvents(events, new Date("2026-04-10T00:00:00"), 2);
    expect(result).toHaveLength(2);
  });

  it("returns empty array when no events match", () => {
    const result = getUpcomingEvents(events, new Date("2026-12-01T00:00:00"), 5);
    expect(result).toEqual([]);
  });

  it("handles all-day events using the date field", () => {
    const allDay = makeEvent("4", "Holiday", { date: "2026-04-14" });
    const result = getUpcomingEvents([allDay], new Date("2026-04-14T00:00:00"), 5);
    expect(result).toHaveLength(1);
  });
});

describe("groupEventsByDay", () => {
  it("groups timed events by their local date", () => {
    const events = [
      makeEvent("1", "Morning", { dateTime: "2026-04-14T09:00:00" }),
      makeEvent("2", "Afternoon", { dateTime: "2026-04-14T14:00:00" }),
      makeEvent("3", "Next day", { dateTime: "2026-04-15T10:00:00" }),
    ];
    const groups = groupEventsByDay(events);
    expect(groups).toHaveLength(2);
    expect(groups[0].events).toHaveLength(2);
    expect(groups[1].events).toHaveLength(1);
  });

  it("handles all-day events using the date field", () => {
    const events = [makeEvent("1", "Holiday", { date: "2026-04-14" })];
    const groups = groupEventsByDay(events);
    expect(groups).toHaveLength(1);
    expect(groups[0].isoDate).toBe("2026-04-14");
  });

  it("returns empty array for empty input", () => {
    expect(groupEventsByDay([])).toEqual([]);
  });
});

describe("formatEventTime", () => {
  it("returns 'All day' for all-day events (no dateTime)", () => {
    const event = makeEvent("1", "X", { date: "2026-04-14" });
    expect(formatEventTime(event)).toBe("All day");
  });

  it("returns a non-empty time string for timed events", () => {
    const event = makeEvent("1", "X", { dateTime: "2026-04-14T09:00:00" });
    const result = formatEventTime(event);
    expect(result).not.toBe("All day");
    expect(result.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test --project unit src/routes/_layout/calendar/-calendarUtils.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the utility functions**

Create `src/routes/_layout/calendar/-calendarUtils.ts`:

```ts
import type { CalendarEvent } from "./-calendar.api";

function eventStartDate(event: CalendarEvent): Date {
  if (event.start.dateTime) return new Date(event.start.dateTime);
  if (event.start.date) {
    const [y, m, d] = event.start.date.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(0);
}

function eventStartIsoDate(event: CalendarEvent): string {
  if (event.start.date) return event.start.date;
  const d = new Date(event.start.dateTime!);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * Returns up to `limit` events whose start is on or after `from`.
 * Assumes events are sorted ascending by start time (as returned by the Google Calendar API).
 */
export function getUpcomingEvents(
  events: CalendarEvent[],
  from: Date,
  limit: number,
): CalendarEvent[] {
  return events.filter((e) => eventStartDate(e) >= from).slice(0, limit);
}

export interface DayGroup {
  isoDate: string;
  events: CalendarEvent[];
}

/**
 * Groups events by their start day.
 * Input must be sorted ascending by start time.
 */
export function groupEventsByDay(events: CalendarEvent[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const event of events) {
    const iso = eventStartIsoDate(event);
    const last = groups[groups.length - 1];
    if (last && last.isoDate === iso) {
      last.events.push(event);
    } else {
      groups.push({ isoDate: iso, events: [event] });
    }
  }
  return groups;
}

/** Returns a localized time string (e.g. "9:00 AM") for timed events, or "All day". */
export function formatEventTime(event: CalendarEvent): string {
  if (!event.start.dateTime) return "All day";
  return new Date(event.start.dateTime).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test --project unit src/routes/_layout/calendar/-calendarUtils.test.ts
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/routes/_layout/calendar/-calendarUtils.ts src/routes/_layout/calendar/-calendarUtils.test.ts
git commit -m "feat: add calendar utility functions"
```

---

## Task 3: Auth scope extension

**Files:**
- Modify: `src/lib/auth.ts`
- Test: `src/lib/-auth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/-auth.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("signInWithGoogle", () => {
  it("requests calendar.readonly scope", () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const source = readFileSync(resolve(__dirname, "auth.ts"), "utf-8");
    expect(source, "auth.ts must request calendar.readonly scope").toContain(
      "https://www.googleapis.com/auth/calendar.readonly",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test --project unit src/lib/-auth.test.ts
```
Expected: FAIL — scope string not present.

- [ ] **Step 3: Add the calendar scope**

In `src/lib/auth.ts`, update `signInWithGoogle`:

Replace:
```ts
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
}
```

With:
```ts
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: "https://www.googleapis.com/auth/calendar.readonly",
    },
  });
  if (error) throw error;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun run test --project unit src/lib/-auth.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/-auth.test.ts
git commit -m "feat: request calendar.readonly scope on Google OAuth login"
```

---

## Task 4: CalendarBentoCard

**Files:**
- Create: `src/routes/_layout/calendar/-CalendarBentoCard.tsx`
- Test: `src/routes/_layout/calendar/-CalendarBentoCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/routes/_layout/calendar/-CalendarBentoCard.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ToolEntry } from "#/tools/registry";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("a", { href: to, ...props }, children),
}));

vi.mock("#/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("./-calendar.api", () => ({
  fetchCalendarEvents: vi.fn(),
}));

const { supabase } = await import("#/lib/supabase");
const { fetchCalendarEvents } = await import("./-calendar.api");
const { CalendarBentoCard } = await import("./-CalendarBentoCard");

const mockTool = {
  id: "calendar",
  label: "Calendar",
  route: "/calendar",
  icon: () => null,
  BentoCard: () => null,
} as unknown as ToolEntry;

function makeEvent(id: string, summary: string, dateTime: string) {
  return { id, summary, start: { dateTime }, end: { dateTime } };
}

describe("CalendarBentoCard", () => {
  it("shows upcoming events once loaded", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { provider_token: "test-token" } },
    } as any);
    vi.mocked(fetchCalendarEvents).mockResolvedValue([
      makeEvent("1", "Team standup", "2026-04-14T09:00:00"),
      makeEvent("2", "Dentist", "2026-04-15T14:00:00"),
    ]);

    render(React.createElement(CalendarBentoCard, { tool: mockTool, data: null }));

    await waitFor(() => expect(screen.getByText("Team standup")).toBeTruthy());
    expect(screen.getByText("Dentist")).toBeTruthy();
  });

  it("shows 'No upcoming events' when event list is empty", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { provider_token: "test-token" } },
    } as any);
    vi.mocked(fetchCalendarEvents).mockResolvedValue([]);

    render(React.createElement(CalendarBentoCard, { tool: mockTool, data: null }));

    await waitFor(() => expect(screen.getByText(/no upcoming events/i)).toBeTruthy());
  });

  it("shows 'Calendar disconnected' when no provider token in session", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as any);

    render(React.createElement(CalendarBentoCard, { tool: mockTool, data: null }));

    await waitFor(() => expect(screen.getByText(/calendar disconnected/i)).toBeTruthy());
  });

  it("shows 'Calendar disconnected' when fetchCalendarEvents throws auth_expired", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { provider_token: "expired-token" } },
    } as any);
    vi.mocked(fetchCalendarEvents).mockRejectedValue({ type: "auth_expired" });

    render(React.createElement(CalendarBentoCard, { tool: mockTool, data: null }));

    await waitFor(() => expect(screen.getByText(/calendar disconnected/i)).toBeTruthy());
  });

  it("renders the card as a link to /calendar", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { provider_token: "test-token" } },
    } as any);
    vi.mocked(fetchCalendarEvents).mockResolvedValue([]);

    render(React.createElement(CalendarBentoCard, { tool: mockTool, data: null }));

    await waitFor(() => {
      const link = screen.getByRole("link");
      expect(link.getAttribute("href")).toBe("/calendar");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test --project components src/routes/_layout/calendar/-CalendarBentoCard.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement CalendarBentoCard**

Create `src/routes/_layout/calendar/-CalendarBentoCard.tsx`:

```tsx
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Skeleton } from "#/components/ui/skeleton";
import { supabase } from "#/lib/supabase";
import type { ToolEntry } from "#/tools/registry";
import { type CalendarEvent, fetchCalendarEvents } from "./-calendar.api";
import { formatEventTime, getUpcomingEvents, groupEventsByDay } from "./-calendarUtils";

function formatChipDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

type BentoStatus = "loading" | "ready" | "auth_expired";

export function CalendarBentoCard({
  tool: _tool,
  data: _data,
}: {
  tool: ToolEntry;
  data: unknown;
}) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [status, setStatus] = useState<BentoStatus>("loading");

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.provider_token;
      if (!token) {
        setStatus("auth_expired");
        return;
      }

      const now = new Date();
      const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      try {
        const fetched = await fetchCalendarEvents(token, now, thirtyDaysOut);
        setEvents(getUpcomingEvents(fetched, now, 5));
        setStatus("ready");
      } catch {
        setStatus("auth_expired");
      }
    }
    void load();
  }, []);

  return (
    <Link
      to="/calendar"
      aria-label="Open Calendar tool"
      className="block rounded-lg border border-border bg-card transition-colors duration-150 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="p-4">
        {status === "loading" && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-4 w-12 rounded" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-14" />
              </div>
            ))}
          </div>
        )}

        {status === "auth_expired" && (
          <p className="text-xs text-muted-foreground">
            Calendar disconnected — sign in again.
          </p>
        )}

        {status === "ready" && events.length === 0 && (
          <p className="text-xs text-muted-foreground">No upcoming events.</p>
        )}

        {status === "ready" && events.length > 0 && (
          <div className="flex flex-col gap-1">
            {groupEventsByDay(events).flatMap((group) =>
              group.events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-2 border-b border-border/40 py-1 last:border-0"
                >
                  <span className="w-12 shrink-0 text-xs text-muted-foreground">
                    {formatChipDate(group.isoDate)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {event.summary}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatEventTime(event)}
                  </span>
                </div>
              )),
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test --project components src/routes/_layout/calendar/-CalendarBentoCard.test.tsx
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/routes/_layout/calendar/-CalendarBentoCard.tsx src/routes/_layout/calendar/-CalendarBentoCard.test.tsx
git commit -m "feat: add CalendarBentoCard component"
```

---

## Task 5: Calendar page

**Files:**
- Create: `src/routes/_layout/calendar/index.tsx`

No dedicated unit tests: the page composes already-tested utilities (`fetchCalendarEvents`, `getUpcomingEvents`, `groupEventsByDay`, `formatEventTime`) and contains rendering-only logic. Testing it meaningfully would require mocking `react-day-picker` internals — not worth the complexity.

- [ ] **Step 1: Create the calendar page**

Create `src/routes/_layout/calendar/index.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { Calendar } from "#/components/ui/calendar";
import { Skeleton } from "#/components/ui/skeleton";
import { signInWithGoogle } from "#/lib/auth";
import { supabase } from "#/lib/supabase";
import { type CalendarEvent, fetchCalendarEvents } from "./-calendar.api";
import {
  type DayGroup,
  formatEventTime,
  getUpcomingEvents,
  groupEventsByDay,
} from "./-calendarUtils";

export const Route = createFileRoute("/_layout/calendar/")({
  component: CalendarPage,
});

type PageStatus = "loading" | "ready" | "auth_expired" | "error";

function formatDayLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function CalendarPage() {
  const today = useMemo(() => new Date(), []);

  const [currentMonth, setCurrentMonth] = useState<Date>(today);
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [status, setStatus] = useState<PageStatus>("loading");

  useEffect(() => {
    async function load() {
      setStatus("loading");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.provider_token;
      if (!token) {
        setStatus("auth_expired");
        return;
      }

      const timeMin = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const timeMax = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);

      try {
        const fetched = await fetchCalendarEvents(token, timeMin, timeMax);
        setEvents(fetched);
        setStatus("ready");
      } catch (err: unknown) {
        const e = err as { type?: string };
        setStatus(e?.type === "auth_expired" ? "auth_expired" : "error");
      }
    }
    void load();
  }, [currentMonth]);

  const eventDates = useMemo(
    () =>
      events
        .map((e) => {
          if (e.start.date) {
            const [y, m, d] = e.start.date.split("-").map(Number);
            return new Date(y, m - 1, d);
          }
          if (e.start.dateTime) {
            const dt = new Date(e.start.dateTime);
            return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
          }
          return null;
        })
        .filter(Boolean) as Date[],
    [events],
  );

  const upcomingGroups: DayGroup[] = useMemo(() => {
    const from = new Date(
      selectedDay.getFullYear(),
      selectedDay.getMonth(),
      selectedDay.getDate(),
    );
    return groupEventsByDay(getUpcomingEvents(events, from, 5));
  }, [events, selectedDay]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">Calendar</h1>

      {status === "auth_expired" && (
        <div className="flex flex-col items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">Your calendar session has expired.</p>
          <button
            className="text-sm font-medium text-destructive underline underline-offset-2 hover:no-underline"
            onClick={() => void signInWithGoogle()}
          >
            Reconnect Calendar
          </button>
        </div>
      )}

      {status === "error" && (
        <p className="text-sm text-destructive">
          Could not load calendar events. Try refreshing.
        </p>
      )}

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* Left: month grid */}
        <div className="shrink-0">
          {status === "loading" ? (
            <Skeleton className="h-72 w-72 rounded-md" />
          ) : (
            <Calendar
              mode="single"
              selected={selectedDay}
              onSelect={(day) => day && setSelectedDay(day)}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              modifiers={{ hasEvent: eventDates }}
              modifiersClassNames={{
                hasEvent:
                  "after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:size-1 after:rounded-full after:bg-primary",
              }}
            />
          )}
        </div>

        {/* Right: event list */}
        <div className="flex-1 md:border-l md:border-border md:pl-6">
          {status === "loading" && (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          )}

          {status === "ready" && upcomingGroups.length === 0 && (
            <p className="text-sm text-muted-foreground">No upcoming events.</p>
          )}

          {status === "ready" && upcomingGroups.length > 0 && (
            <div className="flex flex-col gap-4">
              {upcomingGroups.map((group) => (
                <div key={group.isoDate}>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {formatDayLabel(group.isoDate)}
                  </div>
                  <div className="flex flex-col gap-1">
                    {group.events.map((event) => (
                      <div key={event.id} className="flex items-center gap-3">
                        <div className="h-9 w-0.5 shrink-0 rounded-full bg-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-foreground">{event.summary}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatEventTime(event)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Run the full test suite to verify nothing broke**

```bash
bun run test
```
Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/routes/_layout/calendar/index.tsx
git commit -m "feat: add Calendar page with side-by-side month grid and event list"
```

---

## Task 6: Register calendar tool

**Files:**
- Modify: `src/tools/registry.ts`

- [ ] **Step 1: Update the registry**

In `src/tools/registry.ts`, replace the entire file contents with:

```ts
import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, CheckSquare, Clock } from "lucide-react";
import { TodoBentoCard } from "#/routes/_layout/todos/-TodoBentoCard";
import { ClockBentoCard } from "#/tools/ClockBentoCard";
import { CalendarBentoCard } from "#/routes/_layout/calendar/-CalendarBentoCard";
import { getTodos } from "#/routes/todos/todos.functions";

export interface ToolEntry {
  id: string;
  label: string;
  route: string;
  icon: LucideIcon;
  BentoCard: ComponentType<{ tool: ToolEntry; data: unknown }>;
  loadData?: () => Promise<unknown>;
  overviewOnly?: boolean;
}

export const tools: ToolEntry[] = [
  {
    id: "todos",
    label: "Todos",
    route: "/todos",
    icon: CheckSquare,
    BentoCard: TodoBentoCard,
    loadData: getTodos,
  },
  {
    id: "calendar",
    label: "Calendar",
    route: "/calendar",
    icon: CalendarDays,
    BentoCard: CalendarBentoCard,
  },
  {
    id: "clock",
    label: "Clock",
    route: "/",
    icon: Clock,
    BentoCard: ClockBentoCard,
    overviewOnly: true,
  },
];
```

- [ ] **Step 2: Run the full test suite**

```bash
bun run test
```
Expected: all tests pass.

- [ ] **Step 3: Start the dev server and verify manually**

```bash
bun run dev
```

TanStack Router will auto-regenerate `routeTree.gen.ts` when it detects the new route file. Check the terminal output for the route tree update, then verify:

1. Sidebar shows a "Calendar" nav item with a calendar icon
2. Navigating to `/calendar` renders the side-by-side layout (skeleton while loading)
3. Sign out and back in — Google consent screen now mentions Calendar access
4. After re-login, the calendar page shows your events for the current month
5. Dots appear on days that have events
6. Clicking a day updates the right panel with 5+ events from that day forward
7. Navigating to a different month fetches new data (skeleton briefly appears)
8. Overview bento card shows the next 5 upcoming events

- [ ] **Step 4: Commit**

```bash
git add src/tools/registry.ts src/routeTree.gen.ts
git commit -m "feat: register calendar tool in registry"
```
