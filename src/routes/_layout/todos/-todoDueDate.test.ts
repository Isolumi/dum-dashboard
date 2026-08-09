import { format, parseISO } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatTodoDueDate,
  getTodoDueDateCalendarKey,
  getTodoDueDateInputValues,
  isTodoDueDateOverdue,
  toTodoDueDate,
} from "./-todoDueDate";

afterEach(() => {
  vi.useRealTimers();
});

describe("todo due date helpers", () => {
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

    expect(formatTodoDueDate(value)).toBe(format(new Date(value), "MMM d, h:mm a"));
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
