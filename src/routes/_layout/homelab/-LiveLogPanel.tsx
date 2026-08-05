import { useEffect, useMemo, useRef, useState } from "react";
import { CirclePause, CirclePlay, RotateCcw, Terminal } from "lucide-react";

import { Button } from "#/components/ui/button";

const DNS_LABEL = /^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$/;
const MAX_RENDERED_LINES = 2_000;
const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000] as const;

type ConnectionState = "initial" | "open" | "reconnecting" | "paused" | "invalid";

interface RenderedLogLine {
  id: number;
  text: string;
}

function isDnsLabel(value: string): boolean {
  return value.length > 0 && value.length <= 63 && DNS_LABEL.test(value);
}

function isDnsSubdomain(value: string): boolean {
  return value.length > 0 && value.length <= 253 && value.split(".").every(isDnsLabel);
}

function isValidSelection(namespace: string, pod: string, container: string): boolean {
  return isDnsLabel(namespace) && isDnsSubdomain(pod) && isDnsLabel(container);
}

function logStreamUrl(namespace: string, pod: string, container: string): string {
  const query = new URLSearchParams({ container });
  return `/api/homelab/logs/${encodeURIComponent(namespace)}/${encodeURIComponent(pod)}?${query}`;
}

function connectionLabel(state: ConnectionState, reconnectDelayMs: number | null): string {
  switch (state) {
    case "initial":
      return "Connecting";
    case "open":
      return "Live";
    case "reconnecting":
      return `Reconnecting in ${Math.ceil((reconnectDelayMs ?? 0) / 1_000)}s`;
    case "paused":
      return "Paused";
    case "invalid":
      return "Unavailable";
  }
}

export function LiveLogPanel({
  namespace,
  pod,
  container,
}: {
  namespace: string;
  pod: string;
  container: string;
}) {
  const validSelection = isValidSelection(namespace, pod, container);
  const streamUrl = useMemo(
    () => (validSelection ? logStreamUrl(namespace, pod, container) : null),
    [container, namespace, pod, validSelection],
  );
  const [lines, setLines] = useState<RenderedLogLine[]>([]);
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    validSelection ? "initial" : "invalid",
  );
  const [reconnectDelayMs, setReconnectDelayMs] = useState<number | null>(null);
  const lineId = useRef(0);
  const logViewport = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLines([]);
  }, [streamUrl]);

  useEffect(() => {
    if (!autoScroll || lines.length === 0) return;
    const viewport = logViewport.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [autoScroll, lines]);

  useEffect(() => {
    if (!streamUrl) {
      setConnectionState("invalid");
      setReconnectDelayMs(null);
      return;
    }
    if (paused) {
      setConnectionState("paused");
      setReconnectDelayMs(null);
      return;
    }

    let active = true;
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let reconnectAttempt = 0;

    const closeSource = () => {
      if (!source) return;
      source.onopen = null;
      source.onerror = null;
      source.close();
      source = null;
    };

    const scheduleReconnect = () => {
      if (!active || reconnectTimer) return;
      closeSource();
      const delay =
        RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)] ??
        RECONNECT_DELAYS_MS.at(-1)!;
      reconnectAttempt += 1;
      setConnectionState("reconnecting");
      setReconnectDelayMs(delay);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined;
        connect();
      }, delay);
    };

    const onLine = (event: Event) => {
      if (!active) return;
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as { line?: unknown };
        if (typeof payload.line !== "string") return;
        const nextLine = { id: lineId.current++, text: payload.line };
        setLines((current) => [...current, nextLine].slice(-MAX_RENDERED_LINES));
      } catch {
        // Malformed upstream events are ignored without exposing their contents.
      }
    };

    const connect = () => {
      if (!active) return;
      setConnectionState(reconnectAttempt === 0 ? "initial" : "reconnecting");
      try {
        const nextSource = new EventSource(streamUrl);
        source = nextSource;
        nextSource.addEventListener("line", onLine);
        nextSource.onopen = () => {
          if (!active || source !== nextSource) return;
          reconnectAttempt = 0;
          setReconnectDelayMs(null);
          setConnectionState("open");
        };
        nextSource.onerror = scheduleReconnect;
      } catch {
        scheduleReconnect();
      }
    };

    connect();
    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      closeSource();
    };
  }, [paused, streamUrl]);

  if (!validSelection) {
    return (
      <section
        aria-labelledby="live-logs-title"
        className="rounded-lg border border-border bg-card p-4"
      >
        <h3 id="live-logs-title" className="text-sm font-semibold text-foreground">
          Live logs
        </h3>
        <p role="alert" className="mt-3 text-sm text-health-unknown">
          Invalid pod log selection.
        </p>
      </section>
    );
  }

  const statusLabel = connectionLabel(connectionState, reconnectDelayMs);

  return (
    <section
      aria-labelledby="live-logs-title"
      className="min-w-0 rounded-lg border border-border bg-card"
    >
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Terminal className="size-4 text-muted-foreground" aria-hidden="true" />
            <h3 id="live-logs-title" className="text-sm font-semibold text-foreground">
              Live logs
            </h3>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {namespace}/{pod} · {container}
          </p>
        </div>
        <span
          role="status"
          aria-label="Log stream status"
          className="inline-flex min-h-7 w-fit items-center rounded-full border border-border bg-background/60 px-2.5 text-xs font-medium text-muted-foreground"
        >
          {statusLabel}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          aria-label={paused ? "Resume logs" : "Pause logs"}
          onClick={() => setPaused((current) => !current)}
        >
          {paused ? <CirclePlay aria-hidden="true" /> : <CirclePause aria-hidden="true" />}
          {paused ? "Resume" : "Pause"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          aria-label="Clear logs"
          onClick={() => setLines([])}
        >
          <RotateCcw aria-hidden="true" />
          Clear
        </Button>
        <label className="ml-auto inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 text-xs text-muted-foreground outline-none focus-within:ring-2 focus-within:ring-ring">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(event) => setAutoScroll(event.currentTarget.checked)}
            className="size-4 accent-primary"
          />
          Auto-scroll logs
        </label>
      </div>

      <div
        ref={logViewport}
        role="region"
        aria-label="Live pod log output"
        className="max-h-96 overflow-auto bg-background/70 p-3 font-mono text-xs leading-5 text-foreground"
      >
        {lines.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Waiting for log output.</p>
        ) : (
          <ol role="log" aria-label="Live pod logs" aria-live="off" className="min-w-max">
            {lines.map((line) => (
              <li key={line.id} className="whitespace-pre-wrap break-all">
                {line.text}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
