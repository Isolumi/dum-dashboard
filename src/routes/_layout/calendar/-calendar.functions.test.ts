import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: vi.fn((name: string) =>
    name === "origin" ? "https://doh.lumilumi.xyz" : null,
  ),
  setResponseHeader: vi.fn(),
}));

vi.mock("#/lib/server-auth", () => ({
  getOwnerUser: vi.fn(() => ({ id: "owner-user-id" })),
  noStore: vi.fn(),
}));

vi.mock("#/lib/supabase-admin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

const {
  buildGoogleCalendarAuthUrl,
  createCalendarOAuthRequest,
  refreshGoogleAccessToken,
  sha256Base64Url,
} = await import("./-calendar.functions");
const { getOwnerUser } = await import("#/lib/server-auth");
const { getSupabaseAdmin } = await import("#/lib/supabase-admin");

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  vi.stubEnv("GOOGLE_CLIENT_ID", "google-client-id");
  vi.clearAllMocks();
  vi.mocked(getSupabaseAdmin).mockReturnValue({
    from: vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: null }) })),
  } as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function mockResponse(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body ?? {}),
  } as Response;
}

describe("calendar oauth helpers", () => {
  it("writes the configured owner ID when starting Calendar OAuth", async () => {
    const result = await createCalendarOAuthRequest();

    expect(getOwnerUser).toHaveBeenCalledWith();
    const stateInsert =
      vi.mocked(getSupabaseAdmin).mock.results[0]?.value.from.mock.results[0]?.value.insert;
    expect(stateInsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "owner-user-id" }));
    expect(result.authorizationUrl).toContain("accounts.google.com");
  });

  it("builds a Google OAuth URL for offline read-only calendar access", () => {
    const url = buildGoogleCalendarAuthUrl({
      clientId: "google-client-id",
      redirectUri: "https://dashboard.example.com/calendar/oauth/callback",
      state: "state-token",
    });

    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.pathname).toBe("/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("google-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://dashboard.example.com/calendar/oauth/callback",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/calendar.readonly");
    expect(url.searchParams.get("state")).toBe("state-token");
  });

  it("hashes oauth state without storing the raw browser state token", async () => {
    const first = await sha256Base64Url("state-token");
    const second = await sha256Base64Url("state-token");

    expect(first).toBe(second);
    expect(first).not.toContain("state-token");
  });

  it("refreshes a Google access token with server-side OAuth credentials", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse(200, { access_token: "fresh-access-token", expires_in: 3600 }),
    );

    const token = await refreshGoogleAccessToken({
      refreshToken: "stored-refresh-token",
      clientId: "google-client-id",
      clientSecret: "google-client-secret",
    });

    expect(token).toBe("fresh-access-token");
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect((options as RequestInit).method).toBe("POST");
    expect(String((options as RequestInit).body)).toContain("grant_type=refresh_token");
    expect(String((options as RequestInit).body)).toContain("refresh_token=stored-refresh-token");
    expect(String((options as RequestInit).body)).toContain("client_id=google-client-id");
    expect(String((options as RequestInit).body)).toContain("client_secret=google-client-secret");
  });
});
