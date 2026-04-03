import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export const supabaseAdmin = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.SUPABASE_SECRET_KEY,
);
