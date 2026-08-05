import { Hono, type Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { ResourceWindow } from "../../shared/homelab/contracts";
import { normalizePodLogCursor, podLogCursorFromLine } from "../../shared/homelab/log-cursor";
import { getGatewayConfig } from "./config";
import type { KubernetesReader, PodLogStream } from "./providers/kubernetes";
import { isWindowedProvider, type Provider } from "./providers/provider";
import {
  CertificateActivityTracker,
  collectClusterSnapshot,
  collectDeploymentSnapshot,
  collectOverviewSnapshot,
  collectServiceSnapshot,
  type Now,
} from "./snapshot";

type SnapshotRoute = "cluster" | "deployments" | "services";

const DNS_LABEL = /^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$/;
const RESOURCE_WINDOWS = new Set<ResourceWindow>(["1h", "6h", "24h", "7d"]);

function isDnsLabel(value: string): boolean {
  return value.length > 0 && value.length <= 63 && DNS_LABEL.test(value);
}

function isDnsSubdomain(value: string): boolean {
  return value.length > 0 && value.length <= 253 && value.split(".").every(isDnsLabel);
}

function isResourceWindow(value: string): value is ResourceWindow {
  return RESOURCE_WINDOWS.has(value as ResourceWindow);
}

function clusterProvidersForWindow(
  providers: readonly Provider<unknown>[],
  window: ResourceWindow,
): readonly Provider<unknown>[] {
  return providers.map((provider) =>
    isWindowedProvider(provider)
      ? {
          source: provider.source,
          collect: (signal: AbortSignal) => provider.collectForWindow(window, signal),
        }
      : provider,
  );
}

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
  const certificateActivityTracker = new CertificateActivityTracker();

  app.get("/healthz", (context) => context.json({ status: "ok" }));

  const clusterProviders =
    dependencies.kubernetesProvider && !dependencies.providers?.cluster
      ? [dependencies.kubernetesProvider]
      : (dependencies.providers?.cluster ?? []);
  const deploymentProviders = dependencies.providers?.deployments ?? [];
  const serviceProviders = dependencies.providers?.services ?? [];

  app.get("/overview", async (context) =>
    context.json(
      await collectOverviewSnapshot(
        {
          cluster: clusterProviders,
          deployments: deploymentProviders,
          services: serviceProviders,
        },
        timeoutMs,
        now,
        certificateActivityTracker,
      ),
    ),
  );
  app.get("/cluster", async (context) => {
    const requestedWindow = context.req.query("window");
    if (requestedWindow !== undefined && !isResourceWindow(requestedWindow)) {
      return context.json({ error: "Invalid history window" }, 400);
    }
    const window = requestedWindow ?? "24h";
    return context.json(
      await collectClusterSnapshot(
        clusterProvidersForWindow(clusterProviders, window),
        timeoutMs,
        now,
      ),
    );
  });
  app.get("/deployments", async (context) =>
    context.json(await collectDeploymentSnapshot(deploymentProviders, timeoutMs, now)),
  );
  app.get("/services", async (context) =>
    context.json(await collectServiceSnapshot(serviceProviders, timeoutMs, now)),
  );

  app.get("/pods/:namespace/:pod", async (context) => {
    if (!dependencies.kubernetesProvider) {
      return context.json({ error: "Kubernetes unavailable" }, 503);
    }

    const namespace = context.req.param("namespace");
    const pod = context.req.param("pod");
    if (!isDnsLabel(namespace) || !isDnsSubdomain(pod)) {
      return context.json({ error: "Invalid Kubernetes resource name" }, 400);
    }

    try {
      return context.json(await dependencies.kubernetesProvider.getPod(namespace, pod));
    } catch {
      return context.json({ error: "Pod unavailable" }, 502);
    }
  });

  app.get("/pods/:namespace/:pod/logs", (context) => {
    const provider = dependencies.kubernetesProvider;
    if (!provider) return context.json({ error: "Kubernetes unavailable" }, 503);

    const namespace = context.req.param("namespace");
    const pod = context.req.param("pod");
    const container = context.req.query("container");
    const requestedCursor = context.req.query("since");
    const cursor =
      requestedCursor === undefined ? undefined : normalizePodLogCursor(requestedCursor);
    if (!isDnsLabel(namespace) || !isDnsSubdomain(pod) || !container || !isDnsLabel(container)) {
      return context.json({ error: "Invalid Kubernetes resource name" }, 400);
    }
    if (requestedCursor !== undefined && !cursor) {
      return context.json({ error: "Invalid pod log cursor" }, 400);
    }

    return streamSSE(context, async (stream) => {
      const controller = new AbortController();
      const abort = () => controller.abort();
      stream.onAbort(abort);
      context.req.raw.signal.addEventListener("abort", abort, { once: true });

      try {
        const logs = provider.streamPodLogs(
          namespace,
          pod,
          container,
          controller.signal,
          cursor ?? undefined,
        );
        const ready = (logs as Partial<PodLogStream>).ready;
        if (ready) await ready;
        await stream.writeSSE({ event: "ready", data: JSON.stringify({ status: "ready" }) });

        for await (const line of logs) {
          const lineCursor = podLogCursorFromLine(line);
          await stream.writeSSE({
            event: "line",
            data: JSON.stringify({ line, ...(lineCursor ? { cursor: lineCursor } : {}) }),
          });
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

  const invalidPodRoute = (context: Context) =>
    context.json({ error: "Invalid Kubernetes resource name" }, 400);
  app.all("/pods", invalidPodRoute);
  app.all("/pods/*", invalidPodRoute);

  return app;
}
