/**
 * @vitest-environment jsdom
 */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMoniesExpense,
  deleteMoniesExpense,
  getDeletedMoniesExpenses,
  getMoniesExpenses,
  getMoniesSummary,
  getMoniesUsers,
  restoreMoniesExpense,
  updateMoniesExpense,
} from "#/routes/monies/monies.functions";
import type {
  CreateMoniesExpenseInput,
  MoniesExpense,
  MoniesExpensePage,
  MoniesSummary,
  MoniesUser,
} from "./-monies.types";
import { useMoniesController } from "./-useMoniesController";

vi.mock("#/routes/monies/monies.functions", () => ({
  createMoniesExpense: vi.fn(),
  deleteMoniesExpense: vi.fn(),
  getDeletedMoniesExpenses: vi.fn(),
  getMoniesExpenses: vi.fn(),
  getMoniesSummary: vi.fn(),
  getMoniesUsers: vi.fn(),
  restoreMoniesExpense: vi.fn(),
  updateMoniesExpense: vi.fn(),
}));

const users: MoniesUser[] = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Lumi" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Dum" },
];

const settledSummary: MoniesSummary = { amount: "0.00", debtor: null, creditor: null };
const owedSummary: MoniesSummary = { amount: "20.00", debtor: users[1]!, creditor: users[0]! };

