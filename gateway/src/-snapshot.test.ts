import { describe, expect, it } from "vitest";
import type { Provider } from "./providers/provider";
import { collectProviders } from "./snapshot";

const now = () => new Date("2026-08-04T00:00:00.000Z");

describe("collectProviders", () => {
  it("returns successful provider data when another provider fails", async () => {
    const providers: Provider<{ value: string }>[] = [
      {
        source: "kubernetes",
        collect: async () => ({ value: "cluster data" }),
      },
      {
        source: "github",
        collect: async () => {
          throw new Error("token=secret GitHub API unavailable");
        },
      },
    ];

    const results = await collectProviders(providers, 1_000, now);

    expect(results).toMatchObject([
      {
        source: "kubernetes",
        ok: true,
        data: { value: "cluster data" },
        state: {
          source: "kubernetes",
          status: "healthy",
          observedAt: "2026-08-04T00:00:00.000Z",
          stale: false,
        },
      },
      {
        source: "github",
        ok: false,
        error: "GitHub unavailable",
        state: {
          source: "github",
          status: "unknown",
          observedAt: "2026-08-04T00:00:00.000Z",
          stale: true,
          error: "GitHub unavailable",
        },
      },
    ]);
  });

  it("times out one provider without cancelling another provider", async () => {
    let timedOutSignal: AbortSignal | undefined;
    const providers: Provider<{ value: string }>[] = [
      {
        source: "prometheus",
        collect: async () => ({ value: "metrics" }),
      },
      {
        source: "github",
        collect: (signal) =>
          new Promise((_, reject) => {
            timedOutSignal = signal;
            signal.addEventListener("abort", () => reject(signal.reason), { once: true });
          }),
      },
    ];

    const results = await collectProviders(providers, 5, now);

    expect(timedOutSignal?.aborted).toBe(true);
    expect(results).toMatchObject([
      { source: "prometheus", ok: true, data: { value: "metrics" } },
      { source: "github", ok: false, error: "GitHub unavailable" },
    ]);
  });
});
