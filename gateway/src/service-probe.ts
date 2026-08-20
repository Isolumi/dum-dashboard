import * as tls from "node:tls";
import { evaluateCertificate, rollUpStatus } from "../../shared/homelab/health-rules";
import type { HealthStatus } from "../../shared/homelab/contracts";
import type { ServiceCatalogEntry } from "./service-catalog";

export type { ServiceCatalogEntry } from "./service-catalog";

export interface ServiceProbeResult {
  entry: ServiceCatalogEntry;
  id: string;
  reachable: boolean;
  status: HealthStatus;
  latencyMs: number;
  certificateExpiresAt: string | null;
  consecutiveFailures: number;
  error?: string;
}

const PROBE_TIMEOUT_MS = 5_000;
const consecutiveFailures = new Map<string, number>();

function cancellationError(): Error {
  return new Error("Service probe cancelled");
}

function probeFailure(
  entry: ServiceCatalogEntry,
  latencyMs: number,
  error: string,
): ServiceProbeResult {
  const failures = (consecutiveFailures.get(entry.id) ?? 0) + 1;
  consecutiveFailures.set(entry.id, failures);

  return {
    entry,
    id: entry.id,
    reachable: false,
    status: failures >= 2 ? "critical" : "warning",
    latencyMs,
    certificateExpiresAt: null,
    consecutiveFailures: failures,
    error,
  };
}

function peerCertificateExpiry(url: URL, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: url.hostname,
      port: Number(url.port || 443),
      rejectUnauthorized: true,
      servername: url.hostname,
    });

    const cleanup = () => {
      signal.removeEventListener("abort", onAbort);
      socket.removeListener("secureConnect", onSecureConnect);
      socket.removeListener("error", onError);
    };
    const rejectWith = (error: unknown) => {
      cleanup();
      socket.destroy();
      reject(error);
    };
    const onAbort = () => rejectWith(signal.reason ?? new Error("service probe aborted"));
    const onError = (error: Error) => rejectWith(error);
    const onSecureConnect = () => {
      const validTo = socket.getPeerCertificate().valid_to;
      const expiresAt = Date.parse(validTo);
      if (Number.isNaN(expiresAt)) {
        rejectWith(new Error("peer certificate expiry is unavailable"));
        return;
      }

      cleanup();
      socket.destroy();
      resolve(new Date(expiresAt).toISOString());
    };

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener("abort", onAbort, { once: true });
    socket.once("secureConnect", onSecureConnect);
    socket.once("error", onError);
  });
}

export async function probeService(
  entry: ServiceCatalogEntry,
  signal: AbortSignal,
  now: () => number = Date.now,
): Promise<ServiceProbeResult> {
  if (signal.aborted) throw cancellationError();

  const controller = new AbortController();
  let callerCancelled = false;
  const abort = () => {
    callerCancelled = true;
    controller.abort();
  };
  signal.addEventListener("abort", abort, { once: true });

  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error("service probe timed out"));
  }, PROBE_TIMEOUT_MS);
  const startedAt = performance.now();
  let response: PromiseSettledResult<Response> | undefined;
  let certificate: PromiseSettledResult<string>;

  try {
    const url = new URL(entry.url);
    [response, certificate] = await Promise.allSettled([
      fetch(url, { signal: controller.signal }),
      peerCertificateExpiry(url, controller.signal),
    ]);
    const latencyMs = Math.round(performance.now() - startedAt);

    if (callerCancelled) throw cancellationError();
    if (timedOut) return probeFailure(entry, latencyMs, "Service probe timed out");
    if (
      response.status !== "fulfilled" ||
      response.value.status >= 500 ||
      certificate.status !== "fulfilled"
    ) {
      return probeFailure(entry, latencyMs, "Service endpoint unavailable");
    }

    consecutiveFailures.delete(entry.id);
    const certificateStatus = evaluateCertificate(
      { name: entry.name, expiresAt: certificate.value },
      now(),
    ).status;
    const status = rollUpStatus([
      {
        status: "healthy",
        ruleId: "service-reachable",
        reason: "Service endpoint responded.",
        evidence: {},
      },
      {
        status: certificateStatus,
        ruleId: "service-certificate",
        reason: "Service certificate was inspected.",
        evidence: {},
      },
    ]).status;

    return {
      entry,
      id: entry.id,
      reachable: true,
      status,
      latencyMs,
      certificateExpiresAt: certificate.value,
      consecutiveFailures: 0,
    };
  } finally {
    clearTimeout(timeoutId);
    signal.removeEventListener("abort", abort);
    if (response?.status === "fulfilled")
      await response.value.body?.cancel().catch(() => undefined);
  }
}
