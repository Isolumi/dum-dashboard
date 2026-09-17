import { Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";

import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import type { ToolEntry } from "#/tools/registry";
import { useJobsController } from "./-useJobsController";
import { OpenAllJobsButton } from "./-OpenAllJobsButton";
import { getSafeJobUrl } from "./-job-links";

const MAX_JOBS = 3;

export function JobsBentoCard({ tool: _tool, data: _data }: { tool: ToolEntry; data: unknown }) {
  const { jobs: savedJobs, status, loadError, mutationError, remove } = useJobsController();
  const jobs = savedJobs.slice(0, MAX_JOBS);

  return (
    <section aria-label="Jobs" className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/jobs"
          className="inline-flex rounded-sm text-sm font-semibold text-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
        >
          Jobs
        </Link>
        <OpenAllJobsButton jobs={savedJobs} disabled={status !== "ready" || loadError !== null} />
      </div>

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
          {jobs.map((job) => {
            const safeJobUrl = getSafeJobUrl(job.url);
            const content = (
              <>
                <span className="block truncate text-xs text-muted-foreground">{job.company}</span>
                <span className="line-clamp-2 text-sm leading-5 font-medium">{job.title}</span>
              </>
            );

            return (
              <li
                key={job.id}
                className="group flex min-w-0 items-center gap-1 border-b border-border/40 last:border-0"
              >
                {safeJobUrl ? (
                  <a
                    href={safeJobUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${job.company} — ${job.title}`}
                    className="block min-w-0 flex-1 rounded-sm py-1.5 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {content}
                  </a>
                ) : (
                  <div className="min-w-0 flex-1 py-1.5">{content}</div>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${job.title}`}
                  className="size-8 shrink-0 text-muted-foreground hover:text-destructive focus-visible:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-focus-within:opacity-100"
                  onClick={() => void remove(job.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {mutationError ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {mutationError}
        </p>
      ) : null}
    </section>
  );
}
