import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { proxyPodLogs } = await import("./logs.$namespace.$pod");

beforeEach(() => {
  vi.stubEnv("GATEWAY_URL", "http://gateway.internal:8080");
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("pod log proxy", () => {
  it("returns the upstream SSE stream without buffering and forwards safe stream headers", async () => {
    let keepOpen = true;
    const upstreamBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: line\ndata: {"line":"first"}\n\n'));
      },
      cancel() {
        keepOpen = false;
      },
    });
    vi.mocked(fetch).mockResolvedValue(
      new Response(upstreamBody, {
        headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      }),
    );
    const request = new Request(
      "https://doh.lumilumi.xyz/api/homelab/logs/monitoring/prometheus-0?container=prometheus",
    );

    const response = await proxyPodLogs(request, "monitoring", "prometheus-0");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(response.headers.get("Connection")).toBe("keep-alive");
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toBe(
      "http://gateway.internal:8080/pods/monitoring/prometheus-0/logs?container=prometheus",
    );

    const reader = response.body?.getReader();
    const firstChunk = await reader?.read();
    expect(new TextDecoder().decode(firstChunk?.value)).toContain('"line":"first"');
    expect(firstChunk?.done).toBe(false);
    await reader?.cancel();
    expect(keepOpen).toBe(false);
  });

  it("passes a downstream disconnect to the gateway fetch immediately", async () => {
    const downstream = new AbortController();
    let upstreamSignal: AbortSignal | undefined;
    vi.mocked(fetch).mockImplementation(
      (_input, options) =>
        new Promise<Response>((_resolve, reject) => {
          upstreamSignal = options?.signal ?? undefined;
          upstreamSignal?.addEventListener(
            "abort",
            () => reject(new DOMException("The operation was aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    const request = new Request(
      "https://doh.lumilumi.xyz/api/homelab/logs/default/api-0?container=api",
      { signal: downstream.signal },
    );

    const responsePromise = proxyPodLogs(request, "default", "api-0");
    downstream.abort();

    expect(upstreamSignal).toBe(request.signal);
    expect(upstreamSignal?.aborted).toBe(true);
    await expect(responsePromise).resolves.toMatchObject({ status: 499 });
  });

  it("forwards only a validated RFC3339 resume cursor to the gateway", async () => {
    const cursor = "2026-08-04T12:00:00.123456789Z";
    vi.mocked(fetch).mockResolvedValue(
      new Response('event: ready\ndata: {"status":"ready"}\n\n', {
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    const request = new Request(
      `https://doh.lumilumi.xyz/api/homelab/logs/default/api-0?container=api&since=${encodeURIComponent(cursor)}`,
    );

    const response = await proxyPodLogs(request, "default", "api-0");

    expect(response.status).toBe(200);
    const upstream = new URL(String(vi.mocked(fetch).mock.calls[0]?.[0]));
    expect(upstream.searchParams.get("container")).toBe("api");
    expect(upstream.searchParams.get("since")).toBe(cursor);
  });

  it.each(["../../secret", "2026-08-04 12:00:00Z", "2026-08-04T12:00:00"])(
    "rejects malformed resume cursor %s before gateway access",
    async (since) => {
      const request = new Request(
        `https://doh.lumilumi.xyz/api/homelab/logs/default/api-0?container=api&since=${encodeURIComponent(since)}`,
      );

      const response = await proxyPodLogs(request, "default", "api-0");

      expect(response.status).toBe(400);
      expect(await response.text()).toBe("Invalid pod log request");
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("does not expose or log gateway error bodies, pod lines, or stacks", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const secretBody = "pod-line=secret credential=private stack=/gateway/provider.ts:42";
    vi.mocked(fetch).mockResolvedValue(new Response(secretBody, { status: 502 }));
    const request = new Request(
      "https://doh.lumilumi.xyz/api/homelab/logs/default/api-0?container=api",
    );

    const response = await proxyPodLogs(request, "default", "api-0");
    const browserPayload = await response.text();

    expect(response.status).toBe(502);
    expect(browserPayload).toBe("Pod logs unavailable");
    expect(browserPayload).not.toContain(secretBody);
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
  });

  it("rejects a missing container without contacting the gateway", async () => {
    const request = new Request("https://doh.lumilumi.xyz/api/homelab/logs/default/api-0");

    const response = await proxyPodLogs(request, "default", "api-0");

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Invalid pod log request");
    expect(fetch).not.toHaveBeenCalled();
  });
});
