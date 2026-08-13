import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadServiceCatalog } from "./service-catalog";

const temporaryDirectories: string[] = [];

async function writeCatalog(contents: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "dum-dashboard-service-catalog-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "services.yml");
  await writeFile(path, contents, "utf8");
  return path;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe("loadServiceCatalog", () => {
  it("loads applications and resolves each service reference", async () => {
    const path = await writeCatalog(`
applications:
  - id: yootoob-mp3
    name: Yootoob MP3
    namespace: yootoob-mp3
    argoApplication: yootoob-mp3-dumachine
    github:
      repository: Isolumi/youtube-mp3
      branch: development
      workflow: build-images.yml
    workloads:
      - kind: Deployment
        name: yootoob-mp3-api
        imageRepository: ghcr.io/isolumi/yootoob-mp3-api
        tracksSource: true
  - id: monitoring
    name: Monitoring
    namespace: monitoring
    argoApplication: kube-prometheus-stack
    workloads:
      - kind: Deployment
        name: kube-prometheus-stack-grafana
        imageRepository: docker.io/grafana/grafana
        tracksSource: false
services:
  - id: yootoob-mp3
    name: Yootoob MP3
    description: Private YouTube MP3 downloader
    url: https://yootoob.doh.lumilumi.xyz
    application: yootoob-mp3
  - id: grafana
    name: Grafana
    description: Private monitoring dashboards
    url: https://grafana.doh.lumilumi.xyz
    application: monitoring
`);

    const catalog = await loadServiceCatalog(path);

    expect(catalog.applications).toHaveLength(2);
    expect(catalog.services).toEqual([
      {
        id: "yootoob-mp3",
        name: "Yootoob MP3",
        description: "Private YouTube MP3 downloader",
        url: "https://yootoob.doh.lumilumi.xyz",
        applicationId: "yootoob-mp3",
        namespace: "yootoob-mp3",
        argoApplication: "yootoob-mp3-dumachine",
        workloads: [
          {
            kind: "Deployment",
            name: "yootoob-mp3-api",
            imageRepository: "ghcr.io/isolumi/yootoob-mp3-api",
            tracksSource: true,
          },
        ],
      },
      {
        id: "grafana",
        name: "Grafana",
        description: "Private monitoring dashboards",
        url: "https://grafana.doh.lumilumi.xyz",
        applicationId: "monitoring",
        namespace: "monitoring",
        argoApplication: "kube-prometheus-stack",
        workloads: [
          {
            kind: "Deployment",
            name: "kube-prometheus-stack-grafana",
            imageRepository: "docker.io/grafana/grafana",
            tracksSource: false,
          },
        ],
      },
    ]);
  });

  it("rejects unknown catalog keys", async () => {
    const path = await writeCatalog(`
applications:
  - id: yootoob-mp3
    name: Yootoob MP3
    namespace: yootoob-mp3
    argoApplication: yootoob-mp3-dumachine
    workloads:
      - kind: Deployment
        name: yootoob-mp3-api
        imageRepository: ghcr.io/isolumi/yootoob-mp3-api
        tracksSource: true
services:
  - id: yootoob-mp3
    name: Yootoob MP3
    description: Private YouTube MP3 downloader
    url: https://yootoob.doh.lumilumi.xyz
    application: yootoob-mp3
    unexpected: value
`);

    await expect(loadServiceCatalog(path)).rejects.toThrow(/unrecognized key/i);
  });

  it("rejects duplicate service IDs", async () => {
    const path = await writeCatalog(`
applications:
  - id: yootoob-mp3
    name: Yootoob MP3
    namespace: yootoob-mp3
    argoApplication: yootoob-mp3-dumachine
    workloads:
      - kind: Deployment
        name: yootoob-mp3-api
        imageRepository: ghcr.io/isolumi/yootoob-mp3-api
        tracksSource: true
services:
  - id: yootoob-mp3
    name: Yootoob MP3
    description: Private YouTube MP3 downloader
    url: https://yootoob.doh.lumilumi.xyz
    application: yootoob-mp3
  - id: yootoob-mp3
    name: duplicate
    description: Duplicate ID
    url: https://duplicate.doh.lumilumi.xyz
    application: yootoob-mp3
`);

    await expect(loadServiceCatalog(path)).rejects.toThrow(/duplicate service ID/i);
  });

  it("rejects source tracking when an application has no GitHub pipeline", async () => {
    const path = await writeCatalog(`
applications:
  - id: monitoring
    name: Monitoring
    namespace: monitoring
    argoApplication: kube-prometheus-stack
    workloads:
      - kind: Deployment
        name: kube-prometheus-stack-grafana
        imageRepository: docker.io/grafana/grafana
        tracksSource: true
services: []
`);

    await expect(loadServiceCatalog(path)).rejects.toThrow(/tracksSource requires GitHub/i);
  });

  it("rejects two applications that claim the same workload", async () => {
    const path = await writeCatalog(`
applications:
  - id: first
    name: First
    namespace: shared
    argoApplication: first
    workloads:
      - kind: Deployment
        name: api
        imageRepository: ghcr.io/isolumi/api
        tracksSource: false
  - id: second
    name: Second
    namespace: shared
    argoApplication: second
    workloads:
      - kind: Deployment
        name: api
        imageRepository: ghcr.io/isolumi/api
        tracksSource: false
services: []
`);

    await expect(loadServiceCatalog(path)).rejects.toThrow(/duplicate workload ownership/i);
  });
});
