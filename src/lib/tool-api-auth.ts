import { timingSafeEqual } from "node:crypto";

export function assertValidToolTokenConfig(token: string): void {
  if (Buffer.byteLength(token, "utf8") < 32) {
    throw new Error("DUMQ_TOOL_TOKEN must contain at least 32 bytes");
  }
}

export function hasValidToolBearer(request: Request, expectedToken: string): boolean {
  const value = request.headers.get("authorization");
  if (!value?.startsWith("Bearer ")) return false;

  const supplied = Buffer.from(value.slice(7), "utf8");
  const expected = Buffer.from(expectedToken, "utf8");

  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
