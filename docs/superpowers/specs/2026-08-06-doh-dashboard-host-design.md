# Doh Dashboard Host Cutover Design

## Goal

Move the private Homelab dashboard from `https://dashboard.doh.lumilumi.xyz` to
`https://doh.lumilumi.xyz`. The old dashboard hostname must stop serving the application and must
not redirect.

## Design

Use one GitOps cutover because brief downtime is acceptable. Replace the dashboard Ingress host
and TLS host with `doh.lumilumi.xyz`, and change the cert-manager `Certificate` to request only
`doh.lumilumi.xyz`. Keep the existing service, namespace, Argo application, and TLS Secret name so
no application code or deployment wiring changes.

Public DNS already resolves `doh.lumilumi.xyz` to dumachine's Tailscale address. After Argo syncs,
Traefik will route the apex hostname to the dashboard. The removed hostname will have no matching
Ingress and will return Traefik's 404 response.

## Failure Behavior

The existing TLS Secret initially contains a certificate for the old hostname. During cert-manager
reissuance, `doh.lumilumi.xyz` may briefly show a certificate mismatch or be unavailable. Argo and
cert-manager status will expose the transition; completion requires the replacement certificate to
be Ready for the new hostname.

## Verification

- Render the Kustomize overlay and assert only `doh.lumilumi.xyz` appears in the active Ingress and
  Certificate.
- Run the complete tests, lint, formatting, TypeScript, security-boundary validation, and builds.
- Merge through the protected `v1` branch and wait for the image/tag workflow and Argo sync.
- Verify the certificate is Ready, `https://doh.lumilumi.xyz/homelab` renders without browser
  errors over Tailscale, and `https://dashboard.doh.lumilumi.xyz` returns 404.
- Re-run the tailnet boundary check so the dashboard remains unavailable through dumachine's LAN
  address.
