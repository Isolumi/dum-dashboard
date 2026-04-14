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
