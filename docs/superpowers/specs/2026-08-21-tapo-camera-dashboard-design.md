# Tapo Camera Dashboard Design

**Date:** 2026-08-21
**Status:** Approved in chat; awaiting written-spec review

## Goal

Add the live video from one TP-Link Tapo C100 V2.0 camera to Dum Dashboard. The overview shows a small automatic muted stream, and a dedicated Cameras page shows the full-quality stream. The feature stays private to the existing Tailscale-only dashboard boundary.

## Verified camera facts

- Camera name in the dashboard: `Camera`
- Local camera address: `192.168.2.44`
- RTSP port `554` is reachable from `dumachine`.
- The low stream at `/stream2` provides H.264 video at 640 x 360.
- The high stream at `/stream1` provides the camera's full-quality video.
- The camera also provides G.711 audio, but this feature does not use audio.
- A separate Tapo Camera Account exists for third-party RTSP access.

The router must keep `192.168.2.44` assigned to this camera through a DHCP reservation. A changed address must be treated as configuration, not fixed with code.

## Scope

### Included

- One camera.
- Automatic muted video on the overview.
- A `Cameras` sidebar entry and `/cameras` page.
- A 360p overview stream and a full-quality page stream.
- A clean loading state and a fixed `Camera offline` state.
- Automatic recovery when the camera becomes available again.
- GitOps deployment through the existing Dum Dashboard repository and Argo CD application.
- Camera credentials from Infisical.

### Not included

- Audio playback or two-way audio.
- Recording, clips, screenshots, or storage.
- Motion or person detection.
- PTZ controls.
- Camera administration from the dashboard.
- More than one camera.
- A public camera endpoint.

## Architecture

```text
Tapo C100
  | RTSP over the local network
  v
go2rtc pod in the dum-dashboard namespace
  | MSE over same-origin HTTPS and WebSocket
  v
Traefik at doh.lumilumi.xyz
  | Tailscale-only ingress boundary
  v
Dum Dashboard browser
```

The upstream go2rtc project is the protocol bridge. It reads RTSP from the camera and sends browser-compatible fragmented MP4 through Media Source Extensions (MSE). Dum Dashboard reuses go2rtc's maintained `video-rtc` player instead of implementing RTSP, MSE framing, reconnect logic, or viewport handling.

MSE is fixed for the first version. WebRTC is not enabled because it adds ICE candidate and TCP/UDP routing work. HLS is not used because it adds avoidable delay.

## Repository and GitOps ownership

All source and Kubernetes configuration for this feature live in the `dum-dashboard` repository.

- The dashboard image contains the React camera tool.
- Kustomize contains the go2rtc Deployment, Service, ConfigMap, Infisical resource, ingress path, and NetworkPolicies.
- The official go2rtc image is pinned to an immutable digest. Dum Dashboard does not build a custom streaming image.
- The existing `dum-dashboard` Argo CD Application deploys both the dashboard change and go2rtc resources.
- Changes follow the normal `v1` pull request, CI, merge, `deploy` branch, Argo sync, and live verification process.

## Stream configuration

go2rtc defines two named on-demand streams:

- `camera-low` uses `rtsp://...@192.168.2.44:554/stream2`.
- `camera-high` uses `rtsp://...@192.168.2.44:554/stream1`.

The player requests video only. go2rtc must not transcode video because the camera already provides browser-compatible H.264. A stream is opened only while a visible player consumes it.

The host is non-secret configuration. The RTSP username and password are secret values. The complete RTSP URL must never exist in Git, a ConfigMap, a browser bundle, or dashboard HTML.

## Secret handling

Use the existing Infisical connection pattern with a separate `/camera` secret path and a separate Kubernetes target named `dum-dashboard-camera-secrets`.

Required secret keys:

- `TAPO_CAMERA_USERNAME`
- `TAPO_CAMERA_PASSWORD`

Only the go2rtc pod receives these keys. The Dum Dashboard and Homelab Gateway pods do not receive them. go2rtc expands the values into its in-memory stream configuration at runtime.

If either secret is absent, the go2rtc pod must fail closed. There is no default username, password, URL, or fallback stream.

Use normal production log levels. Live verification must confirm that success and failure logs do not contain the username, password, or complete RTSP URL.

## HTTP boundary

Traefik routes a same-origin prefix such as `/camera-stream` to the ClusterIP-only go2rtc Service. The existing `/` route continues to target Dum Dashboard.

