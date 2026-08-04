/**
 * @vitest-environment jsdom
 */
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePollingRefresh } from "./usePollingRefresh";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("usePollingRefresh", () => {
  it("refreshes on the configured interval", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn();

    renderHook(() => usePollingRefresh(refresh, 3000));
    await vi.advanceTimersByTimeAsync(3000);

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
