import { getGatewayConfig } from "./config";
import { KubernetesProvider } from "./providers/kubernetes";
import { PrometheusProvider } from "./providers/prometheus";

export interface ProductionGatewayDependencies {
  kubernetesProvider: KubernetesProvider;
  providers: {
    cluster: readonly (KubernetesProvider | PrometheusProvider)[];
  };
}

export function createProductionGatewayDependencies(
  environment: NodeJS.ProcessEnv = process.env,
): ProductionGatewayDependencies {
  const kubernetesProvider = new KubernetesProvider({ environment });
  const { prometheusUrl } = getGatewayConfig(environment);
  const cluster: (KubernetesProvider | PrometheusProvider)[] = [kubernetesProvider];
  if (prometheusUrl) cluster.push(new PrometheusProvider({ baseUrl: prometheusUrl }));

  return {
    kubernetesProvider,
    providers: { cluster },
  };
}
