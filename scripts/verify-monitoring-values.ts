import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";

import { parse } from "yaml";

type YamlMap = Record<string, unknown>;
type ResourcePermission = {
  group: string;
  kind: string;
};

const expected = {
  enabled: true,
  host: "grafana.doh.lumilumi.xyz",
  issuer: "letsencrypt-prod",
  role: "Viewer",
  home: "/tmp/dashboards/uwumi-failures.json",
  retention: "7d",
  prometheusStorage: "20Gi",
};

const fail = (message: string): never => {
  throw new Error(message);
};

const asMap = (value: unknown, label: string): YamlMap => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${label} must be a YAML mapping.`);
  }

  return value as YamlMap;
};

const expectExact = (label: string, actual: unknown, wanted: unknown): void => {
  if (!isDeepStrictEqual(actual, wanted)) {
    fail(
      `${label}: expected ${JSON.stringify(wanted)}, received ${JSON.stringify(actual)}.`,
    );
  }
};

const readYaml = (path: string | URL, label: string): YamlMap =>
  asMap(parse(readFileSync(path, "utf8")), label);

const readPermissions = (value: unknown, label: string): ResourcePermission[] => {
  if (!Array.isArray(value)) {
    fail(`${label} must be a YAML sequence.`);
  }

  return value.map((entry, index) => {
    const permission = asMap(entry, `${label}[${index}]`);
    if (typeof permission.group !== "string" || typeof permission.kind !== "string") {
      fail(`${label}[${index}] must contain string group and kind values.`);
    }

    return {
      group: permission.group,
      kind: permission.kind,
    };
  });
};

const expectExactPermissions = (
  label: string,
  actual: ResourcePermission[],
  wanted: ResourcePermission[],
): void => {
  const key = ({ group, kind }: ResourcePermission): string => `${group}/${kind}`;
  expectExact(label, actual.map(key).sort(), wanted.map(key).sort());
};

const values = readYaml(
  process.env.PROMETHEUS_VALUES_PATH ??
    new URL("../k8s/argocd/prometheus-values.yml", import.meta.url),
  "prometheus-values.yml",
);
const project = readYaml(
  process.env.PROMETHEUS_PROJECT_PATH ??
    new URL("../k8s/argocd/prometheus-project.yml", import.meta.url),
  "prometheus-project.yml",
);

const grafana = asMap(values.grafana, "grafana");
expectExact("grafana.enabled", grafana.enabled, expected.enabled);
expectExact("grafana", grafana, {
  enabled: expected.enabled,
  defaultDashboardsEnabled: false,
  ingress: {
    enabled: true,
    ingressClassName: "traefik",
    annotations: {
      "cert-manager.io/cluster-issuer": expected.issuer,
      "traefik.ingress.kubernetes.io/router.entrypoints": "websecure",
    },
    hosts: [expected.host],
    tls: [
      {
        secretName: "grafana-lumilumi-tls",
        hosts: [expected.host],
      },
    ],
  },
  "grafana.ini": {
    server: {
      root_url: `https://${expected.host}`,
    },
    auth: {
      disable_login_form: true,
      disable_signout_menu: true,
    },
    "auth.anonymous": {
      enabled: true,
      org_name: "Main Org.",
      org_role: expected.role,
      hide_version: true,
    },
    users: {
      viewers_can_edit: false,
    },
    dashboards: {
      default_home_dashboard_path: expected.home,
    },
  },
  sidecar: {
    dashboards: {
      enabled: true,
      label: "grafana_dashboard",
      labelValue: "1",
      searchNamespace: "ALL",
      provider: {
        allowUiUpdates: false,
      },
    },
    datasources: {
      enabled: true,
      defaultDatasourceEnabled: true,
      isDefaultDatasource: true,
      label: "grafana_datasource",
      labelValue: "1",
      searchNamespace: "ALL",
      alertmanager: {
        enabled: false,
      },
    },
  },
  persistence: {
    enabled: false,
  },
  resources: {
    requests: {
      cpu: "100m",
      memory: "128Mi",
    },
    limits: {
      cpu: "500m",
      memory: "512Mi",
    },
  },
});

const prometheus = asMap(values.prometheus, "prometheus");
if ("ingress" in prometheus) {
  fail("prometheus.ingress must not be configured; Prometheus is private and cluster-internal.");
}
if ("loki" in values) {
  fail("loki must not be configured in this kube-prometheus-stack values scope.");
}
const prometheusSpec = asMap(prometheus.prometheusSpec, "prometheus.prometheusSpec");
expectExact("prometheus.prometheusSpec.retention", prometheusSpec.retention, expected.retention);
expectExact("prometheus.prometheusSpec.storageSpec", prometheusSpec.storageSpec, {
  volumeClaimTemplate: {
    spec: {
      storageClassName: "local-path",
      accessModes: ["ReadWriteOnce"],
      resources: {
        requests: {
          storage: expected.prometheusStorage,
        },
      },
    },
  },
});

const projectSpec = asMap(project.spec, "AppProject spec");
const clusterPermissions = readPermissions(
  projectSpec.clusterResourceWhitelist,
  "clusterResourceWhitelist",
);
const namespacePermissions = readPermissions(
  projectSpec.namespaceResourceWhitelist,
  "namespaceResourceWhitelist",
);

expectExactPermissions("clusterResourceWhitelist", clusterPermissions, [
  { group: "", kind: "Namespace" },
  { group: "apiextensions.k8s.io", kind: "CustomResourceDefinition" },
  { group: "rbac.authorization.k8s.io", kind: "ClusterRole" },
  { group: "rbac.authorization.k8s.io", kind: "ClusterRoleBinding" },
]);
expectExactPermissions("namespaceResourceWhitelist", namespacePermissions, [
  { group: "", kind: "Service" },
  { group: "", kind: "ServiceAccount" },
  { group: "apps", kind: "DaemonSet" },
  { group: "apps", kind: "Deployment" },
  { group: "monitoring.coreos.com", kind: "Prometheus" },
  { group: "monitoring.coreos.com", kind: "PrometheusRule" },
  { group: "monitoring.coreos.com", kind: "ServiceMonitor" },
  { group: "", kind: "ConfigMap" },
  { group: "", kind: "Secret" },
  { group: "networking.k8s.io", kind: "Ingress" },
  { group: "rbac.authorization.k8s.io", kind: "Role" },
  { group: "rbac.authorization.k8s.io", kind: "RoleBinding" },
]);

for (const permission of [...clusterPermissions, ...namespacePermissions]) {
  if (permission.group === "*" || permission.kind === "*") {
    fail(`AppProject resource wildcard is not allowed: ${permission.group}/${permission.kind}.`);
  }
}

console.log("Monitoring values contract: PASS");
