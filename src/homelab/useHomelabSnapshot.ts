import { useEffect, useRef, useState } from "react";

import type { Snapshot } from "@shared/homelab/contracts";

const REFRESH_INTERVAL_MS = 10_000;
const STALE_AFTER_MS = 30_000;
const REFRESH_ERROR = "Could not refresh homelab data";

export interface HomelabSnapshotState<T> {
  snapshot: T;
  refreshing: boolean;
  error: string | null;
}

export function useHomelabSnapshot<T extends Snapshot<unknown>>(
  fetcher: () => Promise<T>,
  initialData: T,
): HomelabSnapshotState<T> {
  const fetcherRef = useRef(fetcher);
  const [snapshot, setSnapshot] = useState(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      timeoutId = setTimeout(() => void refresh(), REFRESH_INTERVAL_MS);
    };

    const refresh = async () => {
      if (cancelled) return;
      setRefreshing(true);
      try {
        const nextSnapshot = await fetcherRef.current();
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

    schedule();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const observedAt = Date.parse(snapshot.observedAt);
    if (!Number.isFinite(observedAt)) return;

    const markStale = () => {
      setSnapshot((current) => {
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
  }, [snapshot.observedAt, snapshot.stale, snapshot.status]);

  return { snapshot, refreshing, error };
}
