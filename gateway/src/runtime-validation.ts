type OwnDataProperties<Key extends string> = { [Property in Key]: unknown };

const hasOwn = Object.prototype.hasOwnProperty;

function dataDescriptorValue(descriptor: PropertyDescriptor | undefined): unknown | undefined {
  return descriptor && hasOwn.call(descriptor, "value") ? descriptor.value : undefined;
}

export function readOwnDataProperties<const Key extends string>(
  value: unknown,
  keys: readonly Key[],
): OwnDataProperties<Key> | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const properties = Object.create(null) as OwnDataProperties<Key>;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !hasOwn.call(descriptor, "value")) return null;
      properties[key] = descriptor.value;
    }
    return properties;
  } catch {
    return null;
  }
}

export function readDenseArray(value: unknown): unknown[] | null {
  try {
    if (!Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Array.prototype && prototype !== null) return null;

    const length = dataDescriptorValue(Object.getOwnPropertyDescriptor(value, "length"));
    if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0) return null;

    const entries = Array.from<unknown>({ length });
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !hasOwn.call(descriptor, "value")) return null;
      entries[index] = descriptor.value;
    }
    return entries;
  } catch {
    return null;
  }
}
