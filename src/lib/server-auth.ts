import { createServerOnlyFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";

import { requireServerEnv } from "./runtime-env";

export const noStore = createServerOnlyFn(() => {
  setResponseHeader("Cache-Control", "no-store");
});

export const getOwnerUser = createServerOnlyFn((): { id: string } => {
  return { id: requireServerEnv("OWNER_USER_ID") };
});

export const assertSameOrigin = createServerOnlyFn((): void => {
  const origin = getRequestHeader("origin");
  const host = getRequestHeader("host");
  if (!origin || !host || new URL(origin).host !== host) {
    throw new Error("Cross-origin request rejected");
  }
});
