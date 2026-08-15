import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

const repoRoot = process.cwd();
const tokenName = ["MONIES", "API", "TOKEN"].join("_");
const viteTokenName = ["VITE", "MONIES", "API", "TOKEN"].join("_");
const privateHost = ["monies", "monies", "svc", "cluster", "local"].join(".");
const originalFiles = new Map<string, string>();
const createdFiles = new Set<string>();

const runChecker = () =>
  spawnSync("bash", ["scripts/check-monies-manifests.sh"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      MONIES_PUBLIC_DIR: join(repoRoot, ".output/public"),
    },
  });

const mutateTrackedFile = async (relativePath: string, mutation: string): Promise<void> => {
  const path = join(repoRoot, relativePath);
  const original = await readFile(path, "utf8");
  originalFiles.set(path, original);
  await writeFile(path, `${original}\n${mutation}\n`);
};

const createBuiltArtifact = async (name: string, contents: string): Promise<string> => {
  const relativePath = `.output/public/${name}`;
  const path = join(repoRoot, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
  createdFiles.add(path);
  return relativePath;
};

const expectRejected = (result: ReturnType<typeof runChecker>, relativePath: string): void => {
  expect(result.status).not.toBe(0);
  expect(`${result.stdout}\n${result.stderr}`).toContain(relativePath);
};

beforeEach(async () => {
  await mkdir(join(repoRoot, ".output/public"), { recursive: true });
});

afterEach(async () => {
  await Promise.all([...originalFiles].map(([path, contents]) => writeFile(path, contents)));
  originalFiles.clear();
  await Promise.all([...createdFiles].map((path) => rm(path, { force: true })));
  createdFiles.clear();
});

describe("Monies client-secret guard mutations", () => {
  test("rejects a Monies VITE token reference outside the route layout", async () => {
    const relativePath = "src/components/AppSidebar.tsx";
    await mutateTrackedFile(
      relativePath,
      `export const task12Mutation = import.meta.env.${viteTokenName};`,
    );

    expectRejected(runChecker(), relativePath);
  });

  test("rejects a Monies VITE token reference in Vite configuration", async () => {
    const relativePath = "vite.config.ts";
    await mutateTrackedFile(
      relativePath,
      `export const task12Mutation = import.meta.env.${viteTokenName};`,
    );

    expectRejected(runChecker(), relativePath);
  });

  test("rejects a token assignment in the tracked production environment file", async () => {
    const relativePath = ".env.production";
    await mutateTrackedFile(relativePath, `${tokenName}=committed-test-value`);

    expectRejected(runChecker(), relativePath);
  });

  test("rejects a tracked unrendered Kubernetes Secret with the Monies API token", async () => {
    const relativePath = "k8s/argocd/dum-dashboard.yml";
    await mutateTrackedFile(
      relativePath,
      [
        "---",
        "apiVersion: v1",
        "kind: Secret",
        "metadata:",
        "  name: task12-token-mutation",
        "  namespace: dum-dashboard",
        "stringData:",
        `  ${tokenName}: committed-test-value`,
      ].join("\n"),
    );

    expectRejected(runChecker(), relativePath);
  });

  test("rejects committed Universal Auth credentials in an unrendered Secret", async () => {
    const relativePath = "k8s/argocd/dum-dashboard.yml";
    await mutateTrackedFile(
      relativePath,
      [
        "---",
        "apiVersion: v1",
        "kind: Secret",
        "metadata:",
        "  name: dum-dashboard-monies-infisical-auth-credentials",
        "  namespace: dum-dashboard",
        "stringData:",
        "  clientId: committed-test-client",
        "  clientSecret: committed-test-secret",
      ].join("\n"),
    );

    expectRejected(runChecker(), relativePath);
  });

  test.each([
    ["raw token name", tokenName],
    ["Monies VITE token name", viteTokenName],
    ["private Monies host", privateHost],
  ])("rejects a built public artifact containing the %s", async (_label, value) => {
    const relativePath = await createBuiltArtifact(
      `task12-${value.toLowerCase().replaceAll("_", "-")}.js`,
      `globalThis.task12Mutation = ${JSON.stringify(value)};`,
    );

    expectRejected(runChecker(), relativePath);
  });

  test("allows the server-only process environment token reference", async () => {
    const relativePath = "src/lib/monies-api.ts";
    await mutateTrackedFile(
      relativePath,
      `export const task12ServerMutation = process.env.${tokenName};`,
    );

    const result = runChecker();
    expect(result.status).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "Monies manifests and client-secret boundary: PASS",
    );
  });
});
