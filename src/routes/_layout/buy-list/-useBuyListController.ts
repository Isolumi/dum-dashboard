import { useCallback, useEffect, useRef, useState } from "react";
import { usePollingRefresh } from "#/hooks/usePollingRefresh";
import type { BuyListItem } from "#/lib/database.types";
import {
  createBuyListItem,
  deleteBuyListItem,
  getBuyList,
  renameBuyListItem,
} from "#/routes/buy-list/buy-list.functions";
import {
  CreateBuyListItemSchema,
  RenameBuyListItemSchema,
} from "#/routes/buy-list/buy-list.schemas";

const LOAD_ERROR = "Could not refresh Buy list. Check your connection and try again.";
const WRITE_ERROR = "Could not save your change. Check your connection and try again.";
function sorted(items: BuyListItem[]): BuyListItem[] {
  return [...items].sort(
    (left, right) =>
      Date.parse(right.created_at) - Date.parse(left.created_at) || right.id.localeCompare(left.id),
  );
}
export interface BuyListController {
  items: BuyListItem[];
  status: "loading" | "ready" | "error";
  loadError: string | null;
  mutationError: string | null;
  pendingIds: ReadonlySet<string>;
  refresh(): Promise<void>;
  add(name: string): Promise<boolean>;
  rename(id: string, name: string): Promise<boolean>;
  remove(id: string): Promise<boolean>;
}

export function useBuyListController(): BuyListController {
  const [items, setItems] = useState<BuyListItem[]>([]);
  const [status, setStatus] = useState<BuyListController["status"]>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());
  const itemsRef = useRef<BuyListItem[]>([]);
  const pendingRef = useRef(new Set<string>());
  const loadedRef = useRef(false);
  const sequenceRef = useRef(0);
  const readRef = useRef<Promise<void> | null>(null);

  // A synchronous ref lets independent writes see each other's latest state,
  // even when React batches multiple event updates into one render.
  const replace = useCallback((next: BuyListItem[]) => {
    const ordered = sorted(next);
    itemsRef.current = ordered;
    setItems(ordered);
  }, []);

  const refresh = useCallback((): Promise<void> => {
    if (readRef.current) return readRef.current;
    const sequence = ++sequenceRef.current;
    const beganDuringWrite = pendingRef.current.size > 0;
    const isCurrent = () =>
      sequence === sequenceRef.current && !beganDuringWrite && pendingRef.current.size === 0;
    let request: Promise<void>;
    request = (async () => {
      try {
        const fresh = await getBuyList();
        if (!isCurrent()) return;
        replace(fresh);
        loadedRef.current = true;
        setStatus("ready");
        setLoadError(null);
      } catch {
        if (!isCurrent()) return;
        setLoadError(LOAD_ERROR);
        setStatus(loadedRef.current ? "ready" : "error");
      }
    })().finally(() => {
      if (readRef.current === request) readRef.current = null;
    });
    readRef.current = request;
    return request;
  }, [replace]);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  usePollingRefresh(refresh, 10_000, { skipWhilePending: true });

  const mutate = useCallback(
    async (
      id: string,
      optimistic: () => void,
      write: () => Promise<BuyListItem>,
      commit: (item: BuyListItem) => void,
      rollback: () => void,
    ): Promise<boolean> => {
      if (!loadedRef.current || pendingRef.current.has(id)) return false;
      sequenceRef.current += 1;
      pendingRef.current.add(id);
      setPendingIds(new Set(pendingRef.current));
      setMutationError(null);
      optimistic();
      try {
        const canonical = await write();
        commit(canonical);
        return true;
      } catch {
        rollback();
        setMutationError(WRITE_ERROR);
        return false;
      } finally {
        // Both success and failure invalidate any read begun during this write.
        sequenceRef.current += 1;
        pendingRef.current.delete(id);
        setPendingIds(new Set(pendingRef.current));
      }
    },
    [],
  );

  const add = useCallback(
    async (name: string): Promise<boolean> => {
      const parsed = CreateBuyListItemSchema.safeParse({ name });
      if (!parsed.success) {
        setMutationError("Use an item name with 1–300 characters.");
        return false;
      }
      const temporary: BuyListItem = {
        id: `pending:${crypto.randomUUID()}`,
        name: parsed.data.name,
        created_at: new Date().toISOString(),
      };
      return await mutate(
        temporary.id,
        () => replace([temporary, ...itemsRef.current]),
        () => createBuyListItem({ data: parsed.data }),
        (canonical) =>
          replace(itemsRef.current.map((item) => (item.id === temporary.id ? canonical : item))),
        () => replace(itemsRef.current.filter((item) => item.id !== temporary.id)),
      );
    },
    [mutate, replace],
  );

  const rename = useCallback(
    async (id: string, name: string): Promise<boolean> => {
      if (pendingRef.current.has(id)) return false;
      const previous = itemsRef.current.find((item) => item.id === id);
      if (!previous) return false;
      const parsed = RenameBuyListItemSchema.safeParse({ id, name });
      if (!parsed.success) {
        setMutationError("Use an item name with 1–300 characters.");
        return false;
      }
      return await mutate(
        id,
        () =>
          replace(
            itemsRef.current.map((item) =>
              item.id === id ? { ...item, name: parsed.data.name } : item,
            ),
          ),
        () => renameBuyListItem({ data: parsed.data }),
        (canonical) => replace(itemsRef.current.map((item) => (item.id === id ? canonical : item))),
        () => replace(itemsRef.current.map((item) => (item.id === id ? previous : item))),
      );
    },
    [mutate, replace],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      if (pendingRef.current.has(id)) return false;
      const previous = itemsRef.current.find((item) => item.id === id);
      if (!previous) return false;
      return await mutate(
        id,
        () => replace(itemsRef.current.filter((item) => item.id !== id)),
        () => deleteBuyListItem({ data: { id } }),
        () => {},
        () => replace([...itemsRef.current, previous]),
      );
    },
    [mutate, replace],
  );

  return { items, status, loadError, mutationError, pendingIds, refresh, add, rename, remove };
}
