import { describe, expect, it } from "vitest";

import { normalizePodLogCursor, podLogCursorFromLine } from "./log-cursor";

describe("pod log cursor", () => {
  it.each([
    "2026-08-04T12:00:00Z",
    "2028-02-29T12:00:00Z",
    "2026-08-04T12:00:00.123456789Z",
    "2026-08-04T12:00:00.123+05:30",
  ])("accepts a bounded RFC3339 timestamp %s without rewriting it", (cursor) => {
    expect(normalizePodLogCursor(cursor)).toBe(cursor);
  });

  it.each([
    "",
    "../../secret",
    "2026-99-99T12:00:00Z",
    "2026-02-29T12:00:00Z",
    "2026-02-31T12:00:00Z",
    "2026-08-04 12:00:00Z",
    "2026-08-04T12:00:00",
    `2026-08-04T12:00:00.${"1".repeat(10)}Z`,
  ])("rejects malformed cursor %s", (cursor) => {
    expect(normalizePodLogCursor(cursor)).toBeNull();
  });

  it("extracts only a strict leading timestamp and leaves malformed lines cursorless", () => {
    expect(podLogCursorFromLine("2026-08-04T12:00:00.123456789Z request complete")).toBe(
      "2026-08-04T12:00:00.123456789Z",
    );
    expect(podLogCursorFromLine("request at 2026-08-04T12:00:00Z")).toBeNull();
    expect(podLogCursorFromLine("../../secret log line")).toBeNull();
  });
});
