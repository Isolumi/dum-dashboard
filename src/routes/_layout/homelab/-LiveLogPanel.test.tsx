/**
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LiveLogPanel } from "./-LiveLogPanel";

type Listener = (event: MessageEvent<string>) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  readonly url: string;
  readonly close = vi.fn();
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  private listeners = new Map<string, Set<Listener>>();

  constructor(url: string | URL) {
    this.url = String(url);
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const listeners = this.listeners.get(type) ?? new Set<Listener>();
    listeners.add(listener as Listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    this.listeners.get(type)?.delete(listener as Listener);
  }

  open() {
    this.onopen?.(new Event("open"));
  }

  line(line: string) {
    const event = new MessageEvent<string>("line", {
      data: JSON.stringify({ line }),
    });
    this.listeners.get("line")?.forEach((listener) => listener(event));
  }

  fail() {
    this.onerror?.(new Event("error"));
  }
}

const scrollIntoView = vi.fn();

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderPanel(container = "api") {
  return render(
    <LiveLogPanel namespace="yootoob-mp3" pod="yootoob-mp3-api-7c9d8" container={container} />,
  );
}

describe("LiveLogPanel", () => {
  it("uses only the same-origin SSE proxy and renders the initial 200 lines as escaped text", () => {
    renderPanel();

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0]?.url).toBe(
      "/api/homelab/logs/yootoob-mp3/yootoob-mp3-api-7c9d8?container=api",
    );
    expect(screen.getByRole("status", { name: "Log stream status" }).textContent).toContain(
      "Connecting",
    );

    act(() => {
      FakeEventSource.instances[0]!.open();
      for (let index = 0; index < 199; index += 1) {
        FakeEventSource.instances[0]!.line(`line-${index}`);
      }
      FakeEventSource.instances[0]!.line('<img src=x onerror="alert(1)">');
    });

    expect(screen.getByRole("status", { name: "Log stream status" }).textContent).toContain("Live");
    const lines = within(screen.getByRole("log", { name: "Live pod logs" })).getAllByRole(
      "listitem",
    );
    expect(lines).toHaveLength(200);
    expect(lines[0]?.textContent).toBe("line-0");
    expect(lines[199]?.textContent).toBe('<img src=x onerror="alert(1)">');
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("keeps at most 2,000 rendered lines", () => {
    renderPanel();

    act(() => {
      FakeEventSource.instances[0]!.open();
      for (let index = 0; index < 2_005; index += 1) {
        FakeEventSource.instances[0]!.line(`line-${index}`);
      }
    });

    const lines = within(screen.getByRole("log", { name: "Live pod logs" })).getAllByRole(
      "listitem",
    );
    expect(lines).toHaveLength(2_000);
    expect(lines[0]?.textContent).toBe("line-5");
    expect(lines[1_999]?.textContent).toBe("line-2004");
  }, 10_000);

  it("pauses, resumes, clears, and lets auto-scroll be disabled", () => {
    renderPanel();
    const firstSource = FakeEventSource.instances[0]!;
    const logViewport = screen.getByRole("region", { name: "Live pod log output" });
    Object.defineProperty(logViewport, "scrollHeight", {
      configurable: true,
      value: 500,
    });

    act(() => {
      firstSource.open();
      firstSource.line("before pause");
    });
    expect(logViewport.scrollTop).toBe(500);
    expect(scrollIntoView).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Pause logs" }));
    expect(firstSource.close).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status", { name: "Log stream status" }).textContent).toContain(
      "Paused",
    );

    fireEvent.click(screen.getByRole("button", { name: "Resume logs" }));
    expect(FakeEventSource.instances).toHaveLength(2);
    const resumedSource = FakeEventSource.instances[1]!;
    act(() => {
      resumedSource.open();
    });

    fireEvent.click(screen.getByRole("checkbox", { name: "Auto-scroll logs" }));
    logViewport.scrollTop = 0;
    act(() => resumedSource.line("after resume"));
    expect(logViewport.scrollTop).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Clear logs" }));
    expect(screen.getByText("Waiting for log output.")).toBeTruthy();
  });

  it("reconnects after 1, 2, 4, 8, and then capped 15 second delays", () => {
    vi.useFakeTimers();
    renderPanel();

    const delays = [1_000, 2_000, 4_000, 8_000, 15_000, 15_000];
    for (const [index, delay] of delays.entries()) {
      act(() => FakeEventSource.instances[index]!.fail());
      expect(screen.getByRole("status", { name: "Log stream status" }).textContent).toContain(
        "Reconnecting",
      );
      act(() => vi.advanceTimersByTime(delay - 1));
      expect(FakeEventSource.instances).toHaveLength(index + 1);
      act(() => vi.advanceTimersByTime(1));
      expect(FakeEventSource.instances).toHaveLength(index + 2);
    }
  });

  it("closes stale sources on selection changes and never reconnects after unmount", () => {
    vi.useFakeTimers();
    const { rerender, unmount } = renderPanel();
    const firstSource = FakeEventSource.instances[0]!;
    act(() => {
      firstSource.open();
      firstSource.line("old container output");
    });
    expect(screen.getByText("old container output")).toBeTruthy();

    rerender(
      <LiveLogPanel namespace="yootoob-mp3" pod="yootoob-mp3-api-7c9d8" container="sidecar" />,
    );
    expect(firstSource.close).toHaveBeenCalledTimes(1);
    expect(FakeEventSource.instances[1]?.url).toContain("container=sidecar");
    expect(screen.queryByText("old container output")).toBeNull();
    expect(screen.getByText("Waiting for log output.")).toBeTruthy();

    const secondSource = FakeEventSource.instances[1]!;
    act(() => secondSource.fail());
    unmount();
    expect(secondSource.close).toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(60_000));
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it("refuses unsafe Kubernetes identifiers without opening a stream", () => {
    render(
      <LiveLogPanel
        namespace="yootoob-mp3"
        pod="../../private-token"
        container="api/../../secret"
      />,
    );

    expect(FakeEventSource.instances).toHaveLength(0);
    expect(screen.getByRole("alert").textContent).toBe("Invalid pod log selection.");
  });
});
