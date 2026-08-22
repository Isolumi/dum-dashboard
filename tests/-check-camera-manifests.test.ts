import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { checkCameraRepository } from "../scripts/check-camera-manifests";

const image =
  "ghcr.io/alexxit/go2rtc:1.9.14@sha256:1120820fa7405c7655c71928c1f919feaa031fbb34fdc13ebe716006179fe346";
const usernameKey = ["TAPO", "CAMERA", "USERNAME"].join("_");
const passwordKey = ["TAPO", "CAMERA", "PASSWORD"].join("_");
const host = ["192", "168", "2", "44"].join(".");
const expandedRtspMutation = [
  "rtsp",
  "://fixture-user:fixture-password@fixture-host:554/stream1",
].join("");

type Fixture = {
  publicDir: string;
  renderedPath: string;
  root: string;
};

const renderedManifest = `
apiVersion: v1
kind: ConfigMap
metadata:
  name: go2rtc-config
  namespace: dum-dashboard
data:
  TAPO_CAMERA_HOST: "192.168.2.44"
  go2rtc.yml: |
    app:
      modules: [api, ws, rtsp, mp4]
    api:
      listen: ":1984"
      base_path: /camera-stream
      allow_paths: [/camera-stream/, /camera-stream/api/ws, /camera-stream/api/streams]
    rtsp:
      listen: ""
    webrtc:
      listen: ""
    srtp:
      listen: ""
    streams:
      camera-low: rtsp://\${TAPO_CAMERA_USERNAME}:\${TAPO_CAMERA_PASSWORD}@\${TAPO_CAMERA_HOST}:554/stream2
      camera-high: rtsp://\${TAPO_CAMERA_USERNAME}:\${TAPO_CAMERA_PASSWORD}@\${TAPO_CAMERA_HOST}:554/stream1
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: go2rtc
  namespace: dum-dashboard
spec:
  replicas: 1
  strategy:
    type: Recreate
  template:
    metadata:
      labels:
        app.kubernetes.io/name: go2rtc
        app.kubernetes.io/component: camera-stream
    spec:
      automountServiceAccountToken: false
      securityContext:
        runAsNonRoot: true
        runAsUser: 65532
        runAsGroup: 65532
        fsGroup: 65532
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: go2rtc
          image: ${image}
          ports:
            - name: http
              containerPort: 1984
              protocol: TCP
          env:
            - name: TAPO_CAMERA_HOST
              valueFrom:
                configMapKeyRef:
                  name: go2rtc-config
                  key: TAPO_CAMERA_HOST
            - name: TAPO_CAMERA_USERNAME
              valueFrom:
                secretKeyRef:
                  name: dum-dashboard-camera-secrets
                  key: TAPO_CAMERA_USERNAME
            - name: TAPO_CAMERA_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: dum-dashboard-camera-secrets
                  key: TAPO_CAMERA_PASSWORD
          resources:
            requests:
              cpu: 25m
              memory: 32Mi
            limits:
              cpu: 250m
              memory: 256Mi
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: [ALL]
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dum-dashboard
  namespace: dum-dashboard
spec:
  template:
    spec:
      containers:
        - name: dashboard
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: homelab-gateway
  namespace: dum-dashboard
spec:
  template:
    spec:
      containers:
        - name: gateway
---
apiVersion: v1
kind: Service
metadata:
  name: go2rtc
  namespace: dum-dashboard
spec:
  type: ClusterIP
  ports:
    - name: http
      port: 1984
      protocol: TCP
      targetPort: http
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
          - path: /camera-stream/video-rtc.js
            pathType: Exact
            backend:
              service:
                name: go2rtc
                port:
                  number: 1984
          - path: /camera-stream/api/ws
            pathType: Exact
            backend:
              service:
                name: go2rtc
                port:
                  number: 1984
          - path: /
            pathType: Prefix
            backend:
              service:
                name: dum-dashboard
                port:
                  number: 3000
---
apiVersion: secrets.infisical.com/v1alpha1
kind: InfisicalStaticSecret
metadata:
  name: dum-dashboard-camera-secrets
  namespace: dum-dashboard
spec:
  infisicalAuthRef:
    name: dum-dashboard-monies-infisical-auth
    namespace: dum-dashboard
  resyncInterval: 60
  manageSecret: true
  sources:
    - projectId: 1617f220-140c-4a04-a8e7-468a71e4ff50
      environmentSlug: prod
      secretPath: /camera
  targets:
    - name: dum-dashboard-camera-secrets
      namespace: dum-dashboard
      kind: Secret
      creationPolicy: Owner
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: go2rtc-camera-isolation
  namespace: dum-dashboard
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: go2rtc
      app.kubernetes.io/component: camera-stream
  policyTypes: [Ingress, Egress]
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
          port: 1984
  egress:
    - to:
        - ipBlock:
            cidr: 192.168.2.44/32
      ports:
        - protocol: TCP
          port: 554
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
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(" ")} failed`);
};

