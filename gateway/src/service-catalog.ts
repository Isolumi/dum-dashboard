import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

const workloadSchema = z
  .object({
    kind: nonEmptyString,
    name: nonEmptyString,
    imageRepository: nonEmptyString,
    tracksSource: z.boolean(),
    expectedImagePolicy: z.enum(["required", "best-effort"]).optional(),
  })
  .strict();

const applicationCatalogEntrySchema = z
  .object({
    id: nonEmptyString,
    name: nonEmptyString,
    namespace: nonEmptyString,
    argoApplication: nonEmptyString,
    github: z
      .object({
        repository: nonEmptyString,
        branch: nonEmptyString,
        workflow: nonEmptyString,
      })
      .strict()
      .optional(),
    workloads: z.array(workloadSchema).min(1).max(32),
  })
  .strict();

const serviceDefinitionSchema = z
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
    application: nonEmptyString,
  })
  .strict();

const serviceCatalogSchema = z
  .object({
    applications: z.array(applicationCatalogEntrySchema).min(1).max(32),
    services: z.array(serviceDefinitionSchema).max(64),
  })
  .strict()
  .superRefine(({ applications, services }, context) => {
    const applicationIds = new Set<string>();
    const workloadOwners = new Set<string>();
    for (const [index, application] of applications.entries()) {
      if (applicationIds.has(application.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "duplicate application ID",
          path: ["applications", index, "id"],
        });
      }
      applicationIds.add(application.id);
      for (const [workloadIndex, workload] of application.workloads.entries()) {
        if (workload.tracksSource && !application.github) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "tracksSource requires GitHub configuration",
            path: ["applications", index, "workloads", workloadIndex, "tracksSource"],
          });
        }
        const owner = `${application.namespace}/${workload.kind}/${workload.name}`;
        if (workloadOwners.has(owner)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "duplicate workload ownership",
            path: ["applications", index, "workloads", workloadIndex],
          });
        }
        workloadOwners.add(owner);
      }
    }

    const serviceIds = new Set<string>();
    for (const [index, service] of services.entries()) {
      if (serviceIds.has(service.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "duplicate service ID",
          path: ["services", index, "id"],
        });
      }
      serviceIds.add(service.id);
      if (!applicationIds.has(service.application)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "unknown application ID",
          path: ["services", index, "application"],
        });
      }
    }
  });

export type ApplicationCatalogEntry = z.infer<typeof applicationCatalogEntrySchema>;

export interface ServiceCatalogEntry {
  id: string;
  name: string;
  description: string;
  url: string;
  applicationId: string;
  namespace: string;
  argoApplication: string;
  workloads: ApplicationCatalogEntry["workloads"];
}

export interface HomelabCatalog {
  applications: ApplicationCatalogEntry[];
  services: ServiceCatalogEntry[];
}

export async function loadServiceCatalog(path: string): Promise<HomelabCatalog> {
  const contents = await readFile(path, "utf8");
  const catalog = serviceCatalogSchema.parse(parse(contents));
  const applications = new Map(catalog.applications.map((entry) => [entry.id, entry]));

  return {
    applications: catalog.applications,
    services: catalog.services.map((service) => {
      const application = applications.get(service.application)!;
      return {
        id: service.id,
        name: service.name,
        description: service.description,
        url: service.url,
        applicationId: application.id,
        namespace: application.namespace,
        argoApplication: application.argoApplication,
        workloads: application.workloads,
      };
    }),
  };
}
