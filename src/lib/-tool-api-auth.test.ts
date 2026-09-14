import { describe, expect, it } from "vitest";

import { assertValidToolTokenConfig, hasValidToolBearer } from "./tool-api-auth";

const TOKEN = "0123456789abcdef0123456789abcdef";
const SAME_LENGTH_WRONG_TOKEN = "0123456789abcdef0123456789abcdee";

describe("tool API bearer authentication", () => {
  it.each([undefined, "", "Basic abc", "Bearer", "Bearer wrong"])("rejects %s", (authorization) => {
    const request = new Request("http://dumq/api/tools/todos", {
      headers: authorization ? { authorization } : {},
    });

    expect(hasValidToolBearer(request, TOKEN)).toBe(false);
  });

  it("accepts one exact bearer token", () => {
    const request = new Request("http://dumq/api/tools/todos", {
      headers: { authorization: `Bearer ${TOKEN}` },
    });

    expect(hasValidToolBearer(request, TOKEN)).toBe(true);
  });

  it("rejects an incorrect bearer token with the same UTF-8 byte length", () => {
    expect(Buffer.byteLength(TOKEN, "utf8")).toBe(32);
    expect(Buffer.byteLength(SAME_LENGTH_WRONG_TOKEN, "utf8")).toBe(32);
    expect(SAME_LENGTH_WRONG_TOKEN).not.toBe(TOKEN);

    const request = new Request("http://dumq/api/tools/todos", {
      headers: { authorization: `Bearer ${SAME_LENGTH_WRONG_TOKEN}` },
    });

    expect(hasValidToolBearer(request, TOKEN)).toBe(false);
  });

  it.each([
    ["a lowercase scheme", `bearer ${TOKEN}`],
    ["two spaces after the scheme", `Bearer  ${TOKEN}`],
    ["leading horizontal whitespace before the token", `Bearer \t${TOKEN}`],
  ])("rejects malformed bearer grammar with %s", (_case, authorization) => {
    const request = new Request("http://dumq/api/tools/todos", {
      headers: { authorization },
    });

    expect(hasValidToolBearer(request, TOKEN)).toBe(false);
  });

  it("rejects a UTF-8 byte-length mismatch without throwing", () => {
    const request = new Request("http://dumq/api/tools/todos", {
      headers: { authorization: `Bearer ${"\u00e9".repeat(32)}` },
    });

    expect(() => hasValidToolBearer(request, TOKEN)).not.toThrow();
    expect(hasValidToolBearer(request, TOKEN)).toBe(false);
  });
});

describe("tool API token configuration", () => {
  it("rejects configured secrets shorter than 32 UTF-8 bytes", () => {
    expect(() => assertValidToolTokenConfig("a".repeat(31))).toThrow(
      "DUMQ_TOOL_TOKEN must contain at least 32 bytes",
    );
    expect(() => assertValidToolTokenConfig(`${"\u00e9".repeat(15)}a`)).toThrow(
      "DUMQ_TOOL_TOKEN must contain at least 32 bytes",
    );
  });

  it("accepts configured secrets of at least 32 UTF-8 bytes", () => {
    expect(() => assertValidToolTokenConfig(TOKEN)).not.toThrow();
    expect(() => assertValidToolTokenConfig("\u00e9".repeat(16))).not.toThrow();
  });
});
