/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

// --- Supabase mock ---
let subscribeCb: ((status: string) => void) | undefined;
let eventCb: (() => void) | undefined;
const mockRemoveChannel = vi.fn();
const mockChannel = {
  on: vi.fn().mockImplementation((_type: string, _filter: unknown, cb: () => void) => {
    eventCb = cb;
    return mockChannel;
  }),
  subscribe: vi.fn().mockImplementation((cb: (status: string) => void) => {
    subscribeCb = cb;
    return mockChannel;
  }),
};

vi.mock("#/lib/supabase", () => ({
  supabase: {
    channel: vi.fn(() => mockChannel),
    removeChannel: mockRemoveChannel,
  },
}));

const { useTodosRealtime } = await import("./useTodosRealtime");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  subscribeCb = undefined;
  eventCb = undefined;
});

describe("useTodosRealtime", () => {
  it("Test 1: calls onEvent when a postgres_changes event fires", () => {
    const onEvent = vi.fn();
    renderHook(() => useTodosRealtime(onEvent));
    expect(eventCb).toBeDefined();
    eventCb!();
    expect(onEvent).toHaveBeenCalledOnce();
  });

  it("Test 2: returns 'live' when subscribe callback fires with SUBSCRIBED", () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => useTodosRealtime(onEvent));
    expect(result.current).toBe("connecting");
    act(() => {
      subscribeCb!("SUBSCRIBED");
    });
    expect(result.current).toBe("live");
  });

  it("Test 3: returns 'reconnecting' when subscribe callback fires with CHANNEL_ERROR", () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => useTodosRealtime(onEvent));
    act(() => {
      subscribeCb!("CHANNEL_ERROR");
    });
    expect(result.current).toBe("reconnecting");
  });

  it("Test 4: calls removeChannel on unmount", () => {
    const onEvent = vi.fn();
    const { unmount } = renderHook(() => useTodosRealtime(onEvent));
    unmount();
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
  });
});
