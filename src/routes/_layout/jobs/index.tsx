import { createFileRoute } from "@tanstack/react-router";

import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import { JobRow } from "./-JobRow";
import { useJobsController } from "./-useJobsController";

export const Route = createFileRoute("/_layout/jobs/")({
  component: JobsPage,
});

function JobsLoading() {
  return (
    <div className="space-y-3" aria-label="Loading saved jobs" aria-live="polite">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-28 w-full rounded-xl motion-reduce:animate-none" />
      ))}
      <p className="sr-only">Loading saved jobs…</p>
    </div>
  );
}

export function JobsPage() {
  const controller = useJobsController();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Jobs</h1>
        <p className="mt-1 text-sm text-muted-foreground">Saved job links.</p>
      </div>

      {controller.mutationError ? (
        <Alert variant="destructive" aria-live="assertive">
          <AlertTitle>Delete failed</AlertTitle>
          <AlertDescription>{controller.mutationError}</AlertDescription>
        </Alert>
      ) : null}

      {controller.status === "loading" ? <JobsLoading /> : null}

      {controller.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load saved jobs</AlertTitle>
          <AlertDescription>
            <p>{controller.loadError}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-3 min-h-11"
              onClick={() => void controller.refresh()}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {controller.status === "ready" && controller.jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <p className="font-medium">No saved jobs</p>
          <p className="mt-1 text-sm text-muted-foreground">New saved jobs will appear here.</p>
        </div>
      ) : null}

      {controller.status === "ready" && controller.jobs.length > 0 ? (
        <ul className="space-y-3" aria-label="Saved jobs">
          {controller.jobs.map((job) => (
            <JobRow key={job.id} job={job} onDelete={controller.remove} />
          ))}
        </ul>
      ) : null}
    </main>
  );
}
