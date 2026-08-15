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

interface MoniesListContext {
  view: MoniesView;
  page: number;
}

function contextKey(context: MoniesListContext): string {
  return `${context.view}:${context.page}`;
}

function isSameContext(left: MoniesListContext, right: MoniesListContext): boolean {
  return left.view === right.view && left.page === right.page;
}

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
  const selectedContextRef = useRef<MoniesListContext>({ view: "active", page: 1 });
  const activeMutationContextsRef = useRef(new Map<string, number>());
  const mutationContextRevisionsRef = useRef(new Map<string, number>());

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

  const selectContext = useCallback((next: MoniesListContext) => {
    if (isSameContext(selectedContextRef.current, next)) return;
    selectedContextRef.current = next;
    setViewState(next.view);
    setPage(next.page);
  }, []);

  const beginMutation = useCallback((context: MoniesListContext) => {
    const key = contextKey(context);
    mutationCountRef.current += 1;
    activeMutationContextsRef.current.set(
      key,
      (activeMutationContextsRef.current.get(key) ?? 0) + 1,
    );
    mutationContextRevisionsRef.current.set(
      key,
      (mutationContextRevisionsRef.current.get(key) ?? 0) + 1,
    );
    setMutationError(null);
  }, []);

  const endMutation = useCallback((context: MoniesListContext): number => {
    const key = contextKey(context);
    const contextCount = activeMutationContextsRef.current.get(key) ?? 0;
    if (contextCount <= 1) activeMutationContextsRef.current.delete(key);
    else activeMutationContextsRef.current.set(key, contextCount - 1);
    mutationCountRef.current = Math.max(0, mutationCountRef.current - 1);
    return mutationCountRef.current;
  }, []);

  useEffect(() => {
    if (!mutationError) return;
    const timer = setTimeout(() => setMutationError(null), MUTATION_ERROR_DURATION_MS);
    return () => clearTimeout(timer);
  }, [mutationError]);

  const loadPage = useCallback(
    async (
      context: MoniesListContext,
      { showLoading = true }: { showLoading?: boolean } = {},
    ): Promise<void> => {
      const requestId = ++loadRequestRef.current;
      const key = contextKey(context);
      const revisionAtRequestStart = mutationContextRevisionsRef.current.get(key) ?? 0;
      const mutationActiveAtRequestStart = activeMutationContextsRef.current.has(key);
      if (showLoading) setStatus("loading");

      try {
        const usersRequest = usersLoadedRef.current
          ? Promise.resolve(usersRef.current)
          : getMoniesUsers();
        const expensesRequest =
          context.view === "active"
            ? getMoniesExpenses({ data: { page: context.page, pageSize: PAGE_SIZE } })
            : getDeletedMoniesExpenses({ data: { page: context.page, pageSize: PAGE_SIZE } });
        const [freshUsers, freshPage] = await Promise.all([usersRequest, expensesRequest]);
        if (requestId !== loadRequestRef.current) return;
        if (!isSameContext(selectedContextRef.current, context)) return;

        const totalPages = Math.max(1, Math.ceil(freshPage.total / PAGE_SIZE));
        if (context.page > totalPages) {
          selectContext({ ...context, page: totalPages });
          return;
        }

        const mutationOverlappedRequest =
          mutationActiveAtRequestStart ||
          activeMutationContextsRef.current.has(key) ||
          (mutationContextRevisionsRef.current.get(key) ?? 0) !== revisionAtRequestStart;
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
        if (!isSameContext(selectedContextRef.current, context)) return;
        if (
          mutationActiveAtRequestStart ||
          activeMutationContextsRef.current.has(key) ||
          (mutationContextRevisionsRef.current.get(key) ?? 0) !== revisionAtRequestStart
        ) {
          return;
        }
        setLoadError(LOAD_ERROR);
        setStatus((current) => (showLoading || current === "loading" ? "error" : current));
      }
    },
    [replaceExpenses, selectContext],
  );

  useEffect(() => {
    void loadPage({ view, page });
  }, [loadPage, page, view]);

  usePollingRefresh(
    () => loadPage(selectedContextRef.current, { showLoading: false }),
    POLL_INTERVAL_MS,
  );

  const setView = useCallback(
    (nextView: MoniesView) => {
      selectContext({ view: nextView, page: 1 });
    },
    [selectContext],
  );

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const finishMutation = useCallback(
    async (sourceContext: MoniesListContext): Promise<void> => {
      if (endMutation(sourceContext) === 0) {
        await loadPage(selectedContextRef.current, { showLoading: false });
      }
    },
    [endMutation, loadPage],
  );

  const previousPage = useCallback(() => {
    const current = selectedContextRef.current;
    selectContext({ ...current, page: Math.max(1, current.page - 1) });
  }, [selectContext]);

  const nextPage = useCallback(() => {
    const current = selectedContextRef.current;
    selectContext({ ...current, page: Math.min(totalPages, current.page + 1) });
  }, [selectContext, totalPages]);

  const create = useCallback(
    async (input: CreateMoniesExpenseInput): Promise<boolean> => {
      const sourceContext = selectedContextRef.current;
      beginMutation(sourceContext);
      try {
        const created = await createMoniesExpense({ data: input });
        if (
          isSameContext(selectedContextRef.current, sourceContext) &&
          sourceContext.view === "active" &&
          sourceContext.page === 1
        ) {
          replaceExpenses((current) => [created, ...current].slice(0, PAGE_SIZE));
          setTotal((current) => current + 1);
        }
        return true;
      } catch {
        setMutationError(SAVE_ERROR);
        return false;
      } finally {
        await finishMutation(sourceContext);
      }
    },
    [beginMutation, finishMutation, replaceExpenses],
  );

  const update = useCallback(
    async (input: UpdateMoniesExpenseInput): Promise<boolean> => {
      const sourceContext = selectedContextRef.current;
      beginMutation(sourceContext);
      markPending(input.id);
      try {
        const updated = await updateMoniesExpense({ data: input });
        if (isSameContext(selectedContextRef.current, sourceContext)) {
          replaceExpenses((current) =>
            current.map((expense) => (expense.id === updated.id ? updated : expense)),
          );
        }
        return true;
      } catch {
        setMutationError(SAVE_ERROR);
        return false;
      } finally {
        clearPending(input.id);
        await finishMutation(sourceContext);
      }
    },
    [beginMutation, clearPending, finishMutation, markPending, replaceExpenses],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      if (pendingIdsRef.current.has(id)) return false;
      const previousIndex = expensesRef.current.findIndex((expense) => expense.id === id);
      const previous = expensesRef.current[previousIndex];
      if (!previous) return false;

      const sourceContext = selectedContextRef.current;
      beginMutation(sourceContext);
      markPending(id);
      replaceExpenses((current) => current.filter((expense) => expense.id !== id));
      setTotal((current) => Math.max(0, current - 1));
      try {
        await deleteMoniesExpense({ data: { id } });
        if (
          isSameContext(selectedContextRef.current, sourceContext) &&
          expensesRef.current.length === 0
        ) {
          selectContext({ ...sourceContext, page: Math.max(1, sourceContext.page - 1) });
        }
        return true;
      } catch {
        if (isSameContext(selectedContextRef.current, sourceContext)) {
          replaceExpenses((current) => {
            if (current.some((expense) => expense.id === id)) return current;
            const restored = [...current];
            restored.splice(Math.min(previousIndex, restored.length), 0, previous);
            return restored;
          });
          setTotal((current) => current + 1);
        }
        setMutationError(DELETE_ERROR);
        return false;
      } finally {
        clearPending(id);
        await finishMutation(sourceContext);
      }
    },
    [beginMutation, clearPending, finishMutation, markPending, replaceExpenses, selectContext],
  );

  const restore = useCallback(
    async (id: string): Promise<boolean> => {
      if (pendingIdsRef.current.has(id)) return false;
      const previousIndex = expensesRef.current.findIndex((expense) => expense.id === id);
      const previous = expensesRef.current[previousIndex];
      if (!previous) return false;

      const sourceContext = selectedContextRef.current;
      beginMutation(sourceContext);
      markPending(id);
      replaceExpenses((current) => current.filter((expense) => expense.id !== id));
      setTotal((current) => Math.max(0, current - 1));
      try {
        await restoreMoniesExpense({ data: { id } });
        if (
          isSameContext(selectedContextRef.current, sourceContext) &&
          expensesRef.current.length === 0
        ) {
          selectContext({ ...sourceContext, page: Math.max(1, sourceContext.page - 1) });
        }
        return true;
      } catch {
        if (isSameContext(selectedContextRef.current, sourceContext)) {
          replaceExpenses((current) => {
            if (current.some((expense) => expense.id === id)) return current;
            const restored = [...current];
            restored.splice(Math.min(previousIndex, restored.length), 0, previous);
            return restored;
          });
          setTotal((current) => current + 1);
        }
        setMutationError(RESTORE_ERROR);
        return false;
      } finally {
        clearPending(id);
        await finishMutation(sourceContext);
      }
    },
    [beginMutation, clearPending, finishMutation, markPending, replaceExpenses, selectContext],
  );

  const retry = useCallback(
    async (): Promise<void> => loadPage(selectedContextRef.current),
    [loadPage],
  );

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
