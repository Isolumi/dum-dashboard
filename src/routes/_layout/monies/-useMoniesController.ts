import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { usePollingRefresh } from "#/hooks/usePollingRefresh";
import {
  createMoniesExpense,
  deleteMoniesExpense,
  getDeletedMoniesExpenses,
  getMoniesExpenses,
  getMoniesUsers,
  restoreMoniesExpense,
  updateMoniesExpense,
} from "#/routes/monies/monies.functions";
import type {
  CreateMoniesExpenseInput,
  MoniesExpense,
  MoniesUser,
  UpdateMoniesExpenseInput,
} from "./-monies.types";

const PAGE_SIZE = 20;
const POLL_INTERVAL_MS = 10_000;
const MUTATION_ERROR_DURATION_MS = 6_000;
const LOAD_ERROR = "Could not load expenses. Check your connection and try again.";
const SAVE_ERROR = "Could not save expense. Check your connection and try again.";
const DELETE_ERROR = "Could not move expense to Trash. Check your connection and try again.";
const RESTORE_ERROR = "Could not restore expense. Check your connection and try again.";

export type MoniesView = "active" | "trash";

export interface MoniesController {
  users: MoniesUser[];
  expenses: MoniesExpense[];
  pendingIds: ReadonlySet<string>;
  status: "loading" | "ready" | "error";
  loadError: string | null;
  mutationError: string | null;
  view: MoniesView;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  setView(view: MoniesView): void;
  previousPage(): void;
  nextPage(): void;
  retry(): Promise<void>;
  create(input: CreateMoniesExpenseInput): Promise<boolean>;
  update(input: UpdateMoniesExpenseInput): Promise<boolean>;
  remove(id: string): Promise<boolean>;
  restore(id: string): Promise<boolean>;
}

