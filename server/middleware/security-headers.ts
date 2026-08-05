import { defineMiddleware } from "nitro";

const securityHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
} as const;

export default defineMiddleware((event) => {
  for (const [name, value] of Object.entries(securityHeaders)) {
    event.res.headers.set(name, value);
  }
});
