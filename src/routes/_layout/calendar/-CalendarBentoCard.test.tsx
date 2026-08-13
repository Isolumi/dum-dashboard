/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

  it("renders the card as a link to /calendar", async () => {
    vi.mocked(getCalendarEvents).mockResolvedValue({ status: "ready", events: [] });

    render(React.createElement(CalendarBentoCard, { tool: mockTool, data: null }));

    await waitFor(() => {
      const link = screen.getByRole("link");
      expect(link.getAttribute("href")).toBe("/calendar");
    });
  });
});
