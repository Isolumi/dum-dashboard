/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = {
  deleteJob: vi.fn(),
  getJobs: vi.fn(),
};

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: vi.fn(() => (options: unknown) => options),
}));

vi.mock("#/routes/jobs/jobs.functions", () => apiMocks);

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
    document: dom.window.document,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    navigator: dom.window.navigator,
    window: dom.window,
  };
  for (const [name, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, name, { configurable: true, value, writable: true });
  }
}

const { cleanup, render, screen, waitFor } = await import("@testing-library/react");
const { JobsPage } = await import("./index");

beforeEach(() => {
  apiMocks.getJobs.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("JobsPage", () => {
  it("shows a useful empty state in the narrow DumQ page layout", async () => {
    render(<JobsPage />);

    expect(screen.getByRole("heading", { name: "Jobs" })).toBeTruthy();
    await waitFor(() => expect(screen.getByText("No saved jobs")).toBeTruthy());
    expect(screen.getByRole("main").className).toContain("max-w-3xl");
  });
});
