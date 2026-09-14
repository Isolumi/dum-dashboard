import { describe, expect, it } from "vitest";

import { assertValidToolTokenConfig, hasValidToolBearer } from "./tool-api-auth";

const TOKEN = "0123456789abcdef0123456789abcdef";

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
