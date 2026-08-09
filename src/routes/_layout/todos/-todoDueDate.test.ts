import { format, parseISO } from "date-fns";
import { describe, expect, it } from "vitest";

import { formatTodoDueDate, toTodoDueDate } from "./-todoDueDate";

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
});
