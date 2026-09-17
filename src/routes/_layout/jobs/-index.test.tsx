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

const { act, cleanup, fireEvent, render, screen, waitFor } = await import("@testing-library/react");
const { JobsPage } = await import("./index");

beforeEach(() => {
  apiMocks.getJobs.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("JobsPage", () => {
  it("disables bulk opening after a failed background read", async () => {
    vi.useFakeTimers();
    apiMocks.getJobs
      .mockResolvedValueOnce([
        {
          id: "one",
          company: "Company",
          title: "Job one",
          saved_at: "2026-09-17T00:00:00Z",
          url: "https://jobs.example/one",
        },
      ])
      .mockRejectedValueOnce(new Error("offline"));
    render(<JobsPage />);
    await act(async () => Promise.resolve());
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(screen.getByRole("list", { name: "Saved jobs" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Open all" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("opens all saved job links from the page header", async () => {
    const urls = ["https://jobs.example/one", "https://jobs.example/two"];
    apiMocks.getJobs.mockResolvedValue(
      urls.map((url, index) => ({
        id: String(index),
        company: "Company",
        title: `Job ${index}`,
        saved_at: `2026-09-17T0${index}:00:00Z`,
        url,
      })),
    );
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<JobsPage />);
    await screen.findByRole("list", { name: "Saved jobs" });
    fireEvent.click(screen.getByRole("button", { name: "Open all" }));
    expect(open.mock.calls).toEqual(
      urls.toReversed().map((url) => [url, "_blank", "noopener,noreferrer"]),
    );
  });

  it("shows a useful empty state in the narrow DumQ page layout", async () => {
    render(<JobsPage />);

    expect(screen.getByRole("heading", { name: "Jobs" })).toBeTruthy();
    await waitFor(() => expect(screen.getByText("No saved jobs")).toBeTruthy());
    expect((screen.getByRole("button", { name: "Open all" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByRole("main").className).toContain("max-w-3xl");
  });
});
