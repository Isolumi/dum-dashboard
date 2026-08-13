import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Skeleton } from "#/components/ui/skeleton";
import type { ToolEntry } from "#/tools/registry";
import type { CalendarEvent } from "./-calendar.api";
import { getCalendarEvents } from "./-calendar.functions";
import {
  formatCalendarDateLabel,
  formatEventTime,
  getUpcomingEvents,
  groupEventsByDay,
} from "./-calendarUtils";

type BentoStatus = "loading" | "ready" | "auth_expired";

export function CalendarBentoCard({
  tool: _tool,
  data: _data,
}: {
  tool: ToolEntry;
  data: unknown;
}) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [status, setStatus] = useState<BentoStatus>("loading");

  useEffect(() => {
    async function load() {
      const now = new Date();
      const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      try {
        const result = await getCalendarEvents({
          data: {
            time_min: now.toISOString(),
            time_max: thirtyDaysOut.toISOString(),
          },
        });
        if (result.status !== "ready") {
          setStatus("auth_expired");
          return;
        }
        setEvents(getUpcomingEvents(result.events, now, 5));
        setStatus("ready");
      } catch {
        setStatus("auth_expired");
      }
    }
    void load();
  }, []);

  return (
    <Link
      to="/calendar"
      aria-label="Open Calendar tool"
      className="block rounded-lg border border-border bg-card transition-colors duration-150 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="p-4">
        {status === "loading" && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-4 w-12 rounded" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-14" />
              </div>
            ))}
          </div>
        )}

        {status === "auth_expired" && (
          <p className="text-xs text-muted-foreground">
            Calendar disconnected — connect in Calendar.
          </p>
        )}

        {status === "ready" && events.length === 0 && (
          <p className="text-xs text-muted-foreground">No upcoming events.</p>
        )}

        {status === "ready" && events.length > 0 && (
          <div className="flex flex-col gap-1">
            {groupEventsByDay(events).flatMap((group) =>
              group.events.map((event) => (
                <div
                  key={event.id}
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-0.5 border-b border-border/40 py-1.5 last:border-0"
                >
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    {formatCalendarDateLabel(group.isoDate)}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatEventTime(event)}
                  </span>
                  <span className="col-span-2 min-w-0 truncate text-sm text-foreground">
                    {event.summary}
                  </span>
                </div>
              )),
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
