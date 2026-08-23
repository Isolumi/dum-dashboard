/**
 * @vitest-environment jsdom
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NavbarClock } from "./NavbarClock";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("NavbarClock", () => {
  it("renders the current date and time in the compact navbar format", () => {
    vi.useFakeTimers({ now: new Date("2026-01-01T14:37:00") });

    const { container } = render(<NavbarClock />);

    expect(screen.getByText("THU, JAN 1")).toBeTruthy();
    expect(screen.getByText("·")).toBeTruthy();
    expect(screen.getByText("14:37")).toBeTruthy();
    expect(container.querySelector('time[aria-label="Current date and time"]')).toBeTruthy();
  });

  it("zero-pads single-digit hours and minutes", () => {
    vi.useFakeTimers({ now: new Date("2026-01-01T09:05:00") });

    render(<NavbarClock />);

    expect(screen.getByText("09:05")).toBeTruthy();
  });

  it("updates after one minute elapses", () => {
    vi.useFakeTimers({ now: new Date("2026-01-01T14:37:00") });
    render(<NavbarClock />);

    act(() => vi.advanceTimersByTime(60_000));

    expect(screen.getByText("14:38")).toBeTruthy();
  });
});
