/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { OpenAllJobsButton } from "./-OpenAllJobsButton";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("keeps an accessible icon-only control that opens each safe job", () => {
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  render(<OpenAllJobsButton jobs={[{ url: "https://jobs.example/one" }]} />);
  const button = screen.getByRole("button", { name: "Open all" });
  expect(button.textContent).toBe("");
  expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  fireEvent.click(button);
  expect(open).toHaveBeenCalledExactlyOnceWith(
    "https://jobs.example/one",
    "_blank",
    "noopener,noreferrer",
  );
});
