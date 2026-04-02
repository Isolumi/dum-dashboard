import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export const supabaseAdmin = createClient<Database>(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
);
