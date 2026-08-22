import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { checkMoniesRepository } from "../scripts/check-monies-manifests";

const tokenName = ["MONIES", "API", "TOKEN"].join("_");
const viteTokenName = ["VITE", "MONIES", "API", "TOKEN"].join("_");
const privateHost = ["monies", "monies", "svc", "cluster", "local"].join(".");

type Fixture = {
  publicDir: string;
  renderedPath: string;
  root: string;
};

const renderedManifest = `
apiVersion: v1
kind: ConfigMap
metadata:
  name: dum-dashboard-config
  namespace: dum-dashboard
data:
  MONIES_API_URL: http://monies.monies.svc.cluster.local:3333
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dum-dashboard
  namespace: dum-dashboard
spec:
  template:
    metadata:
      labels:
        app.kubernetes.io/name: dum-dashboard
        app.kubernetes.io/component: dashboard
    spec:
      containers:
        - name: dashboard
          envFrom:
            - configMapRef:
                name: dum-dashboard-config
            - secretRef:
                name: dum-dashboard-secrets
            - secretRef:
                name: dum-dashboard-monies-secrets
---
apiVersion: secrets.infisical.com/v1alpha1
kind: InfisicalConnection
metadata:
  name: infisical-cloud
  namespace: dum-dashboard
spec:
  address: https://app.infisical.com
---
apiVersion: secrets.infisical.com/v1alpha1
kind: InfisicalAuth
metadata:
  name: dum-dashboard-monies-infisical-auth
  namespace: dum-dashboard
spec:
  method: universal
  infisicalConnectionRef:
    name: infisical-cloud
    namespace: dum-dashboard
  universal:
    clientIdRef:
      name: dum-dashboard-monies-infisical-auth-credentials
      namespace: dum-dashboard
      key: clientId
    clientSecretRef:
      name: dum-dashboard-monies-infisical-auth-credentials
      namespace: dum-dashboard
      key: clientSecret
---
apiVersion: secrets.infisical.com/v1alpha1
kind: InfisicalStaticSecret
metadata:
  name: dum-dashboard-monies-secrets
  namespace: dum-dashboard
spec:
  infisicalAuthRef:
    name: dum-dashboard-monies-infisical-auth
    namespace: dum-dashboard
  sources:
    - projectId: 1617f220-140c-4a04-a8e7-468a71e4ff50
      environmentSlug: prod
      secretPath: /dashboard
  targets:
    - name: dum-dashboard-monies-secrets
      namespace: dum-dashboard
      kind: Secret
      creationPolicy: Owner
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: dum-dashboard-traefik-only
  namespace: dum-dashboard
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: dum-dashboard
      app.kubernetes.io/component: dashboard
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
          podSelector:
            matchLabels:
              app.kubernetes.io/instance: traefik-kube-system
              app.kubernetes.io/name: traefik
      ports:
        - protocol: TCP
          port: 3000
`;

