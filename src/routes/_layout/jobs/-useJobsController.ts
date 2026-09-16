import { useCallback, useEffect, useRef, useState } from "react";

import { usePollingRefresh } from "#/hooks/usePollingRefresh";
import type { Job } from "#/lib/database.types";
import { deleteJob, getJobs } from "#/routes/jobs/jobs.functions";

const POLL_INTERVAL_MS = 10_000;
const LOAD_ERROR = "Could not refresh saved jobs. Check your connection and try again.";
const DELETE_ERROR = "Could not delete saved job. Check your connection and try again.";

function sortJobs(jobs: Job[]): Job[] {
  return [...jobs].sort(
    (left, right) => right.saved_at.localeCompare(left.saved_at) || right.id.localeCompare(left.id),
  );
}

export interface JobsController {
  jobs: Job[];
  status: "loading" | "ready" | "error";
  loadError: string | null;
  mutationError: string | null;
  pendingIds: ReadonlySet<string>;
  refresh(): Promise<void>;
  remove(id: string): Promise<boolean>;
}

export function useJobsController(): JobsController {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [status, setStatus] = useState<JobsController["status"]>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());
  const jobsRef = useRef<Job[]>([]);
  const hasLoadedRef = useRef(false);
  const pendingIdsRef = useRef(new Set<string>());
  const requestSequenceRef = useRef(0);

  const replaceJobs = useCallback((next: Job[]) => {
    jobsRef.current = next;
    setJobs(next);
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    const requestSequence = ++requestSequenceRef.current;

    try {
      const fresh = await getJobs();
      if (requestSequence !== requestSequenceRef.current) return;

      const visibleJobs = sortJobs(fresh).filter((job) => !pendingIdsRef.current.has(job.id));
      hasLoadedRef.current = true;
      replaceJobs(visibleJobs);
      setLoadError(null);
      setStatus("ready");
    } catch {
      if (requestSequence !== requestSequenceRef.current) return;
      setLoadError(LOAD_ERROR);
      setStatus(hasLoadedRef.current ? "ready" : "error");
    }
  }, [replaceJobs]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  usePollingRefresh(refresh, POLL_INTERVAL_MS, { skipWhilePending: true });

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      if (pendingIdsRef.current.has(id)) return false;
      const previous = jobsRef.current;
      if (!previous.some((job) => job.id === id)) return false;

      requestSequenceRef.current += 1;
      pendingIdsRef.current.add(id);
      setPendingIds(new Set(pendingIdsRef.current));
      setMutationError(null);
      replaceJobs(previous.filter((job) => job.id !== id));

      try {
        await deleteJob({ data: { id } });
        return true;
      } catch {
        replaceJobs(previous);
        setMutationError(DELETE_ERROR);
        return false;
      } finally {
        pendingIdsRef.current.delete(id);
        setPendingIds(new Set(pendingIdsRef.current));
      }
    },
    [replaceJobs],
  );

  return {
    jobs,
    loadError,
    mutationError,
    pendingIds,
    refresh,
    remove,
    status,
  };
}
