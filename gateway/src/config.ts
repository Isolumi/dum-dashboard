export const DEFAULT_PROVIDER_TIMEOUT_MS = 5_000;

export interface GatewayConfig {
  providerTimeoutMs: number;
  prometheusUrl?: string;
  githubReadToken?: string;
}

export type KubernetesConfigSource = "in-cluster" | "default";

export function getKubernetesConfigSource(environment = process.env): KubernetesConfigSource {
  return environment.NODE_ENV === "production" ? "in-cluster" : "default";
}

export function getGatewayConfig(environment = process.env): GatewayConfig {
  const configuredTimeout = Number(environment.GATEWAY_PROVIDER_TIMEOUT_MS);
  const prometheusUrl = environment.PROMETHEUS_URL?.trim();
  const githubReadToken = environment.GITHUB_READ_TOKEN?.trim();

  return {
    providerTimeoutMs:
      Number.isFinite(configuredTimeout) && configuredTimeout > 0
        ? configuredTimeout
        : DEFAULT_PROVIDER_TIMEOUT_MS,
    ...(prometheusUrl ? { prometheusUrl } : {}),
    ...(githubReadToken ? { githubReadToken } : {}),
  };
}
