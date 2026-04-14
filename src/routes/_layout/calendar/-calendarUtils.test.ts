import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "./-calendar.api";
import { formatEventTime, getUpcomingEvents, groupEventsByDay } from "./-calendarUtils";

function makeEvent(
  id: string,
  summary: string,
  start: CalendarEvent["start"],
): CalendarEvent {
  return { id, summary, start, end: {} };
}

describe("getUpcomingEvents", () => {
  const events: CalendarEvent[] = [
    makeEvent("1", "Past", { dateTime: "2026-04-10T10:00:00" }),
    makeEvent("2", "Today", { dateTime: "2026-04-14T10:00:00" }),
    makeEvent("3", "Future", { dateTime: "2026-04-15T10:00:00" }),
  ];

  it("returns events whose start is on or after the from date", () => {
    const result = getUpcomingEvents(events, new Date("2026-04-14T00:00:00"), 10);
    expect(result.map((e) => e.id)).toEqual(["2", "3"]);
  });

  it("respects the limit", () => {
    const result = getUpcomingEvents(events, new Date("2026-04-10T00:00:00"), 2);
    expect(result).toHaveLength(2);
  });

  it("returns empty array when no events match", () => {
    const result = getUpcomingEvents(events, new Date("2026-12-01T00:00:00"), 5);
    expect(result).toEqual([]);
  });

  it("handles all-day events using the date field", () => {
    const allDay = makeEvent("4", "Holiday", { date: "2026-04-14" });
    const result = getUpcomingEvents([allDay], new Date("2026-04-14T00:00:00"), 5);
    expect(result).toHaveLength(1);
  });
});

describe("groupEventsByDay", () => {
  it("groups timed events by their local date", () => {
    const events = [
      makeEvent("1", "Morning", { dateTime: "2026-04-14T09:00:00" }),
      makeEvent("2", "Afternoon", { dateTime: "2026-04-14T14:00:00" }),
      makeEvent("3", "Next day", { dateTime: "2026-04-15T10:00:00" }),
    ];
    const groups = groupEventsByDay(events);
    expect(groups).toHaveLength(2);
    expect(groups[0].events).toHaveLength(2);
    expect(groups[1].events).toHaveLength(1);
  });

  it("handles all-day events using the date field", () => {
    const events = [makeEvent("1", "Holiday", { date: "2026-04-14" })];
    const groups = groupEventsByDay(events);
    expect(groups).toHaveLength(1);
    expect(groups[0].isoDate).toBe("2026-04-14");
  });

  it("returns empty array for empty input", () => {
    expect(groupEventsByDay([])).toEqual([]);
  });
});

describe("formatEventTime", () => {
  it("returns 'All day' for all-day events (no dateTime)", () => {
    const event = makeEvent("1", "X", { date: "2026-04-14" });
    expect(formatEventTime(event)).toBe("All day");
  });

  it("returns a non-empty time string for timed events", () => {
    const event = makeEvent("1", "X", { dateTime: "2026-04-14T09:00:00" });
    const result = formatEventTime(event);
    expect(result).not.toBe("All day");
    expect(result.length).toBeGreaterThan(0);
  });
});
