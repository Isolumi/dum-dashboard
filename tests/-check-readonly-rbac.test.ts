import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

type Fixture = {
  binDir: string;
  normalRenderedPath: string;
  root: string;
};

const repoRoot = process.cwd();
const checkerPath = join(repoRoot, "scripts/check-readonly-rbac.sh");
const normalOverlayPath = join(repoRoot, "k8s/overlays/dumachine");
const kubectlLookup = spawnSync("which", ["kubectl"], { encoding: "utf8" });
if (kubectlLookup.status !== 0) throw new Error("kubectl is required for readonly RBAC tests.");
const realKubectlPath = kubectlLookup.stdout.trim();

const createFixture = async (): Promise<Fixture> => {
  const root = await mkdtemp(join(tmpdir(), "dum-dashboard-readonly-rbac-check-"));
  const binDir = join(root, "bin");
  const normalRenderedPath = join(root, "normal-rendered.yml");
  await mkdir(binDir);

  const rendered = spawnSync(realKubectlPath, ["kustomize", normalOverlayPath], {
    encoding: "utf8",
  });
  if (rendered.status !== 0) {
    throw new Error(rendered.stderr || "Could not render the normal dashboard overlay.");
  }
  await writeFile(normalRenderedPath, rendered.stdout);

  const kubectlShimPath = join(binDir, "kubectl");
  await writeFile(
    kubectlShimPath,
    [
      "#!/usr/bin/env bash",
      'if [[ "$1" == "kustomize" && "$2" == "$NORMAL_OVERLAY_PATH" ]]; then',
      '  command cat "$NORMAL_RENDERED_PATH"',
      "  exit 0",
      "fi",
      'exec "$REAL_KUBECTL_PATH" "$@"',
      "",
    ].join("\n"),
  );
  await chmod(kubectlShimPath, 0o755);

  return { binDir, normalRenderedPath, root };
};

const replaceRenderedManifest = async (
  fixture: Fixture,
  from: string,
  to: string,
): Promise<void> => {
  const original = await readFile(fixture.normalRenderedPath, "utf8");
  if (!original.includes(from)) throw new Error(`Rendered fixture does not contain ${from}`);
  await writeFile(fixture.normalRenderedPath, original.replace(from, to));
};

const appendRenderedManifest = async (fixture: Fixture, manifest: string): Promise<void> => {
  const original = await readFile(fixture.normalRenderedPath, "utf8");
  await writeFile(fixture.normalRenderedPath, `${original}\n${manifest}\n`);
};

const runChecker = (fixture: Fixture) =>
  spawnSync("bash", [checkerPath], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      NORMAL_OVERLAY_PATH: normalOverlayPath,
      NORMAL_RENDERED_PATH: fixture.normalRenderedPath,
      PATH: `${fixture.binDir}:${process.env.PATH ?? ""}`,
      REAL_KUBECTL_PATH: realKubectlPath,
    },
  });

const checkerOutput = (result: ReturnType<typeof runChecker>): string =>
  [result.stdout, result.stderr].filter(Boolean).join("\n");

let fixture: Fixture;

beforeEach(async () => {
  fixture = await createFixture();
});

afterEach(async () => {
  await rm(fixture.root, { force: true, recursive: true });
});

describe("readonly RBAC dashboard ingress contract", () => {
  test("accepts the exact current two-peer dashboard ingress policy", () => {
    const result = runChecker(fixture);

    expect(result.status, checkerOutput(result)).toBe(0);
  });

  test("accepts the approved ingress peers in either order", async () => {
    await replaceRenderedManifest(
      fixture,
      `    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
      podSelector:
        matchLabels:
          app.kubernetes.io/instance: traefik-kube-system
          app.kubernetes.io/name: traefik
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: uwumi
      podSelector:
        matchLabels:
          app: dumq-mcp`,
      `    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: uwumi
      podSelector:
        matchLabels:
          app: dumq-mcp
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
      podSelector:
        matchLabels:
          app.kubernetes.io/instance: traefik-kube-system
          app.kubernetes.io/name: traefik`,
    );

    const result = runChecker(fixture);

    expect(result.status, checkerOutput(result)).toBe(0);
  });

  test.each([
    [
      "a missing DumQ MCP peer",
      `    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: uwumi
      podSelector:
        matchLabels:
          app: dumq-mcp`,
      "",
    ],
    [
      "an additional peer",
      `          app: dumq-mcp
    ports:`,
      `          app: dumq-mcp
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: other
      podSelector:
        matchLabels:
          app: other
    ports:`,
    ],
    [
      "a widened DumQ MCP namespace selector",
      `    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: uwumi`,
      "    - namespaceSelector: {}",
    ],
    [
      "a changed DumQ MCP namespace selector",
      "kubernetes.io/metadata.name: uwumi",
      "kubernetes.io/metadata.name: default",
    ],
    [
      "a widened DumQ MCP pod selector",
      `      podSelector:
        matchLabels:
          app: dumq-mcp`,
      "      podSelector: {}",
    ],
    ["a changed DumQ MCP pod selector", "app: dumq-mcp", "app: uwumi"],
    [
      "a changed dashboard pod selector",
      `  podSelector:
    matchLabels:
      app.kubernetes.io/component: dashboard
      app.kubernetes.io/name: dum-dashboard
  policyTypes:
  - Ingress
---`,
      `  podSelector:
    matchLabels:
      app.kubernetes.io/component: gateway
      app.kubernetes.io/name: dum-dashboard
  policyTypes:
  - Ingress
---`,
    ],
    [
      "a widened port protocol",
      `    - port: 3000
      protocol: TCP`,
      `    - port: 3000
      protocol: UDP`,
    ],
  ])("rejects %s", async (_label, from, to) => {
    await replaceRenderedManifest(fixture, from, to);

    const result = runChecker(fixture);

    expect(result.status, checkerOutput(result)).not.toBe(0);
  });

  test("rejects an additional ingress policy that selects dashboard pods", async () => {
    await appendRenderedManifest(
      fixture,
      `---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: dashboard-broad-ingress
  namespace: dum-dashboard
spec:
  podSelector: {}
  policyTypes:
    - Ingress
  ingress:
    - {}`,
    );

    const result = runChecker(fixture);

    expect(result.status, checkerOutput(result)).not.toBe(0);
  });
});
