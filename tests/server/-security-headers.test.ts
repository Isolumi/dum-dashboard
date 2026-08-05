import { createApp, defineEventHandler } from "h3";
import { describe, expect, it } from "vitest";
import securityHeaders from "../../server/middleware/security-headers";

const expectedHeaders = {
  "cross-origin-opener-policy": "same-origin",
  "permissions-policy": "camera=(), geolocation=(), microphone=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
} as const;

describe("dashboard security headers", () => {
  it("adds every security header to a response", async () => {
    const app = createApp();
    app.use(securityHeaders);
    app.use(defineEventHandler(() => "ok"));

    const response = await app.fetch(new Request("http://dashboard.test/"));

    expect(response.status).toBe(200);

    for (const [name, value] of Object.entries(expectedHeaders)) {
      expect(response.headers.get(name)).toBe(value);
    }
  });
});
