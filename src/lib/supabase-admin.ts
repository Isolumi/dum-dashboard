import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { requireServerEnv } from "./runtime-env";

export function getSupabaseAdmin() {
  const url = requireServerEnv("SUPABASE_URL");
  const secretKey = requireServerEnv("SUPABASE_SECRET_KEY");

  return createClient<Database>(url, secretKey);
}
