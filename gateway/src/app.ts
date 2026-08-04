import { Hono } from "hono";
import { getGatewayConfig } from "./config";
import type { Provider } from "./providers/provider";
import { collectSnapshot, type Now } from "./snapshot";

type SnapshotRoute = "overview" | "cluster" | "deployments" | "services";

export interface GatewayDependencies {
  providers?: Partial<Record<SnapshotRoute, readonly Provider<unknown>[]>>;
  timeoutMs?: number;
  now?: Now;
}

export function createGateway(dependencies: GatewayDependencies = {}): Hono {
  const app = new Hono();
  const timeoutMs = dependencies.timeoutMs ?? getGatewayConfig().providerTimeoutMs;
  const now = dependencies.now ?? (() => new Date());

  app.get("/healthz", (context) => context.json({ status: "ok" }));

  for (const route of ["overview", "cluster", "deployments", "services"] as const) {
    app.get(`/${route}`, async (context) =>
      context.json(await collectSnapshot(dependencies.providers?.[route] ?? [], timeoutMs, now)),
    );
  }

  return app;
}
