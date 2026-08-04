import { KubernetesProvider } from "./providers/kubernetes";
import { PrometheusProvider } from "./providers/prometheus";

export interface ProductionGatewayDependencies {
  kubernetesProvider: KubernetesProvider;
  providers: {
    cluster: readonly [KubernetesProvider, PrometheusProvider];
  };
}

export function createProductionGatewayDependencies(
  environment: NodeJS.ProcessEnv = process.env,
): ProductionGatewayDependencies {
  const kubernetesProvider = new KubernetesProvider({ environment });
  const prometheusProvider = new PrometheusProvider({ environment });

  return {
    kubernetesProvider,
    providers: { cluster: [kubernetesProvider, prometheusProvider] },
  };
}
