/**
 * @vitest-environment jsdom
 */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { WalletCards } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MoniesExpense, MoniesExpensePage, MoniesSummary } from "./-monies.types";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("a", { href: to, ...props }, children),
}));

vi.mock("#/routes/monies/monies.functions", () => ({
  getMoniesExpenses: vi.fn(),
  getMoniesSummary: vi.fn(),
}));

const { getMoniesExpenses, getMoniesSummary } = await import("#/routes/monies/monies.functions");
const { MoniesBentoCard } = await import("./-MoniesBentoCard");
const { tools } = await import("#/tools/registry");

const mockTool = {
  id: "monies",
  label: "Monies",
  route: "/monies",
  icon: WalletCards,
  BentoCard: () => null,
};

function makeExpense(index: number, overrides: Partial<MoniesExpense> = {}): MoniesExpense {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    item: `Expense ${index}`,
    amount: `${40 + index}.50`,
    owedAmount: `${20 + index}.00`,
    payer: { id: "11111111-1111-4111-8111-111111111111", name: "Lumi" },
    debtor: { id: "22222222-2222-4222-8222-222222222222", name: "Dum" },
    purchaseDate: "2026-08-15T20:00:00.000-04:00",
    createdAt: "2026-08-16T00:01:00.000Z",
    updatedAt: "2026-08-16T00:01:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function makePage(items: MoniesExpense[]): MoniesExpensePage {
  return { items, page: 1, pageSize: 3, total: items.length };
}

const owedSummary: MoniesSummary = {
  amount: "21.00",
  debtor: { id: "22222222-2222-4222-8222-222222222222", name: "Dum" },
  creditor: { id: "11111111-1111-4111-8111-111111111111", name: "Lumi" },
};

