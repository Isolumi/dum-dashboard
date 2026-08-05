import { createFileRoute } from "@tanstack/react-router";
import { createServerOnlyFn } from "@tanstack/react-start";

import { normalizePodLogCursor } from "@shared/homelab/log-cursor";
import { requireServerEnv } from "#/lib/runtime-env";

const DNS_LABEL = /^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$/;

function isDnsLabel(value: string): boolean {
  return value.length > 0 && value.length <= 63 && DNS_LABEL.test(value);
}

function isDnsSubdomain(value: string): boolean {
  return value.length > 0 && value.length <= 253 && value.split(".").every(isDnsLabel);
}

function podLogUrl(namespace: string, pod: string, container: string, cursor?: string): URL {
  const url = new URL(requireServerEnv("GATEWAY_URL"));
  url.pathname = `${url.pathname.replace(/\/$/, "")}/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(pod)}/logs`;
  url.search = new URLSearchParams({ container, ...(cursor ? { since: cursor } : {}) }).toString();
  url.hash = "";
  return url;
}

export const proxyPodLogs = createServerOnlyFn(
  async (request: Request, namespace: string, pod: string): Promise<Response> => {
    const container = new URL(request.url).searchParams.get("container");
    const requestedCursor = new URL(request.url).searchParams.get("since");
    const cursor = requestedCursor === null ? undefined : normalizePodLogCursor(requestedCursor);
    if (!isDnsLabel(namespace) || !isDnsSubdomain(pod) || !container || !isDnsLabel(container)) {
      return new Response("Invalid pod log request", { status: 400 });
    }
    if (requestedCursor !== null && !cursor) {
      return new Response("Invalid pod log request", { status: 400 });
    }

    try {
      const response = await fetch(podLogUrl(namespace, pod, container, cursor ?? undefined), {
        headers: { Accept: "text/event-stream" },
        signal: request.signal,
      });
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        return new Response("Pod logs unavailable", { status: 502 });
      }

      return new Response(response.body, {
        status: response.status,
        headers: {
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Content-Type": "text/event-stream",
        },
      });
    } catch {
      if (request.signal.aborted) return new Response(null, { status: 499 });
      return new Response("Pod logs unavailable", { status: 502 });
    }
  },
);

export const Route = createFileRoute("/api/homelab/logs/$namespace/$pod")({
  server: {
    handlers: {
      GET: ({ request, params }) => proxyPodLogs(request, params.namespace, params.pod),
    },
  },
});
