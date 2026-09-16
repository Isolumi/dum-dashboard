import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { Skeleton } from "#/components/ui/skeleton";
import { usePollingRefresh } from "#/hooks/usePollingRefresh";
import type { Job } from "#/lib/database.types";
import { getJobs } from "#/routes/jobs/jobs.functions";
import type { ToolEntry } from "#/tools/registry";

const MAX_JOBS = 3;
const REFRESH_INTERVAL_MS = 10_000;

type BentoStatus = "loading" | "ready" | "error";

function newestJobs(jobs: Job[]): Job[] {
  return [...jobs]
    .sort(
      (left, right) =>
        right.saved_at.localeCompare(left.saved_at) || right.id.localeCompare(left.id),
    )
    .slice(0, MAX_JOBS);
}

export function JobsBentoCard({ tool: _tool, data: _data }: { tool: ToolEntry; data: unknown }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [status, setStatus] = useState<BentoStatus>("loading");
  const mountedRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const refreshPendingRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback((): Promise<void> => {
    if (refreshPendingRef.current) return refreshPendingRef.current;

    let request: Promise<void>;
    request = (async () => {
      try {
        const freshJobs = await getJobs();
        if (!mountedRef.current) return;

        setJobs(newestJobs(freshJobs));
        hasLoadedRef.current = true;
        setStatus("ready");
      } catch {
        if (!mountedRef.current || hasLoadedRef.current) return;
        setStatus("error");
      }
    })().finally(() => {
      if (refreshPendingRef.current === request) refreshPendingRef.current = null;
    });
    refreshPendingRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();

    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  usePollingRefresh(refresh, REFRESH_INTERVAL_MS, { skipWhilePending: true });

  return (
    <section aria-label="Jobs" className="rounded-lg border border-border bg-card p-4">
      <Link
        to="/jobs"
        className="inline-flex rounded-sm text-sm font-semibold text-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
      >
        Jobs
      </Link>

      {status === "loading" ? (
        <div role="status" aria-label="Loading saved jobs" className="mt-3 flex flex-col gap-2">
          <span className="sr-only">Loading saved jobs</span>
          {Array.from({ length: MAX_JOBS }).map((_, index) => (
            <div key={index} className="space-y-1.5 py-1">
              <Skeleton className="h-3 w-20 motion-reduce:animate-none" />
              <Skeleton className="h-4 w-full motion-reduce:animate-none" />
            </div>
          ))}
        </div>
      ) : null}

      {status === "error" ? (
        <p className="mt-3 text-xs text-muted-foreground">Could not load saved jobs.</p>
      ) : null}

      {status === "ready" && jobs.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No saved jobs</p>
      ) : null}

      {status === "ready" && jobs.length > 0 ? (
        <ul className="mt-2 flex flex-col">
          {jobs.map((job) => (
            <li key={job.id} className="min-w-0 border-b border-border/40 last:border-0">
              <a
                href={job.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`${job.company} — ${job.title}`}
                className="block min-w-0 rounded-sm py-1.5 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="block truncate text-xs text-muted-foreground">{job.company}</span>
                <span className="line-clamp-2 text-sm leading-5 font-medium">{job.title}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
