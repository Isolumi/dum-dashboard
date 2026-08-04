import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";

import { requireServerEnv } from "./runtime-env";

export function noStore() {
  setResponseHeader("Cache-Control", "no-store");
}

export function getOwnerUser(): { id: string } {
  return { id: requireServerEnv("OWNER_USER_ID") };
}

export function assertSameOrigin(): void {
  const origin = getRequestHeader("origin");
  const host = getRequestHeader("host");
  if (!origin || !host || new URL(origin).host !== host) {
    throw new Error("Cross-origin request rejected");
  }
}
