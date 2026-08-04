import { describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/argocd.json";
import { ArgoProvider } from "./argocd";

describe("ArgoProvider", () => {
  it("reads and maps the Application custom resource from the argocd namespace", async () => {
    const customObjectsApi = {
      getNamespacedCustomObject: vi.fn(async () => structuredClone(fixture)),
    };
    const provider = new ArgoProvider({ customObjectsApi });

    await expect(provider.getApplication("yootoob-mp3-dumachine")).resolves.toEqual({
      name: "yootoob-mp3-dumachine",
      namespace: "argocd",
      sync: {
        status: "Synced",
        revision: "0123456789abcdef0123456789abcdef01234567",
      },
      health: {
        status: "Healthy",
        message: "Application is healthy",
        lastTransitionAt: "2026-08-04T12:01:00Z",
      },
      operation: {
        phase: "Succeeded",
        message: "successfully synced",
        revision: "0123456789abcdef0123456789abcdef01234567",
        startedAt: "2026-08-04T12:00:00Z",
        finishedAt: "2026-08-04T12:01:00Z",
      },
      resources: [
        {
          group: "apps",
          version: "v1",
          kind: "Deployment",
          namespace: "yootoob-mp3",
          name: "yootoob-mp3-api",
          syncStatus: "Synced",
          healthStatus: "Healthy",
          healthMessage: "Deployment has minimum availability",
        },
        {
          group: "apps",
          version: "v1",
          kind: "Deployment",
          namespace: "yootoob-mp3",
          name: "yootoob-mp3-frontend",
          syncStatus: "Synced",
          healthStatus: "Healthy",
          healthMessage: "Deployment has minimum availability",
        },
      ],
      images: fixture.status.summary.images,
    });

    expect(customObjectsApi.getNamespacedCustomObject).toHaveBeenCalledWith(
      {
        group: "argoproj.io",
        version: "v1alpha1",
        namespace: "argocd",
        plural: "applications",
        name: "yootoob-mp3-dumachine",
      },
      expect.anything(),
    );
    expect(provider.source).toBe("argocd");
  });

  it("contains invalid or failed custom-object responses without exposing upstream details", async () => {
    const invalid = new ArgoProvider({
      customObjectsApi: { getNamespacedCustomObject: vi.fn(async () => ({ status: {} })) },
    });
    const failed = new ArgoProvider({
      customObjectsApi: {
        getNamespacedCustomObject: vi.fn(async () => {
          throw new Error("token=private stack=/secret/path");
        }),
      },
    });

    await expect(invalid.getApplication("yootoob-mp3-dumachine")).rejects.toThrow(
      /^Argo CD response invalid$/,
    );
    await expect(failed.getApplication("yootoob-mp3-dumachine")).rejects.toThrow(
      /^Argo CD request failed$/,
    );
  });
});
