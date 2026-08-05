/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import React from "react";
import type { ToolEntry } from "#/tools/registry";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const { ClockBentoCard } = await import("./ClockBentoCard");

const mockTool = {
  id: "clock",
  label: "Clock",
  route: "/",
  icon: () => null,
  BentoCard: () => null,
  overviewOnly: true,
} as unknown as ToolEntry;

describe("ClockBentoCard", () => {
  it("renders current time in HH:MM format", () => {
    vi.useFakeTimers({ now: new Date("2026-01-01T14:37:00") });
    render(React.createElement(ClockBentoCard, { tool: mockTool, data: null }));
    expect(screen.getByText("14:37")).toBeTruthy();
  });

  it("zero-pads single-digit hours and minutes", () => {
    vi.useFakeTimers({ now: new Date("2026-01-01T09:05:00") });
    render(React.createElement(ClockBentoCard, { tool: mockTool, data: null }));
    expect(screen.getByText("09:05")).toBeTruthy();
  });

  it("renders the compact date label", () => {
    vi.useFakeTimers({ now: new Date("2026-01-01T14:37:00") });
    render(React.createElement(ClockBentoCard, { tool: mockTool, data: null }));
    expect(screen.getByText("Thu, Jan 1")).toBeTruthy();
  });

  it("updates display after one minute elapses", () => {
    vi.useFakeTimers({ now: new Date("2026-01-01T14:37:00") });
    render(React.createElement(ClockBentoCard, { tool: mockTool, data: null }));
    expect(screen.getByText("14:37")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByText("14:38")).toBeTruthy();
  });
});
