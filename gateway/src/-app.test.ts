import { describe, expect, it } from "vitest";
import { createGateway } from "./app";

describe("gateway routes", () => {
  it("reports process health without contacting providers", async () => {
    let calls = 0;
    const app = createGateway({
      providers: {
        overview: [
          {
            source: "kubernetes",
            collect: async () => {
              calls += 1;
              return { ignored: true };
            },
          },
        ],
      },
    });

    const response = await app.request("/healthz");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
    expect(calls).toBe(0);
  });

  it("returns a partial snapshot from the overview aggregator", async () => {
    const app = createGateway({
      now: () => new Date("2026-08-04T00:00:00.000Z"),
      providers: {
        overview: [
          { source: "kubernetes", collect: async () => ({ value: "cluster" }) },
          {
            source: "github",
            collect: async () => {
              throw new Error("credential=private");
            },
          },
        ],
      },
    });

    const response = await app.request("/overview");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [{ value: "cluster" }],
      status: "unknown",
      stale: true,
      issues: [],
      sources: [
        { source: "kubernetes", status: "healthy", stale: false },
        {
          source: "github",
          status: "unknown",
          stale: true,
          error: "GitHub unavailable",
        },
      ],
    });
  });

  it.each(["/cluster", "/deployments", "/services"])(
    "returns an empty unknown snapshot before providers are configured for %s",
    async (path) => {
      const response = await createGateway().request(path);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        data: null,
        status: "unknown",
        stale: true,
        issues: [],
        sources: [],
      });
    },
  );
});
