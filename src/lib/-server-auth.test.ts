import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: vi.fn(),
  setResponseHeader: vi.fn(),
}));

const { getRequestHeader } = await import("@tanstack/react-start/server");
const { assertSameOrigin, getOwnerUser } = await import("./server-auth");

function mockHeaders(headers: Record<string, string | undefined>) {
  vi.mocked(getRequestHeader).mockImplementation((name: string) => headers[name]);
}

describe("single-owner server boundary", () => {
  beforeEach(() => {
    vi.stubEnv("OWNER_USER_ID", "owner-user-id");
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the configured owner without a browser token", () => {
    expect(getOwnerUser()).toEqual({ id: "owner-user-id" });
  });

  it("rejects a mutation from another origin", () => {
    mockHeaders({ origin: "https://evil.example", host: "doh.lumilumi.xyz" });

    expect(() => assertSameOrigin()).toThrow("Cross-origin request rejected");
  });

  it("accepts a mutation from the dashboard origin", () => {
    mockHeaders({
      origin: "https://doh.lumilumi.xyz",
      host: "doh.lumilumi.xyz",
    });

    expect(() => assertSameOrigin()).not.toThrow();
  });
});
