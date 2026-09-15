import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { checkToolApiManifests } from "../scripts/check-tool-api-manifests";

type Fixture = {
  baseRenderedPath: string;
  overlayRenderedPath: string;
  root: string;
};

const tokenEnvironment = `
          env:
            - name: DUMQ_TOOL_TOKEN
              valueFrom:
                secretKeyRef:
                  name: dum-dashboard-tool-secrets
                  key: DUMQ_TOOL_TOKEN`;

const deploymentWithPodSpec = (podSpec: string): string => `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dum-dashboard
  namespace: dum-dashboard
spec:
  template:
    spec:
${podSpec}`;

const dashboardDeployment = deploymentWithPodSpec(`
      containers:
        - name: dashboard${tokenEnvironment}`);

const toolSecret = `
---
apiVersion: secrets.infisical.com/v1beta1
kind: InfisicalStaticSecret
metadata:
  name: dum-dashboard-tool-secrets
  namespace: dum-dashboard
spec:
  infisicalAuthRef:
    name: dum-dashboard-monies-infisical-auth
    namespace: dum-dashboard
  syncOptions:
    refreshInterval: 60s
    instantUpdates: false
  sources:
    - projectId: 1617f220-140c-4a04-a8e7-468a71e4ff50
      environmentSlug: prod
      secretPath: /tool-api
  targets:
    - name: dum-dashboard-tool-secrets
      namespace: dum-dashboard
      kind: Secret
      creationPolicy: Owner`;

const rootIngress = `
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: dum-dashboard
  namespace: dum-dashboard
spec:
  rules:
    - http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: dum-dashboard
                port:
                  number: 3000`;

const dashboardNetworkPolicy = `
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
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: uwumi
          podSelector:
            matchLabels:
              app: dumq-mcp
      ports:
        - port: 3000
          protocol: TCP`;

const additionalIngressPolicy = (podSelector: string): string => `
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: dashboard-broad-ingress
  namespace: dum-dashboard
spec:
  podSelector: ${podSelector}
  policyTypes:
    - Ingress
  ingress:
    - {}`;

const appendDocument = async (path: string, document: string): Promise<void> => {
  const original = await readFile(path, "utf8");
  await writeFile(path, `${original}\n---\n${document.trim()}\n`);
};

const replaceInFile = async (path: string, from: string, to: string): Promise<void> => {
  const original = await readFile(path, "utf8");
  if (!original.includes(from)) throw new Error(`Fixture does not contain ${from}`);
  await writeFile(path, original.replace(from, to));
};

const replaceInBothRenders = async (fixture: Fixture, from: string, to: string): Promise<void> => {
  await Promise.all([
    replaceInFile(fixture.baseRenderedPath, from, to),
    replaceInFile(fixture.overlayRenderedPath, from, to),
  ]);
};

const setDeploymentInBothRenders = async (fixture: Fixture, deployment: string): Promise<void> => {
  await Promise.all([
    writeFile(fixture.baseRenderedPath, deployment),
    writeFile(
      fixture.overlayRenderedPath,
      `${deployment}${toolSecret}${rootIngress}${dashboardNetworkPolicy}`,
    ),
  ]);
};

const createFixture = async (): Promise<Fixture> => {
  const root = await mkdtemp(join(tmpdir(), "dum-dashboard-tool-api-check-"));
  const fixture = {
    baseRenderedPath: join(root, "base.yml"),
    overlayRenderedPath: join(root, "overlay.yml"),
    root,
  };
  await setDeploymentInBothRenders(fixture, dashboardDeployment);
  return fixture;
};

const runChecker = (fixture: Fixture): void =>
  checkToolApiManifests({
    baseRenderedPath: fixture.baseRenderedPath,
    overlayRenderedPath: fixture.overlayRenderedPath,
  });

const expectRejected = (fixture: Fixture): void => {
  expect(() => runChecker(fixture)).toThrow();
};

