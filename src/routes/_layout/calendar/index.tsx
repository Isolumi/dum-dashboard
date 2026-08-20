import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "#/components/ui/button";
import { Calendar } from "#/components/ui/calendar";
import { Skeleton } from "#/components/ui/skeleton";
import { usePollingRefresh } from "#/hooks/usePollingRefresh";
import type { CalendarEvent } from "./-calendar.api";
import { getCalendarEvents, startCalendarOAuth } from "./-calendar.functions";
import {
  type DayGroup,
  formatCalendarDateLabel,
  formatEventTime,
  getUpcomingEvents,
  groupEventsByDay,
} from "./-calendarUtils";

export const Route = createFileRoute("/_layout/calendar/")({
  component: CalendarPage,
});

type PageStatus = "loading" | "ready" | "disconnected" | "auth_expired" | "error";

const REFRESH_INTERVAL_MS = 10_000;

function CalendarPage() {
  const today = useMemo(() => new Date(), []);

  const [currentMonth, setCurrentMonth] = useState<Date>(today);
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [status, setStatus] = useState<PageStatus>("loading");
  const [connecting, setConnecting] = useState(false);
  const loadRequestRef = useRef(0);

  const load = useCallback(
    async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
      const requestId = ++loadRequestRef.current;
      if (showLoading) setStatus("loading");

      const timeMin = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const timeMax = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);

      try {
        const result = await getCalendarEvents({
          data: {
            time_min: timeMin.toISOString(),
            time_max: timeMax.toISOString(),
          },
        });
        if (requestId !== loadRequestRef.current) return;
        setEvents(result.events);
        setStatus(result.status === "ready" ? "ready" : result.status);
      } catch (err: unknown) {
        if (requestId !== loadRequestRef.current) return;
        const e = err as { type?: string };
        setStatus(e?.type === "auth_expired" ? "auth_expired" : "error");
      }
    },
    [currentMonth],
  );

  async function handleConnectCalendar() {
    setConnecting(true);
    try {
      const { authorizationUrl } = await startCalendarOAuth();
      window.location.href = authorizationUrl;
    } catch {
      setStatus("error");
      setConnecting(false);
    }
  }

  // Initial load + reload when month changes
  useEffect(() => {
    void load();
    return () => {
      loadRequestRef.current += 1;
    };
  }, [load]);

  usePollingRefresh(() => load({ showLoading: false }), REFRESH_INTERVAL_MS);

  const eventDates = useMemo(
    () =>
      events
        .map((e) => {
          if (e.start.date) {
            const [y, m, d] = e.start.date.split("-").map(Number);
            return new Date(y, m - 1, d);
          }
          if (e.start.dateTime) {
            const dt = new Date(e.start.dateTime);
            return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
          }
          return null;
        })
        .filter(Boolean) as Date[],
    [events],
  );

  const upcomingGroups: DayGroup[] = useMemo(() => {
    const from = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate());
    return groupEventsByDay(getUpcomingEvents(events, from, 5));
  }, [events, selectedDay]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">Calendar</h1>

      {(status === "disconnected" || status === "auth_expired") && (
        <div className="flex flex-col items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            {status === "disconnected"
              ? "Google Calendar is not connected yet."
              : "Your Google Calendar connection needs to be refreshed."}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleConnectCalendar()}
            disabled={connecting}
          >
            {connecting ? "Connecting..." : "Connect Google Calendar"}
          </Button>
        </div>
      )}

      {status === "error" && (
        <p className="text-sm text-destructive">Could not load calendar events. Try refreshing.</p>
      )}

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* Left: month grid */}
        <div className="shrink-0">
          {status === "loading" ? (
            <Skeleton className="h-72 w-72 rounded-md" />
          ) : (
            <Calendar
              mode="single"
              selected={selectedDay}
              onSelect={(day) => day && setSelectedDay(day)}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              modifiers={{ hasEvent: eventDates }}
              modifiersClassNames={{
                hasEvent:
                  "after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:size-1 after:rounded-full after:bg-primary",
              }}
            />
          )}
        </div>

        {/* Right: event list */}
        <div className="flex-1 md:border-l md:border-border md:pl-6">
          {status === "loading" && (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          )}

          {status === "ready" && upcomingGroups.length === 0 && (
            <p className="text-sm text-muted-foreground">No upcoming events.</p>
          )}

          {status === "ready" && upcomingGroups.length > 0 && (
            <div className="flex flex-col gap-4">
              {upcomingGroups.map((group) => (
                <div key={group.isoDate}>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {formatCalendarDateLabel(group.isoDate)}
                  </div>
                  <div className="flex flex-col gap-1">
                    {group.events.map((event) => (
                      <div key={event.id} className="flex items-center gap-3">
                        <div className="h-9 w-0.5 shrink-0 rounded-full bg-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-foreground">{event.summary}</p>
                          <p className="text-xs text-muted-foreground">{formatEventTime(event)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
