/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: vi.fn(() => (route: unknown) => route),
}));

vi.mock("./-useMoniesController", () => ({
  useMoniesController: vi.fn(() => ({
    create: vi.fn(),
    expenses: [],
    loadError: null,
    mutationError: null,
    nextPage: vi.fn(),
    page: 1,
    pendingIds: new Set(),
    previousPage: vi.fn(),
    remove: vi.fn(),
    restore: vi.fn(),
    retry: vi.fn(),
    setView: vi.fn(),
    status: "ready",
    summary: {
      amount: "20.00",
      creditor: { id: "11111111-1111-4111-8111-111111111111", name: "Lumi" },
      debtor: { id: "22222222-2222-4222-8222-222222222222", name: "Dum" },
    },
    totalPages: 1,
    update: vi.fn(),
    users: [],
    view: "active",
  })),
}));

vi.mock("./-ExpenseFormDialog", () => ({ ExpenseFormDialog: () => null }));
vi.mock("./-ExpenseList", () => ({ ExpenseList: () => <div /> }));

const { MoniesPage } = await import("./index");

afterEach(cleanup);

describe("MoniesPage", () => {
  it("shows the owed-only description, compact summary, and add-entry action", () => {
    render(<MoniesPage />);

    expect(screen.getByText("Private two-person owed-amount tracker.")).toBeTruthy();
    expect(screen.getByText("Dum owes Lumi")).toBeTruthy();
    expect(screen.getByText("$20.00")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add entry" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add expense" })).toBeNull();
  });
});
