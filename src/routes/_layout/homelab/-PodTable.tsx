import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";

import type { PodSummary } from "@shared/homelab/contracts";
import { Input } from "#/components/ui/input";
import { StatusBadge } from "./-StatusBadge";

export interface PodSelection {
  namespace: string;
  pod: string;
}

function formatAge(createdAt: string, now = Date.now()): string {
  const createdAtMs = Date.parse(createdAt);
  if (!Number.isFinite(createdAtMs)) return "Unknown";
  const elapsedMinutes = Math.max(0, Math.floor((now - createdAtMs) / 60_000));
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h`;
  return `${Math.floor(elapsedHours / 24)}d`;
}

function searchablePodText(pod: PodSummary): string {
  return [pod.name, pod.namespace, pod.node, pod.image, pod.imageTag, pod.imageDigest]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLocaleLowerCase();
}

export function PodTable({
  pods,
  onSelectPod,
  selectedPod,
  namespaceFilter,
  onNamespaceChange,
}: {
  pods: readonly PodSummary[];
  onSelectPod: (selection: PodSelection) => void;
  selectedPod?: PodSelection;
  namespaceFilter?: string | null;
  onNamespaceChange?: (namespace: string | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [localNamespace, setLocalNamespace] = useState("");
  const controlledNamespace = namespaceFilter !== undefined;
  const activeNamespace = controlledNamespace ? (namespaceFilter ?? "") : localNamespace;
  const namespaces = useMemo(
    () =>
      [...new Set(pods.map((pod) => pod.namespace))].sort((left, right) =>
        left.localeCompare(right),
      ),
    [pods],
  );
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredPods = useMemo(
    () =>
      pods.filter(
        (pod) =>
          (!activeNamespace || pod.namespace === activeNamespace) &&
          (!normalizedSearch || searchablePodText(pod).includes(normalizedSearch)),
      ),
    [activeNamespace, normalizedSearch, pods],
  );

  useEffect(() => {
    if (controlledNamespace) return;
    if (localNamespace && !namespaces.includes(localNamespace)) setLocalNamespace("");
  }, [controlledNamespace, localNamespace, namespaces]);

  const changeNamespace = (value: string) => {
    if (!controlledNamespace) setLocalNamespace(value);
    onNamespaceChange?.(value || null);
  };

  return (
    <section
      aria-labelledby="pod-inventory-title"
      className="min-w-0 rounded-lg border border-border bg-card"
    >
      <div className="border-b border-border p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Kubernetes inventory
            </p>
            <h2 id="pod-inventory-title" className="mt-1 text-base font-semibold text-foreground">
              Pods
            </h2>
          </div>
          <p className="text-xs tabular-nums text-muted-foreground">
            {filteredPods.length} of {pods.length} shown
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <label className="relative block">
            <span className="sr-only">Search pods</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              aria-label="Search pods"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Search name, image, or node"
              className="min-h-11 pl-9"
            />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            <span className="sr-only">Filter pods by namespace</span>
            <select
              aria-label="Filter pods by namespace"
              value={activeNamespace}
              onChange={(event) => changeNamespace(event.currentTarget.value)}
              className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All namespaces</option>
              {namespaces.map((namespace) => (
                <option key={namespace} value={namespace}>
                  {namespace}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {filteredPods.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">
          No pods match these filters.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
            <caption className="sr-only">
              Pod readiness, status, age, restarts, node, and image
            </caption>
            <thead className="bg-background/50 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5">
                  Pod
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Ready
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Status
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Age
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Restarts
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Node
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Image
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {filteredPods.map((pod) => {
                const selected =
                  selectedPod?.namespace === pod.namespace && selectedPod.pod === pod.name;
                return (
                  <tr
                    key={`${pod.namespace}/${pod.name}`}
                    data-selected={selected || undefined}
                    className="transition-colors data-[selected]:bg-accent/70 hover:bg-accent/40 motion-reduce:transition-none"
                  >
                    <th scope="row" className="px-4 py-2 font-medium">
                      <button
                        type="button"
                        aria-current={selected ? "true" : undefined}
                        onClick={() => onSelectPod({ namespace: pod.namespace, pod: pod.name })}
                        className="flex min-h-11 max-w-72 flex-col justify-center rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="truncate text-foreground">{pod.name}</span>
                        <span className="truncate text-xs font-normal text-muted-foreground">
                          {pod.namespace}
                        </span>
                      </button>
                    </th>
                    <td className="px-3 py-2 tabular-nums text-foreground">
                      {pod.ready ? "Ready" : "Not ready"}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={pod.status} />
                    </td>
                    <td
                      className="px-3 py-2 tabular-nums text-muted-foreground"
                      suppressHydrationWarning
                    >
                      {formatAge(pod.createdAt)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      <span
                        aria-label={`${pod.restartCount} ${pod.restartCount === 1 ? "restart" : "restarts"}`}
                        className={
                          pod.restartCount > 0
                            ? "inline-flex items-center gap-1.5 text-health-warning"
                            : "text-muted-foreground"
                        }
                      >
                        {pod.restartCount > 0 ? (
                          <AlertTriangle className="size-3.5" aria-hidden="true" />
                        ) : null}
                        {pod.restartCount}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{pod.node ?? "Unknown"}</td>
                    <td className="max-w-80 px-4 py-2">
                      <span
                        className="block truncate font-mono text-xs text-muted-foreground"
                        title={pod.image ?? undefined}
                      >
                        {pod.image ?? "Unknown"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
