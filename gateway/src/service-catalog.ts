import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

const serviceCatalogEntrySchema = z
  .object({
    id: nonEmptyString,
    name: nonEmptyString,
    description: nonEmptyString,
    url: nonEmptyString.refine(
      (value) => {
        try {
          const url = new URL(value);
          return url.protocol === "https:" && !url.username && !url.password;
        } catch {
          return false;
        }
      },
      { message: "must be an HTTPS URL without credentials" },
    ),
    namespace: nonEmptyString,
    argoApplication: nonEmptyString,
    workloads: z
      .array(
        z
          .object({
            kind: nonEmptyString,
            name: nonEmptyString,
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

const serviceCatalogSchema = z
  .object({
    services: z.array(serviceCatalogEntrySchema).min(1),
  })
  .strict();

export type ServiceCatalogEntry = z.infer<typeof serviceCatalogEntrySchema>;

export async function loadServiceCatalog(path: string): Promise<ServiceCatalogEntry[]> {
  const contents = await readFile(path, "utf8");
  return serviceCatalogSchema.parse(parse(contents)).services;
}
