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
  it("loads the configured private service entry", async () => {
    const catalog = await loadServiceCatalog(
      join(import.meta.dirname, "../../config/homelab-services.yml"),
    );

    expect(catalog).toEqual([
      {
        id: "yootoob-mp3",
        name: "yootoob-mp3",
        description: "Private YouTube MP3 downloader",
        url: "https://yootoob.doh.lumilumi.xyz",
        namespace: "yootoob-mp3",
        argoApplication: "yootoob-mp3-dumachine",
        workloads: [
          { kind: "Deployment", name: "yootoob-mp3-api" },
          { kind: "Deployment", name: "yootoob-mp3-frontend" },
        ],
      },
    ]);
  });

  it("rejects unknown catalog keys", async () => {
    const path = await writeCatalog(`
services:
  - id: yootoob-mp3
    name: yootoob-mp3
    description: Private YouTube MP3 downloader
    url: https://yootoob.doh.lumilumi.xyz
    namespace: yootoob-mp3
    argoApplication: yootoob-mp3-dumachine
    workloads:
      - kind: Deployment
        name: yootoob-mp3-api
    unexpected: value
`);

    await expect(loadServiceCatalog(path)).rejects.toThrow(/unrecognized key/i);
  });
});
