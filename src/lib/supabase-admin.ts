import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getCfEnv } from "./cf-env";

export function getSupabaseAdmin() {
  return createClient<Database>(
    import.meta.env.VITE_SUPABASE_URL,
    getCfEnv().SUPABASE_SECRET_KEY ?? "",
  );
}
