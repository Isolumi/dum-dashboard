# Tapo Camera Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the private Tapo C100 live video to the Dum Dashboard overview and a dedicated Cameras page, with automatic muted playback and no camera credentials in the browser.

**Architecture:** A locked-down go2rtc pod reads the camera RTSP streams on the local network. Traefik exposes only the go2rtc player module and MSE WebSocket endpoint under the existing Tailscale-only `doh.lumilumi.xyz` ingress. React uses a thin adapter around go2rtc's maintained `video-rtc.js` player. Infisical supplies the camera username and password only to the go2rtc pod.

**Tech Stack:** React 19, TanStack Start, TypeScript, Tailwind CSS, Vitest, go2rtc `v1.9.14`, Kubernetes, Kustomize, Infisical Operator, Traefik, Argo CD

**Spec:** `docs/superpowers/specs/2026-08-21-tapo-camera-dashboard-design.md`

## Global Constraints

- Work only in the isolated `feature/tapo-camera-dashboard` worktree.
- Use `.yml` for repository YAML filenames.
- Keep the camera private behind the existing Tailscale-only Traefik ingress.
- Do not add WebRTC, HLS, audio, recording, screenshots, PTZ, or camera administration.
- Do not add a custom streaming protocol or a custom go2rtc image.
- Load only the go2rtc modules required for this feature: `api`, `ws`, `rtsp`, and `mp4`. Keep command, script, transcoding, and unrelated source modules disabled.
- Keep all current browser security headers unchanged.
- Do not commit, print, log, or send camera credentials to the browser.
- Keep `TAPO_CAMERA_USERNAME` and `TAPO_CAMERA_PASSWORD` in Infisical at `/camera`.
- Expose only the low stream name `camera-low` and high stream name `camera-high` to the browser.
- Pin the amd64 go2rtc image to `ghcr.io/alexxit/go2rtc:1.9.14@sha256:1120820fa7405c7655c71928c1f919feaa031fbb34fdc13ebe716006179fe346`.
- Use test-driven development: add one failing test, confirm the expected failure, implement the smallest change, and rerun the test.
- Commit after each task. Do not mix unrelated cleanup into a task.
- Never put a real camera username, password, or expanded RTSP URL in a command, test fixture, commit, PR, browser panel, or log excerpt.
- Baseline note from 2026-08-21: the full `bun run fmt:check` already reports unrelated formatting in `scripts/verify-monitoring-values.ts` and `tests/-verify-monitoring-values.test.ts`. Do not change those files in this feature. Run Oxfmt against the camera feature's changed files.

## Verified Upstream References

