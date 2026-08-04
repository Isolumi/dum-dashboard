import { supabase } from "./supabase";

/** Returns the current session or null. Safe to call on client only. */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session;
}

export async function getAccessToken() {
  const session = await getSession();
  return session?.access_token ?? null;
}

/** Initiates Google OAuth redirect. */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
}

/** Signs out the current user. */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
