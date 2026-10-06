import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { Skeleton } from "#/components/ui/skeleton";
import { usePollingRefresh } from "#/hooks/usePollingRefresh";
import type { ToolEntry } from "#/tools/registry";
import type { CalendarEvent } from "./-calendar.api";
import { getCalendarEvents } from "./-calendar.functions";
import {
  formatCalendarDateLabel,
  formatEventTime,
  getUpcomingEvents,
  groupEventsByDay,
} from "./-calendarUtils";

type BentoStatus = "loading" | "ready" | "auth_expired" | "error";

const REFRESH_INTERVAL_MS = 10_000;

export function CalendarBentoCard({
  tool: _tool,
  data: _data,
}: {
  tool: ToolEntry;
  data: unknown;
}) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [status, setStatus] = useState<BentoStatus>("loading");
  const mountedRef = useRef(false);
  const loadRequestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    const now = new Date();
    const ninetyDaysOut = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    try {
      const result = await getCalendarEvents({
        data: {
          time_min: now.toISOString(),
          time_max: ninetyDaysOut.toISOString(),
        },
      });
      if (!mountedRef.current || requestId !== loadRequestRef.current) return;
      if (result.status !== "ready") {
        setStatus("auth_expired");
        return;
      }
      setEvents(getUpcomingEvents(result.events, now, result.events.length));
      setStatus("ready");
    } catch {
      if (mountedRef.current && requestId === loadRequestRef.current) {
        setStatus((current) => (current === "loading" ? "error" : current));
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load();

    return () => {
      mountedRef.current = false;
      loadRequestRef.current += 1;
    };
  }, [load]);

  usePollingRefresh(load, REFRESH_INTERVAL_MS, { skipWhilePending: true });

  return (
    <section aria-label="Calendar" className="rounded-lg border border-border bg-card p-4">
      <Link
        to="/calendar"
        className="mb-3 inline-flex rounded-sm text-sm font-semibold text-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
      >
        Calendar
      </Link>
      <div>
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

        {status === "error" && (
          <p className="text-xs text-muted-foreground">Could not load Calendar.</p>
        )}

        {status === "ready" && events.length === 0 && (
          <p className="text-xs text-muted-foreground">No upcoming events.</p>
        )}

        {status === "ready" && events.length > 0 && (
          <div
            role="region"
            aria-label="Upcoming calendar events"
            tabIndex={0}
            className="flex max-h-56 flex-col gap-1 overflow-y-auto pr-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
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
    </section>
  );
}