- [go2rtc v1.9.14 release](https://github.com/AlexxIT/go2rtc/releases/tag/v1.9.14)
- [Maintained `VideoRTC` player](https://github.com/AlexxIT/go2rtc/blob/v1.9.14/www/video-rtc.js)
- [Base-path and allow-path registration](https://github.com/AlexxIT/go2rtc/blob/v1.9.14/internal/api/api.go)
- [Static file handler registration](https://github.com/AlexxIT/go2rtc/blob/v1.9.14/internal/api/static.go)
- [Module allow-list](https://github.com/AlexxIT/go2rtc/blob/v1.9.14/main.go)
- [Dynamic source behavior](https://github.com/AlexxIT/go2rtc/blob/v1.9.14/internal/streams/streams.go)
- [Environment expansion and secret registration](https://github.com/AlexxIT/go2rtc/blob/v1.9.14/pkg/creds/creds.go)
- [Log and API response redaction](https://github.com/AlexxIT/go2rtc/blob/v1.9.14/pkg/creds/secrets.go)

---

### Task 1: Add the tested go2rtc player adapter

**Files:**

- Create: `src/routes/_layout/cameras/-camera-player-element.ts`
- Create: `src/routes/_layout/cameras/-camera-player-element.test.ts`
- Create: `src/routes/_layout/cameras/-CameraPlayer.tsx`
- Create: `src/routes/_layout/cameras/-CameraPlayer.test.tsx`

#### 1. Define the adapter contract with a failing test

- [ ] Create `src/routes/_layout/cameras/-camera-player-element.test.ts` with a jsdom environment.
- [ ] Define a fake upstream `VideoRTC` base class that creates one `<video>` element in `oninit()`, returns `[]` from `onopen()`, returns `true` from `onclose()`, and records `ondisconnect()`.
- [ ] Write a test for `configureCameraStreamElement()` that expects these exact values:

```ts
expect(element.mode).toBe("mse");
expect(element.media).toBe("video");
expect(element.background).toBe(false);
expect(element.visibilityCheck).toBe(true);
expect(element.visibilityThreshold).toBe(0.01);
expect(element.src).toBe("/camera-stream/api/ws?src=camera-low");
```

- [ ] Write a second assertion for `camera-high`; reject any stream name outside the `CameraStreamName` union at compile time.
- [ ] Write tests for the class returned by `buildCameraStreamElementClass()`:
  - `oninit()` makes the child video muted, automatic, inline, without controls, and `object-fit: contain`.
  - the child video's `playing` event emits `camera-playback-state` with `detail: "live"`.
  - `onopen()` emits `detail: "loading"`.
  - an upstream JSON message with `type: "error"` emits `detail: "offline"` and closes only the current WebSocket so the upstream reconnect timer runs.
  - no `playing` event within 20 seconds emits `detail: "offline"` and closes only the current WebSocket.
  - a `playing` event clears the startup timer.
  - a reconnecting `onclose()` emits `detail: "offline"`.
  - `onclose()` and `ondisconnect()` clear the startup timer.
  - `ondisconnect()` emits `detail: "idle"` and calls the upstream method.
- [ ] Run the new test and confirm that it fails because the adapter does not exist:

```bash
bun run test -- src/routes/_layout/cameras/-camera-player-element.test.ts
```

Expected result: FAIL with an import error for `-camera-player-element`.

#### 2. Implement the protocol boundary

- [ ] Create `src/routes/_layout/cameras/-camera-player-element.ts` with these exported types and constants:

```ts
export type CameraStreamName = "camera-low" | "camera-high";
export type CameraPlaybackState = "idle" | "loading" | "live" | "offline";
export const CAMERA_PLAYBACK_EVENT = "camera-playback-state";

export interface CameraStreamElement extends HTMLElement {
  mode: string;
  media: string;
  background: boolean;
  visibilityCheck: boolean;
  visibilityThreshold: number;
  src: string;
  video: HTMLVideoElement | null;
  ws: WebSocket | null;
}
```

- [ ] Add a private structural type for the upstream constructor and lifecycle methods. Do not add `any` or copy protocol code from go2rtc.
- [ ] Implement `configureCameraStreamElement(element, stream)` so all player configuration is in one place:

```ts
element.mode = "mse";
element.media = "video";
element.background = false;
element.visibilityCheck = true;
element.visibilityThreshold = 0.01;
element.src = `/camera-stream/api/ws?src=${encodeURIComponent(stream)}`;
```

- [ ] Implement `buildCameraStreamElementClass(VideoRTC)` as a thin subclass:
  - call `super.oninit()` before changing the child video;
  - set `controls = false`, `muted = true`, `autoplay = true`, and `playsInline = true`;
  - set `video.style.objectFit = "contain"`;
  - emit `loading` after `super.onopen()` and start one 20-second startup timer;
  - listen to the current upstream WebSocket for JSON `error` messages, but never copy the upstream error value into a DOM event or visible text;
  - on an upstream error or startup timeout, emit `offline` and close the current WebSocket so go2rtc's fixed 15-second reconnect runs;
  - clear the startup timer when the video plays, the WebSocket closes, or the player becomes idle;
  - keep at most one startup timer and one listener per WebSocket;
  - emit `offline` only when `super.onclose()` returns `true`, so an intentional stop is not shown as a camera failure;
  - emit `idle` after `super.ondisconnect()`;
  - use a non-bubbling `CustomEvent<CameraPlaybackState>` for each state.
- [ ] Implement a browser-only module loader. Keep the URL in a variable so Vite does not bundle the runtime file:

```ts
const videoRtcModuleUrl = "/camera-stream/video-rtc.js";
const module = await import(/* @vite-ignore */ videoRtcModuleUrl);
```

- [ ] Implement `createCameraStreamElement(stream)`:
  - load the upstream module only after the component mounts in the browser;
  - define one custom element name, `dum-camera-stream`, only if it is not registered;
  - create the custom element, call `configureCameraStreamElement()`, and return it;
  - throw a normal `Error` if the module does not export a valid `VideoRTC` constructor.
- [ ] Keep the upstream library URL, WebSocket URL, and custom-element lifecycle details in this file only.
- [ ] Use fake timers in the adapter test. Do not wait 20 real seconds.

#### 3. Implement the React wrapper from a failing component test

- [ ] Create `src/routes/_layout/cameras/-CameraPlayer.test.tsx` with a jsdom environment.
- [ ] Inject a fake `elementFactory` into `CameraPlayer` so tests do not load a network module.
- [ ] Write tests that verify:
  - the reserved frame has a stable 16:9 aspect ratio while loading;
  - the factory receives the selected stream;
  - the custom element is appended once;
  - `live`, `offline`, and `idle` events update the visible state;
  - `Live` appears only in the live state and is removed in the offline state;
  - the exact offline text is `Camera offline`;
  - unmount removes the state listener and player element;
  - a rejected factory promise shows `Camera offline` without an unhandled promise rejection.
- [ ] Run the test and confirm that it fails because `CameraPlayer` does not exist:

```bash
bun run test -- src/routes/_layout/cameras/-CameraPlayer.test.tsx
```

Expected result: FAIL with an import error for `-CameraPlayer`.

- [ ] Create `src/routes/_layout/cameras/-CameraPlayer.tsx` with this public interface:

```ts
type CameraPlayerProps = {
  stream: CameraStreamName;
  label: string;
  className?: string;
  elementFactory?: (stream: CameraStreamName) => Promise<CameraStreamElement>;
};
```

- [ ] Use a `ref` for the player host and one `useEffect` for the player lifecycle. Guard each async continuation with a disposed flag.
- [ ] Start in `loading`; append the player element once; listen for `CAMERA_PLAYBACK_EVENT`; remove the listener and element during cleanup.
- [ ] Keep one fixed 16:9 frame in every state. Use existing theme tokens only: `bg-muted`, `text-muted-foreground`, `border-border`, and `text-foreground`.
- [ ] Show a small spinner or fixed loading label before playback. Show `Live` only while video is playing. Show `Camera offline` for module, WebSocket, or media failure. Use `aria-live="polite"` for state text.
- [ ] Do not render browser media controls or any audio control.

#### 4. Verify and commit Task 1

- [ ] Run the adapter and component tests:

```bash
bun run test -- \
  src/routes/_layout/cameras/-camera-player-element.test.ts \
  src/routes/_layout/cameras/-CameraPlayer.test.tsx
```

Expected result: both test files pass.

- [ ] Run focused lint and format checks:

```bash
bun run lint
bunx oxfmt --check src/routes/_layout/cameras
```

Expected result: both commands pass.

- [ ] Commit the adapter:

```bash
git add src/routes/_layout/cameras
git commit -m "feat: add camera stream player adapter"
```

---

### Task 2: Add the overview card and Cameras page

**Files:**

- Create: `src/routes/_layout/cameras/-CameraBentoCard.tsx`
- Create: `src/routes/_layout/cameras/-CameraBentoCard.test.tsx`
- Create: `src/routes/_layout/cameras/index.tsx`
- Create: `src/routes/_layout/cameras/index.test.tsx`
- Modify: `src/tools/registry.ts`
- Modify: `src/routes/_layout/-OverviewPage.test.tsx`
- Regenerate: `src/routeTree.gen.ts`

#### 1. Add failing UI tests

- [ ] Create `-CameraBentoCard.test.tsx`. Mock `CameraPlayer` and verify that the card:
  - links to `/cameras`;
  - has the accessible name `Open Camera`;
  - passes `camera-low` and `Camera` to `CameraPlayer`;
  - displays a small `Camera` label;
  - has a 16:9, non-cropping frame.
- [ ] Create `index.test.tsx`. Mock `CameraPlayer` and verify that the page:
  - has one level-one heading named `Cameras`;
  - labels the camera `Camera`;
  - passes `camera-high` and `Camera` to `CameraPlayer`;
  - does not show audio, recording, or camera-management controls.
- [ ] Modify `src/routes/_layout/-OverviewPage.test.tsx`:
  - add `cameras` to the test router's route list;
  - assert that the camera region appears after the clock and before calendar in the right column;
  - keep all existing overview regression assertions.
- [ ] Run the tests and confirm the expected failures:

```bash
bun run test -- \
  src/routes/_layout/cameras/-CameraBentoCard.test.tsx \
  src/routes/_layout/cameras/index.test.tsx \
  src/routes/_layout/-OverviewPage.test.tsx
```

Expected result: FAIL because the camera card, route, and registry entry do not exist.

#### 2. Build the overview card

- [ ] Create `src/routes/_layout/cameras/-CameraBentoCard.tsx`.
- [ ] Use TanStack Router's `Link`, not a normal anchor.
- [ ] Keep the card visual pattern consistent with existing bento cards:
  - rounded `border-border` card;
  - `outline-none` and `focus-visible:ring-2 focus-visible:ring-ring`;
  - a subtle `hover:border-primary/50` transition;
  - a full-width 16:9 player frame;
  - no hardcoded color values.
- [ ] Put `Camera` at the upper-left as a small overlay. `CameraPlayer` owns the state-accurate `Live` indicator at the upper-right. Keep both overlays legible without covering important video content.
- [ ] Pass `stream="camera-low"` and `label="Camera"` to `CameraPlayer`.
- [ ] Keep the full frame clickable and route it to `/cameras`.

#### 3. Build the Cameras page and register the tool

- [ ] Create `src/routes/_layout/cameras/index.tsx` with `createFileRoute("/_layout/cameras/")`.
- [ ] Render a compact page header named `Cameras` and one large 16:9 camera frame.
- [ ] Pass `stream="camera-high"` and `label="Camera"` to `CameraPlayer`.
- [ ] Do not add playback controls, audio controls, recording controls, settings, or camera account fields.
- [ ] Modify `src/tools/registry.ts`:
  - import `Camera` from `lucide-react`;
  - import `CameraBentoCard`;
  - add `{ id: "cameras", label: "Cameras", route: "/cameras", icon: Camera, BentoCard: CameraBentoCard }` directly after the `clock` entry.
- [ ] Run the focused tests until they pass.

#### 4. Regenerate routing and verify the dashboard build

- [ ] Run the dashboard build so TanStack Start regenerates `src/routeTree.gen.ts`:

```bash
bun run build
```

Expected result: build passes and the generated route tree contains `/_layout/cameras/`.

- [ ] Confirm the generated route and registry position:

```bash
rg -n 'cameras|Cameras' src/routeTree.gen.ts src/tools/registry.ts
```

Expected result: the route tree contains the Cameras route and the registry entry follows Clock.

- [ ] Run the focused tests again:

```bash
bun run test -- \
  src/routes/_layout/cameras/-camera-player-element.test.ts \
  src/routes/_layout/cameras/-CameraPlayer.test.tsx \
  src/routes/_layout/cameras/-CameraBentoCard.test.tsx \
  src/routes/_layout/cameras/index.test.tsx \
  src/routes/_layout/-OverviewPage.test.tsx
```

Expected result: all focused tests pass.

- [ ] Commit the interface:

```bash
git add src/routes/_layout/cameras src/routes/_layout/-OverviewPage.test.tsx src/tools/registry.ts src/routeTree.gen.ts
git commit -m "feat: add camera dashboard views"
```

---

### Task 3: Add a camera deployment contract checker

**Files:**

- Create: `scripts/check-camera-manifests.ts`
- Create: `scripts/check-camera-manifests.sh`
- Create: `tests/-check-camera-manifests.test.ts`
- Modify: `scripts/check-monies-manifests.ts`
- Modify: `tests/-check-monies-manifests.test.ts`
- Modify: `.github/workflows/build-images.yml`

#### 1. Write mutation tests before the checker

- [ ] Create `tests/-check-camera-manifests.test.ts` from an isolated temporary Git fixture. Do not run mutation tests against the dashboard checkout.
- [ ] Build one valid rendered fixture containing only the required camera ConfigMap, go2rtc Deployment, Service, `InfisicalStaticSecret`, Ingress paths, and NetworkPolicy.
- [ ] Add one test for each rejected mutation:
  - a tracked Kubernetes `Secret` contains `TAPO_CAMERA_USERNAME` or `TAPO_CAMERA_PASSWORD`;
  - a tracked source file reads `VITE_TAPO_CAMERA_USERNAME` or `VITE_TAPO_CAMERA_PASSWORD`;
  - a built public file contains a camera secret key name, `rtsp://`, or `192.168.2.44`;
  - any ConfigMap contains a concrete username or password value;
  - the go2rtc Deployment gets a direct credential value instead of `secretKeyRef`;
  - a dashboard or gateway container receives either camera key;
  - the image tag or digest differs from the approved immutable amd64 image;
  - `automountServiceAccountToken` is not `false`;
  - the pod or container security settings are weakened;
  - the Service is not `ClusterIP` or exposes a port other than TCP 1984;
  - ingress uses a broad `/camera-stream` Prefix instead of the two exact paths;
  - ingress exposes any go2rtc configuration, stream-list, debug, or mutation endpoint;
  - the go2rtc module list enables `exec`, `echo`, `expr`, `ffmpeg`, `http`, WebRTC, HLS, MJPEG, or any module outside the exact approved list;
  - NetworkPolicy accepts a source other than Traefik;
  - NetworkPolicy permits egress outside `192.168.2.44/32` TCP 554;
  - Infisical uses a path other than `/camera` or a target other than `dum-dashboard-camera-secrets`.
- [ ] Add one positive test that accepts the exact contract.
- [ ] Add two regression tests to `tests/-check-monies-manifests.test.ts`:
  - accept an egress policy whose pod selector can match only the go2rtc camera pod;
  - reject an egress policy with an empty selector or labels that can match the dashboard pod.
- [ ] Run the new test and confirm that it fails because the checker does not exist:

```bash
bun run test -- tests/-check-camera-manifests.test.ts
```

Expected result: FAIL with an import error for `check-camera-manifests`.

#### 2. Implement the repository and rendered-manifest checks

- [ ] Create `scripts/check-camera-manifests.ts` and export:

```ts
export type CameraCheckOptions = {
  repoRoot: string;
  renderedPath: string;
  publicDir: string;
};
```

- [ ] Export `checkCameraRepository(options: CameraCheckOptions): void` as the single entry point used by tests and the command-line wrapper.

- [ ] Reuse the existing `yaml` and TypeScript parser dependencies. Do not add a new parser package.
- [ ] Inspect only Git-tracked files for committed secret checks. Report the normalized relative file path for every violation.
- [ ] Permit the literal secret key names only in approved files: the checker, its tests, `camera-config.yml`, the go2rtc Deployment `secretKeyRef`, the Infisical resource, the approved camera design and plan, and the operations guide.
- [ ] Reject direct assignments, string data, base64 data, browser environment names, and public build copies of camera keys.
- [ ] Reject a concrete expanded RTSP URL everywhere. Permit only the go2rtc ConfigMap template that references all three environment variables:

```yml
rtsp://${TAPO_CAMERA_USERNAME}:${TAPO_CAMERA_PASSWORD}@${TAPO_CAMERA_HOST}:554/stream2
```

- [ ] Validate the exact rendered contract:
  - Deployment `go2rtc`, namespace `dum-dashboard`, one replica, `Recreate` strategy;
  - image `ghcr.io/alexxit/go2rtc:1.9.14@sha256:1120820fa7405c7655c71928c1f919feaa031fbb34fdc13ebe716006179fe346`;
  - only the go2rtc container receives the two secret keys by `secretKeyRef` from `dum-dashboard-camera-secrets`;
  - `TAPO_CAMERA_HOST` comes from `go2rtc-config` and equals `192.168.2.44` there;
  - no service-account token, non-root UID/GID 65532, RuntimeDefault seccomp, read-only root filesystem, no privilege escalation, all capabilities dropped;
  - explicit CPU and memory requests and limits;
  - ConfigMap disables RTSP listening, WebRTC, and SRTP, defines only `camera-low` and `camera-high`, and has the exact HTTP allow-list;
  - ConfigMap allows only the `api`, `ws`, `rtsp`, and `mp4` modules and does not allow wildcard WebSocket origins;
  - Service `go2rtc` is ClusterIP-only on TCP 1984;
  - Ingress routes only exact `/camera-stream/video-rtc.js` and `/camera-stream/api/ws` paths to `go2rtc:1984`;
  - the existing `/` Prefix still routes to `dum-dashboard:3000`;
  - Infisical project `1617f220-140c-4a04-a8e7-468a71e4ff50`, environment `prod`, path `/camera`, and target `dum-dashboard-camera-secrets`;
  - one camera NetworkPolicy allows Traefik-only ingress on TCP 1984 and camera-only egress to `192.168.2.44/32` TCP 554.
- [ ] Add a command-line entry point with `--repo-root`, `--rendered`, and `--public-dir` arguments. Print one short PASS message without secret values.

#### 3. Keep the existing Monies guard strict and camera-compatible

- [ ] Modify the egress-policy check in `scripts/check-monies-manifests.ts`. It currently rejects every egress policy in the namespace, including a policy that cannot select the dashboard.
- [ ] Add a focused `selectorCanMatchDashboard()` helper that evaluates `matchLabels` and standard `matchExpressions` against the known dashboard labels.
- [ ] Reject any egress policy with a selector that can match dashboard pods. This includes an empty selector and an unknown expression.
- [ ] Allow the exact go2rtc selector because `app.kubernetes.io/name: go2rtc` cannot match `app.kubernetes.io/name: dum-dashboard`.
- [ ] Do not weaken the existing exact validation of `dum-dashboard-traefik-only`.
- [ ] Run both manifest test files:

```bash
bun run test -- \
  tests/-check-camera-manifests.test.ts \
  tests/-check-monies-manifests.test.ts
```

Expected result: both test files pass; dashboard egress remains rejected and camera-only egress is accepted.

#### 4. Add the shell entry point and CI check

- [ ] Create executable `scripts/check-camera-manifests.sh` with `set -euo pipefail`.
- [ ] Follow the existing Monies checker workflow:
  - resolve the Git root;
  - use `mktemp` and remove the file with a trap;
  - require `kubectl` and `bun`;
  - render `k8s/overlays/dumachine` with `kubectl kustomize`;
  - use `${CAMERA_PUBLIC_DIR:-${repo_root}/.output/public}`;
  - call the TypeScript checker with all three absolute paths.
- [ ] Make the wrapper executable:

```bash
chmod +x scripts/check-camera-manifests.sh
```

- [ ] Add a CI step directly after the Monies boundary check in `.github/workflows/build-images.yml`:

```yml
- name: Verify camera secret and network boundaries
  run: bash scripts/check-camera-manifests.sh
```

#### 5. Verify and commit Task 3

- [ ] Run the mutation tests:

```bash
bun run test -- \
  tests/-check-camera-manifests.test.ts \
  tests/-check-monies-manifests.test.ts
```

Expected result: all mutation and positive tests pass.

- [ ] Run syntax, lint, and format checks:

```bash
bash -n scripts/check-camera-manifests.sh
bun run lint
bunx oxfmt --check \
  scripts/check-camera-manifests.ts \
  scripts/check-monies-manifests.ts \
  tests/-check-camera-manifests.test.ts \
  tests/-check-monies-manifests.test.ts \
  .github/workflows/build-images.yml
```

Expected result: all checks pass.

- [ ] Commit the contract checker:

```bash
git add scripts/check-camera-manifests.ts scripts/check-camera-manifests.sh tests/-check-camera-manifests.test.ts scripts/check-monies-manifests.ts tests/-check-monies-manifests.test.ts .github/workflows/build-images.yml
git commit -m "test: guard camera deployment boundaries"
```

---

### Task 4: Add the locked-down go2rtc GitOps resources

**Files:**

- Create: `k8s/base/go2rtc-deployment.yml`
- Create: `k8s/base/go2rtc-service.yml`
- Create: `k8s/overlays/dumachine/camera-config.yml`
- Create: `k8s/overlays/dumachine/camera-infisical.yml`
- Modify: `k8s/base/kustomization.yml`
- Modify: `k8s/overlays/dumachine/kustomization.yml`
- Modify: `k8s/overlays/dumachine/ingress.yml`
- Modify: `k8s/overlays/dumachine/network-policy.yml`

#### 1. Confirm the contract test fails against the real rendered overlay

- [ ] Build the dashboard public files and run the camera checker:

```bash
bun run build
bash scripts/check-camera-manifests.sh
```

Expected result: FAIL because the go2rtc and camera resources are not in the overlay.

#### 2. Add the base Deployment and Service

- [ ] Create `k8s/base/go2rtc-deployment.yml` with:
  - name `go2rtc`, namespace `dum-dashboard`;
  - labels `app.kubernetes.io/name: go2rtc`, `app.kubernetes.io/component: camera-stream`, and `app.kubernetes.io/part-of: dum-dashboard`;
  - one replica and `strategy.type: Recreate`;
  - `automountServiceAccountToken: false`;
  - pod `runAsNonRoot: true`, UID/GID/fsGroup `65532`, and RuntimeDefault seccomp;
  - exact pinned image digest from Global Constraints;
  - named TCP port `http` at 1984;
  - `TAPO_CAMERA_HOST` from ConfigMap `go2rtc-config`, key `TAPO_CAMERA_HOST`;
  - username and password from required keys in Secret `dum-dashboard-camera-secrets` with no `optional: true`;
  - TCP readiness and liveness probes on port `http`;
  - requests `cpu: 25m`, `memory: 32Mi`; limits `cpu: 250m`, `memory: 256Mi`;
  - container `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, and all capabilities dropped;
  - a read-only ConfigMap volume mounted at `/config`, mapping key `go2rtc.yml` to path `go2rtc.yaml` so the upstream default command finds it.
- [ ] Do not add a command, shell wrapper, or custom image. Use the upstream image entrypoint and default config path.
- [ ] Create `k8s/base/go2rtc-service.yml` as a ClusterIP Service named `go2rtc` with one TCP `http` port at 1984.
- [ ] Add both files to `k8s/base/kustomization.yml`.

#### 3. Add dumachine configuration and Infisical sync

- [ ] Create `k8s/overlays/dumachine/camera-config.yml` with a ConfigMap named `go2rtc-config`.
- [ ] Set `TAPO_CAMERA_HOST: "192.168.2.44"`.
- [ ] Put this exact go2rtc configuration under the `go2rtc.yml` key:

```yml
app:
  modules:
    - api
    - ws
    - rtsp
    - mp4
api:
  listen: ":1984"
  base_path: /camera-stream
  allow_paths:
    - /camera-stream/
    - /camera-stream/api/ws
    - /camera-stream/api/streams
log:
  format: text
  level: info
rtsp:
  listen: ""
webrtc:
  listen: ""
srtp:
  listen: ""
streams:
  camera-low: rtsp://${TAPO_CAMERA_USERNAME}:${TAPO_CAMERA_PASSWORD}@${TAPO_CAMERA_HOST}:554/stream2
  camera-high: rtsp://${TAPO_CAMERA_USERNAME}:${TAPO_CAMERA_PASSWORD}@${TAPO_CAMERA_HOST}:554/stream1
```

- [ ] The internal `/camera-stream/` entry is required because go2rtc registers embedded static files at its base-path handler. Traefik must still route only the exact `/camera-stream/video-rtc.js` asset.
- [ ] Keep `/camera-stream/api/streams` in go2rtc's internal allow-list for pod-local diagnostics. Do not route it through Traefik.
- [ ] Keep `api.origin` at its same-origin default. Do not set it to `"*"`.
- [ ] Create `k8s/overlays/dumachine/camera-infisical.yml` with one `InfisicalStaticSecret`:
  - name `dum-dashboard-camera-secrets`, namespace `dum-dashboard`;
  - reuse `dum-dashboard-monies-infisical-auth` in namespace `dum-dashboard`;
  - refresh every 60 seconds with instant updates disabled;
  - project `1617f220-140c-4a04-a8e7-468a71e4ff50`, environment `prod`, path `/camera`;
  - target Secret `dum-dashboard-camera-secrets`, kind `Secret`, `creationPolicy: Owner`.
- [ ] Add both files to `k8s/overlays/dumachine/kustomization.yml`.

#### 4. Add exact ingress routes and network isolation

- [ ] Modify `k8s/overlays/dumachine/ingress.yml`. Add these two paths before the existing `/` route:

```yml
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
```

- [ ] Do not add a broad `/camera-stream` Prefix. Do not route `/camera-stream/api/streams`.
- [ ] Append a `go2rtc-camera-isolation` document to `k8s/overlays/dumachine/network-policy.yml`:
  - select only `app.kubernetes.io/name: go2rtc` and `app.kubernetes.io/component: camera-stream`;
  - set both `Ingress` and `Egress` policy types;
  - allow ingress only from namespace `kube-system` and pods labeled as the existing Traefik deployment, on TCP 1984;
  - allow egress only to `ipBlock.cidr: 192.168.2.44/32` on TCP 554.
- [ ] Do not change the existing dashboard or gateway policies.

#### 5. Render, inspect, and run the contract checker

- [ ] Render the complete overlay:

```bash
kubectl kustomize k8s/overlays/dumachine > /tmp/dum-dashboard-camera-rendered.yml
```

Expected result: command exits with status 0.

- [ ] Inspect only the non-secret camera resource structure:

```bash
rg -n 'name: go2rtc|camera-stream|dum-dashboard-camera-secrets|192\.168\.2\.44|/camera-stream' /tmp/dum-dashboard-camera-rendered.yml
```

Expected result: the Deployment, Service, Infisical target, exact routes, host, and policies are present. No secret value is present.

- [ ] Run the full camera contract:

```bash
bash scripts/check-camera-manifests.sh
```

Expected result: PASS.

- [ ] Run existing manifest boundary checks to catch regressions:

```bash
bash scripts/check-readonly-rbac.sh
bash -n scripts/check-tailnet-boundary.sh
bash scripts/check-monies-manifests.sh
```

Expected result: all checks pass.

- [ ] Remove the temporary rendered file:

```bash
rm /tmp/dum-dashboard-camera-rendered.yml
```

- [ ] Commit the GitOps resources:

```bash
git add k8s/base k8s/overlays/dumachine
git commit -m "feat: deploy private camera stream bridge"
```

---

### Task 5: Document setup and complete local verification

**Files:**

- Modify: `docs/homelab-dashboard-operations.md`

#### 1. Add the operator procedure

- [ ] Add a `Camera stream` section to `docs/homelab-dashboard-operations.md`.
- [ ] State the required network prerequisite: reserve `192.168.2.44` for the Tapo camera in the router DHCP settings.
- [ ] State the required Infisical setup without secret values:
  1. open project `1617f220-140c-4a04-a8e7-468a71e4ff50`;
  2. select environment `prod`;
  3. create path `/camera`;
  4. add `TAPO_CAMERA_USERNAME` and `TAPO_CAMERA_PASSWORD` from the Tapo Camera Account.
- [ ] Explain that the dashboard browser never receives these values. Only the go2rtc pod receives them.
- [ ] Explain that Kubernetes environment variables do not change inside a running pod. After a camera credential rotation and a successful Infisical refresh, restart only `deployment/go2rtc` and verify its rollout.
- [ ] Add exact health commands:

```bash
kubectl -n dum-dashboard get infisicalstaticsecret dum-dashboard-camera-secrets
kubectl -n dum-dashboard rollout status deployment/go2rtc --timeout=180s
kubectl -n dum-dashboard get pod,service,ingress,networkpolicy -l app.kubernetes.io/part-of=dum-dashboard
kubectl -n dum-dashboard logs deployment/go2rtc --tail=100
```

- [ ] Add an internal diagnostics command that checks the two stream names without displaying credentials:

```bash
kubectl -n dum-dashboard exec deployment/go2rtc -- \
  curl -fsS http://127.0.0.1:1984/camera-stream/api/streams
```

- [ ] Add a rollback command that uses Git history and Argo CD. Do not tell the operator to delete resources by hand.

#### 2. Run the full local quality gate

- [ ] Run every project check from a clean shell:

```bash
bun run test
bun run lint
git diff --name-only --diff-filter=ACMR origin/v1 -- \
  | rg '\.(css|html|js|json|jsx|md|ts|tsx|ya?ml)$' \
  | xargs bunx oxfmt --check
bun run build
bun run build:gateway
bun run verify:monitoring
bash scripts/render-monitoring.sh
bash scripts/check-readonly-rbac.sh
bash -n scripts/check-tailnet-boundary.sh
bash scripts/check-monies-manifests.sh
bash scripts/check-camera-manifests.sh
kubectl kustomize k8s/overlays/dumachine >/dev/null
```

Expected result: every command exits with status 0.

- [ ] Scan tracked source and built public assets for forbidden camera exposure. This command must find no real credentials or expanded RTSP URL:

```bash
git grep -n -I -E 'VITE_TAPO_CAMERA_|rtsp://[^$]' -- ':!docs/superpowers/**' || true
rg -n -I 'TAPO_CAMERA_|rtsp://|192\.168\.2\.44' .output/public || true
```

Expected result: no output from `.output/public`; tracked source contains only the approved server-side key references and unexpanded go2rtc template.

- [ ] Review the final diff and whitespace:

```bash
git status --short
git diff --check
git diff --stat origin/v1...HEAD
```

Expected result: only camera feature files and the approved design/plan files are present; `git diff --check` prints nothing.

- [ ] Commit the operations guide:

```bash
git add docs/homelab-dashboard-operations.md
git commit -m "docs: add camera stream operations"
```

---

### Task 6: Publish, merge, deploy, and verify live

**Files:** None unless verification finds a defect. Fix defects in the task that owns the affected file, rerun its tests, and add a focused commit.

#### 1. Complete the external prerequisites

- [ ] Confirm the router has a DHCP reservation that keeps the camera at `192.168.2.44`.
- [ ] Ask the user to add these two values in Infisical `prod` path `/camera` if they are not present:
  - `TAPO_CAMERA_USERNAME`
  - `TAPO_CAMERA_PASSWORD`
- [ ] Do not ask the user to paste either value into chat or a shell command.

#### 2. Push and create the pull request

- [ ] Confirm the branch and clean state:

```bash
git branch --show-current
git status --short
```

Expected result: branch is `feature/tapo-camera-dashboard`; status is clean.

- [ ] Push the branch and create a PR against `v1`:

```bash
git push -u origin feature/tapo-camera-dashboard
gh pr create \
  --base v1 \
  --head feature/tapo-camera-dashboard \
  --title "feat: add private Tapo camera dashboard" \
  --body "Adds a Tailscale-only Tapo camera stream through a locked-down go2rtc pod, with a low-quality overview card, full-quality Cameras page, Infisical credentials, and tested deployment boundaries."
```

- [ ] Watch all PR checks:

```bash
gh pr checks --watch
```

Expected result: all required checks pass. Treat dashboard CI, image publication, deploy-branch update, Argo sync, and live health as separate milestones.

#### 3. Merge and wait for GitOps deployment

- [ ] Merge only after all required checks pass:

```bash
gh pr merge --merge --delete-branch
```

- [ ] Watch the `Build and deploy images` workflow on `v1` until `build-and-push` and `update-tags` pass:

```bash
gh run list --workflow "Build and deploy images" --branch v1 --limit 3
camera_run_id="$(gh run list \
  --workflow "Build and deploy images" \
  --branch v1 \
  --event push \
  --limit 1 \
  --json databaseId \
  --jq '.[0].databaseId')"
test -n "${camera_run_id}"
gh run watch "${camera_run_id}" --exit-status
```

- [ ] Verify that the `deploy` branch has the merged source and new dashboard image tag before checking Argo CD.

#### 4. Verify Infisical, Argo CD, and Kubernetes health

- [ ] Wait for the Infisical operator condition:

```bash
ssh dumachine "kubectl -n dum-dashboard wait \
  infisicalstaticsecret/dum-dashboard-camera-secrets \
  --for='jsonpath={.status.conditions[?(@.type==\"secrets.infisical.com/LastReconcileStatus\")].status}=True' \
  --timeout=120s"
```

Expected result: the resource meets the condition. Do not display Secret data.

- [ ] Wait for Argo CD and both deployments:

```bash
ssh dumachine 'kubectl -n argocd get application dum-dashboard-dumachine'
ssh dumachine 'kubectl -n dum-dashboard rollout status deployment/dum-dashboard --timeout=300s'
ssh dumachine 'kubectl -n dum-dashboard rollout status deployment/go2rtc --timeout=300s'
```

Expected result: Argo CD is Synced and Healthy; both deployments complete.

- [ ] Verify the running go2rtc image and service boundary:

```bash
ssh dumachine 'kubectl -n dum-dashboard get deployment go2rtc -o jsonpath="{.spec.template.spec.containers[0].image}{\"\\n\"}"'
ssh dumachine 'kubectl -n dum-dashboard get service/go2rtc networkpolicy/go2rtc-camera-isolation -o wide'
```

Expected result: the exact pinned image is running; the Service is ClusterIP-only; the policy exists.

- [ ] Check stream registration from inside the go2rtc pod without printing the expanded source URL:

```bash
ssh dumachine "kubectl -n dum-dashboard exec deployment/go2rtc -- sh -c 'curl -fsS http://127.0.0.1:1984/camera-stream/api/streams | jq -e \"has(\\\"camera-low\\\") and has(\\\"camera-high\\\")\"'"
```

Expected result: `true`. If this quoting is changed during execution, first verify that the command still prints only names or a Boolean and never prints source URLs.

- [ ] Inspect only normal-level logs, and redact before sharing any output:

```bash
ssh dumachine 'kubectl -n dum-dashboard logs deployment/go2rtc --tail=100'
```

Expected result: no username, password, or expanded RTSP URL appears.

#### 5. Verify in a real Tailscale browser

- [ ] Use the `browser-testing-with-devtools` skill for live browser verification.
- [ ] Open `https://doh.lumilumi.xyz` from a device connected to the tailnet.
- [ ] Verify the overview card:
  - it is directly below Clock in the right column;
  - it shows the `camera-low` stream;
  - video starts automatically, muted, and without controls;
  - the frame remains 16:9 while loading;
  - the complete image is visible without cropping;
  - selecting the card opens `/cameras`.
- [ ] Verify the Cameras page:
  - it uses `camera-high`;
  - the camera name is `Camera`;
  - playback remains automatic, muted, and video-only;
  - no recording or administration controls exist.
- [ ] In DevTools, verify only these camera requests are reachable through ingress:
  - `/camera-stream/video-rtc.js`;
  - `/camera-stream/api/ws?src=camera-low` or `camera-high`.
- [ ] Confirm `/camera-stream/api/streams` and `/camera-stream/` do not expose the go2rtc API through Traefik.
- [ ] Confirm browser HTML, JavaScript, DOM, console, and network details do not contain `TAPO_CAMERA_USERNAME`, `TAPO_CAMERA_PASSWORD`, `rtsp://`, or `192.168.2.44`.
- [ ] Scroll the overview camera fully outside the viewport for more than five seconds. Confirm its WebSocket closes. Return it to view and confirm playback resumes.
- [ ] Hide the browser tab for more than five seconds. Confirm the WebSocket closes. Return to the tab and confirm playback resumes.
- [ ] Power off or disconnect the camera. Confirm the stable frame shows `Camera offline`. Restore the camera and confirm Live returns without a full page refresh.
- [ ] From a device outside the tailnet, confirm `doh.lumilumi.xyz` and the camera paths remain unavailable.

#### 6. Record final evidence

- [ ] Record these independent results in the handoff:
  - PR checks passed;
  - images published;
  - `deploy` branch updated;
  - Argo CD Synced and Healthy;
  - Infisical ready;
  - go2rtc and dashboard pods ready;
  - overview and full page video verified;
  - offline recovery verified;
  - secret and RTSP URL exposure checks passed;
  - access outside Tailscale denied.
- [ ] If any result is not tested, label it as unverified. Do not infer live success from CI or Argo CD alone.
