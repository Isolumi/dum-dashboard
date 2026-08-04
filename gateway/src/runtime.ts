import { getGatewayConfig } from "./config";
import { ArgoProvider } from "./providers/argocd";
import { GitHubProvider } from "./providers/github";
import { KubernetesProvider } from "./providers/kubernetes";
import { PrometheusProvider } from "./providers/prometheus";
import type { Provider } from "./providers/provider";

export interface ProductionGatewayDependencies {
  kubernetesProvider: KubernetesProvider;
  providers: {
    cluster: readonly Provider<unknown>[];
    deployments: readonly Provider<unknown>[];
  };
}

export function createProductionGatewayDependencies(
  environment: NodeJS.ProcessEnv = process.env,
): ProductionGatewayDependencies {
  const kubernetesProvider = new KubernetesProvider({ environment });
  const { githubReadToken, prometheusUrl } = getGatewayConfig(environment);
  const githubProvider = new GitHubProvider({ token: githubReadToken, environment });
  const argoProvider = new ArgoProvider({ environment });
  const cluster: Provider<unknown>[] = [kubernetesProvider];
  if (prometheusUrl) cluster.push(new PrometheusProvider({ baseUrl: prometheusUrl }));

  return {
    kubernetesProvider,
    providers: {
      cluster,
      deployments: [githubProvider, argoProvider, kubernetesProvider],
    },
  };
}
