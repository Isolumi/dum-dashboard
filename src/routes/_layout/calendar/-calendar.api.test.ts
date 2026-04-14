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
