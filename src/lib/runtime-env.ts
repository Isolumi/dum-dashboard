export function requireServerEnv(name: string): string {
  const value = typeof process === "undefined" ? "" : process.env[name];
  if (!value) throw new Error(`Missing server-only ${name} secret`);
  return value;
}
