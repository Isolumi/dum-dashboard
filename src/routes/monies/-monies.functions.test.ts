import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerOnlyFn: vi.fn((fn: (...args: never[]) => unknown) => fn),
  createServerFn: vi.fn(() => {
    let validator: { parse: (input: unknown) => unknown } | undefined;
    const builder = {
      inputValidator(nextValidator: { parse: (input: unknown) => unknown }) {
        validator = nextValidator;
        return builder;
      },
      handler(handler: (context: { data: unknown }) => unknown) {
        return (options?: { data?: unknown }) =>
          handler({ data: validator ? validator.parse(options?.data) : options?.data });
      },
    };
    return builder;
  }),
}));

vi.mock("#/lib/server-auth", () => ({
  assertSameOrigin: vi.fn(),
  getOwnerUser: vi.fn(() => ({ id: "owner-user-id" })),
  noStore: vi.fn(),
}));

const {
  CreateMoniesExpenseInputSchema,
  createMoniesExpense,
  deleteMoniesExpense,
  getDeletedMoniesExpenses,
  getMoniesExpenses,
  getMoniesSummary,
  getMoniesUsers,
  restoreMoniesExpense,
  updateMoniesExpense,
} = await import("./monies.functions");
const { assertSameOrigin, getOwnerUser, noStore } = await import("#/lib/server-auth");

const PAYER_ID = "550e8400-e29b-41d4-a716-446655440000";
const DEBTOR_ID = "11111111-1111-4111-8111-111111111111";
const EXPENSE_ID = "22222222-2222-4222-8222-222222222222";

