/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";

const { LiveIndicator } = await import("./-LiveIndicator");

afterEach(() => {
  cleanup();
});

describe("LiveIndicator", () => {
  it("Test 5: renders nothing when status is 'connecting'", () => {
    const { container } = render(React.createElement(LiveIndicator, { status: "connecting" }));
    expect(container.innerHTML).toBe("");
  });

  it("Test 6: renders 'Live' text and a pulsing dot when status is 'live'", () => {
    render(React.createElement(LiveIndicator, { status: "live" }));
    expect(screen.getByText("Live")).toBeTruthy();
    const dot = document.querySelector(".animate-pulse");
    expect(dot).toBeTruthy();
  });

  it("Test 7: renders 'Reconnecting...' text when status is 'reconnecting'", () => {
    render(React.createElement(LiveIndicator, { status: "reconnecting" }));
    expect(screen.getByText("Reconnecting...")).toBeTruthy();
    const dot = document.querySelector(".animate-pulse");
    expect(dot).toBeNull();
  });
});
