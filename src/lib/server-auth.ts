import { setResponseHeader } from "@tanstack/react-start/server";

import { getSupabaseAdmin } from "./supabase-admin";

export function noStore() {
  setResponseHeader("Cache-Control", "no-store");
}

export async function requireOwnerUser(accessToken: string): Promise<{ id: string }> {
  const { data, error } = await getSupabaseAdmin().auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Unauthorized");
  if (data.user.id !== import.meta.env.VITE_OWNER_ID) throw new Error("Forbidden");
  return { id: data.user.id };
}
