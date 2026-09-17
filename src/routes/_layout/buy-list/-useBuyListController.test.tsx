import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BuyListItem } from "#/lib/database.types";
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  create: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("#/routes/buy-list/buy-list.functions", () => ({
  getBuyList: mocks.get,
  createBuyListItem: mocks.create,
  renameBuyListItem: mocks.rename,
  deleteBuyListItem: mocks.remove,
}));
import { useBuyListController } from "./-useBuyListController";

const older: BuyListItem = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Milk",
  created_at: "2026-09-17T12:00:00.000Z",
};
const newer: BuyListItem = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Bread",
  created_at: "2026-09-17T13:00:00.000Z",
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.get.mockResolvedValue([older, newer]);
  mocks.create.mockResolvedValue(newer);
  mocks.rename.mockResolvedValue({ ...older, name: "Cheese" });
  mocks.remove.mockResolvedValue(older);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
async function ready() {
  const hook = renderHook(() => useBuyListController());
  await waitFor(() => expect(hook.result.current.status).toBe("ready"));
  return hook;
}
describe("Buy list controller", () => {
  it.each([
    { format: "UTC", later: "2026-09-17T12:00:00.000900Z", earlier: "2026-09-17T12:00:00.000100Z" },
    {
      format: "different timezones",
      later: "2026-09-17T14:00:00.0009+02:00",
      earlier: "2026-09-17T12:00:00.000100+00:00",
    },
  ])(
    "preserves microsecond order for $format database-sorted reads and refreshes",
    async ({ later, earlier }) => {
      const laterItem = { ...older, created_at: later };
      const earlierItem = { ...newer, created_at: earlier };
      mocks.get
        .mockResolvedValueOnce([laterItem, earlierItem])
        .mockResolvedValueOnce([earlierItem, laterItem]);
      const { result } = await ready();
      expect(result.current.items).toEqual([laterItem, earlierItem]);
      await act(async () => result.current.refresh());
      expect(result.current.items).toEqual([laterItem, earlierItem]);
    },
  );
  it("compares timestamps as instants, including canonical database timezone formats", async () => {
    const tied = {
      ...newer,
      id: "33333333-3333-4333-8333-333333333333",
      created_at: "2026-09-17T13:00:00+00:00",
    };
    const earlier = { ...older, created_at: "2026-09-17T14:00:00+02:00" };
    mocks.get.mockResolvedValue([newer, earlier, tied]);
    const { result } = await ready();
    expect(result.current.items).toEqual([tied, newer, earlier]);
  });
  it("uses ID descending for equal microsecond instants with different fractional widths and timezones", async () => {
    const lowId = { ...older, created_at: "2026-09-17T12:00:00.000900Z" };
    const highId = { ...newer, created_at: "2026-09-17T14:00:00.0009+02:00" };
    mocks.get.mockResolvedValue([lowId, highId]);
    const { result } = await ready();
    expect(result.current.items).toEqual([highId, lowId]);
  });
  it("sorts by creation time then ID descending", async () => {
    const tie = { ...newer, id: "33333333-3333-4333-8333-333333333333" };
    mocks.get.mockResolvedValue([older, newer, tie]);
    const { result } = await ready();
    expect(result.current.items).toEqual([tie, newer, older]);
  });
  it("retries an initial failure without leaking exceptions", async () => {
    mocks.get.mockRejectedValueOnce(new Error("secret"));
    const { result } = renderHook(() => useBuyListController());
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.loadError).not.toContain("secret");
    await act(async () => result.current.refresh());
    expect(result.current.items).toEqual([newer, older]);
    expect(result.current.loadError).toBeNull();
  });
  it.each([{ items: [] }, { items: [older] }])(
    "retains last-good items after refresh failure",
    async ({ items }) => {
      mocks.get.mockResolvedValueOnce(items).mockRejectedValueOnce(new Error("secret"));
      const { result } = await ready();
      await act(async () => result.current.refresh());
      expect(result.current.items).toEqual(items);
      expect(result.current.status).toBe("ready");
      expect(result.current.loadError).toBeTruthy();
    },
  );
  it("polls at ten seconds without overlapping the initial or later read", async () => {
    vi.useFakeTimers();
    const initial = deferred<BuyListItem[]>();
    const poll = deferred<BuyListItem[]>();
    mocks.get.mockReturnValueOnce(initial.promise).mockReturnValueOnce(poll.promise);
    const { result } = renderHook(() => useBuyListController());
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(mocks.get).toHaveBeenCalledTimes(1);
    await act(async () => {
      initial.resolve([older]);
      await initial.promise;
    });
    await act(async () => {
      vi.advanceTimersByTime(9_999);
    });
    expect(mocks.get).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(mocks.get).toHaveBeenCalledTimes(2);
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(mocks.get).toHaveBeenCalledTimes(2);
    await act(async () => {
      poll.resolve([newer]);
      await poll.promise;
    });
    expect(result.current.items).toEqual([newer]);
  });
  it("creates optimistically, protects the temporary ID, and replaces it with the canonical row", async () => {
    const write = deferred<BuyListItem>();
    mocks.create.mockReturnValue(write.promise);
    const { result } = await ready();
    let promise!: Promise<boolean>;
    act(() => {
      promise = result.current.add(" Soap ");
    });
    const temporary = result.current.items.find((item) => item.name === "Soap")!;
    expect(result.current.pendingIds.has(temporary.id)).toBe(true);
    await act(async () => {
      expect(await result.current.rename(temporary.id, "Other")).toBe(false);
      expect(await result.current.remove(temporary.id)).toBe(false);
    });
    expect(mocks.rename).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
    const saved = { ...newer, id: "33333333-3333-4333-8333-333333333333", name: "Soap" };
    await act(async () => {
      write.resolve(saved);
      expect(await promise).toBe(true);
    });
    expect(result.current.items).toEqual([saved, newer, older]);
    expect(result.current.pendingIds.size).toBe(0);
    expect(mocks.create).toHaveBeenCalledWith({ data: { name: "Soap" } });
  });
  it("renames optimistically without changing creation time or order and blocks duplicate writes", async () => {
    const write = deferred<BuyListItem>();
    mocks.rename.mockReturnValue(write.promise);
    const { result } = await ready();
    let promise!: Promise<boolean>;
    act(() => {
      promise = result.current.rename(older.id, " Cheese ");
    });
    expect(result.current.items).toEqual([newer, { ...older, name: "Cheese" }]);
    await act(async () => {
      expect(await result.current.rename(older.id, "Other")).toBe(false);
      expect(await result.current.remove(older.id)).toBe(false);
    });
    expect(mocks.rename).toHaveBeenCalledTimes(1);
    await act(async () => {
      write.resolve({ ...older, name: "Cheese" });
      expect(await promise).toBe(true);
    });
  });
  it("deletes optimistically and blocks a duplicate delete", async () => {
    const write = deferred<BuyListItem>();
    mocks.remove.mockReturnValue(write.promise);
    const { result } = await ready();
    let promise!: Promise<boolean>;
    act(() => {
      promise = result.current.remove(older.id);
    });
    expect(result.current.items).toEqual([newer]);
    await act(async () => {
      expect(await result.current.remove(older.id)).toBe(false);
    });
    await act(async () => {
      write.resolve(older);
      expect(await promise).toBe(true);
    });
    expect(mocks.remove).toHaveBeenCalledTimes(1);
  });
  it.each(["create", "rename", "delete"])(
    "rolls back only the failed %s while another item succeeds",
    async (action) => {
      const failure = deferred<BuyListItem>();
      const success = deferred<BuyListItem>();
      mocks.create.mockReturnValue(failure.promise);
      mocks.remove.mockReturnValue(failure.promise);
      mocks.rename.mockImplementation(({ data }: { data: { id: string } }) =>
        data.id === newer.id ? success.promise : failure.promise,
      );
      const { result } = await ready();
      let failed!: Promise<boolean>;
      let succeeded!: Promise<boolean>;
      act(() => {
        failed =
          action === "create"
            ? result.current.add("Soap")
            : action === "rename"
              ? result.current.rename(older.id, "Cheese")
              : result.current.remove(older.id);
        succeeded = result.current.rename(newer.id, "Toast");
      });
      await act(async () => {
        success.resolve({ ...newer, name: "Toast" });
        expect(await succeeded).toBe(true);
        failure.reject(new Error("secret"));
        expect(await failed).toBe(false);
      });
      expect(result.current.items).toEqual([{ ...newer, name: "Toast" }, older]);
      expect(result.current.mutationError).toBeTruthy();
      expect(result.current.mutationError).not.toContain("secret");
    },
  );
  it("keeps a successful delete removed when an independent delete fails", async () => {
    const failure = deferred<BuyListItem>();
    const success = deferred<BuyListItem>();
    mocks.remove.mockReturnValueOnce(failure.promise).mockReturnValueOnce(success.promise);
    const { result } = await ready();
    let failed!: Promise<boolean>;
    let succeeded!: Promise<boolean>;
    act(() => {
      failed = result.current.remove(older.id);
      succeeded = result.current.remove(newer.id);
    });
    await act(async () => {
      success.resolve(newer);
      await succeeded;
      failure.reject(new Error("offline"));
      await failed;
    });
    expect(result.current.items).toEqual([older]);
  });
  it.each([
    { when: "before", action: "create" },
    { when: "during", action: "create" },
    { when: "before", action: "rename" },
    { when: "during", action: "rename" },
    { when: "before", action: "delete" },
    { when: "during", action: "delete" },
  ])("ignores stale refresh started $when a successful $action", async ({ when, action }) => {
    const read = deferred<BuyListItem[]>();
    const write = deferred<BuyListItem>();
    mocks.get.mockReturnValueOnce(Promise.resolve([older])).mockReturnValueOnce(read.promise);
    mocks.create.mockReturnValue(write.promise);
    mocks.rename.mockReturnValue(write.promise);
    mocks.remove.mockReturnValue(write.promise);
    const { result } = await ready();
    let refresh!: Promise<void>;
    let mutation!: Promise<boolean>;
    act(() => {
      if (when === "before") refresh = result.current.refresh();
      mutation =
        action === "create"
          ? result.current.add("Cheese")
          : action === "rename"
            ? result.current.rename(older.id, "Cheese")
            : result.current.remove(older.id);
      if (when === "during") refresh = result.current.refresh();
    });
    const canonical =
      action === "create" ? { ...newer, name: "Cheese" } : { ...older, name: "Cheese" };
    await act(async () => {
      write.resolve(canonical);
      await mutation;
      read.resolve([older]);
      await refresh;
    });
    expect(result.current.items).toEqual(
      action === "create" ? [canonical, older] : action === "rename" ? [canonical] : [],
    );
  });
  it("invalidates reads at the end of a failed mutation as well", async () => {
    const read = deferred<BuyListItem[]>();
    const write = deferred<BuyListItem>();
    mocks.get.mockResolvedValueOnce([older]).mockReturnValueOnce(read.promise);
    mocks.rename.mockReturnValue(write.promise);
    const { result } = await ready();
    let mutation!: Promise<boolean>;
    let refresh!: Promise<void>;
    act(() => {
      mutation = result.current.rename(older.id, "Cheese");
      refresh = result.current.refresh();
    });
    await act(async () => {
      write.reject(new Error("offline"));
      await mutation;
      read.resolve([{ ...older, name: "stale" }]);
      await refresh;
    });
    expect(result.current.items).toEqual([older]);
  });
  it("does not undo a successful independent create when a rename fails", async () => {
    const write = deferred<BuyListItem>();
    mocks.rename.mockReturnValue(write.promise);
    const created = { ...newer, id: "33333333-3333-4333-8333-333333333333", name: "Soap" };
    mocks.create.mockResolvedValue(created);
    const { result } = await ready();
    let rename!: Promise<boolean>;
    act(() => {
      rename = result.current.rename(older.id, "Cheese");
    });
    await act(async () => {
      expect(await result.current.add("Soap")).toBe(true);
      write.reject(new Error("offline"));
      await rename;
    });
    expect(result.current.items).toEqual([created, newer, older]);
  });
  it("rejects invalid and missing-item writes without calling the server", async () => {
    const { result } = await ready();
    await act(async () => {
      expect(await result.current.add(" ")).toBe(false);
      expect(await result.current.rename(older.id, "a".repeat(301))).toBe(false);
      expect(await result.current.rename("missing", "Milk")).toBe(false);
      expect(await result.current.remove("missing")).toBe(false);
    });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.rename).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([newer, older]);
  });
  it("does not let a refresh overwrite pending create, rename, or delete", async () => {
    const create = deferred<BuyListItem>();
    const rename = deferred<BuyListItem>();
    const remove = deferred<BuyListItem>();
    const third = { ...older, id: "33333333-3333-4333-8333-333333333333" };
    mocks.get.mockResolvedValue([older, newer, third]);
    mocks.create.mockReturnValue(create.promise);
    mocks.rename.mockReturnValue(rename.promise);
    mocks.remove.mockReturnValue(remove.promise);
    const { result } = await ready();
    let operations!: Promise<boolean>[];
    act(() => {
      operations = [
        result.current.add("Soap"),
        result.current.rename(older.id, "Cheese"),
        result.current.remove(newer.id),
      ];
    });
    const optimistic = result.current.items;
    await act(async () => result.current.refresh());
    expect(result.current.items).toEqual(optimistic);
    await act(async () => {
      create.resolve({ ...newer, name: "Soap" });
      rename.resolve({ ...older, name: "Cheese" });
      remove.resolve(newer);
      await Promise.all(operations);
    });
  });
});
