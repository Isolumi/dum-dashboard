import type { ResourceWindow, SourceName } from "../../../shared/homelab/contracts";

export interface ProviderObservation {
  observedAt: string;
  stale: boolean;
  error?: string;
}

export interface Provider<T> {
  source: SourceName;
  collect(signal: AbortSignal): Promise<T>;
  observation?(): ProviderObservation | undefined;
}

export interface WindowedProvider<T> extends Provider<T> {
  collectForWindow(window: ResourceWindow, signal: AbortSignal): Promise<T>;
}

export function isWindowedProvider<T>(provider: Provider<T>): provider is WindowedProvider<T> {
  return typeof (provider as Partial<WindowedProvider<T>>).collectForWindow === "function";
}
