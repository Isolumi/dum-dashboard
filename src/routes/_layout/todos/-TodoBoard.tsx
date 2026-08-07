import type { ReactElement } from "react";
import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import { cn } from "#/lib/utils";
import { PrioritySection } from "./-PrioritySection";
import { PRIORITY_LABELS, PRIORITY_ORDER } from "./-todoUtils";
import type { TodoController } from "./-useTodoController";

export interface TodoBoardProps {
  controller: TodoController;
  variant: "compact" | "full";
}

function TodoBoardSkeleton({ compact }: { compact: boolean }) {
  return (
    <div className={cn("flex flex-col", compact ? "gap-1" : "gap-2")}>
      {Array.from({ length: compact ? 3 : 5 }).map((_, index) => (
        <div key={index} className={cn("flex items-center gap-2", compact ? "px-2" : "px-4")}>
          <Skeleton className="size-5 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-5 w-14 rounded-sm" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export function TodoBoard({ controller, variant }: TodoBoardProps): ReactElement {
  const compact = variant === "compact";

  return (
    <section
      aria-label="Todo board"
      className={cn("flex flex-col gap-2", compact && "max-h-[32rem] overflow-y-auto")}
    >
      {controller.status === "loading" ? (
        <TodoBoardSkeleton compact={compact} />
      ) : (
        <>
          {controller.loadError && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>{controller.loadError}</span>
                <Button size="sm" variant="outline" onClick={() => void controller.retry()}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <div className={cn("flex flex-col", compact ? "gap-1" : "gap-2")}>
            {PRIORITY_ORDER.map((priority) => (
              <PrioritySection
                key={priority}
                compact={compact}
                priority={priority}
                label={PRIORITY_LABELS[priority]}
                todos={controller.grouped[priority]}
                onUpdate={controller.update}
                onDelete={controller.remove}
                onCreate={controller.create}
                onReorder={controller.reorder}
              />
            ))}
          </div>
          {controller.mutationError && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{controller.mutationError}</AlertDescription>
            </Alert>
          )}
        </>
      )}
    </section>
  );
}
