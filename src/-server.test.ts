import { describe, expect, it, vi } from "vitest";

import { handleRequest } from "./server";

describe("server health endpoint", () => {
  it("returns health directly without calling the TanStack handler", async () => {
    const next = vi.fn(async () => new Response("dashboard"));

    const response = await handleRequest(new Request("https://doh.lumilumi.xyz/healthz"), next);

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    await expect(response.text()).resolves.toBe("ok");
  });

  it("forwards every other path to TanStack", async () => {
    const dashboardResponse = new Response("dashboard");
    const next = vi.fn(async () => dashboardResponse);
    const request = new Request("https://doh.lumilumi.xyz/");

    const response = await handleRequest(request, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(request);
    expect(response).toBe(dashboardResponse);
  });
});
