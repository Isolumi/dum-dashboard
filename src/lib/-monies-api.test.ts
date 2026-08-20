import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  MoniesApiError,
  createMoniesExpenseRequest,
  deleteMoniesExpenseRequest,
  listMoniesExpenses,
  getMoniesSummary,
  listMoniesUsers,
  restoreMoniesExpenseRequest,
  updateMoniesExpenseRequest,
} = await import("./monies-api");

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
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Monies private API client", () => {
  it("adds server authorization and disables caching for reads", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([payer, debtor]));

    await expect(listMoniesUsers()).resolves.toEqual([payer, debtor]);

    const [url, options] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toBe("http://localhost:3333/api/users");
    expect(options).toMatchObject({ method: "GET", cache: "no-store" });
    const headers = new Headers(options?.headers);
    expect(headers.get("Authorization")).toBe("Bearer test-token");
    expect(headers.get("Cache-Control")).toBe("no-store");
    expect(headers.get("Accept")).toBe("application/json");
  });

  it("aborts a private request after five seconds", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    vi.mocked(fetch).mockImplementation((_input, options) => {
      requestSignal = options?.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener(
          "abort",
          () => reject(new DOMException("The operation was aborted", "AbortError")),
          { once: true },
        );
      });
    });

    const request = listMoniesUsers();
    const rejection = expect(request).rejects.toBeInstanceOf(MoniesApiError);

    await vi.advanceTimersByTimeAsync(4_999);
    expect(requestSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(requestSignal?.aborted).toBe(true);
    await rejection;
  });

  it("converts non-success responses to an error without private response text", async () => {
    const privateText = "database password and bearer test-token";
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: privateText }, 500));

    const error = await listMoniesUsers().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(MoniesApiError);
    expect(error).toMatchObject({ name: "MoniesApiError", message: "Monies service unavailable" });
    expect((error as Error).stack).toBeUndefined();
    expect(JSON.stringify(error)).not.toContain(privateText);
    expect(JSON.stringify(error)).not.toContain("test-token");
  });

  it("rejects an expense page with private or unsupported response fields", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        ...expensePage,
        items: [{ ...expense, idempotencyKey: "dashboard:private-key" }],
      }),
    );

    await expect(
      listMoniesExpenses({ page: 1, pageSize: 50, deleted: false }),
    ).rejects.toMatchObject({
      name: "MoniesApiError",
      message: "Monies service unavailable",
    });
  });

  it("rejects numeric money in a private response before it reaches a caller", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ ...expensePage, items: [{ ...expense, amount: 42.5 }] }),
    );

    await expect(
      listMoniesExpenses({ page: 1, pageSize: 50, deleted: false }),
    ).rejects.toBeInstanceOf(MoniesApiError);
  });

  it.each([
    ["an empty note", { item: "" }],
    ["a note over 200 characters", { item: "x".repeat(201) }],
    ["zero stored money", { amount: "0.00", owedAmount: "0.00" }],
    ["negative stored money", { amount: "-42.50", owedAmount: "-20.00" }],
  ])("accepts a legacy expense response with %s", async (_name, overrides) => {
    const legacyExpense = { ...expense, ...overrides };
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ...expensePage, items: [legacyExpense] }));

    await expect(listMoniesExpenses({ page: 1, pageSize: 50, deleted: false })).resolves.toEqual({
      ...expensePage,
      items: [legacyExpense],
    });
  });

  it("gets the strict private owed summary without caching", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(summary));

    await expect(getMoniesSummary()).resolves.toEqual(summary);

    const [url, options] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toBe("http://localhost:3333/api/summary");
    expect(options).toMatchObject({ method: "GET", cache: "no-store" });
    expect(new Headers(options?.headers).get("Cache-Control")).toBe("no-store");
  });

  it("accepts an aggregate summary above the per-entry money limit", async () => {
    const aggregateSummary = { ...summary, amount: "19999999999.98" };
    vi.mocked(fetch).mockResolvedValue(jsonResponse(aggregateSummary));

    await expect(getMoniesSummary()).resolves.toEqual(aggregateSummary);
  });

  it.each([
    { amount: "0.00", debtor, creditor: payer },
    { amount: "20.00", debtor: null, creditor: payer },
    { amount: "20.00", debtor, creditor: null },
    { amount: 20, debtor, creditor: payer },
  ])("rejects an invalid summary response", async (body) => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(body));

    await expect(getMoniesSummary()).rejects.toBeInstanceOf(MoniesApiError);
  });

  it("uses the exact private HTTP methods, paths, and JSON bodies for mutations", async () => {
    vi.mocked(fetch).mockImplementation(async () => jsonResponse(expense));

    await createMoniesExpenseRequest(createInput);
    await updateMoniesExpenseRequest(EXPENSE_ID, { item: "Updated dinner" });
    await deleteMoniesExpenseRequest(EXPENSE_ID);
    await restoreMoniesExpenseRequest(EXPENSE_ID);

    const requests = vi.mocked(fetch).mock.calls.map(([url, options]) => ({
      url: String(url),
      method: options?.method,
      body: options?.body,
      authorization: new Headers(options?.headers).get("Authorization"),
    }));
    expect(requests).toEqual([
      {
        url: "http://localhost:3333/api/expenses",
        method: "POST",
        body: JSON.stringify(createInput),
        authorization: "Bearer test-token",
      },
      {
        url: `http://localhost:3333/api/expenses/${EXPENSE_ID}`,
        method: "PATCH",
        body: JSON.stringify({ item: "Updated dinner" }),
        authorization: "Bearer test-token",
      },
      {
        url: `http://localhost:3333/api/expenses/${EXPENSE_ID}`,
        method: "DELETE",
        body: undefined,
        authorization: "Bearer test-token",
      },
      {
        url: `http://localhost:3333/api/expenses/${EXPENSE_ID}/restore`,
        method: "POST",
        body: undefined,
        authorization: "Bearer test-token",
      },
    ]);
  });

  it.each([
    "http://user:password@localhost:3333",
    "http://localhost:3333?token=private",
    "http://localhost:3333?",
    "http://localhost:3333#private",
    "http://localhost:3333#",
    "http://localhost:3333/base-path",
    "http://localhost:3333/.",
    "http://localhost:3333/allowed/..",
    "http://localhost",
    "http://remote.example:3333",
    "https://localhost:3333",
    "http://monies.monies.svc.cluster.local:3333",
  ])("rejects an unsafe non-production base URL: %s", async (baseUrl) => {
    vi.stubEnv("MONIES_API_URL", baseUrl);

    await expect(listMoniesUsers()).rejects.toBeInstanceOf(MoniesApiError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["http://localhost:3333", "http://127.0.0.1:3333", "http://localhost:80"])(
    "allows an explicit local HTTP origin outside production: %s",
    async (baseUrl) => {
      vi.stubEnv("MONIES_API_URL", baseUrl);
      vi.mocked(fetch).mockResolvedValue(jsonResponse([payer, debtor]));

      await expect(listMoniesUsers()).resolves.toEqual([payer, debtor]);
    },
  );

  it("requires the exact cluster service origin in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MONIES_API_URL", "http://localhost:3333");

    await expect(listMoniesUsers()).rejects.toBeInstanceOf(MoniesApiError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("allows the exact cluster service origin in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MONIES_API_URL", "http://monies.monies.svc.cluster.local:3333");
    vi.mocked(fetch).mockResolvedValue(jsonResponse([payer, debtor]));

    await expect(listMoniesUsers()).resolves.toEqual([payer, debtor]);
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toBe(
      "http://monies.monies.svc.cluster.local:3333/api/users",
    );
  });
});
