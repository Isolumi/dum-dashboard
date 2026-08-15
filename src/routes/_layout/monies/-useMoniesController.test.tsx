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
  getMoniesUsers,
  restoreMoniesExpense,
  updateMoniesExpense,
} from "#/routes/monies/monies.functions";
import type {
  CreateMoniesExpenseInput,
  MoniesExpense,
  MoniesExpensePage,
  MoniesUser,
} from "./-monies.types";
import { useMoniesController } from "./-useMoniesController";

vi.mock("#/routes/monies/monies.functions", () => ({
  createMoniesExpense: vi.fn(),
  deleteMoniesExpense: vi.fn(),
  getDeletedMoniesExpenses: vi.fn(),
  getMoniesExpenses: vi.fn(),
  getMoniesUsers: vi.fn(),
  restoreMoniesExpense: vi.fn(),
  updateMoniesExpense: vi.fn(),
}));

const users: MoniesUser[] = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Lumi" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Dum" },
];

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
  it("loads both users and the first active expense page", async () => {
    const { result } = renderHook(() => useMoniesController());

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.users).toEqual(users);
    expect(result.current.expenses).toEqual([makeExpense()]);
    expect(getMoniesExpenses).toHaveBeenCalledWith({ data: { page: 1, pageSize: 20 } });
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

  it("returns a failed save result so the form can retain its entered values", async () => {
    vi.mocked(createMoniesExpense).mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useMoniesController());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const input: CreateMoniesExpenseInput = {
      item: "Groceries",
      amount: "30.00",
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
    expect(result.current.mutationError).toMatch(/could not save expense/i);
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
    expect(result.current.mutationError).toMatch(/could not move expense to Trash/i);
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
