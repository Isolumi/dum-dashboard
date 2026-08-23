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
    expect(
      container.querySelector('time[aria-label="Current date and time: THU, JAN 1, 14:37"]'),
    ).toBeTruthy();
  });

  it("zero-pads single-digit hours and minutes", () => {
    vi.useFakeTimers({ now: new Date("2026-01-01T09:05:00") });

    render(<NavbarClock />);

    expect(screen.getByText("09:05")).toBeTruthy();
  });

  it("updates on minute boundaries instead of every second", () => {
    vi.useFakeTimers({ now: new Date("2026-01-01T14:37:42") });
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

    render(<NavbarClock />);

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 18_000);
    expect(setIntervalSpy).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(17_999));
    expect(screen.getByText("14:37")).toBeTruthy();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText("14:38")).toBeTruthy();
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60_000);

    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText("14:39")).toBeTruthy();
  });
});
