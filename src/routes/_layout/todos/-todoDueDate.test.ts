import { format, parseISO } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatTodoDueDate,
  formatTodoDueDateLabel,
  formatTodoPastDateLabel,
  getTodoDueDateUrgency,
  getTodoDueDateCalendarKey,
  getTodoDueDateInputValues,
  isTodoDueDateOverdue,
  toTodoDueDate,
} from "./-todoDueDate";

afterEach(() => {
  vi.useRealTimers();
});

describe("todo due date helpers", () => {
  it.each([
    ["2026-08-09", "Today"],
    ["2026-08-08", "Yesterday"],
    ["2026-08-07", "2 days ago"],
    ["2026-08-06", "3 days ago"],
    ["2025-08-09", "365 days ago"],
  ])("shows elapsed calendar days for %s", (value, expected) => {
    expect(formatTodoPastDateLabel(value, false, new Date(2026, 7, 9, 12))).toBe(expected);
  });

  it("keeps a past deadline's local 24-hour time", () => {
    expect(
      formatTodoPastDateLabel(
        new Date(2026, 7, 8, 23, 5).toISOString(),
        true,
        new Date(2026, 7, 9, 12),
      ),
    ).toBe("Yesterday · 23:05");
  });

  it("counts elapsed calendar days across daylight saving", () => {
    expect(formatTodoPastDateLabel("2026-03-07", false, new Date(2026, 2, 9, 12))).toBe(
      "2 days ago",
    );
  });

  it("preserves the calendar key of a migrated date-only deadline", () => {
    expect(
      formatTodoPastDateLabel("2026-08-08T00:00:00.000Z", false, new Date(2026, 7, 9, 12)),
    ).toBe("Yesterday");
  });
  it.each([
    ["2026-08-09", "Due today"],
    ["2026-08-10", "Due tomorrow"],
    ["2026-08-11", "Due Tuesday"],
    ["2026-08-15", "Due Saturday"],
    ["2026-08-16", "Due Aug 16"],
    ["2027-08-09", "Due Aug 9, 2027"],
    [null, ""],
  ])("labels %s relative to local calendar days", (value, expected) => {
    expect(formatTodoDueDateLabel(value, false, new Date(2026, 7, 9, 12))).toBe(expected);
  });

  it("keeps the local time in a relative label", () => {
    const value = new Date(2026, 7, 10, 15, 30).toISOString();
    expect(formatTodoDueDateLabel(value, true, new Date(2026, 7, 9, 12))).toBe(
      "Due tomorrow, 15:30",
    );
  });

  it("counts calendar days across the daylight saving change", () => {
    expect(formatTodoDueDateLabel("2026-03-09", false, new Date(2026, 2, 7, 23, 59))).toBe(
      "Due Monday",
    );
  });

  it("preserves the UTC calendar key for migrated date-only labels", () => {
    expect(
      formatTodoDueDateLabel("2026-08-09T23:30:00-04:00", false, new Date(2026, 7, 9, 12)),
    ).toBe("Due tomorrow");
  });

  it.each([
    ["2026-08-08", "overdue"],
    ["2026-08-09", "soon"],
    ["2026-08-10", "soon"],
    ["2026-08-11", "later"],
    [null, "later"],
  ])("classifies urgency for %s", (value, expected) => {
    expect(getTodoDueDateUrgency(value, false, new Date(2026, 7, 9, 12))).toBe(expected);
  });

  it("makes a timed item overdue once its deadline passes", () => {
    const value = new Date(2026, 7, 9, 11, 59).toISOString();
    expect(getTodoDueDateUrgency(value, true, new Date(2026, 7, 9, 12))).toBe("overdue");
  });

  it("returns an empty string for a missing due date", () => {
    expect(formatTodoDueDate(null)).toBe("");
  });

  it("keeps date-only values displayable", () => {
    expect(formatTodoDueDate("2026-08-09")).toBe(format(parseISO("2026-08-09"), "MMM d"));
  });

  it("converts typed local date and time into an ISO timestamp", () => {
    const result = toTodoDueDate("2026-08-09", "15:30");

    expect(new Date(result).toISOString()).toBe(result);
    expect(result).toBe(new Date(2026, 7, 9, 15, 30).toISOString());
  });

  it("formats timestamp values with a local time", () => {
    const value = "2026-08-09T19:30:00.000Z";

    expect(formatTodoDueDate(value)).toBe(format(new Date(value), "MMM d, HH:mm"));
  });

  it.each([
    [0, "00:05"],
    [12, "12:05"],
    [23, "23:05"],
  ])("uses 24-hour time at hour %s", (hour, expected) => {
    const value = new Date(2026, 7, 9, hour, 5).toISOString();
    expect(formatTodoDueDateLabel(value, true, new Date(2026, 7, 9, 12))).toBe(
      `Due today, ${expected}`,
    );
  });

  it("preserves a migrated date-only timestamp when metadata says it has no time", () => {
    const value = "2026-08-09T00:00:00.000Z";

    expect(formatTodoDueDate(value, false)).toBe(format(parseISO("2026-08-09"), "MMM d"));
    expect(getTodoDueDateInputValues(value, false)).toEqual({
      dateValue: "2026-08-09",
      timeValue: "",
    });
  });

  it("uses the same UTC calendar key for date-only display and sorting", () => {
    expect(getTodoDueDateCalendarKey("2026-08-09T23:30:00-04:00")).toBe("2026-08-10");
  });

  it("uses the UTC calendar date for date-only metadata regardless of timestamp offset", () => {
    const value = "2026-08-09T23:30:00-04:00";

    expect(formatTodoDueDate(value, false)).toBe(format(parseISO("2026-08-10"), "MMM d"));
    expect(getTodoDueDateInputValues(value, false)).toEqual({
      dateValue: "2026-08-10",
      timeValue: "",
    });
  });

  it("infers precision for old API values only from a date-only string", () => {
    expect(getTodoDueDateInputValues("2026-08-09")).toEqual({
      dateValue: "2026-08-09",
      timeValue: "",
    });
    expect(getTodoDueDateInputValues("2026-08-09T00:00:00.000Z").timeValue).not.toBe("");
  });

  it("treats a migrated date-only timestamp as overdue only after its local day ends", () => {
    const value = "2026-08-09T00:00:00.000Z";

    expect(isTodoDueDateOverdue(value, false, new Date(2026, 7, 9, 12))).toBe(false);
    expect(isTodoDueDateOverdue(value, false, new Date(2026, 7, 10, 0))).toBe(true);
  });

  it("treats timestamp values as overdue once the timestamp is in the past even on the same UTC day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T04:30:00.000Z"));

    expect(isTodoDueDateOverdue("2026-08-09T03:30:00.000Z")).toBe(true);
  });
});
