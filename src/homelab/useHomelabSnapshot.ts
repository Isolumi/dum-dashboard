import { useEffect, useRef, useState } from "react";

import type { Snapshot } from "@shared/homelab/contracts";

const REFRESH_INTERVAL_MS = 10_000;
const STALE_AFTER_MS = 30_000;
const REFRESH_ERROR = "Could not refresh homelab data";

export interface HomelabSnapshotOptions {
  refreshKey?: string;
}

export type HomelabSnapshotFetcher<T> = (signal: AbortSignal) => Promise<T>;

export interface HomelabSnapshotState<T> {
  snapshot: T;
  refreshing: boolean;
  error: string | null;
}

export function useHomelabSnapshot<T extends Snapshot<unknown>>(
  fetcher: HomelabSnapshotFetcher<T>,
  initialData: T,
  options?: HomelabSnapshotOptions,
): HomelabSnapshotState<T>;
export function useHomelabSnapshot<T extends Snapshot<unknown>>(
  fetcher: HomelabSnapshotFetcher<T>,
  initialData: T | null,
  options?: HomelabSnapshotOptions,
): HomelabSnapshotState<T | null>;
export function useHomelabSnapshot<T extends Snapshot<unknown>>(
  fetcher: HomelabSnapshotFetcher<T>,
  initialData: T | null,
  options: HomelabSnapshotOptions = {},
): HomelabSnapshotState<T | null> {
  const fetcherRef = useRef(fetcher);
  const mounted = useRef(false);
  const [snapshot, setSnapshot] = useState<T | null>(initialData);
  const [refreshing, setRefreshing] = useState(initialData === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    const schedule = () => {
      timeoutId = setTimeout(() => void refresh(), REFRESH_INTERVAL_MS);
    };

    const refresh = async () => {
      if (cancelled) return;
      setRefreshing(true);
      try {
        const nextSnapshot = await fetcherRef.current(controller.signal);
        if (!cancelled) {
          setSnapshot(nextSnapshot);
          setError(null);
        }
      } catch {
        if (!cancelled) setError(REFRESH_ERROR);
      } finally {
        if (!cancelled) {
          setRefreshing(false);
          schedule();
        }
      }
    };

    const firstRun = !mounted.current;
    mounted.current = true;
    if (firstRun && initialData) schedule();
    else void refresh();
    return () => {
      cancelled = true;
      controller.abort();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [options.refreshKey]);

  useEffect(() => {
    if (!snapshot) return;
    const observedAt = Date.parse(snapshot.observedAt);
    if (!Number.isFinite(observedAt)) return;

    const markStale = () => {
      setSnapshot((current) => {
        if (!current) return current;
        if (current.observedAt !== snapshot.observedAt) return current;
        if (current.stale && current.status === "unknown") return current;
        return { ...current, stale: true, status: "unknown" };
      });
    };
    const staleAt = observedAt + STALE_AFTER_MS + 1;
    const delay = staleAt - Date.now();
    if (delay <= 0) {
      markStale();
      return;
    }

    const timeoutId = setTimeout(markStale, delay);
    return () => clearTimeout(timeoutId);
  }, [snapshot?.observedAt, snapshot?.stale, snapshot?.status]);

  return { snapshot, refreshing, error };
}
