import { spawnSync } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";
import { parse, stringify } from "yaml";

const repoRoot = process.cwd();
const temporaryDirectories: string[] = [];

const createMutatedValues = async (mutate: (values: ReturnType<typeof parse>) => void) => {
  const directory = await mkdtemp(join(tmpdir(), "dum-dashboard-monitoring-values-"));
  temporaryDirectories.push(directory);

  const valuesPath = join(directory, "prometheus-values.yml");
  const values = parse(
    await readFile(join(repoRoot, "k8s/argocd/prometheus-values.yml"), "utf8"),
  );
  mutate(values);
  await writeFile(valuesPath, stringify(values));

  return { directory, valuesPath };
};

const runStaticVerifier = async (mutate: (values: ReturnType<typeof parse>) => void) => {
  const { directory, valuesPath } = await createMutatedValues(mutate);
  const projectPath = join(directory, "prometheus-project.yml");
  await copyFile(join(repoRoot, "k8s/argocd/prometheus-project.yml"), projectPath);

  return spawnSync("bun", ["scripts/verify-monitoring-values.ts"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PROMETHEUS_PROJECT_PATH: projectPath,
      PROMETHEUS_VALUES_PATH: valuesPath,
    },
  });
};

const runRenderVerifier = async (mutate: (values: ReturnType<typeof parse>) => void) => {
  const { valuesPath } = await createMutatedValues(mutate);

  return spawnSync("bash", ["scripts/render-monitoring.sh"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PROMETHEUS_VALUES_PATH: valuesPath,
    },
  });
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe("monitoring values contract mutations", () => {
  test("rejects a datasource sidecar that does not search all namespaces", async () => {
    const result = await runStaticVerifier((values) => {
      delete values.grafana.sidecar.datasources.searchNamespace;
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("searchNamespace");
  });

  test("rejects an enabled public Prometheus ingress", async () => {
    const result = await runStaticVerifier((values) => {
      values.prometheus.ingress = {
        enabled: true,
        hosts: ["prometheus.public.example"],
      };
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("prometheus.ingress");
  });

  test("rejects a public Prometheus host even when its ingress is disabled", async () => {
    const result = await runStaticVerifier((values) => {
      values.prometheus.ingress = {
        enabled: false,
        hosts: ["prometheus.public.example"],
      };
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("prometheus.ingress");
  });

  test("rejects Loki route configuration from this monitoring values scope", async () => {
    const result = await runStaticVerifier((values) => {
      values.loki = {
        ingress: {
          enabled: true,
          hosts: ["loki.public.example"],
        },
      };
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("loki");
  });

  test(
    "rejects a rendered Ingress in addition to the approved Grafana Ingress",
    async () => {
      const result = await runRenderVerifier((values) => {
        values.prometheus.ingress = {
          enabled: true,
          hosts: ["prometheus.public.example"],
        };
      });

      expect(result.status).not.toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toContain("exactly one Ingress");
    },
    30_000,
  );
});
