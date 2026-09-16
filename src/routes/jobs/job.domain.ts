import type { Job } from "#/lib/database.types";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { SaveJobSchema, type SaveJobInput } from "./job.schemas";

const JOB_COLUMNS = "id,company,title,url,saved_at";

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

export async function listJobRecords(limit = 100): Promise<Job[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("jobs")
    .select(JOB_COLUMNS)
    .order("saved_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throwDatabaseError(error);
  return data ?? [];
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
