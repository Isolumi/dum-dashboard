/**
 * @vitest-environment jsdom
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});

vi.mock("@tanstack/react-router", () => ({
  createFileRoute:
    () =>
    <T,>(options: T): T =>
      options,
}));

vi.mock("#/components/ui/calendar", () => ({
  Calendar: () => React.createElement("div", null, "Month grid"),
}));

vi.mock("./-calendar.functions", () => ({
  getCalendarEvents: vi.fn(),
  startCalendarOAuth: vi.fn(),
}));

const { getCalendarEvents } = await import("./-calendar.functions");
const { Route } = await import("./index");
const CalendarPage = (Route as unknown as { component: React.ComponentType }).component;

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

describe("CalendarPage", () => {
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

    render(React.createElement(CalendarPage));
    await act(async () => Promise.resolve());
    expect(screen.getByText("Old event")).toBeTruthy();

    await act(async () => vi.advanceTimersByTimeAsync(10_000));

    expect(getCalendarEvents).toHaveBeenCalledTimes(2);
    expect(screen.getByText("New event")).toBeTruthy();
    expect(screen.queryByText("Old event")).toBeNull();
  });

  it("keeps current events visible while a background refresh is pending", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 20, 12));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const refresh = deferred<{
      status: "ready";
      events: ReturnType<typeof makeEvent>[];
    }>();
    vi.mocked(getCalendarEvents)
      .mockResolvedValueOnce({
        status: "ready",
        events: [makeEvent("1", "Current event", "2026-08-21T09:00:00-04:00")],
      })
      .mockReturnValueOnce(refresh.promise);

    render(React.createElement(CalendarPage));
    await act(async () => Promise.resolve());
    expect(screen.getByText("Current event")).toBeTruthy();

    await act(async () => vi.advanceTimersByTimeAsync(10_000));

    expect(getCalendarEvents).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Current event")).toBeTruthy();
    expect(screen.getByText("Month grid")).toBeTruthy();

    await act(async () => {
      refresh.resolve({
        status: "ready",
        events: [makeEvent("2", "Refreshed event", "2026-08-21T10:00:00-04:00")],
      });
      await refresh.promise;
    });
    expect(screen.getByText("Refreshed event")).toBeTruthy();
  });
});
