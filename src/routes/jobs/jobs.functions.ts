import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";

import type { Job } from "#/lib/database.types";
import { assertSameOrigin, getOwnerUser, noStore } from "#/lib/server-auth";
import { deleteJobRecord, listJobRecords } from "./job.domain";
import { DeleteJobSchema } from "./job.schemas";

export const getJobs = createServerFn({ method: "POST" }).handler(async (): Promise<Job[]> => {
  noStore();
  getOwnerUser();
  return await listJobRecords();
});

export const deleteJob = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(DeleteJobSchema))
  .handler(async ({ data }): Promise<void> => {
    noStore();
    getOwnerUser();
    assertSameOrigin();
    await deleteJobRecord(data.id);
  });
