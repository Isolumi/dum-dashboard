/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Job } from "#/lib/database.types";

vi.mock("#/routes/jobs/jobs.functions", () => ({
  deleteJob: vi.fn(),
  getJobs: vi.fn(),
}));

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

const { act, cleanup, renderHook, waitFor } = await import("@testing-library/react");
const { deleteJob, getJobs } = await import("#/routes/jobs/jobs.functions");
const { useJobsController } = await import("./-useJobsController");

type TestMock = ReturnType<typeof vi.fn>;
const getJobsMock = getJobs as TestMock;
const deleteJobMock = deleteJob as TestMock;

function makeJob(id: string, saved_at: string, overrides: Partial<Job> = {}): Job {
  return {
    company: "Point72",
    id,
    saved_at,
    title: "Quantitative Developer Intern",
    url: `https://jobs.example/${id}`,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

const older = makeJob("11111111-1111-4111-8111-111111111111", "2026-09-15T13:00:00.000Z");
const newestLowerId = makeJob("22222222-2222-4222-8222-222222222222", "2026-09-15T15:00:00.000Z");
const newestHigherId = makeJob("550e8400-e29b-41d4-a716-446655440000", "2026-09-15T15:00:00.000Z");

beforeEach(() => {
  getJobsMock.mockResolvedValue([]);
  deleteJobMock.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("useJobsController", () => {
  it("loads jobs in saved-at and ID descending order", async () => {
    getJobsMock.mockResolvedValueOnce([older, newestLowerId, newestHigherId]);
    const { result } = renderHook(() => useJobsController());

    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.jobs).toEqual([newestHigherId, newestLowerId, older]);
    expect(result.current.loadError).toBeNull();
  });

  it("refreshes every ten seconds without overlapping a pending refresh", async () => {
    vi.useFakeTimers();
    const pendingRefresh = deferred<Job[]>();
    getJobsMock.mockResolvedValueOnce([newestHigherId]).mockReturnValueOnce(pendingRefresh.promise);
    const { result } = renderHook(() => useJobsController());

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.status).toBe("ready");
    expect(getJobsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });
    expect(getJobsMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });
    expect(getJobsMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      pendingRefresh.resolve([newestHigherId]);
      await pendingRefresh.promise;
    });
  });

  it("keeps a valid empty state visible during a background refresh", async () => {
    vi.useFakeTimers();
    const pendingRefresh = deferred<Job[]>();
    getJobsMock.mockResolvedValueOnce([]).mockReturnValueOnce(pendingRefresh.promise);
    const { result } = renderHook(() => useJobsController());

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.status).toBe("ready");

    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.jobs).toEqual([]);

    await act(async () => {
      pendingRefresh.resolve([]);
      await pendingRefresh.promise;
    });
  });

  it("preserves a valid empty result when a later refresh fails", async () => {
    getJobsMock.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useJobsController());

    await waitFor(() => expect(result.current.status).toBe("ready"));
    await act(async () => result.current.refresh());

    expect(result.current.status).toBe("ready");
    expect(result.current.jobs).toEqual([]);
    expect(result.current.loadError).toMatch(/could not refresh saved jobs/i);
  });

  it("preserves last-good jobs when a background refresh fails", async () => {
    getJobsMock.mockResolvedValueOnce([newestHigherId]).mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useJobsController());

    await waitFor(() => expect(result.current.status).toBe("ready"));
    await act(async () => result.current.refresh());

    expect(result.current.status).toBe("ready");
    expect(result.current.jobs).toEqual([newestHigherId]);
    expect(result.current.loadError).toMatch(/could not refresh saved jobs/i);
  });

  it("does not let an older refresh overwrite a newer result", async () => {
    const first = deferred<Job[]>();
    const second = deferred<Job[]>();
    getJobsMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useJobsController());

    let newerRefresh!: Promise<void>;
    act(() => {
      newerRefresh = result.current.refresh();
    });

    await act(async () => {
      second.resolve([newestHigherId]);
      await newerRefresh;
    });
    expect(result.current.jobs).toEqual([newestHigherId]);

    await act(async () => {
      first.resolve([older]);
      await first.promise;
    });
    expect(result.current.jobs).toEqual([newestHigherId]);
  });

  it("removes a job optimistically while delete is pending", async () => {
    const pendingDelete = deferred<void>();
    getJobsMock.mockResolvedValueOnce([newestHigherId, older]);
    deleteJobMock.mockReturnValueOnce(pendingDelete.promise);
    const { result } = renderHook(() => useJobsController());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    let deletion!: Promise<boolean>;
    act(() => {
      deletion = result.current.remove(newestHigherId.id);
    });

    expect(result.current.jobs).toEqual([older]);
    expect(result.current.pendingIds.has(newestHigherId.id)).toBe(true);
    expect(deleteJobMock).toHaveBeenCalledWith({ data: { id: newestHigherId.id } });

    await act(async () => {
      pendingDelete.resolve();
      await deletion;
    });
    expect(result.current.pendingIds.has(newestHigherId.id)).toBe(false);
  });

  it("restores the exact previous array when delete fails", async () => {
    const previous = [newestHigherId, older];
    getJobsMock.mockResolvedValueOnce(previous);
    deleteJobMock.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useJobsController());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const previousArray = result.current.jobs;

    let removed!: boolean;
    await act(async () => {
      removed = await result.current.remove(newestHigherId.id);
    });

    expect(removed).toBe(false);
    expect(result.current.jobs).toBe(previousArray);
    expect(result.current.mutationError).toMatch(/could not delete saved job/i);
    expect(result.current.pendingIds.has(newestHigherId.id)).toBe(false);
  });
});
