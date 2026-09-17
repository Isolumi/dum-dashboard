import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
  owner: vi.fn(),
  origin: vi.fn(),
  noStore: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validator: { parse(input: unknown): unknown } | undefined;
    const builder = {
      inputValidator(next: typeof validator) {
        validator = next;
        return builder;
      },
      handler(handler: (context: { data: unknown }) => unknown) {
        return (options?: { data: unknown }) =>
          handler({ data: validator ? validator.parse(options?.data) : options?.data });
      },
    };
    return builder;
  },
}));
vi.mock("#/lib/server-auth", () => ({
  getOwnerUser: mocks.owner,
  assertSameOrigin: mocks.origin,
  noStore: mocks.noStore,
}));
vi.mock("./buy-list.domain", () => ({
  listBuyListRecords: mocks.list,
  createBuyListRecord: mocks.create,
  renameBuyListRecord: mocks.rename,
  deleteBuyListRecord: mocks.remove,
}));
const { getBuyList, createBuyListItem, renameBuyListItem, deleteBuyListItem } =
  await import("./buy-list.functions");
const item = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Milk",
  created_at: "2026-09-17T12:00:00Z",
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.list.mockResolvedValue([item]);
  mocks.create.mockResolvedValue(item);
  mocks.rename.mockResolvedValue(item);
  mocks.remove.mockResolvedValue(item);
});
const writes = [
  {
    name: "create",
    call: () => createBuyListItem({ data: { name: " Milk " } }),
    domain: mocks.create,
    args: { name: "Milk" },
  },
  {
    name: "rename",
    call: () => renameBuyListItem({ data: { id: item.id, name: " Milk " } }),
    domain: mocks.rename,
    args: { id: item.id, name: "Milk" },
  },
  {
    name: "delete",
    call: () => deleteBuyListItem({ data: { id: item.id } }),
    domain: mocks.remove,
    args: item.id,
  },
];
describe("Buy list server boundaries", () => {
  it("owner-gates a no-store read", async () => {
    await expect(getBuyList()).resolves.toEqual([item]);
    expect(mocks.owner.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.list.mock.invocationCallOrder[0]!,
    );
    expect(mocks.noStore.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.list.mock.invocationCallOrder[0]!,
    );
  });
  it.each(writes)("validates and protects $name", async ({ call, domain, args }) => {
    await expect(call()).resolves.toEqual(item);
    expect(domain).toHaveBeenCalledWith(args);
    for (const guard of [mocks.owner, mocks.origin, mocks.noStore])
      expect(guard.mock.invocationCallOrder[0]).toBeLessThan(domain.mock.invocationCallOrder[0]!);
  });
  it.each(writes)("rejects a foreign origin before $name", async ({ call, domain }) => {
    mocks.origin.mockImplementation(() => {
      throw new Error("Cross-origin request rejected");
    });
    await expect(call()).rejects.toThrow("Cross-origin");
    expect(domain).not.toHaveBeenCalled();
  });
  it.each(writes)("rejects a missing owner before $name", async ({ call, domain }) => {
    mocks.owner.mockImplementation(() => {
      throw new Error("Owner unavailable");
    });
    await expect(call()).rejects.toThrow("Owner unavailable");
    expect(domain).not.toHaveBeenCalled();
  });
  it("rejects a missing owner on read", async () => {
    mocks.owner.mockImplementation(() => {
      throw new Error("Owner unavailable");
    });
    await expect(getBuyList()).rejects.toThrow();
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("rejects invalid inputs before writes", async () => {
    await expect(
      Promise.resolve().then(() => deleteBuyListItem({ data: { id: "bad" } })),
    ).rejects.toThrow();
    await expect(
      Promise.resolve().then(() => createBuyListItem({ data: { name: " " } })),
    ).rejects.toThrow();
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