const createFixture = async (): Promise<Fixture> => {
  const root = await mkdtemp(join(tmpdir(), "dum-dashboard-camera-check-"));
  const fixture = {
    publicDir: join(root, ".output/public"),
    renderedPath: join(root, "rendered.yml"),
    root,
  };
  await Promise.all([
    writeFixtureFile(fixture, "src/camera.ts", "export const camera = true;\n"),
    writeFixtureFile(
      fixture,
      "scripts/check-camera-manifests.ts",
      "export const fixtureChecker = true;\n",
    ),
    writeFixtureFile(
      fixture,
      "k8s/overlays/dumachine/camera-config.yml",
      `apiVersion: v1
kind: ConfigMap
metadata:
  name: go2rtc-config
data:
  go2rtc.yml: |
    streams:
      camera-low: rtsp://\${${usernameKey}}:\${${passwordKey}}@\${TAPO_CAMERA_HOST}:554/stream2
      camera-high: rtsp://\${${usernameKey}}:\${${passwordKey}}@\${TAPO_CAMERA_HOST}:554/stream1
`,
    ),
    writeFixtureFile(
      fixture,
      "docs/superpowers/specs/2026-08-21-tapo-camera-dashboard-design.md",
      "Camera design.\n",
    ),
    writeFixtureFile(
      fixture,
      "docs/superpowers/plans/2026-08-21-tapo-camera-dashboard.md",
      "Camera plan.\n",
    ),
    writeFixtureFile(fixture, "docs/homelab-dashboard-operations.md", "Camera operation guide.\n"),
    writeFixtureFile(fixture, "rendered.yml", renderedManifest),
    writeFixtureFile(fixture, ".output/public/app.js", "globalThis.camera = true;\n"),
  ]);
  runGit(fixture, ["init", "--quiet"]);
  runGit(fixture, ["add", "src/camera.ts", "scripts", "k8s", "docs"]);
  return fixture;
};

const appendTracked = async (
  fixture: Fixture,
  relativePath: string,
  contents: string,
): Promise<void> => {
  const path = join(fixture.root, relativePath);
  const original = await readFile(path, "utf8");
  await writeFile(path, `${original}\n${contents}\n`);
};

const replaceRendered = async (fixture: Fixture, before: string, after: string): Promise<void> => {
  const original = await readFile(fixture.renderedPath, "utf8");
  expect(original).toContain(before);
  await writeFile(fixture.renderedPath, original.replace(before, after));
};

const appendRenderedManifest = async (fixture: Fixture, mutation: string): Promise<void> => {
  const original = await readFile(fixture.renderedPath, "utf8");
  await writeFile(fixture.renderedPath, `${original}\n${mutation}\n`);
};

const runChecker = (fixture: Fixture): void =>
  checkCameraRepository({
    publicDir: fixture.publicDir,
    renderedPath: fixture.renderedPath,
    repoRoot: fixture.root,
  });

const expectRejected = (fixture: Fixture, expected?: string): void => {
  expect(() => runChecker(fixture)).toThrow(expected);
};

let fixture: Fixture;

beforeEach(async () => {
  fixture = await createFixture();
});

afterEach(async () => {
  await rm(fixture.root, { force: true, recursive: true });
});

