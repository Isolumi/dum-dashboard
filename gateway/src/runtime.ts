import { getGatewayConfig } from "./config";
import { ArgoProvider } from "./providers/argocd";
import { GitHubProvider } from "./providers/github";
import { KubernetesProvider } from "./providers/kubernetes";
import { PrometheusProvider } from "./providers/prometheus";
import type { Provider } from "./providers/provider";
import { loadServiceCatalog } from "./service-catalog";
import { probeService } from "./service-probe";

export interface ProductionGatewayRuntime {
  loadServiceCatalog: typeof loadServiceCatalog;
  probeService: typeof probeService;
}

const productionRuntime: ProductionGatewayRuntime = {
  loadServiceCatalog,
  probeService,
};

export interface ProductionGatewayDependencies {
  kubernetesProvider: KubernetesProvider;
  providers: {
    cluster: readonly Provider<unknown>[];
    deployments: readonly Provider<unknown>[];
    services: readonly Provider<unknown>[];
  };
}

export function createProductionGatewayDependencies(
  environment: NodeJS.ProcessEnv = process.env,
  runtime: ProductionGatewayRuntime = productionRuntime,
): ProductionGatewayDependencies {
  const kubernetesProvider = new KubernetesProvider({ environment });
  const { githubReadToken, prometheusUrl, serviceCatalogPath } = getGatewayConfig(environment);
  const githubProvider = new GitHubProvider({ token: githubReadToken, environment });
  const argoProvider = new ArgoProvider({ environment });
  const cluster: Provider<unknown>[] = [kubernetesProvider];
  if (prometheusUrl) cluster.push(new PrometheusProvider({ baseUrl: prometheusUrl }));
  const serviceProbeProvider: Provider<unknown> = {
    source: "service-probe",
    async collect(signal) {
      const catalog = await runtime.loadServiceCatalog(serviceCatalogPath);
      return Promise.all(catalog.map((entry) => runtime.probeService(entry, signal)));
    },
  };

  return {
    kubernetesProvider,
    providers: {
      cluster,
      deployments: [githubProvider, argoProvider, kubernetesProvider],
      services: [serviceProbeProvider],
    },
  };
}
