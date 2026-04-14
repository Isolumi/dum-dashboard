import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Calendar } from "#/components/ui/calendar";
import { Skeleton } from "#/components/ui/skeleton";
import { signInWithGoogle } from "#/lib/auth";
import { supabase } from "#/lib/supabase";
import { type CalendarEvent, fetchCalendarEvents } from "./-calendar.api";
import {
  type DayGroup,
  formatEventTime,
  getUpcomingEvents,
  groupEventsByDay,
} from "./-calendarUtils";

export const Route = createFileRoute("/_layout/calendar/")({
  component: CalendarPage,
});

type PageStatus = "loading" | "ready" | "auth_expired" | "error";

function formatDayLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function CalendarPage() {
  const today = useMemo(() => new Date(), []);

  const [currentMonth, setCurrentMonth] = useState<Date>(today);
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [status, setStatus] = useState<PageStatus>("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.provider_token;

    if (!token) {
      setStatus("auth_expired");
      return;
    }

    const timeMin = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const timeMax = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);

    try {
      const fetched = await fetchCalendarEvents(token, timeMin, timeMax);
      setEvents(fetched);
      setStatus("ready");
    } catch (err: unknown) {
      const e = err as { type?: string };
      setStatus(e?.type === "auth_expired" ? "auth_expired" : "error");
    }
  }, [currentMonth]);

  // Initial load + reload when month changes
  useEffect(() => {
    void load();
  }, [load]);

  // Poll every 5 minutes so the calendar stays fresh without manual refresh
  useEffect(() => {
    const id = setInterval(() => void load(), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

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
    const from = new Date(
      selectedDay.getFullYear(),
      selectedDay.getMonth(),
      selectedDay.getDate(),
    );
    return groupEventsByDay(getUpcomingEvents(events, from, 5));
  }, [events, selectedDay]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">Calendar</h1>

      {status === "auth_expired" && (
        <div className="flex flex-col items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">Your calendar session has expired.</p>
          <button
            className="text-sm font-medium text-destructive underline underline-offset-2 hover:no-underline"
            onClick={() => void signInWithGoogle()}
          >
            Reconnect Calendar
          </button>
        </div>
      )}

      {status === "error" && (
        <p className="text-sm text-destructive">
          Could not load calendar events. Try refreshing.
        </p>
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
                    {formatDayLabel(group.isoDate)}
                  </div>
                  <div className="flex flex-col gap-1">
                    {group.events.map((event) => (
                      <div key={event.id} className="flex items-center gap-3">
                        <div className="h-9 w-0.5 shrink-0 rounded-full bg-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-foreground">{event.summary}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatEventTime(event)}
                          </p>
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
