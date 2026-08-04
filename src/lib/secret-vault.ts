import { requireServerEnv } from "./runtime-env";

const VERSION = "v1";
const IV_BYTES = 12;

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeBase64Url(value: string): Uint8Array {
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function importAesKey(secret: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", keyMaterial, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const runtimeSecret = requireServerEnv("GOOGLE_TOKEN_ENCRYPTION_KEY");
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await importAesKey(runtimeSecret);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)),
  );
  return `${VERSION}.${encodeBase64Url(iv)}.${encodeBase64Url(ciphertext)}`;
}

export async function decryptSecret(sealed: string): Promise<string> {
  const runtimeSecret = requireServerEnv("GOOGLE_TOKEN_ENCRYPTION_KEY");
  const [version, iv, ciphertext] = sealed.split(".");
  if (version !== VERSION || !iv || !ciphertext) {
    throw new Error("Stored secret has an unsupported format");
  }

  try {
    const key = await importAesKey(runtimeSecret);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decodeBase64Url(iv) },
      key,
      decodeBase64Url(ciphertext),
    );
    return new TextDecoder().decode(plaintext);
  } catch (error) {
    throw new Error("Could not decrypt stored secret", { cause: error });
  }
}