const payer = { id: PAYER_ID, name: "Lumi" };
const debtor = { id: DEBTOR_ID, name: "Dum" };
const expense = {
  id: EXPENSE_ID,
  item: "Dinner",
  amount: "42.50",
  owedAmount: "20.00",
  payer,
  debtor,
  purchaseDate: "2026-08-15T20:00:00.000-04:00",
  createdAt: "2026-08-16T00:01:00.000Z",
  updatedAt: "2026-08-16T00:01:00.000Z",
  deletedAt: null,
};
const expensePage = { items: [expense], page: 1, pageSize: 50, total: 1 };
const summary = { amount: "20.00", debtor, creditor: payer };
const createInput = {
  item: "Dinner",
  owedAmount: "20.00",
  payerId: PAYER_ID,
  purchaseDate: "2026-08-15T20:00:00.000-04:00",
  idempotencyKey: "dashboard:request-1",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("MONIES_API_URL", "http://localhost:3333");
  vi.stubEnv("MONIES_API_TOKEN", "test-token");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/users") return jsonResponse([payer, debtor]);
      if (url.pathname === "/api/summary") return jsonResponse(summary);
      if (url.pathname === "/api/expenses" && url.searchParams.has("page")) {
        return jsonResponse(expensePage);
      }
      if (url.pathname === "/api/expenses/deleted") return jsonResponse(expensePage);
      return jsonResponse(expense);
    }),
  );
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Monies read server functions", () => {
  it("owner-gates users and disables response caching before private access", async () => {
    await expect(getMoniesUsers()).resolves.toEqual([payer, debtor]);

    expect(noStore).toHaveBeenCalledOnce();
    expect(getOwnerUser).toHaveBeenCalledOnce();
    expect(vi.mocked(noStore).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(fetch).mock.invocationCallOrder[0]!,
    );
    expect(vi.mocked(getOwnerUser).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(fetch).mock.invocationCallOrder[0]!,
    );
  });

  it("uses uncached GET requests with validated active and deleted pagination", async () => {
    await expect(getMoniesExpenses({ data: { page: 2, pageSize: 25 } })).resolves.toEqual(
      expensePage,
    );
    await expect(getDeletedMoniesExpenses({ data: { page: 3, pageSize: 10 } })).resolves.toEqual(
      expensePage,
    );

    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual([
      "http://localhost:3333/api/expenses?page=2&pageSize=25",
      "http://localhost:3333/api/expenses/deleted?page=3&pageSize=10",
    ]);
    for (const [, options] of vi.mocked(fetch).mock.calls) {
      expect(options).toMatchObject({ method: "GET", cache: "no-store" });
      expect(new Headers(options?.headers).get("Cache-Control")).toBe("no-store");
    }
    expect(noStore).toHaveBeenCalledTimes(2);
    expect(getOwnerUser).toHaveBeenCalledTimes(2);
  });

  it("owner-gates the no-store summary before private access", async () => {
    await expect(getMoniesSummary()).resolves.toEqual(summary);

    expect(noStore).toHaveBeenCalledOnce();
    expect(getOwnerUser).toHaveBeenCalledOnce();
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toBe("http://localhost:3333/api/summary");
    expect(vi.mocked(fetch).mock.calls[0]?.[1]).toMatchObject({ method: "GET", cache: "no-store" });
  });

  it("rejects unsupported list input before private access", async () => {
    await expect(
      Promise.resolve().then(() =>
        getMoniesExpenses({
          data: { page: 1, pageSize: 50, serviceToken: "browser-secret" },
        } as never),
      ),
    ).rejects.toThrow();

    expect(getOwnerUser).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("Monies mutation server functions", () => {
  it("returns a failed Zod result for malformed owed decimal text", () => {
    const parse = () =>
      CreateMoniesExpenseInputSchema.safeParse({ ...createInput, owedAmount: "invalid" });

    expect(parse).not.toThrow();
    expect(parse().success).toBe(false);
  });

  it.each([
    [
      "create",
      () => createMoniesExpense({ data: createInput }),
      "POST",
      "/api/expenses",
      JSON.stringify(createInput),
    ],
    [
      "update",
      () => updateMoniesExpense({ data: { id: EXPENSE_ID, item: "Updated dinner" } }),
      "PATCH",
      `/api/expenses/${EXPENSE_ID}`,
      JSON.stringify({ item: "Updated dinner" }),
    ],
    [
      "delete",
      () => deleteMoniesExpense({ data: { id: EXPENSE_ID } }),
      "DELETE",
      `/api/expenses/${EXPENSE_ID}`,
      undefined,
    ],
    [
      "restore",
      () => restoreMoniesExpense({ data: { id: EXPENSE_ID } }),
      "POST",
      `/api/expenses/${EXPENSE_ID}/restore`,
      undefined,
    ],
  ])("owner-gates and checks same origin before %s", async (_name, call, method, path, body) => {
    await expect(call()).resolves.toEqual(expense);

    expect(getOwnerUser).toHaveBeenCalledOnce();
    expect(assertSameOrigin).toHaveBeenCalledOnce();
    const fetchOrder = vi.mocked(fetch).mock.invocationCallOrder[0]!;
    expect(vi.mocked(getOwnerUser).mock.invocationCallOrder[0]).toBeLessThan(fetchOrder);
    expect(vi.mocked(assertSameOrigin).mock.invocationCallOrder[0]).toBeLessThan(fetchOrder);
    const [url, options] = vi.mocked(fetch).mock.calls[0]!;
    expect(new URL(String(url)).pathname).toBe(path);
    expect(options?.method).toBe(method);
    expect(options?.body).toBe(body);
  });

  it("does not contact the private API when owner gating fails", async () => {
    vi.mocked(getOwnerUser).mockImplementationOnce(() => {
      throw new Error("Owner unavailable");
    });

    await expect(createMoniesExpense({ data: createInput })).rejects.toThrow("Owner unavailable");
    expect(assertSameOrigin).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not contact the private API when same-origin validation fails", async () => {
    vi.mocked(assertSameOrigin).mockImplementationOnce(() => {
      throw new Error("Cross-origin request rejected");
    });

    await expect(createMoniesExpense({ data: createInput })).rejects.toThrow(
      "Cross-origin request rejected",
    );
    expect(getOwnerUser).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["legacy amount field", { ...createInput, amount: "42.50" }],
    ["numeric owed amount", { ...createInput, owedAmount: 42.5 }],
    ["zero owed amount", { ...createInput, owedAmount: "0.00" }],
    ["timestamp without offset", { ...createInput, purchaseDate: "2026-08-16T00:00:00.000Z" }],
    ["unsupported browser field", { ...createInput, moniesApiToken: "browser-secret" }],
  ])("rejects invalid create input with %s before private access", async (_name, data) => {
    await expect(
      Promise.resolve().then(() => createMoniesExpense({ data } as never)),
    ).rejects.toThrow();

    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects the legacy amount field even with another valid update field", async () => {
    await expect(
      Promise.resolve().then(() =>
        updateMoniesExpense({
          data: { id: EXPENSE_ID, item: "Updated dinner", amount: "50.00" },
        } as never),
      ),
    ).rejects.toThrow();

    expect(getOwnerUser).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