go2rtc uses the same base path and an HTTP allow-list. Only the files and WebSocket endpoint required by the player are available. Configuration, stream inspection, mutation, debug, and settings endpoints are not exposed through ingress.

The browser receives no RTSP address or camera credential. It knows only the safe stream names `camera-low` and `camera-high` and the same-origin player path.

## Kubernetes security

The go2rtc workload uses:

- One replica.
- No Kubernetes ServiceAccount token.
- A non-root UID and GID.
- A read-only root filesystem.
- Dropped Linux capabilities.
- RuntimeDefault seccomp.
- Explicit CPU and memory requests and limits.
- A ClusterIP-only Service on the go2rtc HTTP port.
- TCP readiness and liveness probes.

NetworkPolicy allows:

- Ingress to go2rtc only from Traefik on its HTTP port.
- Egress from go2rtc only to `192.168.2.44:554/TCP`.

The existing Traefik Tailscale source restriction remains the outer access boundary. Private DNS alone is not accepted as access control.

## Dashboard user interface

### Shared camera player

A small `CameraPlayer` adapter wraps go2rtc's `video-rtc` custom element. It owns only dashboard concerns:

- Stream name.
- Accessible label.
- Aspect ratio and visual size.
- Automatic muted playback.
- `playsInline` behavior on mobile devices.
- Loading and offline presentation.

The adapter does not implement a media protocol. The upstream player owns MSE negotiation, reconnects, hidden-page stopping, and off-screen stopping.

### Overview card

- Add `Cameras` to the tool registry directly after `Clock`.
- This places the camera card below the clock in the overview's right column.
- Use a 16:9 frame with the `camera-low` stream.
- Preserve the full camera image without cropping.
- Show a small `Camera` label and `Live` indicator over the image.
- Start automatically and muted when visible.
- The card opens `/cameras` when selected.

### Cameras page

- Add a dedicated `/cameras` route and `Cameras` sidebar entry.
- Show one large 16:9 frame using `camera-high`.
- Show the name `Camera`.
- Keep playback automatic, muted, and video-only.
- Do not show audio, recording, or camera-administration controls.

## States and recovery

The player has four user-visible states:

1. **Idle:** The player is outside the viewport or the page is hidden. No camera connection is required.
2. **Loading:** A reserved 16:9 frame is visible. The layout does not move.
3. **Live:** Video is playing and the fixed `Live` indicator is visible.
4. **Offline:** The fixed message `Camera offline` is visible in the same frame.

The player retries after a failure with bounded backoff. It returns to Live without a full dashboard refresh when the camera or network recovers. Repeated retries must not create overlapping RTSP or WebSocket connections.

## Security headers

The existing `Permissions-Policy` continues to disable browser camera and microphone capture. This feature plays a remote stream and does not request device camera or microphone permission.

The Content Security Policy must allow the same-origin HTTPS and WebSocket requests required by the player. It must not add a third-party script origin or a broad wildcard.

## Verification

### Automated checks

- Component tests for automatic muted playback, the correct low/high stream name, overview navigation, stable loading layout, and offline recovery.
- A contract test for the player adapter so upstream player details do not spread into page components.
- Manifest tests that reject camera credentials or a complete RTSP URL in tracked files, rendered public assets, ConfigMaps, and browser environment variables.
- Kustomize rendering for the dumachine overlay.
- NetworkPolicy checks for Traefik-only ingress and camera-only egress.
- Existing `bun run test`, lint, format, dashboard build, gateway build, and security scripts.

### Live checks

- Infisical reports the camera secret as ready.
- The go2rtc Deployment is available and its pod is ready.
- Both named streams connect from inside K3s.
- The 360p overview stream starts automatically and muted.
- The full page uses the high stream and remains video-only.
- Leaving the viewport or hiding the page closes the consumer.
- Turning the camera off produces the fixed offline state; turning it on recovers without a full page refresh.
- Browser console and network panels contain no camera credentials or RTSP URL.
- go2rtc logs contain no camera credentials or complete RTSP URL.
- `doh.lumilumi.xyz` works from a Tailscale device and remains unavailable outside the Tailscale boundary.
- Argo CD reports the Dum Dashboard application Synced and Healthy.

## Rollback

Rollback is the normal GitOps revert of the camera feature commit. Argo CD then removes the go2rtc workload, Service, ingress path, ConfigMap, Infisical target, and NetworkPolicies. The Infisical source secrets can remain for a later retry or be deleted separately after the rollback is verified.

