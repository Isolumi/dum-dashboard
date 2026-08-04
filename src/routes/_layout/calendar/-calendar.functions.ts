import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { SupabaseAccessTokenSchema } from "#/lib/auth-schemas";
import { getCfEnv } from "#/lib/cf-env";
import type { Database } from "#/lib/database.types";
import { decryptSecret, encryptSecret } from "#/lib/secret-vault";
import { noStore, requireOwnerUser } from "#/lib/server-auth";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { type CalendarEvent, fetchCalendarEvents } from "./-calendar.api";

export const GOOGLE_CALENDAR_READONLY_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

const StartCalendarOAuthSchema = z.object({
  supabase_access_token: SupabaseAccessTokenSchema,
});

const CompleteCalendarOAuthSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

const GetCalendarEventsSchema = z.object({
  supabase_access_token: SupabaseAccessTokenSchema,
  time_min: z.string().datetime(),
  time_max: z.string().datetime(),
});

type CalendarConnectionRow = Database["public"]["Tables"]["calendar_connections"]["Row"];
type CalendarOAuthStateRow = Database["public"]["Tables"]["calendar_oauth_states"]["Row"];

export type CalendarEventsResult =
  | { status: "ready"; events: CalendarEvent[] }
  | { status: "disconnected"; events: [] }
  | { status: "auth_expired"; events: [] };

export interface GoogleTokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

export class GoogleTokenRefreshError extends Error {
  constructor(
    message: string,
    readonly authExpired: boolean,
  ) {
    super(message);
    this.name = "GoogleTokenRefreshError";
  }
}

function getRuntimeEnv(name: string): string {
  const fromWorker = getCfEnv()[name];
  if (fromWorker) return fromWorker;
  if (typeof process !== "undefined") return process.env[name] ?? "";
  return "";
}

function requireRuntimeEnv(name: string): string {
  const value = getRuntimeEnv(name);
  if (!value) throw new Error(`Missing server-only ${name} secret`);
  return value;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function createStateToken(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

export function buildGoogleCalendarAuthUrl({
  clientId,
  redirectUri,
  state,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
}): URL {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_READONLY_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  }).toString();
  return url;
}

export async function refreshGoogleAccessToken({
  refreshToken,
  clientId,
  clientSecret,
}: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<string> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new GoogleTokenRefreshError(
      "Failed to refresh Google Calendar access token",
      response.status === 400 || response.status === 401 || text.includes("invalid_grant"),
    );
  }

  const json = (await response.json()) as Partial<GoogleTokenResponse>;
  if (!json.access_token) {
    throw new GoogleTokenRefreshError(
      "Google token refresh response did not include an access token",
      true,
    );
  }
  return json.access_token;
}

async function exchangeGoogleAuthorizationCode({
  code,
  redirectUri,
  clientId,
  clientSecret,
}: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<GoogleTokenResponse> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to exchange Google OAuth code: ${await response.text()}`);
  }

  const json = (await response.json()) as Partial<GoogleTokenResponse>;
  if (!json.access_token) throw new Error("Google OAuth response missing access token");
  return json as GoogleTokenResponse;
}

function getRequestOrigin(): string {
  const origin = getRequestHeader("origin");
  if (origin) return origin;

  const host = getRequestHeader("host");
  if (!host) throw new Error("Could not determine request origin");
  const proto = getRequestHeader("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

async function getConnection(userId: string): Promise<CalendarConnectionRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("calendar_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load calendar connection: ${error.message}`);
  return data;
}

export const startCalendarOAuth = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(StartCalendarOAuthSchema))
  .handler(async ({ data }): Promise<{ authorizationUrl: string }> => {
    noStore();
    const user = await requireOwnerUser(data.supabase_access_token);
    const state = createStateToken();
    const stateHash = await sha256Base64Url(state);
    const redirectUri = `${getRequestOrigin()}/calendar/oauth/callback`;
    const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString();

    const { error } = await getSupabaseAdmin().from("calendar_oauth_states").insert({
      state_hash: stateHash,
      user_id: user.id,
      redirect_uri: redirectUri,
      expires_at: expiresAt,
    });
    if (error) throw new Error(`Failed to start calendar OAuth: ${error.message}`);

    return {
      authorizationUrl: buildGoogleCalendarAuthUrl({
        clientId: requireRuntimeEnv("GOOGLE_CLIENT_ID"),
        redirectUri,
        state,
      }).toString(),
    };
  });

export const completeCalendarOAuth = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(CompleteCalendarOAuthSchema))
  .handler(async ({ data }): Promise<{ status: "connected" }> => {
    noStore();
    const stateHash = await sha256Base64Url(data.state);
    const admin = getSupabaseAdmin();
    const { data: stateRow, error } = await admin
      .from("calendar_oauth_states")
      .select("*")
      .eq("state_hash", stateHash)
      .maybeSingle();

    await admin.from("calendar_oauth_states").delete().eq("state_hash", stateHash);

    if (error) throw new Error(`Failed to complete calendar OAuth: ${error.message}`);
    if (!stateRow) throw new Error("Calendar connection request was not found");

    const state = stateRow as CalendarOAuthStateRow;
    if (new Date(state.expires_at).getTime() < Date.now()) {
      throw new Error("Calendar connection request expired");
    }

    const tokens = await exchangeGoogleAuthorizationCode({
      code: data.code,
      redirectUri: state.redirect_uri,
      clientId: requireRuntimeEnv("GOOGLE_CLIENT_ID"),
      clientSecret: requireRuntimeEnv("GOOGLE_CLIENT_SECRET"),
    });

    if (!tokens.refresh_token) {
      throw new Error("Google did not return a refresh token. Reconnect calendar access.");
    }

    const encryptedRefreshToken = await encryptSecret(
      tokens.refresh_token,
      requireRuntimeEnv("GOOGLE_TOKEN_ENCRYPTION_KEY"),
    );

    const { error: upsertError } = await admin.from("calendar_connections").upsert({
      user_id: state.user_id,
      encrypted_refresh_token: encryptedRefreshToken,
      scope: tokens.scope ?? GOOGLE_CALENDAR_READONLY_SCOPE,
      updated_at: new Date().toISOString(),
    });
    if (upsertError) {
      throw new Error(`Failed to save calendar connection: ${upsertError.message}`);
    }

    return { status: "connected" };
  });

export const getCalendarEvents = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(GetCalendarEventsSchema))
  .handler(async ({ data }): Promise<CalendarEventsResult> => {
    noStore();
    const user = await requireOwnerUser(data.supabase_access_token);
    const connection = await getConnection(user.id);
    if (!connection) return { status: "disconnected", events: [] };

    try {
      const refreshToken = await decryptSecret(
        connection.encrypted_refresh_token,
        requireRuntimeEnv("GOOGLE_TOKEN_ENCRYPTION_KEY"),
      );
      const accessToken = await refreshGoogleAccessToken({
        refreshToken,
        clientId: requireRuntimeEnv("GOOGLE_CLIENT_ID"),
        clientSecret: requireRuntimeEnv("GOOGLE_CLIENT_SECRET"),
      });
      const events = await fetchCalendarEvents(
        accessToken,
        new Date(data.time_min),
        new Date(data.time_max),
      );
      return { status: "ready", events };
    } catch (error) {
      if (
        error instanceof GoogleTokenRefreshError ||
        (typeof error === "object" &&
          error !== null &&
          "type" in error &&
          (error as { type?: string }).type === "auth_expired")
      ) {
        return { status: "auth_expired", events: [] };
      }
      throw error;
    }
  });