const runCheckerScript = (fixture: Fixture) =>
  spawnSync(
    "bash",
    [
      join(process.cwd(), "scripts/check-tool-api-manifests.sh"),
      "--base-rendered",
      fixture.baseRenderedPath,
      "--overlay-rendered",
      fixture.overlayRenderedPath,
    ],
    { encoding: "utf8" },
  );

const checkerOutput = (result: ReturnType<typeof runCheckerScript>): string =>
  [result.stdout, result.stderr].filter(Boolean).join("\n");

let fixture: Fixture;

beforeEach(async () => {
  fixture = await createFixture();
});

afterEach(async () => {
  await rm(fixture.root, { force: true, recursive: true });
});

describe("DumQ tool API manifest guard mutations", () => {
  test("accepts the approved base and overlay contract", () => {
    expect(() => runChecker(fixture)).not.toThrow();
  });

  test.each([
    [
      "API version",
      "apiVersion: secrets.infisical.com/v1beta1",
      "apiVersion: secrets.infisical.com/v1alpha1",
    ],
    ["project", "1617f220-140c-4a04-a8e7-468a71e4ff50", "wrong-project"],
    [
      "resource namespace",
      "metadata:\n  name: dum-dashboard-tool-secrets\n  namespace: dum-dashboard",
      "metadata:\n  name: dum-dashboard-tool-secrets\n  namespace: wrong-namespace",
    ],
    ["auth", "name: dum-dashboard-monies-infisical-auth", "name: wrong-auth"],
    [
      "auth namespace",
      "  infisicalAuthRef:\n    name: dum-dashboard-monies-infisical-auth\n    namespace: dum-dashboard",
      "  infisicalAuthRef:\n    name: dum-dashboard-monies-infisical-auth\n    namespace: wrong-namespace",
    ],
    ["refresh interval", "refreshInterval: 60s", "refreshInterval: 5m"],
    ["instant updates", "instantUpdates: false", "instantUpdates: true"],
    ["environment", "environmentSlug: prod", "environmentSlug: dev"],
    ["path", "secretPath: /tool-api", "secretPath: /dashboard"],
    [
      "target",
      "    - name: dum-dashboard-tool-secrets\n      namespace: dum-dashboard\n      kind: Secret",
      "    - name: wrong-target\n      namespace: dum-dashboard\n      kind: Secret",
    ],
    [
      "target namespace",
      "    - name: dum-dashboard-tool-secrets\n      namespace: dum-dashboard\n      kind: Secret",
      "    - name: dum-dashboard-tool-secrets\n      namespace: wrong-namespace\n      kind: Secret",
    ],
    [
      "target kind",
      "      kind: Secret\n      creationPolicy: Owner",
      "      kind: ConfigMap\n      creationPolicy: Owner",
    ],
    ["creation policy", "creationPolicy: Owner", "creationPolicy: Orphan"],
  ])("rejects a wrong Infisical %s field", async (_label, from, to) => {
    await replaceInFile(fixture.overlayRenderedPath, from, to);

    expectRejected(fixture);
  });

  test("does not accept an init container named dashboard as the dashboard container", async () => {
    await setDeploymentInBothRenders(
      fixture,
      deploymentWithPodSpec(`
      containers:
        - name: app
      initContainers:
        - name: dashboard${tokenEnvironment}`),
    );

    expectRejected(fixture);
  });

  test("does not accept an ephemeral container named dashboard as the dashboard container", async () => {
    await setDeploymentInBothRenders(
      fixture,
      deploymentWithPodSpec(`
      containers:
        - name: app
      ephemeralContainers:
        - name: dashboard${tokenEnvironment}`),
    );

    expectRejected(fixture);
  });

  test("rejects duplicate normal dashboard containers", async () => {
    await replaceInBothRenders(
      fixture,
      "      containers:\n        - name: dashboard",
      "      containers:\n        - name: dashboard\n        - name: dashboard",
    );

    expectRejected(fixture);
  });

  test.each(["containers", "initContainers", "ephemeralContainers"])(
    "rejects a second Deployment %s consumer",
    async (containerField) => {
      await appendDocument(
        fixture.baseRenderedPath,
        `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: copied-token
spec:
  template:
    spec:
      ${containerField}:
        - name: copier
          env:
            - name: DUMQ_TOOL_TOKEN
              valueFrom:
                secretKeyRef:
                  name: dum-dashboard-tool-secrets
                  key: DUMQ_TOOL_TOKEN`,
      );

      expectRejected(fixture);
    },
  );

  test.each([
    ["same Secret and key", "dum-dashboard-tool-secrets", "DUMQ_TOOL_TOKEN"],
    ["same Secret with another key", "dum-dashboard-tool-secrets", "OTHER_KEY"],
    ["same key from another Secret", "other-secret", "DUMQ_TOOL_TOKEN"],
  ])("rejects an aliased dashboard secretKeyRef with the %s", async (_label, name, key) => {
    await replaceInBothRenders(
      fixture,
      "                  key: DUMQ_TOOL_TOKEN",
      `                  key: DUMQ_TOOL_TOKEN
            - name: COPIED_TOOL_TOKEN
              valueFrom:
                secretKeyRef:
                  name: ${name}
                  key: ${key}`,
    );

    expectRejected(fixture);
  });

  test("rejects a duplicate exact dashboard secretKeyRef", async () => {
    await replaceInBothRenders(
      fixture,
      "                  key: DUMQ_TOOL_TOKEN",
      `                  key: DUMQ_TOOL_TOKEN
            - name: DUMQ_TOOL_TOKEN
              valueFrom:
                secretKeyRef:
                  name: dum-dashboard-tool-secrets
                  key: DUMQ_TOOL_TOKEN`,
    );

    expectRejected(fixture);
  });

  test("rejects dashboard envFrom from the tool Secret", async () => {
    await replaceInBothRenders(
      fixture,
      "          env:",
      `          envFrom:
            - secretRef:
                name: dum-dashboard-tool-secrets
          env:`,
    );

    expectRejected(fixture);
  });

  test("rejects a direct tool Secret volume", async () => {
    await replaceInBothRenders(
      fixture,
      "      containers:",
      `      volumes:
        - name: copied-token
          secret:
            secretName: dum-dashboard-tool-secrets
      containers:`,
    );

    expectRejected(fixture);
  });

  test("rejects a projected tool Secret volume", async () => {
    await replaceInBothRenders(
      fixture,
      "      containers:",
      `      volumes:
        - name: copied-token
          projected:
            sources:
              - secret:
                  name: dum-dashboard-tool-secrets
      containers:`,
    );

    expectRejected(fixture);
  });

  test.each([
    ["ConfigMap data", "ConfigMap", "data", "committed-token"],
    ["Secret stringData", "Secret", "stringData", "committed-token"],
    ["ConfigMap binaryData", "ConfigMap", "binaryData", "Y29tbWl0dGVkLXRva2Vu"],
  ])("rejects DUMQ_TOOL_TOKEN in %s", async (_label, kind, field, value) => {
    await appendDocument(
      fixture.baseRenderedPath,
      `
apiVersion: v1
kind: ${kind}
metadata:
  name: copied-token
${field}:
  DUMQ_TOOL_TOKEN: ${value}`,
    );

    expectRejected(fixture);
  });

  test("rejects a literal token environment value", async () => {
    await replaceInBothRenders(
      fixture,
      `              valueFrom:
                secretKeyRef:
                  name: dum-dashboard-tool-secrets
                  key: DUMQ_TOOL_TOKEN`,
      "              value: committed-token",
    );

    expectRejected(fixture);
  });

  test("rejects a direct Pod consumer", async () => {
    await appendDocument(
      fixture.baseRenderedPath,
      `
apiVersion: v1
kind: Pod
metadata:
  name: copied-token
spec:
  containers:
    - name: copier
      env:
        - name: COPIED_TOOL_TOKEN
          valueFrom:
            secretKeyRef:
              name: dum-dashboard-tool-secrets
              key: DUMQ_TOOL_TOKEN`,
    );

    expectRejected(fixture);
  });

  test("rejects a ReplicationController consumer", async () => {
    await appendDocument(
      fixture.baseRenderedPath,
      `
apiVersion: v1
kind: ReplicationController
metadata:
  name: copied-token
spec:
  template:
    spec:
      containers:
        - name: copier
          env:
            - name: COPIED_TOOL_TOKEN
              valueFrom:
                secretKeyRef:
                  name: dum-dashboard-tool-secrets
                  key: DUMQ_TOOL_TOKEN`,
    );

    expectRejected(fixture);
  });

  test("rejects a PodTemplate consumer", async () => {
    await appendDocument(
      fixture.baseRenderedPath,
      `
apiVersion: v1
kind: PodTemplate
metadata:
  name: copied-token
template:
  spec:
    containers:
      - name: copier
        env:
          - name: COPIED_TOOL_TOKEN
            valueFrom:
              secretKeyRef:
                name: dum-dashboard-tool-secrets
                key: DUMQ_TOOL_TOKEN`,
    );

    expectRejected(fixture);
  });

  test("rejects a CronJob consumer", async () => {
    await appendDocument(
      fixture.baseRenderedPath,
      `
apiVersion: batch/v1
kind: CronJob
metadata:
  name: copied-token
spec:
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: copier
              env:
                - name: COPIED_TOOL_TOKEN
                  valueFrom:
                    secretKeyRef:
                      name: dum-dashboard-tool-secrets
                      key: DUMQ_TOOL_TOKEN`,
    );

    expectRejected(fixture);
  });

  test.each(["containers", "initContainers", "ephemeralContainers"])(
    "rejects a generic pod-template %s consumer",
    async (containerField) => {
      await appendDocument(
        fixture.baseRenderedPath,
        `
apiVersion: example.test/v1
kind: CustomWorkload
metadata:
  name: copied-token
spec:
  template:
    spec:
      ${containerField}:
        - name: copier
          env:
            - name: COPIED_TOOL_TOKEN
              valueFrom:
                secretKeyRef:
                  name: dum-dashboard-tool-secrets
                  key: DUMQ_TOOL_TOKEN`,
      );

      expectRejected(fixture);
    },
  );

  test("rejects generic pod-template envFrom", async () => {
    await appendDocument(
      fixture.baseRenderedPath,
      `
apiVersion: example.test/v1
kind: CustomWorkload
metadata:
  name: copied-token
spec:
  template:
    spec:
      containers:
        - name: copier
          envFrom:
            - secretRef:
                name: dum-dashboard-tool-secrets`,
    );

    expectRejected(fixture);
  });

  test("rejects a generic pod-template Secret volume", async () => {
    await appendDocument(
      fixture.baseRenderedPath,
      `
apiVersion: example.test/v1
kind: CustomWorkload
metadata:
  name: copied-token
spec:
  template:
    spec:
      volumes:
        - name: copied-token
          secret:
            secretName: dum-dashboard-tool-secrets
      containers:
        - name: app`,
    );

    expectRejected(fixture);
  });

  test("rejects a generic pod-template literal token", async () => {
    await appendDocument(
      fixture.baseRenderedPath,
      `
apiVersion: example.test/v1
kind: CustomWorkload
metadata:
  name: copied-token
spec:
  template:
    spec:
      containers:
        - name: copier
          env:
            - name: DUMQ_TOOL_TOKEN
              value: committed-token`,
    );

    expectRejected(fixture);
  });

  test("rejects an explicit /api/tools Ingress path", async () => {
    await replaceInFile(
      fixture.overlayRenderedPath,
      "          - path: /",
      "          - path: /api/tools",
    );

    expectRejected(fixture);
  });
});