describe("camera deployment boundary mutations", () => {
  test("uses an isolated Git fixture instead of the dashboard checkout", async () => {
    const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: fixture.root,
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(await realpath(result.stdout.trim())).toBe(await realpath(fixture.root));
  });

  test("accepts the exact camera contract", () => {
    expect(() => runChecker(fixture)).not.toThrow();
  });

  test.each([["data"], ["stringData"]])(
    "rejects a tracked Kubernetes Secret %s with a camera key",
    async (field) => {
      const path = "k8s/overlays/dumachine/camera-config.yml";
      await appendTracked(
        fixture,
        path,
        `---\nkind: Secret\n${field}:\n  ${usernameKey}: fixture-value`,
      );
      expectRejected(fixture, path);
    },
  );

  test("rejects a tracked browser camera environment name", async () => {
    const path = "src/camera.ts";
    await appendTracked(
      fixture,
      path,
      `export const exposed = import.meta.env.VITE_${usernameKey};`,
    );
    expectRejected(fixture, path);
  });

  test("rejects a direct camera identifier assignment in an approved checker file", async () => {
    const path = "scripts/check-camera-manifests.ts";
    await appendTracked(fixture, path, `let ${usernameKey};\n${usernameKey} = "fixture-value";`);
    expectRejected(fixture, path);
  });

  test("rejects an expanded RTSP URL beside the approved ConfigMap templates", async () => {
    const path = "k8s/overlays/dumachine/camera-config.yml";
    await appendTracked(fixture, path, `      mutation: ${expandedRtspMutation}`);
    expectRejected(fixture, path);
  });

  test.each([
    "docs/superpowers/specs/2026-08-21-tapo-camera-dashboard-design.md",
    "docs/superpowers/plans/2026-08-21-tapo-camera-dashboard.md",
    "docs/homelab-dashboard-operations.md",
  ])("rejects an expanded RTSP URL in approved documentation %s", async (path) => {
    await appendTracked(fixture, path, `reference: ${expandedRtspMutation}`);
    expectRejected(fixture, path);
  });

  test("ignores an untracked source file", async () => {
    await writeFixtureFile(
      fixture,
      "src/untracked-camera.ts",
      `export const fixture = import.meta.env.VITE_${usernameKey};`,
    );
    expect(() => runChecker(fixture)).not.toThrow();
  });

  test.each([[usernameKey], [passwordKey], ["rtsp://"], [host]])(
    "rejects a built public artifact containing %s",
    async (forbidden) => {
      await writeFixtureFile(
        fixture,
        ".output/public/exposed.js",
        `globalThis.x = ${JSON.stringify(forbidden)};`,
      );
      expectRejected(fixture, ".output/public/exposed.js");
    },
  );

  test.each([[usernameKey], [passwordKey]])(
    "rejects a concrete %s value in a ConfigMap",
    async (key) => {
      await replaceRendered(
        fixture,
        '  TAPO_CAMERA_HOST: "192.168.2.44"',
        `  TAPO_CAMERA_HOST: "192.168.2.44"\n  ${key}: fixture-value`,
      );
      expectRejected(fixture);
    },
  );

  test.each([[usernameKey], [passwordKey]])("rejects a direct go2rtc %s value", async (key) => {
    await replaceRendered(
      fixture,
      `              valueFrom:\n                secretKeyRef:\n                  name: dum-dashboard-camera-secrets\n                  key: ${key}`,
      "              value: fixture-value",
    );
    expectRejected(fixture);
  });

  test.each([
    ["dum-dashboard", "dashboard"],
    ["homelab-gateway", "gateway"],
  ])("rejects a camera key in the %s container", async (_deployment, container) => {
    await replaceRendered(
      fixture,
      `        - name: ${container}\n---`,
      `        - name: ${container}\n          env:\n            - name: ${passwordKey}\n              valueFrom:\n                secretKeyRef:\n                  name: dum-dashboard-camera-secrets\n                  key: ${passwordKey}\n---`,
    );
    expectRejected(fixture);
  });

  test("rejects dashboard envFrom from the camera Secret", async () => {
    await replaceRendered(
      fixture,
      "        - name: dashboard\n---",
      "        - name: dashboard\n          envFrom:\n            - secretRef:\n                name: dum-dashboard-camera-secrets\n---",
    );
    expectRejected(fixture);
  });

  test("rejects a gateway Secret volume", async () => {
    await replaceRendered(
      fixture,
      "        - name: gateway\n---",
      "        - name: gateway\n      volumes:\n        - name: camera-secret\n          secret:\n            secretName: dum-dashboard-camera-secrets\n---",
    );
    expectRejected(fixture);
  });

  test("rejects a gateway projected Secret volume", async () => {
    await replaceRendered(
      fixture,
      "        - name: gateway\n---",
      "        - name: gateway\n      volumes:\n        - name: camera-secret\n          projected:\n            sources:\n              - secret:\n                  name: dum-dashboard-camera-secrets\n---",
    );
    expectRejected(fixture);
  });

  test("rejects an init container that reads the camera Secret", async () => {
    await replaceRendered(
      fixture,
      "        - name: dashboard\n---",
      "        - name: dashboard\n      initContainers:\n        - name: credential-reader\n          env:\n            - name: TAPO_CAMERA_PASSWORD\n              valueFrom:\n                secretKeyRef:\n                  name: dum-dashboard-camera-secrets\n                  key: TAPO_CAMERA_PASSWORD\n---",
    );
    expectRejected(fixture);
  });

  test("rejects a camera Secret reference in another pod-template workload", async () => {
    await appendRenderedManifest(
      fixture,
      `---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: unrelated-workload
  namespace: dum-dashboard
spec:
  template:
    spec:
      containers:
        - name: unrelated
          envFrom:
            - secretRef:
                name: dum-dashboard-camera-secrets`,
    );
    expectRejected(fixture);
  });

  test("rejects a changed go2rtc image", async () => {
    await replaceRendered(fixture, image, "ghcr.io/alexxit/go2rtc:1.9.14");
    expectRejected(fixture);
  });

  test("rejects a service-account token mount", async () => {
    await replaceRendered(
      fixture,
      "automountServiceAccountToken: false",
      "automountServiceAccountToken: true",
    );
    expectRejected(fixture);
  });

  test.each([
    ["pod UID", "runAsUser: 65532", "runAsUser: 0"],
    ["seccomp", "type: RuntimeDefault", "type: Unconfined"],
    ["container filesystem", "readOnlyRootFilesystem: true", "readOnlyRootFilesystem: false"],
  ])("rejects weakened %s security", async (_label, before, after) => {
    await replaceRendered(fixture, before, after);
    expectRejected(fixture);
  });

  test("rejects an Ingress default backend routed to go2rtc", async () => {
    await appendRenderedManifest(
      fixture,
      `---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: camera-default-backend
  namespace: dum-dashboard
spec:
  defaultBackend:
    service:
      name: go2rtc
      port:
        number: 1984`,
    );
    expectRejected(fixture);
  });

  test("rejects a non-ClusterIP camera Service", async () => {
    await replaceRendered(fixture, "type: ClusterIP", "type: LoadBalancer");
    expectRejected(fixture);
  });

  test("rejects a camera Service port other than TCP 1984", async () => {
    await replaceRendered(fixture, "      port: 1984", "      port: 8080");
    expectRejected(fixture);
  });

  test("rejects a broad camera ingress prefix", async () => {
    await replaceRendered(
      fixture,
      "          - path: /camera-stream/video-rtc.js\n            pathType: Exact",
      "          - path: /camera-stream\n            pathType: Prefix",
    );
    expectRejected(fixture);
  });

  test("rejects an exposed go2rtc stream-list ingress endpoint", async () => {
    await replaceRendered(
      fixture,
      "          - path: /\n            pathType: Prefix",
      "          - path: /camera-stream/api/streams\n            pathType: Exact\n            backend:\n              service:\n                name: go2rtc\n                port:\n                  number: 1984\n          - path: /\n            pathType: Prefix",
    );
    expectRejected(fixture);
  });

  test.each([
    ["a broad path", "/camera-stream", "Prefix"],
    ["a sensitive streams endpoint", "/camera-stream/api/streams", "Exact"],
  ])("rejects a second Ingress with %s routed to go2rtc", async (_label, path, pathType) => {
    await appendRenderedManifest(
      fixture,
      `---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: camera-bypass
  namespace: dum-dashboard
spec:
  rules:
    - http:
        paths:
          - path: ${path}
            pathType: ${pathType}
            backend:
              service:
                name: go2rtc
                port:
                  number: 1984`,
    );
    expectRejected(fixture);
  });

  test.each([
    ["exec"],
    ["echo"],
    ["expr"],
    ["ffmpeg"],
    ["http"],
    ["webrtc"],
    ["hls"],
    ["mjpeg"],
    ["unapproved"],
  ])("rejects the %s go2rtc module", async (module) => {
    await replaceRendered(
      fixture,
      "modules: [api, ws, rtsp, mp4]",
      `modules: [api, ws, rtsp, mp4, ${module}]`,
    );
    expectRejected(fixture);
  });

  test("rejects a non-Traefik NetworkPolicy ingress source", async () => {
    await replaceRendered(fixture, "kube-system", "other-namespace");
    expectRejected(fixture);
  });

  test("rejects NetworkPolicy egress outside the camera RTSP endpoint", async () => {
    await replaceRendered(fixture, "192.168.2.44/32", "0.0.0.0/0");
    expectRejected(fixture);
  });

  test.each([
    [
      "a subset selector with permissive ingress",
      "podSelector:\n    matchLabels:\n      app.kubernetes.io/name: go2rtc",
      "ingress:\n    - {}",
    ],
    ["an empty selector with permissive egress", "podSelector: {}", "egress:\n    - {}"],
  ])("rejects an extra go2rtc-selecting NetworkPolicy with %s", async (_label, selector, rules) => {
    await appendRenderedManifest(
      fixture,
      `---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: camera-policy-bypass
  namespace: dum-dashboard
spec:
  ${selector}
  policyTypes: [Ingress, Egress]
  ${rules}`,
    );
    expectRejected(fixture);
  });

  test.each([
    ["path", "secretPath: /camera", "secretPath: /other"],
    [
      "target",
      "name: dum-dashboard-camera-secrets\n      namespace: dum-dashboard\n      kind: Secret",
      "name: other-secret\n      namespace: dum-dashboard\n      kind: Secret",
    ],
  ])("rejects an Infisical %s change", async (_label, before, after) => {
    await replaceRendered(fixture, before, after);
    expectRejected(fixture);
  });
});
