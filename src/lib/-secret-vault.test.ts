import { access } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requireServerEnv } from "./runtime-env";
import { decryptSecret, encryptSecret } from "./secret-vault";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("secret-vault", () => {
  it("reads server-only secrets from process.env", () => {
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", "process-env-encryption-key");

    expect(requireServerEnv("GOOGLE_TOKEN_ENCRYPTION_KEY")).toBe("process-env-encryption-key");
  });

  it("does not retain the Cloudflare-only environment module", async () => {
    await expect(access(new URL("./cf-env.ts", import.meta.url))).rejects.toThrow();
  });

  it("encrypts and decrypts a secret with the same runtime key", async () => {
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", "test-encryption-key");
    const encrypted = await encryptSecret("google-refresh-token");

    expect(encrypted).not.toContain("google-refresh-token");
    expect(encrypted.startsWith("v1.")).toBe(true);
    await expect(decryptSecret(encrypted)).resolves.toBe("google-refresh-token");
  });

  it("rejects decrypting with a different runtime key", async () => {
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", "test-encryption-key");
    const encrypted = await encryptSecret("google-refresh-token");
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", "wrong-key");

    await expect(decryptSecret(encrypted)).rejects.toThrow(/decrypt stored secret/i);
  });
});
