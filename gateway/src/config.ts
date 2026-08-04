export const DEFAULT_PROVIDER_TIMEOUT_MS = 5_000;

export interface GatewayConfig {
  providerTimeoutMs: number;
}

export function getGatewayConfig(environment = process.env): GatewayConfig {
  const configuredTimeout = Number(environment.GATEWAY_PROVIDER_TIMEOUT_MS);

  return {
    providerTimeoutMs:
      Number.isFinite(configuredTimeout) && configuredTimeout > 0
        ? configuredTimeout
        : DEFAULT_PROVIDER_TIMEOUT_MS,
  };
}
