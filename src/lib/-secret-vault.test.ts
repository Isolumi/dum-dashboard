import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./secret-vault";

describe("secret-vault", () => {
  it("encrypts and decrypts a secret with the same runtime key", async () => {
    const encrypted = await encryptSecret("google-refresh-token", "test-encryption-key");

    expect(encrypted).not.toContain("google-refresh-token");
    expect(encrypted.startsWith("v1.")).toBe(true);
    await expect(decryptSecret(encrypted, "test-encryption-key")).resolves.toBe(
      "google-refresh-token",
    );
  });

  it("rejects decrypting with a different runtime key", async () => {
    const encrypted = await encryptSecret("google-refresh-token", "test-encryption-key");

    await expect(decryptSecret(encrypted, "wrong-key")).rejects.toThrow(/decrypt stored secret/i);
  });
});
