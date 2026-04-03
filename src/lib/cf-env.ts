import { AsyncLocalStorage } from "node:async_hooks";

type CfEnv = Record<string, string | undefined>;

const storage = new AsyncLocalStorage<CfEnv>();

export const runWithCfEnv = <T>(env: CfEnv, fn: () => T): T =>
  storage.run(env, fn) as T;

export const getCfEnv = (): CfEnv => storage.getStore() ?? {};
