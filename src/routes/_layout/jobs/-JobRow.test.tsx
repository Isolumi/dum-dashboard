/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Job } from "#/lib/database.types";

if (typeof document === "undefined") {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });
  const globals = {
    CustomEvent: dom.window.CustomEvent,
    Element: dom.window.Element,
    Event: dom.window.Event,
    FocusEvent: dom.window.FocusEvent,
    HTMLElement: dom.window.HTMLElement,
    KeyboardEvent: dom.window.KeyboardEvent,
    MouseEvent: dom.window.MouseEvent,
    MutationObserver: dom.window.MutationObserver,
    Node: dom.window.Node,
    cancelAnimationFrame: (handle: number) => clearTimeout(handle),
    document: dom.window.document,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    navigator: dom.window.navigator,
    requestAnimationFrame: (callback: FrameRequestCallback) =>
      setTimeout(() => callback(Date.now()), 0),
    window: dom.window,
  };
  for (const [name, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, name, { configurable: true, value, writable: true });
  }
}

if (typeof requestAnimationFrame === "undefined") {
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    value: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
    writable: true,
  });
  Object.defineProperty(globalThis, "cancelAnimationFrame", {
    configurable: true,
    value: (handle: number) => clearTimeout(handle),
    writable: true,
  });
}

const { cleanup, fireEvent, render, screen, waitFor } = await import("@testing-library/react");
const { JobRow } = await import("./-JobRow");

const job: Job = {
  company: "Point72",
  id: "550e8400-e29b-41d4-a716-446655440000",
  saved_at: "2026-09-15T15:00:00.000Z",
  title: "Quantitative Developer Intern",
  url: "https://jobs.example/point72?source=discord",
};

afterEach(() => {
  cleanup();
});

describe("JobRow", () => {
  it("shows only the saved job facts and uses a safe external link", () => {
    render(<JobRow job={job} onDelete={vi.fn(async () => true)} />);

    expect(screen.getByText(job.company)).toBeTruthy();
    expect(screen.getByText(job.title)).toBeTruthy();
    expect(screen.getByText("Saved Sep 15, 2026, 11:00 a.m.")).toBeTruthy();
    expect(screen.queryByText(/applied|status|notes|reminder/i)).toBeNull();

    const link = screen.getByRole("link", { name: `Open ${job.title} at ${job.company}` });
    expect(link.getAttribute("href")).toBe(job.url);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noreferrer");
  });

  it("uses an explicit delete confirmation with cancel and delete actions", async () => {
    const onDelete = vi.fn(async () => true);
    render(<JobRow job={job} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: `Delete ${job.title}` }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Delete this saved job?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Delete this saved job?" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: `Delete ${job.title}` }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(job.id));
  });

  it("keeps job facts and actions usable in a narrow stacked layout", () => {
    render(<JobRow job={job} onDelete={vi.fn(async () => true)} />);

    const row = screen.getByRole("listitem").firstElementChild;
    expect(row?.className).toContain("flex-col");
    expect(row?.className).toContain("sm:flex-row");
    expect(
      screen.getByRole("link", { name: `Open ${job.title} at ${job.company}` }).className,
    ).toContain("min-h-11");
    expect(screen.getByRole("button", { name: `Delete ${job.title}` }).className).toContain(
      "size-11",
    );
  });
});
