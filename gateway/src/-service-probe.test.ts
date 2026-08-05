import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

const { connect } = vi.hoisted(() => ({ connect: vi.fn() }));

vi.mock("node:tls", () => ({ connect }));

import { probeService, type ServiceCatalogEntry } from "./service-probe";

const now = new Date("2026-08-04T00:00:00.000Z");

function service(id: string): ServiceCatalogEntry {
  return {
    id,
    name: "yootoob-mp3",
    description: "Private YouTube MP3 downloader",
    url: "https://yootoob.doh.lumilumi.xyz",
    namespace: "yootoob-mp3",
    argoApplication: "yootoob-mp3-dumachine",
    workloads: [
      { kind: "Deployment", name: "yootoob-mp3-api" },
      { kind: "Deployment", name: "yootoob-mp3-frontend" },
    ],
  };
}

function certificateSocket(validTo: string) {
  const socket = Object.assign(new EventEmitter(), {
    destroy: vi.fn(),
    getPeerCertificate: () => ({ valid_to: validTo }),
  });
  queueMicrotask(() => socket.emit("secureConnect"));
  return socket;
}

function completeTlsHandshake(validTo = "Sep 01 2026 00:00:00 GMT") {
  connect.mockImplementation(() => certificateSocket(validTo));
}

function rejectsWhenAborted() {
  return vi.fn(
    (_url: URL, options: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        if (options.signal?.aborted) {
          reject(options.signal.reason);
          return;
        }
        options.signal?.addEventListener("abort", () => reject(options.signal?.reason), {
          once: true,
        });
      }),
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  connect.mockReset();
});

describe("probeService", () => {
  it("records the successful HTTPS response latency and peer certificate expiry", async () => {
    completeTlsHandshake();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    vi.spyOn(performance, "now").mockReturnValueOnce(100).mockReturnValueOnce(143);

    await expect(
      probeService(service("latency"), new AbortController().signal),
    ).resolves.toMatchObject({
      id: "latency",
      reachable: true,
      status: "healthy",
      latencyMs: 43,
      certificateExpiresAt: "2026-09-01T00:00:00.000Z",
    });
    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "yootoob.doh.lumilumi.xyz",
        port: 443,
        rejectUnauthorized: true,
        servername: "yootoob.doh.lumilumi.xyz",
      }),
    );
  });

  it("reports one failed probe as warning and two consecutive failures as critical", async () => {
    completeTlsHandshake();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));
    const entry = service("consecutive-failures");

    await expect(probeService(entry, new AbortController().signal)).resolves.toMatchObject({
      reachable: false,
      status: "warning",
      consecutiveFailures: 1,
    });
    await expect(probeService(entry, new AbortController().signal)).resolves.toMatchObject({
      reachable: false,
      status: "critical",
      consecutiveFailures: 2,
    });
  });

  it("rejects an already-aborted caller without advancing its failure history", async () => {
    completeTlsHandshake();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));
    const entry = service("already-cancelled");

    await expect(probeService(entry, new AbortController().signal)).resolves.toMatchObject({
      status: "warning",
      consecutiveFailures: 1,
    });

    const controller = new AbortController();
    controller.abort(new Error("credential=private cancellation"));
    await expect(probeService(entry, controller.signal)).rejects.toThrow(
      /^Service probe cancelled$/,
    );

    await expect(probeService(entry, new AbortController().signal)).resolves.toMatchObject({
      status: "critical",
      consecutiveFailures: 2,
    });
  });

  it("rejects a mid-flight caller cancellation without advancing its failure history", async () => {
    completeTlsHandshake();
    vi.stubGlobal("fetch", rejectsWhenAborted());
    const entry = service("midflight-cancelled");
    const controller = new AbortController();
    const probe = probeService(entry, controller.signal);

    controller.abort(new Error("credential=private cancellation"));
    await expect(probe).rejects.toThrow(/^Service probe cancelled$/);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));
    await expect(probeService(entry, new AbortController().signal)).resolves.toMatchObject({
      status: "warning",
      consecutiveFailures: 1,
    });
  });

  it("cancels response bodies after successful and non-2xx probes", async () => {
    completeTlsHandshake();
    const successfulBody = { cancel: vi.fn().mockResolvedValue(undefined) };
    const failedBody = { cancel: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, body: successfulBody })
        .mockResolvedValueOnce({ ok: false, body: failedBody }),
    );

    await expect(
      probeService(service("response-cleanup-success"), new AbortController().signal),
    ).resolves.toMatchObject({
      reachable: true,
    });
    await expect(
      probeService(service("response-cleanup-failure"), new AbortController().signal),
    ).resolves.toMatchObject({
      reachable: false,
    });

    expect(successfulBody.cancel).toHaveBeenCalledOnce();
    expect(failedBody.cancel).toHaveBeenCalledOnce();
  });

  it("resets failure history only after a reachable probe and keeps service IDs isolated", async () => {
    completeTlsHandshake();
    const first = service("failure-reset");
    const second = service("separate-service");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));

    await expect(probeService(first, new AbortController().signal)).resolves.toMatchObject({
      status: "warning",
      consecutiveFailures: 1,
    });
    await expect(probeService(second, new AbortController().signal)).resolves.toMatchObject({
      status: "warning",
      consecutiveFailures: 1,
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(probeService(first, new AbortController().signal)).resolves.toMatchObject({
      status: "healthy",
      consecutiveFailures: 0,
    });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));
    await expect(probeService(first, new AbortController().signal)).resolves.toMatchObject({
      status: "warning",
      consecutiveFailures: 1,
    });
    await expect(probeService(second, new AbortController().signal)).resolves.toMatchObject({
      status: "critical",
      consecutiveFailures: 2,
    });
  });

  it("bounds a stalled private service probe to five seconds", async () => {
    vi.useFakeTimers();
    completeTlsHandshake();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: URL, options: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            options.signal?.addEventListener("abort", () => reject(options.signal?.reason), {
              once: true,
            });
          }),
      ),
    );

    const probe = probeService(service("timeout"), new AbortController().signal);
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(probe).resolves.toMatchObject({
      reachable: false,
      status: "warning",
      consecutiveFailures: 1,
      error: "Service probe timed out",
    });
  });

  it("reports a certificate expiring within fourteen days as warning", async () => {
    vi.setSystemTime(now);
    completeTlsHandshake("Aug 17 2026 00:00:00 GMT");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(
      probeService(service("expiring-certificate"), new AbortController().signal),
    ).resolves.toMatchObject({
      reachable: true,
      status: "warning",
      certificateExpiresAt: "2026-08-17T00:00:00.000Z",
    });
  });
});
