import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getCfEnv } from "./cf-env";

function getRuntimeEnv(name: string): string {
  const fromWorker = getCfEnv()[name];
  if (fromWorker) return fromWorker;
  if (typeof process !== "undefined") return process.env[name] ?? "";
  return "";
}

export function getSupabaseAdmin() {
  const secretKey = getRuntimeEnv("SUPABASE_SECRET_KEY");
  if (!secretKey) throw new Error("Missing server-only SUPABASE_SECRET_KEY secret");

  return createClient<Database>(import.meta.env.VITE_SUPABASE_URL, secretKey);
}
