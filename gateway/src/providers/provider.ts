import type { SourceName } from "../../../shared/homelab/contracts";

export interface Provider<T> {
  source: SourceName;
  collect(signal: AbortSignal): Promise<T>;
}
