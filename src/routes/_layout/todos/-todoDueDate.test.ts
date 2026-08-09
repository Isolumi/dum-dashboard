import { format, parseISO } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";

import { formatTodoDueDate, isTodoDueDateOverdue, toTodoDueDate } from "./-todoDueDate";

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

  it("treats timestamp values as overdue once the timestamp is in the past even on the same UTC day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T04:30:00.000Z"));

    expect(isTodoDueDateOverdue("2026-08-09T03:30:00.000Z")).toBe(true);
  });
});
