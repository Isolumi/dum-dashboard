import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { runWithCfEnv } from "#/lib/cf-env";

const handler = createStartHandler(defaultStreamHandler);

export default {
  fetch(request: Request, env: Record<string, string | undefined>) {
    return runWithCfEnv(env, () => handler(request));
  },
};
