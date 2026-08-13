import { describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/argocd.json";
import { ArgoProvider, parseArgoApplicationState } from "./argocd";

const TARGET = { applicationName: "yootoob-mp3-dumachine" } as const;

describe("ArgoProvider", () => {
  it("reads and maps the Application custom resource from the argocd namespace", async () => {
    const customObjectsApi = {
      getNamespacedCustomObject: vi.fn(async () => structuredClone(fixture)),
    };
    const provider = new ArgoProvider({ ...TARGET, customObjectsApi });

    await expect(provider.getApplication("yootoob-mp3-dumachine")).resolves.toEqual({
      name: "yootoob-mp3-dumachine",
      namespace: "argocd",
      sync: {
        status: "Synced",
        revision: "feedfacefeedfacefeedfacefeedfacefeedface",
      },
      health: {
        status: "Healthy",
        message: "Application is healthy",
        lastTransitionAt: "2026-08-04T12:01:00Z",
      },
      operation: {
        phase: "Succeeded",
        message: "successfully synced",
        revision: "feedfacefeedfacefeedfacefeedfacefeedface",
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
      images: [
        "ghcr.io/isolumi/yootoob-mp3-api:1829d6ba3b55e66a2134ae64161b9e48ad39a197",
        "ghcr.io/isolumi/yootoob-mp3-frontend:1829d6ba3b55e66a2134ae64161b9e48ad39a197",
      ],
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
      ...TARGET,
      customObjectsApi: { getNamespacedCustomObject: vi.fn(async () => ({ status: {} })) },
    });
    const failed = new ArgoProvider({
      ...TARGET,
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

  it.each(["resources", "images"] as const)(
    "rejects Argo %s at max plus one",
    async (collection) => {
      const payload = structuredClone(fixture);
      if (collection === "resources") {
        payload.status.resources = Array.from({ length: 257 }, () =>
          structuredClone(fixture.status.resources[0]!),
        );
      } else {
        payload.status.summary.images = Array.from(
          { length: 65 },
          () => fixture.status.summary.images[0]!,
        );
      }
      const provider = new ArgoProvider({
        ...TARGET,
        customObjectsApi: { getNamespacedCustomObject: vi.fn(async () => payload) },
      });

      await expect(provider.getApplication("yootoob-mp3-dumachine")).rejects.toThrow(
        /^Argo CD response invalid$/,
      );
    },
  );

  it("parses null-prototype Argo state into one fresh normalized copy", async () => {
    const provider = new ArgoProvider({
      ...TARGET,
      customObjectsApi: {
        getNamespacedCustomObject: vi.fn(async () => structuredClone(fixture)),
      },
    });
    const normalized = await provider.getApplication("yootoob-mp3-dumachine");
    const value = Object.assign(Object.create(null), normalized, {
      sync: Object.assign(Object.create(null), normalized.sync),
      health: Object.assign(Object.create(null), normalized.health),
      operation: Object.assign(Object.create(null), normalized.operation),
      resources: normalized.resources.map((resource) =>
        Object.assign(Object.create(null), resource),
      ),
      images: [...normalized.images],
    });

    const parsed = parseArgoApplicationState(value);

    expect(parsed).toEqual(normalized);
    expect(parsed).not.toBe(value);
    expect(parsed?.sync).not.toBe(value.sync);
    expect(parsed?.resources[0]).not.toBe(value.resources[0]);
  });

  it("rejects blank required strings in normalized Argo application evidence", async () => {
    const provider = new ArgoProvider({
      ...TARGET,
      customObjectsApi: {
        getNamespacedCustomObject: vi.fn(async () => structuredClone(fixture)),
      },
    });
    const validApplication = await provider.getApplication("yootoob-mp3-dumachine");
    const requiredMutations = [
      (value: typeof validApplication, invalid: string) => {
        value.sync.status = invalid;
      },
      (value: typeof validApplication, invalid: string) => {
        value.sync.revision = invalid;
      },
      (value: typeof validApplication, invalid: string) => {
        value.health.status = invalid;
      },
      (value: typeof validApplication, invalid: string) => {
        value.operation.phase = invalid;
      },
    ] as const;

    for (const mutate of requiredMutations) {
      for (const invalid of ["", "   "]) {
        const value = structuredClone(validApplication);
        mutate(value, invalid);

        expect(parseArgoApplicationState(value)).toBeNull();
      }
    }

    for (const path of ["kind", "name", "syncStatus"] as const) {
      for (const invalid of ["", "   "]) {
        const value = structuredClone(validApplication);
        value.resources[0]![path] = invalid;

        expect(parseArgoApplicationState(value)).toBeNull();
      }
    }
  });

  it.each(["", "   "] as const)("rejects a blank normalized Argo image entry", async (invalid) => {
    const provider = new ArgoProvider({
      ...TARGET,
      customObjectsApi: {
        getNamespacedCustomObject: vi.fn(async () => structuredClone(fixture)),
      },
    });
    const value = await provider.getApplication("yootoob-mp3-dumachine");
    value.images[0] = invalid;

    expect(parseArgoApplicationState(value)).toBeNull();
  });

  it.each([
    {
      name: "sync revision",
      mutate: (payload: typeof fixture) => {
        payload.status.sync.revision = " \t\n";
      },
    },
    {
      name: "health status",
      mutate: (payload: typeof fixture) => {
        payload.status.health.status = " \t\n";
      },
    },
    {
      name: "operation phase",
      mutate: (payload: typeof fixture) => {
        payload.status.operationState.phase = " \t\n";
      },
    },
    {
      name: "resource kind",
      mutate: (payload: typeof fixture) => {
        payload.status.resources[0]!.kind = " \t\n";
      },
    },
    {
      name: "resource name",
      mutate: (payload: typeof fixture) => {
        payload.status.resources[0]!.name = " \t\n";
      },
    },
    {
      name: "resource sync status",
      mutate: (payload: typeof fixture) => {
        payload.status.resources[0]!.status = " \t\n";
      },
    },
  ])(
    "rejects whitespace-only custom-resource $name with a fixed safe error",
    async ({ mutate }) => {
      const payload = structuredClone(fixture);
      mutate(payload);
      const provider = new ArgoProvider({
        ...TARGET,
        customObjectsApi: { getNamespacedCustomObject: vi.fn(async () => payload) },
      });

      await expect(provider.getApplication("yootoob-mp3-dumachine")).rejects.toThrow(
        /^Argo CD response invalid$/,
      );
    },
  );

  it.each([
    {
      name: "sync status empty",
      invalid: "",
      mutate: (payload: typeof fixture, invalid: string) => {
        payload.status.sync.status = invalid;
      },
    },
    {
      name: "sync status whitespace",
      invalid: " \t\n",
      mutate: (payload: typeof fixture, invalid: string) => {
        payload.status.sync.status = invalid;
      },
    },
    {
      name: "summary image empty",
      invalid: "",
      mutate: (payload: typeof fixture, invalid: string) => {
        payload.status.summary.images[0] = invalid;
      },
    },
    {
      name: "summary image whitespace",
      invalid: " \t\n",
      mutate: (payload: typeof fixture, invalid: string) => {
        payload.status.summary.images[0] = invalid;
      },
    },
  ])("rejects blank custom-resource $name with a fixed safe error", async ({ invalid, mutate }) => {
    const payload = structuredClone(fixture);
    mutate(payload, invalid);
    const provider = new ArgoProvider({
      ...TARGET,
      customObjectsApi: { getNamespacedCustomObject: vi.fn(async () => payload) },
    });

    await expect(provider.getApplication("yootoob-mp3-dumachine")).rejects.toThrow(
      /^Argo CD response invalid$/,
    );
  });

  it("preserves null and empty defaults for absent optional Argo status fields", async () => {
    const payload = structuredClone(fixture);
    const status = payload.status as unknown as Record<string, unknown> & {
      health: Record<string, unknown>;
      operationState: Record<string, unknown>;
    };
    delete status.health.message;
    delete status.health.lastTransitionTime;
    delete status.operationState.message;
    delete status.operationState.startedAt;
    delete status.operationState.finishedAt;
    delete status.operationState.syncResult;
    delete status.resources;
    delete status.summary;
    const provider = new ArgoProvider({
      ...TARGET,
      customObjectsApi: { getNamespacedCustomObject: vi.fn(async () => payload) },
    });

    await expect(provider.getApplication("yootoob-mp3-dumachine")).resolves.toMatchObject({
      health: { message: null, lastTransitionAt: null },
      operation: {
        message: null,
        revision: null,
        startedAt: null,
        finishedAt: null,
      },
      resources: [],
      images: [],
    });
  });

  it.each(["summary", "syncResult", "resource health"] as const)(
    "rejects a present transparent proxy in optional Argo %s evidence",
    async (field) => {
      const payload = structuredClone(fixture);
      if (field === "summary") {
        payload.status.summary = new Proxy(payload.status.summary, {});
      } else if (field === "syncResult") {
        payload.status.operationState.syncResult = new Proxy(
          payload.status.operationState.syncResult,
          {},
        );
      } else {
        payload.status.resources[0]!.health = new Proxy(payload.status.resources[0]!.health, {});
      }
      const provider = new ArgoProvider({
        ...TARGET,
        customObjectsApi: { getNamespacedCustomObject: vi.fn(async () => payload) },
      });

      await expect(provider.getApplication("yootoob-mp3-dumachine")).rejects.toThrow(
        /^Argo CD response invalid$/,
      );
    },
  );
});
