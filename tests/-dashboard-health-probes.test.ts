import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { parseAllDocuments } from "yaml";

interface KubernetesResource {
  kind?: string;
  metadata?: { name?: string };
  spec?: {
    template?: {
      spec?: {
        containers?: Array<{
          livenessProbe?: { httpGet?: { path?: string } };
          name?: string;
          readinessProbe?: { httpGet?: { path?: string } };
        }>;
      };
    };
  };
}

describe("dashboard health probes", () => {
  it("checks the lightweight health endpoint instead of rendering the dashboard", () => {
    const rendered = execFileSync("kubectl", ["kustomize", "k8s/overlays/dumachine"], {
      encoding: "utf8",
    });
    const resources = parseAllDocuments(rendered).map(
      (document) => document.toJSON() as KubernetesResource,
    );
    const deployment = resources.find(
      (resource) => resource.kind === "Deployment" && resource.metadata?.name === "dum-dashboard",
    );
    const dashboard = deployment?.spec?.template?.spec?.containers?.find(
      (container) => container.name === "dashboard",
    );

    expect(dashboard?.readinessProbe?.httpGet?.path).toBe("/healthz");
    expect(dashboard?.livenessProbe?.httpGet?.path).toBe("/healthz");
  });
});
