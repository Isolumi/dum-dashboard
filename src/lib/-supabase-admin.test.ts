import { afterEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(() => ({ kind: "supabase-admin" })),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { getSupabaseAdmin } from "./supabase-admin";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("getSupabaseAdmin", () => {
  it("reads both Supabase credentials from server runtime environment variables", () => {
    vi.stubEnv("SUPABASE_URL", "https://runtime.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "runtime-secret-key");

    expect(getSupabaseAdmin()).toEqual({ kind: "supabase-admin" });
    expect(createClient).toHaveBeenCalledWith("https://runtime.supabase.co", "runtime-secret-key");
  });
});
