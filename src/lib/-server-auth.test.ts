import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#/lib/supabase-admin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

const { getSupabaseAdmin } = await import("#/lib/supabase-admin");
const { requireOwnerUser } = await import("./server-auth");

function mockGetUser(result: unknown) {
  vi.mocked(getSupabaseAdmin).mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue(result),
    },
  } as never);
}

describe("requireOwnerUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_OWNER_ID", "owner-user-id");
  });

  it("returns the owner user for a valid owner access token", async () => {
    mockGetUser({ data: { user: { id: "owner-user-id" } }, error: null });

    await expect(requireOwnerUser("access-token")).resolves.toEqual({ id: "owner-user-id" });
  });

  it("rejects missing or invalid access tokens", async () => {
    mockGetUser({ data: { user: null }, error: new Error("invalid") });

    await expect(requireOwnerUser("bad-token")).rejects.toThrow("Unauthorized");
  });

  it("rejects authenticated non-owner users", async () => {
    mockGetUser({ data: { user: { id: "someone-else" } }, error: null });

    await expect(requireOwnerUser("other-token")).rejects.toThrow("Forbidden");
  });
});