const settledSummary: MoniesSummary = { amount: "0.00", debtor: null, creditor: null };

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
  vi.mocked(getMoniesExpenses).mockResolvedValue(makePage([]));
  vi.mocked(getMoniesSummary).mockResolvedValue(settledSummary);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("MoniesBentoCard", () => {
  it("shows a compact balance and no more than three owed-only active entries", async () => {
    const longItem = "A long grocery item that must wrap cleanly inside the compact card";
    vi.mocked(getMoniesExpenses).mockResolvedValue(
      makePage([
        makeExpense(1, { item: longItem }),
        makeExpense(2),
        makeExpense(3),
        makeExpense(4),
      ]),
    );
    vi.mocked(getMoniesSummary).mockResolvedValue(owedSummary);

    render(<MoniesBentoCard tool={mockTool} data={null} />);

    await waitFor(() => expect(screen.getByText(longItem)).toBeTruthy());
    expect(getMoniesExpenses).toHaveBeenCalledWith({ data: { page: 1, pageSize: 3 } });
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByText("Expense 4")).toBeNull();
    expect(screen.getAllByText("Dum owes Lumi")).toHaveLength(4);
    expect(screen.getAllByText("$21.00")).toHaveLength(2);
    expect(screen.queryByText(/total/i)).toBeNull();
    expect(screen.getByText(longItem).className).toContain("break-words");
    expect(screen.queryByText(/balance|chart/i)).toBeNull();
  });

  it("keeps maximum owed amounts on a narrow-safe row below the note", async () => {
    const item = "Maximum amount expense with a long item name";
    vi.mocked(getMoniesExpenses).mockResolvedValue(
      makePage([
        makeExpense(1, {
          item,
          owedAmount: "9999999999.99",
        }),
      ]),
    );

    render(<MoniesBentoCard tool={mockTool} data={null} />);

    const itemElement = await screen.findByText(item);
    const row = itemElement.closest("li");
    const amount = screen.getByText("$9,999,999,999.99");

    expect(row?.className).toContain("flex-col");
    expect(amount.className).toContain("whitespace-nowrap");
    expect(amount.className).not.toContain("shrink-0");
    expect(screen.queryByText(/owed \$/i)).toBeNull();
  });

  it("shows a loading state while the first request is pending", () => {
    vi.mocked(getMoniesExpenses).mockReturnValue(new Promise(() => undefined));

    render(<MoniesBentoCard tool={mockTool} data={null} />);

    expect(screen.getByRole("status", { name: "Loading Monies entries" })).toBeTruthy();
  });

  it("shows settled-up balance and an empty state when there are no active entries", async () => {
    render(<MoniesBentoCard tool={mockTool} data={null} />);

    await waitFor(() => expect(screen.getByText("No active entries.")).toBeTruthy());
    expect(screen.getByText("Settled up")).toBeTruthy();
    expect(screen.getByText("$0.00")).toBeTruthy();
  });

  it("shows a safe error state when loading fails", async () => {
    vi.mocked(getMoniesExpenses).mockRejectedValue(new Error("private service detail"));

    render(<MoniesBentoCard tool={mockTool} data={null} />);

    await waitFor(() => expect(screen.getByText("Could not load entries.")).toBeTruthy());
    expect(screen.queryByText(/private service detail/i)).toBeNull();
  });

  it("refreshes every ten seconds only while the page is visible", async () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, "visibilityState", "get");
    visibility.mockReturnValue("visible");

    render(<MoniesBentoCard tool={mockTool} data={null} />);
    await act(async () => Promise.resolve());
    expect(getMoniesExpenses).toHaveBeenCalledTimes(1);
    expect(getMoniesSummary).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(getMoniesExpenses).toHaveBeenCalledTimes(2);
    expect(getMoniesSummary).toHaveBeenCalledTimes(2);

    visibility.mockReturnValue("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(getMoniesExpenses).toHaveBeenCalledTimes(2);
    expect(getMoniesSummary).toHaveBeenCalledTimes(2);

    visibility.mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => vi.advanceTimersByTimeAsync(9_999));
    expect(getMoniesExpenses).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(getMoniesExpenses).toHaveBeenCalledTimes(3);
    expect(getMoniesSummary).toHaveBeenCalledTimes(3);
  });

  it("keeps the newest expenses when overlapping requests finish out of order", async () => {
    vi.useFakeTimers();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const olderRequest = deferred<MoniesExpensePage>();
    const newerRequest = deferred<MoniesExpensePage>();
    vi.mocked(getMoniesExpenses)
      .mockReturnValueOnce(olderRequest.promise)
      .mockReturnValueOnce(newerRequest.promise);

    render(<MoniesBentoCard tool={mockTool} data={null} />);
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(getMoniesExpenses).toHaveBeenCalledTimes(2);

    await act(async () => {
      newerRequest.resolve(makePage([makeExpense(2, { item: "Newest expense" })]));
      await newerRequest.promise;
    });
    expect(screen.getByText("Newest expense")).toBeTruthy();

    await act(async () => {
      olderRequest.resolve(makePage([makeExpense(1, { item: "Stale expense" })]));
      await olderRequest.promise;
    });

    expect(screen.getByText("Newest expense")).toBeTruthy();
    expect(screen.queryByText("Stale expense")).toBeNull();
  });

  it("keeps the newest success when an older overlapping request fails later", async () => {
    vi.useFakeTimers();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const olderRequest = deferred<MoniesExpensePage>();
    const newerRequest = deferred<MoniesExpensePage>();
    vi.mocked(getMoniesExpenses)
      .mockReturnValueOnce(olderRequest.promise)
      .mockReturnValueOnce(newerRequest.promise);

    render(<MoniesBentoCard tool={mockTool} data={null} />);
    await act(async () => vi.advanceTimersByTimeAsync(10_000));

    await act(async () => {
      newerRequest.resolve(makePage([makeExpense(2, { item: "Current expense" })]));
      await newerRequest.promise;
    });
    expect(screen.getByText("Current expense")).toBeTruthy();

    await act(async () => {
      olderRequest.reject(new Error("stale failure"));
      await olderRequest.promise.catch(() => undefined);
    });

    expect(screen.getByText("Current expense")).toBeTruthy();
    expect(screen.queryByText("Could not load expenses.")).toBeNull();
  });

  it("stops polling and ignores a pending request after cleanup", async () => {
    vi.useFakeTimers();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const pendingRequest = deferred<MoniesExpensePage>();
    vi.mocked(getMoniesExpenses).mockReturnValueOnce(pendingRequest.promise);
    const view = render(<MoniesBentoCard tool={mockTool} data={null} />);

    expect(getMoniesExpenses).toHaveBeenCalledTimes(1);
    view.unmount();
    await act(async () => vi.advanceTimersByTimeAsync(20_000));
    await act(async () => {
      pendingRequest.resolve(makePage([makeExpense(1)]));
      await pendingRequest.promise;
    });

    expect(getMoniesExpenses).toHaveBeenCalledTimes(1);
  });

  it("links the whole card to the Monies page", async () => {
    render(<MoniesBentoCard tool={mockTool} data={null} />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Open Monies tool" }).getAttribute("href")).toBe(
        "/monies",
      );
    });
  });
});

describe("Monies tool registration", () => {
  it("registers Monies after Calendar and before Homelab for overview and sidebar use", () => {
    const calendarIndex = tools.findIndex((tool) => tool.id === "calendar");
    const moniesIndex = tools.findIndex((tool) => tool.id === "monies");
    const homelabIndex = tools.findIndex((tool) => tool.id === "homelab");
    const monies = tools[moniesIndex];

    expect(moniesIndex).toBe(calendarIndex + 1);
    expect(homelabIndex).toBe(moniesIndex + 1);
    expect(monies).toMatchObject({
      label: "Monies",
      route: "/monies",
      icon: WalletCards,
    });
    expect(monies?.overviewOnly).not.toBe(true);
  });
});