function makeExpense(overrides: Partial<MoniesExpense> = {}): MoniesExpense {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    item: "Dinner",
    amount: "42.50",
    owedAmount: "20.00",
    payer: users[0]!,
    debtor: users[1]!,
    purchaseDate: "2026-08-15T20:00:00.000-04:00",
    createdAt: "2026-08-16T00:01:00.000Z",
    updatedAt: "2026-08-16T00:01:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function makePage(
  items: MoniesExpense[],
  overrides: Partial<MoniesExpensePage> = {},
): MoniesExpensePage {
  return { items, page: 1, pageSize: 20, total: items.length, ...overrides };
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

beforeEach(() => {
  vi.mocked(getMoniesUsers).mockResolvedValue(users);
  vi.mocked(getMoniesExpenses).mockResolvedValue(makePage([makeExpense()]));
  vi.mocked(getMoniesSummary).mockResolvedValue(settledSummary);
  vi.mocked(getDeletedMoniesExpenses).mockResolvedValue(makePage([]));
  vi.mocked(createMoniesExpense).mockResolvedValue(makeExpense());
  vi.mocked(updateMoniesExpense).mockResolvedValue(makeExpense());
  vi.mocked(deleteMoniesExpense).mockResolvedValue(
    makeExpense({ deletedAt: "2026-08-16T00:05:00.000Z" }),
  );
  vi.mocked(restoreMoniesExpense).mockResolvedValue(makeExpense());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("useMoniesController", () => {
  it("loads users, the summary, and the first active entry page", async () => {
    const { result } = renderHook(() => useMoniesController());

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.users).toEqual(users);
    expect(result.current.summary).toEqual(settledSummary);
    expect(result.current.expenses).toEqual([makeExpense()]);
    expect(getMoniesExpenses).toHaveBeenCalledWith({ data: { page: 1, pageSize: 20 } });
    expect(getMoniesSummary).toHaveBeenCalledOnce();
  });

  it("refreshes the visible page every ten seconds without returning to loading", async () => {
    vi.useFakeTimers();
    const initialRequest = deferred<MoniesExpensePage>();
    vi.mocked(getMoniesExpenses).mockReturnValueOnce(initialRequest.promise);
    const { result } = renderHook(() => useMoniesController());

    await act(async () => {
      initialRequest.resolve(makePage([makeExpense()]));
      await initialRequest.promise;
    });
    expect(result.current.status).toBe("ready");
    expect(getMoniesExpenses).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_999);
    });
    expect(getMoniesExpenses).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(getMoniesExpenses).toHaveBeenCalledTimes(2);
    expect(getMoniesSummary).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("ready");
  });

  it("keeps pagination between page one and the last available page", async () => {
    vi.mocked(getMoniesExpenses).mockImplementation(async ({ data }) =>
      makePage([makeExpense({ item: `Page ${data.page}` })], {
        page: data.page,
        total: 41,
      }),
    );
    const { result } = renderHook(() => useMoniesController());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.previousPage());
    expect(result.current.page).toBe(1);

    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.page).toBe(2));
    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.page).toBe(3));
    act(() => result.current.nextPage());

    expect(result.current.page).toBe(3);
    expect(getMoniesExpenses).toHaveBeenLastCalledWith({ data: { page: 3, pageSize: 20 } });
  });

  it("does not let an older active request replace the selected Trash page", async () => {
    const activeRequest = deferred<MoniesExpensePage>();
    const deletedRequest = deferred<MoniesExpensePage>();
    const deletedExpense = makeExpense({
      item: "Deleted dinner",
      deletedAt: "2026-08-16T00:05:00.000Z",
    });
    vi.mocked(getMoniesExpenses).mockReturnValueOnce(activeRequest.promise);
    vi.mocked(getDeletedMoniesExpenses).mockReturnValueOnce(deletedRequest.promise);
    const { result } = renderHook(() => useMoniesController());

    act(() => result.current.setView("trash"));
    await waitFor(() => expect(getDeletedMoniesExpenses).toHaveBeenCalledOnce());
    await act(async () => deletedRequest.resolve(makePage([deletedExpense])));
    expect(result.current.expenses).toEqual([deletedExpense]);

    await act(async () => activeRequest.resolve(makePage([makeExpense({ item: "Stale" })])));

    expect(result.current.view).toBe("trash");
    expect(result.current.expenses).toEqual([deletedExpense]);
  });

  it("loads the selected Active rows after a Trash restore finishes", async () => {
    const activeExpense = makeExpense({
      id: "77777777-7777-4777-8777-777777777777",
      item: "Active dinner",
    });
    const deletedExpense = makeExpense({
      item: "Deleted dinner",
      deletedAt: "2026-08-16T00:05:00.000Z",
    });
    const restoredExpense = { ...deletedExpense, deletedAt: null };
    const restoreRequest = deferred<MoniesExpense>();
    vi.mocked(getMoniesExpenses)
      .mockResolvedValueOnce(makePage([activeExpense]))
      .mockResolvedValueOnce(makePage([activeExpense]))
      .mockResolvedValueOnce(makePage([restoredExpense, activeExpense]));
    vi.mocked(getDeletedMoniesExpenses).mockResolvedValueOnce(makePage([deletedExpense]));
    vi.mocked(restoreMoniesExpense).mockReturnValueOnce(restoreRequest.promise);
    const { result } = renderHook(() => useMoniesController());
    await waitFor(() => expect(result.current.expenses).toEqual([activeExpense]));
    act(() => result.current.setView("trash"));
    await waitFor(() => expect(result.current.expenses).toEqual([deletedExpense]));

    let restoration!: Promise<boolean>;
    act(() => {
      restoration = result.current.restore(deletedExpense.id);
    });
    act(() => result.current.setView("active"));
    await waitFor(() => expect(getMoniesExpenses).toHaveBeenCalledTimes(2));
    await act(async () => {
      restoreRequest.resolve(restoredExpense);
      await restoration;
    });

    await waitFor(() => {
      expect(result.current.view).toBe("active");
      expect(result.current.page).toBe(1);
      expect(result.current.expenses).toEqual([restoredExpense, activeExpense]);
    });
  });

  it("keeps the selected Trash page when a restore from another page finishes", async () => {
    const deletedExpense = makeExpense({
      item: "Deleted dinner",
      deletedAt: "2026-08-16T00:05:00.000Z",
    });
    const pageTwoExpense = makeExpense({
      id: "55555555-5555-4555-8555-555555555555",
      item: "Trash page two",
      deletedAt: "2026-08-16T00:06:00.000Z",
    });
    const restoreRequest = deferred<MoniesExpense>();
    vi.mocked(getDeletedMoniesExpenses).mockImplementation(async ({ data }) =>
      makePage(data.page === 1 ? [deletedExpense] : [pageTwoExpense], {
        page: data.page,
        total: 41,
      }),
    );
    vi.mocked(restoreMoniesExpense).mockReturnValueOnce(restoreRequest.promise);
    const { result } = renderHook(() => useMoniesController());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.setView("trash"));
    await waitFor(() => expect(result.current.expenses).toEqual([deletedExpense]));

    let restoration!: Promise<boolean>;
    act(() => {
      restoration = result.current.restore(deletedExpense.id);
    });
    act(() => result.current.nextPage());
    await waitFor(() =>
      expect(getDeletedMoniesExpenses).toHaveBeenLastCalledWith({
        data: { page: 2, pageSize: 20 },
      }),
    );
    await act(async () => {
      restoreRequest.resolve({ ...deletedExpense, deletedAt: null });
      await restoration;
    });

    await waitFor(() => {
      expect(result.current.view).toBe("trash");
      expect(result.current.page).toBe(2);
      expect(result.current.expenses).toEqual([pageTwoExpense]);
    });
  });

  it("does not put a failed Trash restore into the selected Active rows", async () => {
    const activeExpense = makeExpense({
      id: "88888888-8888-4888-8888-888888888888",
      item: "Active dinner",
    });
    const deletedExpense = makeExpense({
      item: "Deleted dinner",
      deletedAt: "2026-08-16T00:05:00.000Z",
    });
    const restoreRequest = deferred<MoniesExpense>();
    vi.mocked(getMoniesExpenses)
      .mockResolvedValueOnce(makePage([activeExpense]))
      .mockResolvedValueOnce(makePage([activeExpense]))
      .mockResolvedValueOnce(makePage([activeExpense]));
    vi.mocked(getDeletedMoniesExpenses).mockResolvedValueOnce(makePage([deletedExpense]));
    vi.mocked(restoreMoniesExpense).mockReturnValueOnce(restoreRequest.promise);
    const { result } = renderHook(() => useMoniesController());
    await waitFor(() => expect(result.current.expenses).toEqual([activeExpense]));
    act(() => result.current.setView("trash"));
    await waitFor(() => expect(result.current.expenses).toEqual([deletedExpense]));

    let restoration!: Promise<boolean>;
    act(() => {
      restoration = result.current.restore(deletedExpense.id);
    });
    act(() => result.current.setView("active"));
    await waitFor(() => expect(getMoniesExpenses).toHaveBeenCalledTimes(2));
    await act(async () => {
      restoreRequest.reject(new Error("offline"));
      await restoration;
    });

    await waitFor(() => {
      expect(result.current.view).toBe("active");
      expect(result.current.page).toBe(1);
      expect(result.current.expenses).toEqual([activeExpense]);
      expect(result.current.mutationError).toMatch(/could not restore entry/i);
    });
  });

  it("keeps a failed restore from mutating Active rows after returning to its Trash context", async () => {
    const bootstrapActive = makeExpense({
      id: "99999999-9999-4999-8999-999999999999",
      item: "Bootstrap active",
    });
    const otherActive = makeExpense({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      item: "Other active context",
    });
    const deletedExpense = makeExpense({
      item: "Deleted dinner",
      deletedAt: "2026-08-16T00:05:00.000Z",
    });
    const restoreRequest = deferred<MoniesExpense>();
    const discardedTrashLoad = deferred<MoniesExpensePage>();
    const settledTrashLoad = deferred<MoniesExpensePage>();
    vi.mocked(getMoniesExpenses)
      .mockResolvedValueOnce(makePage([bootstrapActive]))
      .mockResolvedValueOnce(makePage([otherActive]));
    vi.mocked(getDeletedMoniesExpenses)
      .mockResolvedValueOnce(makePage([deletedExpense]))
      .mockReturnValueOnce(discardedTrashLoad.promise)
      .mockReturnValueOnce(settledTrashLoad.promise);
    vi.mocked(restoreMoniesExpense).mockReturnValueOnce(restoreRequest.promise);
    const { result } = renderHook(() => useMoniesController());
    await waitFor(() => expect(result.current.expenses).toEqual([bootstrapActive]));
    act(() => result.current.setView("trash"));
    await waitFor(() => expect(result.current.expenses).toEqual([deletedExpense]));

    let restoration!: Promise<boolean>;
    act(() => {
      restoration = result.current.restore(deletedExpense.id);
    });
    act(() => result.current.setView("active"));
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
      expect(result.current.expenses).toEqual([otherActive]);
    });
    act(() => result.current.setView("trash"));
    await act(async () => {
      discardedTrashLoad.resolve(makePage([deletedExpense]));
      await discardedTrashLoad.promise;
    });

    expect(result.current.view).toBe("trash");
    expect(result.current.page).toBe(1);
    expect(result.current.status).toBe("loading");
    expect(result.current.expenses).toEqual([]);

    act(() => restoreRequest.reject(new Error("offline")));
    await waitFor(() => expect(getDeletedMoniesExpenses).toHaveBeenCalledTimes(3));
    expect(result.current.status).toBe("loading");
    expect(result.current.expenses).toEqual([]);
    expect(result.current.expenses).not.toContainEqual(otherActive);
    expect(result.current.expenses).not.toContainEqual(deletedExpense);

    let restored = true;
    await act(async () => {
      settledTrashLoad.resolve(makePage([deletedExpense]));
      restored = await restoration;
    });

    expect(restored).toBe(false);
    expect(result.current.view).toBe("trash");
    expect(result.current.page).toBe(1);
    expect(result.current.status).toBe("ready");
    expect(result.current.expenses).toEqual([deletedExpense]);
  });

  it("loads the returned Trash context after the same restore sequence succeeds", async () => {
    const bootstrapActive = makeExpense({
      id: "99999999-9999-4999-8999-999999999999",
      item: "Bootstrap active",
    });
    const otherActive = makeExpense({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      item: "Other active context",
    });
    const deletedExpense = makeExpense({
      item: "Deleted dinner",
      deletedAt: "2026-08-16T00:05:00.000Z",
    });
    const remainingTrash = makeExpense({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      item: "Remaining Trash row",
      deletedAt: "2026-08-16T00:06:00.000Z",
    });
    const restoreRequest = deferred<MoniesExpense>();
    const discardedTrashLoad = deferred<MoniesExpensePage>();
    const settledTrashLoad = deferred<MoniesExpensePage>();
    vi.mocked(getMoniesExpenses)
      .mockResolvedValueOnce(makePage([bootstrapActive]))
      .mockResolvedValueOnce(makePage([otherActive]));
    vi.mocked(getDeletedMoniesExpenses)
      .mockResolvedValueOnce(makePage([deletedExpense]))
      .mockReturnValueOnce(discardedTrashLoad.promise)
      .mockReturnValueOnce(settledTrashLoad.promise);
    vi.mocked(restoreMoniesExpense).mockReturnValueOnce(restoreRequest.promise);
    const { result } = renderHook(() => useMoniesController());
    await waitFor(() => expect(result.current.expenses).toEqual([bootstrapActive]));
    act(() => result.current.setView("trash"));
    await waitFor(() => expect(result.current.expenses).toEqual([deletedExpense]));

    let restoration!: Promise<boolean>;
    act(() => {
      restoration = result.current.restore(deletedExpense.id);
    });
    act(() => result.current.setView("active"));
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
      expect(result.current.expenses).toEqual([otherActive]);
    });
    act(() => result.current.setView("trash"));
    await act(async () => {
      discardedTrashLoad.resolve(makePage([deletedExpense]));
      await discardedTrashLoad.promise;
    });

    expect(result.current.status).toBe("loading");
    expect(result.current.expenses).toEqual([]);

    act(() => restoreRequest.resolve({ ...deletedExpense, deletedAt: null }));
    await waitFor(() => expect(getDeletedMoniesExpenses).toHaveBeenCalledTimes(3));
    expect(result.current.status).toBe("loading");
    expect(result.current.expenses).toEqual([]);

    let restored = false;
    await act(async () => {
      settledTrashLoad.resolve(makePage([remainingTrash]));
      restored = await restoration;
    });

    expect(restored).toBe(true);
    expect(result.current.view).toBe("trash");
    expect(result.current.page).toBe(1);
    expect(result.current.status).toBe("ready");
    expect(result.current.expenses).toEqual([remainingTrash]);
  });

  it("reloads the selected rows after a stale refresh overlaps a mutation", async () => {
    vi.useFakeTimers();
    const targetExpense = makeExpense({ item: "Delete this" });
    const currentExpense = makeExpense({
      id: "66666666-6666-4666-8666-666666666666",
      item: "Current server row",
    });
    const initialRequest = deferred<MoniesExpensePage>();
    const staleRefresh = deferred<MoniesExpensePage>();
    const deleteRequest = deferred<MoniesExpense>();
    vi.mocked(getMoniesExpenses)
      .mockReturnValueOnce(initialRequest.promise)
      .mockReturnValueOnce(staleRefresh.promise)
      .mockResolvedValueOnce(makePage([currentExpense]));
    vi.mocked(deleteMoniesExpense).mockReturnValueOnce(deleteRequest.promise);
    const { result } = renderHook(() => useMoniesController());
    await act(async () => {
      initialRequest.resolve(makePage([targetExpense]));
      await initialRequest.promise;
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(getMoniesExpenses).toHaveBeenCalledTimes(2);

    let deletion!: Promise<boolean>;
    act(() => {
      deletion = result.current.remove(targetExpense.id);
    });
    expect(result.current.expenses).toEqual([]);
    await act(async () => {
      staleRefresh.resolve(makePage([targetExpense]));
      await staleRefresh.promise;
    });
    expect(result.current.expenses).toEqual([]);
    await act(async () => {
      deleteRequest.resolve({ ...targetExpense, deletedAt: "2026-08-16T00:05:00.000Z" });
      await deletion;
    });

    expect(result.current.view).toBe("active");
    expect(result.current.page).toBe(1);
    expect(result.current.expenses).toEqual([currentExpense]);
    expect(getMoniesExpenses).toHaveBeenCalledTimes(3);
  });

  it("returns a failed save result so the form can retain its entered values", async () => {
    vi.mocked(createMoniesExpense).mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useMoniesController());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const input: CreateMoniesExpenseInput = {
      item: "Groceries",
      owedAmount: "15.00",
      payerId: users[0]!.id,
      purchaseDate: "2026-08-15T18:30:00-04:00",
      idempotencyKey: "one-request",
    };

    let saved = true;
    await act(async () => {
      saved = await result.current.create(input);
    });

    expect(saved).toBe(false);
    expect(result.current.mutationError).toMatch(/could not save entry/i);
  });

  it("refreshes the summary after a successful entry mutation", async () => {
    vi.mocked(getMoniesSummary)
      .mockResolvedValueOnce(settledSummary)
      .mockResolvedValueOnce(owedSummary);
    const { result } = renderHook(() => useMoniesController());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    await act(async () =>
      result.current.create({
        item: "Groceries",
        owedAmount: "15.00",
        payerId: users[0]!.id,
        purchaseDate: "2026-08-15T18:30:00-04:00",
        idempotencyKey: "one-request",
      }),
    );

    await waitFor(() => expect(result.current.summary).toEqual(owedSummary));
    expect(getMoniesSummary).toHaveBeenCalledTimes(2);
  });

  it("removes an expense optimistically and restores its position when delete fails", async () => {
    const deleteRequest = deferred<MoniesExpense>();
    vi.mocked(deleteMoniesExpense).mockReturnValueOnce(deleteRequest.promise);
    const { result } = renderHook(() => useMoniesController());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    let deletion!: Promise<boolean>;

    act(() => {
      deletion = result.current.remove(makeExpense().id);
    });
    expect(result.current.expenses).toEqual([]);

    await act(async () => {
      deleteRequest.reject(new Error("offline"));
      await deletion;
    });

    expect(result.current.expenses).toEqual([makeExpense()]);
    expect(result.current.mutationError).toMatch(/could not move entry to Trash/i);
  });

  it("returns to the previous page after deleting the only item on the last page", async () => {
    vi.mocked(getMoniesExpenses).mockImplementation(async ({ data }) =>
      makePage([makeExpense({ item: `Page ${data.page}` })], {
        page: data.page,
        total: 21,
      }),
    );
    const { result } = renderHook(() => useMoniesController());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.page).toBe(2));

    await act(async () => result.current.remove(makeExpense().id));

    await waitFor(() => expect(result.current.page).toBe(1));
  });

  it("removes a restored expense from Trash after the service accepts it", async () => {
    const deletedExpense = makeExpense({ deletedAt: "2026-08-16T00:05:00.000Z" });
    vi.mocked(getDeletedMoniesExpenses).mockResolvedValueOnce(makePage([deletedExpense]));
    const { result } = renderHook(() => useMoniesController());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.setView("trash"));
    await waitFor(() => expect(result.current.expenses).toEqual([deletedExpense]));

    await act(async () => result.current.restore(deletedExpense.id));

    expect(restoreMoniesExpense).toHaveBeenCalledWith({ data: { id: deletedExpense.id } });
    expect(result.current.expenses).toEqual([]);
  });

  it("returns to the previous Trash page after restoring its only item", async () => {
    const deletedExpense = makeExpense({ deletedAt: "2026-08-16T00:05:00.000Z" });
    vi.mocked(getDeletedMoniesExpenses).mockImplementation(async ({ data }) =>
      makePage([deletedExpense], { page: data.page, total: 21 }),
    );
    const { result } = renderHook(() => useMoniesController());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.setView("trash"));
    await waitFor(() => expect(result.current.expenses).toEqual([deletedExpense]));
    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.page).toBe(2));

    await act(async () => result.current.restore(deletedExpense.id));

    await waitFor(() => expect(result.current.page).toBe(1));
  });
});
