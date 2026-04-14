import type { CalendarEvent } from "./-calendar.api";

function eventStartDate(event: CalendarEvent): Date {
  if (event.start.dateTime) return new Date(event.start.dateTime);
  if (event.start.date) {
    const [y, m, d] = event.start.date.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(0);
}

function eventStartIsoDate(event: CalendarEvent): string {
  if (event.start.date) return event.start.date;
  if (event.start.dateTime) {
    const d = new Date(event.start.dateTime);
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  }
  return "1970-01-01";
}

/**
 * Returns up to `limit` events whose start is on or after `from`.
 * Assumes events are already sorted ascending by start time.
 */
export function getUpcomingEvents(
  events: CalendarEvent[],
  from: Date,
  limit: number,
): CalendarEvent[] {
  return events.filter((e) => eventStartDate(e) >= from).slice(0, limit);
}

export interface DayGroup {
  isoDate: string;
  events: CalendarEvent[];
}

/**
 * Groups events by their start day.
 * Input must be sorted ascending by start time.
 */
export function groupEventsByDay(events: CalendarEvent[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const event of events) {
    const iso = eventStartIsoDate(event);
    const last = groups[groups.length - 1];
    if (last && last.isoDate === iso) {
      last.events.push(event);
    } else {
      groups.push({ isoDate: iso, events: [event] });
    }
  }
  return groups;
}

/** Returns a localized time string (e.g. "9:00 AM") for timed events, or "All day". */
export function formatEventTime(event: CalendarEvent): string {
  if (!event.start.dateTime) return "All day";
  return new Date(event.start.dateTime).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
