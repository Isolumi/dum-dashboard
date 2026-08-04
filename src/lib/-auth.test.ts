import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("signInWithGoogle", () => {
  it("keeps dashboard login separate from Google Calendar API consent", () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const source = readFileSync(resolve(__dirname, "auth.ts"), "utf-8");
    expect(source, "dashboard login must not request Calendar API scope").not.toContain(
      "https://www.googleapis.com/auth/calendar.readonly",
    );
    expect(source, "dashboard login must not request offline Google API access").not.toContain(
      "access_type",
    );
  });
});
