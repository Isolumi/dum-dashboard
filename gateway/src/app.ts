import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { getGatewayConfig } from "./config";
import type { KubernetesReader, PodLogStream } from "./providers/kubernetes";
import type { Provider } from "./providers/provider";
import { collectSnapshot, type Now } from "./snapshot";

type SnapshotRoute = "overview" | "cluster" | "deployments" | "services";

export interface GatewayDependencies {
  providers?: Partial<Record<SnapshotRoute, readonly Provider<unknown>[]>>;
  kubernetesProvider?: KubernetesReader;
  timeoutMs?: number;
  now?: Now;
}

export function createGateway(dependencies: GatewayDependencies = {}): Hono {
  const app = new Hono();
  const timeoutMs = dependencies.timeoutMs ?? getGatewayConfig().providerTimeoutMs;
  const now = dependencies.now ?? (() => new Date());

  app.get("/healthz", (context) => context.json({ status: "ok" }));

  for (const route of ["overview", "cluster", "deployments", "services"] as const) {
    const providers =
      route === "cluster" && dependencies.kubernetesProvider && !dependencies.providers?.cluster
        ? [dependencies.kubernetesProvider]
        : (dependencies.providers?.[route] ?? []);
    app.get(`/${route}`, async (context) =>
      context.json(await collectSnapshot(providers, timeoutMs, now)),
    );
  }

  app.get("/pods/:namespace/:pod", async (context) => {
    if (!dependencies.kubernetesProvider) {
      return context.json({ error: "Kubernetes unavailable" }, 503);
    }

    try {
      return context.json(
        await dependencies.kubernetesProvider.getPod(
          context.req.param("namespace"),
          context.req.param("pod"),
        ),
      );
    } catch {
      return context.json({ error: "Pod unavailable" }, 502);
    }
  });

  app.get("/pods/:namespace/:pod/logs", (context) => {
    const provider = dependencies.kubernetesProvider;
    if (!provider) return context.json({ error: "Kubernetes unavailable" }, 503);

    const container = context.req.query("container");
    if (!container) return context.json({ error: "Container is required" }, 400);

    return streamSSE(context, async (stream) => {
      const controller = new AbortController();
      const abort = () => controller.abort();
      stream.onAbort(abort);
      context.req.raw.signal.addEventListener("abort", abort, { once: true });

      try {
        const logs = provider.streamPodLogs(
          context.req.param("namespace"),
          context.req.param("pod"),
          container,
          controller.signal,
        );
        const ready = (logs as Partial<PodLogStream>).ready;
        if (ready) await ready;
        await stream.writeSSE({ event: "ready", data: JSON.stringify({ status: "ready" }) });

        for await (const line of logs) {
          await stream.writeSSE({ event: "line", data: JSON.stringify({ line }) });
        }
      } catch {
        if (!controller.signal.aborted) {
          await stream.writeSSE({
            event: "error",
            data: JSON.stringify({ message: "Pod logs unavailable" }),
          });
        }
      } finally {
        context.req.raw.signal.removeEventListener("abort", abort);
        controller.abort();
      }
    });
  });

  return app;
}