describe("DumQ NetworkPolicy manifest guard mutations", () => {
  test("accepts only the approved rendered ingress contract", () => {
    const result = runCheckerScript(fixture);

    expect(result.status, checkerOutput(result)).toBe(0);
  });

  test.each([
    [
      "missing Uwumi namespace selector",
      `        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: uwumi
          podSelector:
            matchLabels:
              app: dumq-mcp`,
      `        - podSelector:
            matchLabels:
              app: dumq-mcp`,
    ],
    ["unstable Uwumi namespace label", "kubernetes.io/metadata.name: uwumi", "name: uwumi"],
    [
      "all namespaces",
      `        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: uwumi`,
      "        - namespaceSelector: {}",
    ],
    [
      "missing DumQ MCP pod selector",
      `          podSelector:
            matchLabels:
              app: dumq-mcp
      ports:`,
      "      ports:",
    ],
    [
      "all pods in Uwumi",
      `          podSelector:
            matchLabels:
              app: dumq-mcp`,
      "          podSelector: {}",
    ],
    ["wrong DumQ MCP pod label", "app: dumq-mcp", "app: uwumi"],
    [
      "expression-based DumQ MCP pod selector",
      `          podSelector:
            matchLabels:
              app: dumq-mcp`,
      `          podSelector:
            matchExpressions:
              - key: app
                operator: Exists`,
    ],
    [
      "namespace and pod selectors split into separate peers",
      `        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: uwumi
          podSelector:
            matchLabels:
              app: dumq-mcp`,
      `        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: uwumi
        - podSelector:
            matchLabels:
              app: dumq-mcp`,
    ],
    [
      "extra broad peer",
      `          podSelector:
            matchLabels:
              app: dumq-mcp
      ports:`,
      `          podSelector:
            matchLabels:
              app: dumq-mcp
        - namespaceSelector: {}
      ports:`,
    ],
    ["wrong dashboard port", "        - port: 3000", "        - port: 3001"],
    ["wrong dashboard protocol", "          protocol: TCP", "          protocol: UDP"],
    [
      "changed Traefik peer",
      "app.kubernetes.io/instance: traefik-kube-system",
      "app.kubernetes.io/instance: traefik",
    ],
    [
      "new egress isolation",
      `  policyTypes:
    - Ingress
  ingress:`,
      `  policyTypes:
    - Ingress
    - Egress
  egress: []
  ingress:`,
    ],
  ])("rejects %s", async (_label, from, to) => {
    await replaceInFile(fixture.overlayRenderedPath, from, to);

    const result = runCheckerScript(fixture);

    expect(result.status, checkerOutput(result)).not.toBe(0);
  });

  test.each([
    [
      "the exact dashboard labels",
      `
    matchLabels:
      app.kubernetes.io/name: dum-dashboard
      app.kubernetes.io/component: dashboard`,
    ],
    [
      "a partial dashboard label set",
      `
    matchLabels:
      app.kubernetes.io/name: dum-dashboard`,
    ],
    ["an empty selector", "{}"],
    [
      "a matching In expression",
      `
    matchExpressions:
      - key: app.kubernetes.io/name
        operator: In
        values:
          - dum-dashboard`,
    ],
    [
      "a matching Exists expression",
      `
    matchExpressions:
      - key: app.kubernetes.io/component
        operator: Exists`,
    ],
    [
      "a matching NotIn expression",
      `
    matchExpressions:
      - key: app.kubernetes.io/component
        operator: NotIn
        values:
          - camera-stream`,
    ],
    [
      "a matching DoesNotExist expression",
      `
    matchExpressions:
      - key: app.kubernetes.io/instance
        operator: DoesNotExist`,
    ],
  ])(
    "rejects a second ingress policy selecting the dashboard with %s",
    async (_label, selector) => {
      await appendDocument(fixture.overlayRenderedPath, additionalIngressPolicy(selector));

      const result = runCheckerScript(fixture);

      expect(result.status, checkerOutput(result)).not.toBe(0);
    },
  );

  test("accepts an additional ingress policy that selects another pod", async () => {
    await appendDocument(
      fixture.overlayRenderedPath,
      additionalIngressPolicy(`
    matchLabels:
      app.kubernetes.io/name: go2rtc`),
    );

    const result = runCheckerScript(fixture);

    expect(result.status, checkerOutput(result)).toBe(0);
  });
});
