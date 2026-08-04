import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { runWithCfEnv } from "#/lib/cf-env";

const handler = createStartHandler(defaultStreamHandler);

const SECURITY_HEADERS = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
} as const;

export default {
  async fetch(request: Request, env: Record<string, string | undefined>) {
    const response = await runWithCfEnv(env, () => handler(request));
    const headers = new Headers(response.headers);

    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      headers.set(name, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
