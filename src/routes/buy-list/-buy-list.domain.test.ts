import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  order: vi.fn(),
  range: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));
const query = {
  select: (...args: unknown[]) => {
    mocks.select(...args);
    return query;
  },
  order: (...args: unknown[]) => {
    mocks.order(...args);
    return query;
  },
  range: (...args: unknown[]) => mocks.range(...args),
  insert: (...args: unknown[]) => {
    mocks.insert(...args);
    return query;
  },
  update: (...args: unknown[]) => {
    mocks.update(...args);
    return query;
  },
  delete: () => {
    mocks.delete();
    return query;
  },
  eq: (...args: unknown[]) => {
    mocks.eq(...args);
    return query;
  },
  maybeSingle: () => mocks.maybeSingle(),
};
vi.mock("#/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({ from: mocks.from }) }));
const { listBuyListRecords, createBuyListRecord, renameBuyListRecord, deleteBuyListRecord } =
  await import("./buy-list.domain");
const item = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Milk",
  created_at: "2026-09-17T12:00:00Z",
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.from.mockReturnValue(query);
  mocks.range.mockResolvedValue({ data: [item], error: null });
  mocks.maybeSingle.mockResolvedValue({ data: item, error: null });
});
describe("Buy list domain", () => {
  it("reads canonical columns in stable newest-first order", async () => {
    await expect(listBuyListRecords()).resolves.toEqual([item]);
    expect(mocks.from).toHaveBeenCalledWith("buy_list_items");
    expect(mocks.select).toHaveBeenCalledWith("id,name,created_at");
    expect(mocks.order.mock.calls).toEqual([
      ["created_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
  });
  it("reads all pages instead of truncating the list", async () => {
    const page = Array.from({ length: 1000 }, (_, i) => ({ ...item, id: String(i) }));
    mocks.range
      .mockResolvedValueOnce({ data: page, error: null })
      .mockResolvedValueOnce({ data: [item], error: null });
    expect(await listBuyListRecords()).toHaveLength(1001);
    expect(mocks.range.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });
  it("creates a trimmed name and returns the canonical row", async () => {
    await expect(createBuyListRecord({ name: " Milk " })).resolves.toEqual(item);
    expect(mocks.insert).toHaveBeenCalledWith({ name: "Milk" });
  });
  it("renames only the name, preserving creation time", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { ...item, name: "Bread" }, error: null });
    await expect(renameBuyListRecord({ id: item.id, name: " Bread " })).resolves.toEqual({
      ...item,
      name: "Bread",
    });
    expect(mocks.update).toHaveBeenCalledWith({ name: "Bread" });
    expect(mocks.eq).toHaveBeenCalledWith("id", item.id);
  });
  it("selects and returns the deleted record", async () => {
    await expect(deleteBuyListRecord(item.id)).resolves.toEqual(item);
    expect(mocks.delete).toHaveBeenCalledOnce();
    expect(mocks.eq).toHaveBeenCalledWith("id", item.id);
    expect(mocks.select).toHaveBeenCalledWith("id,name,created_at");
  });
  it.each(["rename", "delete"])("reports a safe missing record on %s", async (action) => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    const operation =
      action === "rename"
        ? renameBuyListRecord({ id: item.id, name: "Bread" })
        : deleteBuyListRecord(item.id);
    await expect(operation).rejects.toMatchObject({
      code: "not_found",
      message: "Buy list item not found",
    });
  });
  it.each(["list", "create", "rename", "delete"])(
    "hides database details on %s",
    async (action) => {
      const result = { data: null, error: { message: "secret database detail" } };
      mocks.range.mockResolvedValue(result);
      mocks.maybeSingle.mockResolvedValue(result);
      const operations = {
        list: () => listBuyListRecords(),
        create: () => createBuyListRecord({ name: "Milk" }),
        rename: () => renameBuyListRecord({ id: item.id, name: "Milk" }),
        delete: () => deleteBuyListRecord(item.id),
      };
      await expect(operations[action as keyof typeof operations]()).rejects.toMatchObject({
        code: "database_unavailable",
        message: "Buy list service unavailable",
      });
    },
  );
  it("hides thrown transport errors", async () => {
    mocks.range.mockRejectedValue(new Error("secret transport detail"));
    await expect(listBuyListRecords()).rejects.toThrow("Buy list service unavailable");
  });
});
