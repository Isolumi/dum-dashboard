import { getGatewayConfig } from "./config";
import { ArgoProvider } from "./providers/argocd";
import { GitHubProvider } from "./providers/github";
import { KubernetesProvider } from "./providers/kubernetes";
import { PrometheusProvider } from "./providers/prometheus";
import type { Provider } from "./providers/provider";
import { loadServiceCatalog, type ApplicationCatalogEntry } from "./service-catalog";
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
  applications: readonly ApplicationCatalogEntry[];
  providers: {
    cluster: readonly Provider<unknown>[];
    deployments: readonly Provider<unknown>[];
    services: readonly Provider<unknown>[];
  };
}

export async function createProductionGatewayDependencies(
  environment: NodeJS.ProcessEnv = process.env,
  runtime: ProductionGatewayRuntime = productionRuntime,
): Promise<ProductionGatewayDependencies> {
  const kubernetesProvider = new KubernetesProvider({ environment });
  const { githubReadToken, prometheusUrl, serviceCatalogPath } = getGatewayConfig(environment);
  const catalog = await runtime.loadServiceCatalog(serviceCatalogPath);
  const githubProviders = catalog.applications.flatMap((application) =>
    application.github
      ? [
          new GitHubProvider({
            ...application.github,
            token: githubReadToken,
            environment,
          }),
        ]
      : [],
  );
  const argoProviders = [
    ...new Set(catalog.applications.map(({ argoApplication }) => argoApplication)),
  ].map((applicationName) => new ArgoProvider({ applicationName, environment }));
  const cluster: Provider<unknown>[] = [kubernetesProvider];
  if (prometheusUrl) cluster.push(new PrometheusProvider({ baseUrl: prometheusUrl }));
  const serviceProbeProvider: Provider<unknown> = {
    source: "service-probe",
    async collect(signal) {
      return Promise.all(catalog.services.map((entry) => runtime.probeService(entry, signal)));
    },
  };

  return {
    kubernetesProvider,
    applications: catalog.applications,
    providers: {
      cluster,
      deployments: [...githubProviders, ...argoProviders, kubernetesProvider],
      services: [serviceProbeProvider, ...argoProviders, kubernetesProvider],
    },
  };
}