export function useMoniesController(): MoniesController {
  const [users, setUsers] = useState<MoniesUser[]>([]);
  const [expenses, setExpenses] = useState<MoniesExpense[]>([]);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());
  const [status, setStatus] = useState<MoniesController["status"]>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [view, setViewState] = useState<MoniesView>("active");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const expensesRef = useRef<MoniesExpense[]>([]);
  const usersRef = useRef<MoniesUser[]>([]);
  const usersLoadedRef = useRef(false);
  const pendingIdsRef = useRef(new Set<string>());
  const loadRequestRef = useRef(0);
  const mutationCountRef = useRef(0);
  const mutationRevisionRef = useRef(0);

  const replaceExpenses = useCallback((replace: (current: MoniesExpense[]) => MoniesExpense[]) => {
    const next = replace(expensesRef.current);
    expensesRef.current = next;
    setExpenses(next);
  }, []);

  const markPending = useCallback((id: string) => {
    pendingIdsRef.current.add(id);
    setPendingIds(new Set(pendingIdsRef.current));
  }, []);

  const clearPending = useCallback((id: string) => {
    pendingIdsRef.current.delete(id);
    setPendingIds(new Set(pendingIdsRef.current));
  }, []);

  const beginMutation = useCallback(() => {
    mutationCountRef.current += 1;
    mutationRevisionRef.current += 1;
    setMutationError(null);
  }, []);

  const endMutation = useCallback(() => {
    mutationCountRef.current = Math.max(0, mutationCountRef.current - 1);
  }, []);

  useEffect(() => {
    if (!mutationError) return;
    const timer = setTimeout(() => setMutationError(null), MUTATION_ERROR_DURATION_MS);
    return () => clearTimeout(timer);
  }, [mutationError]);

  const loadPage = useCallback(
    async ({ showLoading = true }: { showLoading?: boolean } = {}): Promise<void> => {
      const requestId = ++loadRequestRef.current;
      const revisionAtRequestStart = mutationRevisionRef.current;
      const mutationActiveAtRequestStart = mutationCountRef.current > 0;
      if (showLoading) setStatus("loading");

      try {
        const usersRequest = usersLoadedRef.current
          ? Promise.resolve(usersRef.current)
          : getMoniesUsers();
        const expensesRequest =
          view === "active"
            ? getMoniesExpenses({ data: { page, pageSize: PAGE_SIZE } })
            : getDeletedMoniesExpenses({ data: { page, pageSize: PAGE_SIZE } });
        const [freshUsers, freshPage] = await Promise.all([usersRequest, expensesRequest]);
        if (requestId !== loadRequestRef.current) return;

        const totalPages = Math.max(1, Math.ceil(freshPage.total / PAGE_SIZE));
        if (page > totalPages) {
          setPage(totalPages);
          return;
        }

        const mutationOverlappedRequest =
          mutationActiveAtRequestStart ||
          mutationCountRef.current > 0 ||
          mutationRevisionRef.current !== revisionAtRequestStart;
        if (!mutationOverlappedRequest) {
          usersRef.current = freshUsers;
          usersLoadedRef.current = true;
          setUsers(freshUsers);
          replaceExpenses(() => freshPage.items);
          setTotal(freshPage.total);
          setLoadError(null);
        }
        setStatus("ready");
      } catch {
        if (requestId !== loadRequestRef.current) return;
        setLoadError(LOAD_ERROR);
        setStatus((current) => (showLoading || current === "loading" ? "error" : current));
      }
    },
    [page, replaceExpenses, view],
  );

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  usePollingRefresh(() => loadPage({ showLoading: false }), POLL_INTERVAL_MS);

  const setView = useCallback((nextView: MoniesView) => {
    setViewState((current) => (current === nextView ? current : nextView));
    setPage(1);
  }, []);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const previousPage = useCallback(() => {
    setPage((current) => Math.max(1, current - 1));
  }, []);

  const nextPage = useCallback(() => {
    setPage((current) => Math.min(totalPages, current + 1));
  }, [totalPages]);

  const create = useCallback(
    async (input: CreateMoniesExpenseInput): Promise<boolean> => {
      beginMutation();
      try {
        const created = await createMoniesExpense({ data: input });
        if (view === "active" && page === 1) {
          replaceExpenses((current) => [created, ...current].slice(0, PAGE_SIZE));
          setTotal((current) => current + 1);
        }
        return true;
      } catch {
        setMutationError(SAVE_ERROR);
        return false;
      } finally {
        endMutation();
      }
    },
    [beginMutation, endMutation, page, replaceExpenses, view],
  );

  const update = useCallback(
    async (input: UpdateMoniesExpenseInput): Promise<boolean> => {
      beginMutation();
      markPending(input.id);
      try {
        const updated = await updateMoniesExpense({ data: input });
        replaceExpenses((current) =>
          current.map((expense) => (expense.id === updated.id ? updated : expense)),
        );
        return true;
      } catch {
        setMutationError(SAVE_ERROR);
        return false;
      } finally {
        clearPending(input.id);
        endMutation();
      }
    },
    [beginMutation, clearPending, endMutation, markPending, replaceExpenses],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      if (pendingIdsRef.current.has(id)) return false;
      const previousIndex = expensesRef.current.findIndex((expense) => expense.id === id);
      const previous = expensesRef.current[previousIndex];
      if (!previous) return false;

      beginMutation();
      markPending(id);
      replaceExpenses((current) => current.filter((expense) => expense.id !== id));
      setTotal((current) => Math.max(0, current - 1));
      try {
        await deleteMoniesExpense({ data: { id } });
        if (expensesRef.current.length === 0) {
          setPage((current) => Math.max(1, current - 1));
        }
        return true;
      } catch {
        replaceExpenses((current) => {
          if (current.some((expense) => expense.id === id)) return current;
          const restored = [...current];
          restored.splice(Math.min(previousIndex, restored.length), 0, previous);
          return restored;
        });
        setTotal((current) => current + 1);
        setMutationError(DELETE_ERROR);
        return false;
      } finally {
        clearPending(id);
        endMutation();
      }
    },
    [beginMutation, clearPending, endMutation, markPending, replaceExpenses],
  );

  const restore = useCallback(
    async (id: string): Promise<boolean> => {
      if (pendingIdsRef.current.has(id)) return false;
      const previousIndex = expensesRef.current.findIndex((expense) => expense.id === id);
      const previous = expensesRef.current[previousIndex];
      if (!previous) return false;

      beginMutation();
      markPending(id);
      replaceExpenses((current) => current.filter((expense) => expense.id !== id));
      setTotal((current) => Math.max(0, current - 1));
      try {
        await restoreMoniesExpense({ data: { id } });
        if (expensesRef.current.length === 0) {
          setPage((current) => Math.max(1, current - 1));
        }
        return true;
      } catch {
        replaceExpenses((current) => {
          if (current.some((expense) => expense.id === id)) return current;
          const restored = [...current];
          restored.splice(Math.min(previousIndex, restored.length), 0, previous);
          return restored;
        });
        setTotal((current) => current + 1);
        setMutationError(RESTORE_ERROR);
        return false;
      } finally {
        clearPending(id);
        endMutation();
      }
    },
    [beginMutation, clearPending, endMutation, markPending, replaceExpenses],
  );

  const retry = useCallback(async (): Promise<void> => loadPage(), [loadPage]);

  return {
    users,
    expenses,
    pendingIds,
    status,
    loadError,
    mutationError,
    view,
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages,
    setView,
    previousPage,
    nextPage,
    retry,
    create,
    update,
    remove,
    restore,
  };
}
