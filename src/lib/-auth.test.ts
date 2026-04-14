import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("signInWithGoogle", () => {
  it("requests calendar.readonly scope", () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const source = readFileSync(resolve(__dirname, "auth.ts"), "utf-8");
    expect(source, "auth.ts must request calendar.readonly scope").toContain(
      "https://www.googleapis.com/auth/calendar.readonly",
    );
  });
});
