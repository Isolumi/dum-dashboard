/**
 * @vitest-environment jsdom
 */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ToolEntry } from "#/tools/registry";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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

vi.mock("./-calendar.functions", () => ({
  getCalendarEvents: vi.fn(),
}));

const { getCalendarEvents } = await import("./-calendar.functions");
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("CalendarBentoCard", () => {
  it("shows upcoming events once loaded", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 7, 13, 12));
    vi.mocked(getCalendarEvents).mockResolvedValue({
      status: "ready",
      events: [
        makeEvent("1", "Team standup", "2030-04-14T09:00:00"),
        makeEvent("2", "Dentist", "2030-04-15T14:00:00"),
      ],
    });

    render(React.createElement(CalendarBentoCard, { tool: mockTool, data: null }));

    await waitFor(() => expect(screen.getByText("Team standup")).toBeTruthy());
    expect(screen.getByText("Dentist")).toBeTruthy();
    expect(screen.getByText("Sun, Apr 14, 2030")).toBeTruthy();

    const eventRow = screen.getByText("Team standup").parentElement;
    expect(eventRow?.className).toContain("grid-cols-[minmax(0,1fr)_auto]");
  });

  it("shows more than five events, including events beyond 30 days", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-06T12:00:00.000Z"));
    vi.mocked(getCalendarEvents).mockResolvedValue({
      status: "ready",
      events: [
        ...Array.from({ length: 6 }, (_, index) =>
          makeEvent(
            `${index}`,
            `October event ${index}`,
            `2026-10-${String(index + 7).padStart(2, "0")}T13:00:00Z`,
          ),
        ),
        makeEvent("winter", "Winter event", "2026-12-02T13:00:00Z"),
      ],
    });

    render(React.createElement(CalendarBentoCard, { tool: mockTool, data: null }));

    await waitFor(() => expect(screen.getByText("Winter event")).toBeTruthy());
    expect(screen.getByText("October event 5")).toBeTruthy();
    expect(vi.mocked(getCalendarEvents).mock.calls[0][0].data.time_max).toBe(
      "2027-01-04T12:00:00.000Z",
    );
  });

  it("puts the event list in a keyboard-focusable scroll region", async () => {
    vi.mocked(getCalendarEvents).mockResolvedValue({
      status: "ready",
      events: [makeEvent("1", "First event", "2030-04-14T09:00:00")],
    });

    render(React.createElement(CalendarBentoCard, { tool: mockTool, data: null }));

    const list = await screen.findByRole("region", { name: "Upcoming calendar events" });
    expect(list.getAttribute("tabindex")).toBe("0");
    expect(list.className).toContain("overflow-y-auto");
    expect(list.className).toContain("max-h-56");
    expect(list.className).not.toContain("overscroll-contain");
    expect(list.querySelector("a")).toBeNull();
  });

  it("shows 'No upcoming events' when event list is empty", async () => {
    vi.mocked(getCalendarEvents).mockResolvedValue({ status: "ready", events: [] });

    render(React.createElement(CalendarBentoCard, { tool: mockTool, data: null }));

    await waitFor(() => expect(screen.getByText(/no upcoming events/i)).toBeTruthy());
  });

  it("shows 'Calendar disconnected' when the server reports expired calendar access", async () => {
    vi.mocked(getCalendarEvents).mockResolvedValue({ status: "auth_expired", events: [] });

    render(React.createElement(CalendarBentoCard, { tool: mockTool, data: null }));

    await waitFor(() => expect(screen.getByText(/calendar disconnected/i)).toBeTruthy());
  });

  it("links to the full Calendar page from the card heading", async () => {
    vi.mocked(getCalendarEvents).mockResolvedValue({ status: "ready", events: [] });

    render(React.createElement(CalendarBentoCard, { tool: mockTool, data: null }));

    await waitFor(() => {
      const link = screen.getByRole("link");
      expect(link.getAttribute("href")).toBe("/calendar");
    });
  });

  it("shows new events after the ten-second refresh without a page reload", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 20, 12));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    vi.mocked(getCalendarEvents)
      .mockResolvedValueOnce({
        status: "ready",
        events: [makeEvent("1", "Old event", "2026-08-21T09:00:00-04:00")],
      })
      .mockResolvedValueOnce({
        status: "ready",
        events: [makeEvent("2", "New event", "2026-08-21T10:00:00-04:00")],
      });

    render(React.createElement(CalendarBentoCard, { tool: mockTool, data: null }));
    await act(async () => Promise.resolve());
    expect(screen.getByText("Old event")).toBeTruthy();

    await act(async () => vi.advanceTimersByTimeAsync(10_000));

    expect(getCalendarEvents).toHaveBeenCalledTimes(2);
    expect(screen.getByText("New event")).toBeTruthy();
    expect(screen.queryByText("Old event")).toBeNull();
  });

  it("keeps current events visible when a background refresh fails", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 20, 12));
    vi.mocked(getCalendarEvents)
      .mockResolvedValueOnce({
        status: "ready",
        events: [makeEvent("1", "Current event", "2026-08-21T09:00:00-04:00")],
      })
      .mockRejectedValueOnce(new Error("temporary network failure"));

    render(React.createElement(CalendarBentoCard, { tool: mockTool, data: null }));
    await act(async () => Promise.resolve());
    expect(screen.getByText("Current event")).toBeTruthy();

    await act(async () => vi.advanceTimersByTimeAsync(10_000));

    expect(screen.getByText("Current event")).toBeTruthy();
    expect(screen.queryByText(/calendar disconnected/i)).toBeNull();
  });

  it("does not let an older request overwrite newer events", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 20, 12));
    const olderInitial = deferred<{
      status: "ready";
      events: ReturnType<typeof makeEvent>[];
    }>();
    const newerPoll = deferred<{
      status: "ready";
      events: ReturnType<typeof makeEvent>[];
    }>();
    vi.mocked(getCalendarEvents)
      .mockReturnValueOnce(olderInitial.promise)
      .mockReturnValueOnce(newerPoll.promise);

    render(React.createElement(CalendarBentoCard, { tool: mockTool, data: null }));
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(getCalendarEvents).toHaveBeenCalledTimes(2);

    await act(async () => {
      newerPoll.resolve({
        status: "ready",
        events: [makeEvent("2", "New event", "2026-08-21T10:00:00-04:00")],
      });
      await newerPoll.promise;
    });
    expect(screen.getByText("New event")).toBeTruthy();

    await act(async () => {
      olderInitial.resolve({
        status: "ready",
        events: [makeEvent("1", "Old event", "2026-08-21T09:00:00-04:00")],
      });
      await olderInitial.promise;
    });

    expect(screen.getByText("New event")).toBeTruthy();
    expect(screen.queryByText("Old event")).toBeNull();
  });
});
