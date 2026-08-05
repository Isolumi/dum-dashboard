/**
 * @vitest-environment jsdom
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceSnapshot } from "@shared/homelab/contracts";
import { useHomelabSnapshot } from "./useHomelabSnapshot";

const STARTED_AT = "2026-08-04T12:00:00.000Z";

function serviceSnapshot(
  observedAt: string,
  status: ServiceSnapshot["status"] = "healthy",
): ServiceSnapshot {
  return {
    data: { services: [] },
    status,
    observedAt,
    stale: false,
    issues: [],
    sources: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(STARTED_AT));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useHomelabSnapshot", () => {
  it("refreshes after ten seconds and never overlaps an in-flight refresh", async () => {
    const first = deferred<ServiceSnapshot>();
    const second = deferred<ServiceSnapshot>();
    const fetcher = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useHomelabSnapshot(fetcher, serviceSnapshot(STARTED_AT)));

    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.refreshing).toBe(true);

    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(fetcher).toHaveBeenCalledTimes(1);

    const refreshedAt = new Date().toISOString();
    await act(async () => first.resolve(serviceSnapshot(refreshedAt)));
    expect(result.current.refreshing).toBe(false);

    await act(async () => vi.advanceTimersByTimeAsync(9_999));
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(fetcher).toHaveBeenCalledTimes(2);

    await act(async () => second.resolve(serviceSnapshot(new Date().toISOString())));
  });

  it("preserves the last good snapshot and exposes only a fixed error after refresh failure", async () => {
    const fetcher = vi
      .fn<() => Promise<ServiceSnapshot>>()
      .mockRejectedValue(new Error("credential=private GATEWAY_URL stack=/gateway.ts:42"));
    const initial = serviceSnapshot(STARTED_AT, "warning");
    const { result } = renderHook(() => useHomelabSnapshot(fetcher, initial));

    await act(async () => vi.advanceTimersByTimeAsync(10_000));

    expect(result.current.snapshot).toEqual(initial);
    expect(result.current.refreshing).toBe(false);
    expect(result.current.error).toBe("Could not refresh homelab data");
    expect(JSON.stringify(result.current)).not.toContain("credential=private");
    expect(JSON.stringify(result.current)).not.toContain("gateway.ts");
  });

  it("marks retained data stale and unknown once it is older than thirty seconds", async () => {
    const fetcher = vi.fn(() => new Promise<ServiceSnapshot>(() => undefined));
    const { result } = renderHook(() => useHomelabSnapshot(fetcher, serviceSnapshot(STARTED_AT)));

    await act(async () => vi.advanceTimersByTimeAsync(30_001));

    expect(result.current.snapshot).toMatchObject({
      observedAt: STARTED_AT,
      stale: true,
      status: "unknown",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("cancels scheduled refreshes when unmounted", async () => {
    const fetcher = vi.fn<() => Promise<ServiceSnapshot>>();
    const { unmount } = renderHook(() => useHomelabSnapshot(fetcher, serviceSnapshot(STARTED_AT)));

    unmount();
    await act(async () => vi.advanceTimersByTimeAsync(60_000));

    expect(fetcher).not.toHaveBeenCalled();
  });
});