const writeFixtureFile = async (
  fixture: Fixture,
  relativePath: string,
  contents: string | Uint8Array,
): Promise<void> => {
  const path = join(fixture.root, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
};

const runGit = (fixture: Fixture, args: string[]): void => {
  const result = spawnSync("git", args, { cwd: fixture.root, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  }
};

const createFixture = async (): Promise<Fixture> => {
  const root = await mkdtemp(join(tmpdir(), "dum-dashboard-monies-check-"));
  const fixture = {
    publicDir: join(root, ".output/public"),
    renderedPath: join(root, "rendered.yml"),
    root,
  };

  await Promise.all([
    writeFixtureFile(
      fixture,
      ".env.example",
      "MONIES_API_URL=http://monies.monies.svc.cluster.local:3333\n",
    ),
    writeFixtureFile(fixture, ".env.production", "APP_ENV=production\n"),
    writeFixtureFile(fixture, "src/components/AppSidebar.tsx", "export const sidebar = true;\n"),
    writeFixtureFile(fixture, "src/lib/monies-api.ts", "export const serverOnly = true;\n"),
    writeFixtureFile(fixture, "vite.config.ts", "export default {};\n"),
    writeFixtureFile(
      fixture,
      "k8s/argocd/dum-dashboard.yml",
      "apiVersion: argoproj.io/v1alpha1\nkind: Application\nmetadata:\n  name: dashboard\n",
    ),
    writeFixtureFile(fixture, ".output/public/index.js", "globalThis.dashboard = true;\n"),
    writeFixtureFile(fixture, "rendered.yml", renderedManifest),
  ]);

  runGit(fixture, ["init", "--quiet"]);
  runGit(fixture, [
    "add",
    "--",
    ".env.example",
    ".env.production",
    "src/components/AppSidebar.tsx",
    "src/lib/monies-api.ts",
    "vite.config.ts",
    "k8s/argocd/dum-dashboard.yml",
  ]);
  return fixture;
};

const appendFixtureFile = async (
  fixture: Fixture,
  relativePath: string,
  mutation: string,
): Promise<void> => {
  const path = join(fixture.root, relativePath);
  const original = await readFile(path, "utf8");
  await writeFile(path, `${original}\n${mutation}\n`);
};

const appendRenderedManifest = async (fixture: Fixture, mutation: string): Promise<void> => {
  const original = await readFile(fixture.renderedPath, "utf8");
  await writeFile(fixture.renderedPath, `${original}\n${mutation}\n`);
};

const createBuiltArtifact = async (
  fixture: Fixture,
  name: string,
  contents: string | Uint8Array,
): Promise<string> => {
  const relativePath = `.output/public/${name}`;
  await writeFixtureFile(fixture, relativePath, contents);
  return relativePath;
};

const runChecker = (fixture: Fixture): void =>
  checkMoniesRepository({
    publicDir: fixture.publicDir,
    renderedPath: fixture.renderedPath,
    repoRoot: fixture.root,
  });

const expectRejected = (fixture: Fixture, relativePath: string): void => {
  expect(() => runChecker(fixture)).toThrow(relativePath);
};

let fixture: Fixture;

beforeEach(async () => {
  fixture = await createFixture();
});

afterEach(async () => {
  await rm(fixture.root, { force: true, recursive: true });
});

describe("Monies client-secret guard mutations", () => {
  test("uses an isolated Git fixture instead of the dashboard checkout", async () => {
    expect(fixture.root).not.toBe(process.cwd());
    const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: fixture.root,
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(await realpath(result.stdout.trim())).toBe(await realpath(fixture.root));
  });

  test("rejects a Monies VITE token reference outside the route layout", async () => {
    const relativePath = "src/components/AppSidebar.tsx";
    await appendFixtureFile(
      fixture,
      relativePath,
      `export const task12Mutation = import.meta.env.${viteTokenName};`,
    );

    expectRejected(fixture, relativePath);
  });

  test("rejects a Monies VITE token reference in Vite configuration", async () => {
    const relativePath = "vite.config.ts";
    await appendFixtureFile(
      fixture,
      relativePath,
      `export const task12Mutation = import.meta.env.${viteTokenName};`,
    );

    expectRejected(fixture, relativePath);
  });

  test("rejects a token assignment in the tracked production environment file", async () => {
    const relativePath = ".env.production";
    await appendFixtureFile(fixture, relativePath, `${tokenName}=committed-test-value`);

    expectRejected(fixture, relativePath);
  });

  test("rejects a direct Monies token declaration in tracked source", async () => {
    const relativePath = "src/components/AppSidebar.tsx";
    await appendFixtureFile(fixture, relativePath, `const ${tokenName} = "committed-value";`);

    expectRejected(fixture, relativePath);
  });

  test.each([
    ["one parenthesis layer", `(${tokenName})`],
    ["multiple parenthesis layers", `(((${tokenName})))`],
  ])("rejects a direct Monies token assignment with %s", async (_label, target) => {
    const relativePath = "src/components/AppSidebar.tsx";
    await appendFixtureFile(
      fixture,
      relativePath,
      [`let ${tokenName};`, `${target} = "committed-secret";`].join("\n"),
    );

    expectRejected(fixture, relativePath);
  });

  test("rejects a tracked unrendered Kubernetes Secret with the Monies API token", async () => {
    const relativePath = "k8s/argocd/dum-dashboard.yml";
    await appendFixtureFile(
      fixture,
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

    expectRejected(fixture, relativePath);
  });

  test("rejects committed Universal Auth credentials in an unrendered Secret", async () => {
    const relativePath = "k8s/argocd/dum-dashboard.yml";
    await appendFixtureFile(
      fixture,
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

    expectRejected(fixture, relativePath);
  });

  test.each([
    ["raw token name", tokenName],
    ["Monies VITE token name", viteTokenName],
    ["private Monies host", privateHost],
  ])("rejects a built public artifact containing the %s", async (_label, value) => {
    const relativePath = await createBuiltArtifact(
      fixture,
      `task12-${value.toLowerCase().replaceAll("_", "-")}.js`,
      `globalThis.task12Mutation = ${JSON.stringify(value)};`,
    );

    expectRejected(fixture, relativePath);
  });

  test.each([
    ["raw token name", tokenName],
    ["Monies VITE token name", viteTokenName],
    ["private Monies host", privateHost],
  ])("rejects a NUL-containing built public artifact containing the %s", async (_label, value) => {
    const relativePath = await createBuiltArtifact(
      fixture,
      `task12-binary-${value.toLowerCase().replaceAll("_", "-")}.bin`,
      Buffer.concat([Buffer.from([0, 255, 0]), Buffer.from(value, "ascii"), Buffer.from([0])]),
    );

    expectRejected(fixture, relativePath);
  });

  test("allows the server-only process environment token reference", async () => {
    const relativePath = "src/lib/monies-api.ts";
    await appendFixtureFile(
      fixture,
      relativePath,
      `export const task12ServerMutation = process.env.${tokenName};`,
    );

    expect(() => runChecker(fixture)).not.toThrow();
  });

  test("allows the Monies token name in a stubbed environment test fixture", async () => {
    const relativePath = "src/lib/monies-api.ts";
    await appendFixtureFile(
      fixture,
      relativePath,
      `vi.stubEnv(${JSON.stringify(tokenName)}, "test-token");`,
    );

    expect(() => runChecker(fixture)).not.toThrow();
  });

  test("allows an egress policy that can select only the go2rtc camera pod", async () => {
    await appendRenderedManifest(
      fixture,
      `---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: go2rtc-camera-isolation
  namespace: dum-dashboard
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: go2rtc
  policyTypes: [Egress]
  egress: []`,
    );

    expect(() => runChecker(fixture)).not.toThrow();
  });

  test.each([
    ["an empty selector", "podSelector: {}"],
    [
      "a dashboard-matching selector",
      "podSelector:\n    matchLabels:\n      app.kubernetes.io/name: dum-dashboard",
    ],
  ])("rejects egress policy with %s", async (_label, selector) => {
    await appendRenderedManifest(
      fixture,
      `---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: dashboard-egress-mutation
  namespace: dum-dashboard
spec:
  ${selector}
  policyTypes: [Egress]
  egress: []`,
    );

    expect(() => runChecker(fixture)).toThrow("dashboard egress policy");
  });
});
