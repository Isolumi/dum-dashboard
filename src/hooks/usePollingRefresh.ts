import { useEffect, useRef } from "react";

type PollingRefreshOptions = {
  skipWhilePending?: boolean;
};

export function usePollingRefresh(
  callback: () => void | Promise<void>,
  intervalMs: number,
  { skipWhilePending = false }: PollingRefreshOptions = {},
): void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    let refreshPending = false;

    const interval = setInterval(() => {
      if (skipWhilePending && refreshPending) return;

      const refresh = callbackRef.current();
      if (skipWhilePending) {
        refreshPending = true;
        void Promise.resolve(refresh).finally(() => {
          refreshPending = false;
        });
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs, skipWhilePending]);
}
