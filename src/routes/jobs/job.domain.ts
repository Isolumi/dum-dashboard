import type { Job } from "#/lib/database.types";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { SaveJobSchema, type SaveJobInput } from "./job.schemas";

const JOB_COLUMNS = "id,company,title,url,saved_at";
const PAGE_SIZE = 1000;

export type SaveJobResult = { status: "created"; job: Job } | { status: "already_saved"; job: Job };

export type JobDomainErrorCode = "not_found" | "database_unavailable";

export class JobDomainError extends Error {
  constructor(public readonly code: JobDomainErrorCode) {
    super(code === "not_found" ? "Job not found" : "Job service unavailable");
    this.name = "JobDomainError";
  }
}

type DatabaseError = {
  code?: string;
};

function throwDatabaseError(_error: DatabaseError): never {
  throw new JobDomainError("database_unavailable");
}

export async function listJobRecords(limit?: number): Promise<Job[]> {
  const admin = getSupabaseAdmin();
  const jobs: Job[] = [];
  let cursor: Job | undefined;
  for (;;) {
    let query = admin
      .from("jobs")
      .select(JOB_COLUMNS)
      .order("saved_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit ?? PAGE_SIZE);
    if (cursor) {
      // Continue after the last key, so inserts/deletes cannot shift page offsets.
      const savedAt = JSON.stringify(cursor.saved_at);
      const id = JSON.stringify(cursor.id);
      query = query.or(`saved_at.lt.${savedAt},and(saved_at.eq.${savedAt},id.lt.${id})`);
    }
    const { data, error } = await query;
    if (error) throwDatabaseError(error);
    const page = data ?? [];
    jobs.push(...page);
    if (limit !== undefined || page.length < PAGE_SIZE) return jobs;
    cursor = page.at(-1);
  }
}

export async function saveJobRecord(input: SaveJobInput): Promise<SaveJobResult> {
  const job = SaveJobSchema.parse(input);
  const admin = getSupabaseAdmin();
  const { data: created, error: upsertError } = await admin
    .from("jobs")
    .upsert(job, { onConflict: "url", ignoreDuplicates: true })
    .select(JOB_COLUMNS)
    .maybeSingle();
  if (upsertError) throwDatabaseError(upsertError);
  if (created) return { status: "created", job: created };

  const { data: existing, error: selectError } = await admin
    .from("jobs")
    .select(JOB_COLUMNS)
    .eq("url", job.url)
    .maybeSingle();
  if (selectError) throwDatabaseError(selectError);
  if (!existing) throw new JobDomainError("database_unavailable");
  return { status: "already_saved", job: existing };
}

export async function deleteJobRecord(id: string): Promise<Job> {
  const { data, error } = await getSupabaseAdmin()
    .from("jobs")
    .delete()
    .eq("id", id)
    .select(JOB_COLUMNS)
    .maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw new JobDomainError("not_found");
  return data;
}

export async function deleteAllJobRecords(): Promise<void> {
  // Jobs is a single-owner table. Its primary key is non-null, so this matches every row.
  const { error } = await getSupabaseAdmin().from("jobs").delete().not("id", "is", null);
  if (error) throwDatabaseError(error);
}
