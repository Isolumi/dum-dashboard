import { types as nodeUtilTypes } from "node:util";

type OwnDataProperties<Key extends string> = { [Property in Key]: unknown };

const hasOwn = Object.prototype.hasOwnProperty;

export const RUNTIME_COLLECTION_LIMITS = Object.freeze({
  githubWorkflowRuns: 1,
  argoResources: 256,
  argoImages: 64,
  nodes: 64,
  nodeConditions: 32,
  namespaces: 256,
  workloads: 512,
  pods: 1_024,
  podContainerImages: 32,
  events: 2_048,
  currentResourceMetrics: 16,
  resourceHistory: 16,
  metricPoints: 4_096,
});

export function readOwnDataRecord(value: unknown): ReadonlyMap<PropertyKey, unknown> | null {
  try {
    if (typeof value !== "object" || value === null || nodeUtilTypes.isProxy(value)) return null;
    if (Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const descriptors = new Map<PropertyKey, unknown>();
    for (const property of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, property);
      if (!descriptor || !hasOwn.call(descriptor, "value")) return null;
      descriptors.set(property, descriptor.value);
    }
    return descriptors;
  } catch {
    return null;
  }
}

export function readOwnDataProperties<const Key extends string>(
  value: unknown,
  keys: readonly Key[],
): OwnDataProperties<Key> | null {
  try {
    const descriptors = readOwnDataRecord(value);
    if (!descriptors) return null;
    const properties = Object.create(null) as OwnDataProperties<Key>;
    for (const key of keys) {
      if (!descriptors.has(key)) return null;
      properties[key] = descriptors.get(key);
    }
    return properties;
  } catch {
    return null;
  }
}

export function readDenseArray(value: unknown, maxLength: number): unknown[] | null {
  try {
    if (typeof value !== "object" || value === null || nodeUtilTypes.isProxy(value)) return null;
    if (!Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Array.prototype && prototype !== null) return null;

    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (!lengthDescriptor || !hasOwn.call(lengthDescriptor, "value")) return null;
    const length = lengthDescriptor.value;
    if (
      typeof length !== "number" ||
      !Number.isSafeInteger(length) ||
      length < 0 ||
      !Number.isSafeInteger(maxLength) ||
      maxLength < 0 ||
      length > maxLength
    ) {
      return null;
    }

    const entries = Array.from<unknown>({ length });
    let indexCount = 0;
    for (const property of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, property);
      if (!descriptor || !hasOwn.call(descriptor, "value")) return null;
      if (property === "length") continue;
      if (typeof property !== "string") return null;

      const index = Number(property);
      if (
        !Number.isSafeInteger(index) ||
        index < 0 ||
        index >= length ||
        String(index) !== property
      ) {
        return null;
      }
      entries[index] = descriptor.value;
      indexCount += 1;
    }
    return indexCount === length ? entries : null;
  } catch {
    return null;
  }
}
