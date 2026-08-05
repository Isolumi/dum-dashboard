import { describe, expect, it, vi } from "vitest";
import { readDenseArray, readOwnDataProperties } from "./runtime-validation";

const readBoundedDenseArray = readDenseArray as unknown as (
  value: unknown,
  maxLength: number,
) => unknown[] | null;

describe("runtime validation", () => {
  it("rejects a transparent proxy before inspecting an otherwise valid record", () => {
    const value = new Proxy({ required: "safe" }, {});
    const arrayCheck = vi.spyOn(Array, "isArray");
    const prototypeCheck = vi.spyOn(Object, "getPrototypeOf");
    const ownKeysCheck = vi.spyOn(Reflect, "ownKeys");
    let result: ReturnType<typeof readOwnDataProperties>;
    let inspectedByArrayCheck = false;
    let inspectedByPrototypeCheck = false;
    let inspectedByOwnKeysCheck = false;

    try {
      result = readOwnDataProperties(value, ["required"]);
      inspectedByArrayCheck = arrayCheck.mock.calls.some(([candidate]) => candidate === value);
      inspectedByPrototypeCheck = prototypeCheck.mock.calls.some(
        ([candidate]) => candidate === value,
      );
      inspectedByOwnKeysCheck = ownKeysCheck.mock.calls.some(([candidate]) => candidate === value);
    } finally {
      arrayCheck.mockRestore();
      prototypeCheck.mockRestore();
      ownKeysCheck.mockRestore();
    }

    expect(result!).toBeNull();
    expect(inspectedByArrayCheck).toBe(false);
    expect(inspectedByPrototypeCheck).toBe(false);
    expect(inspectedByOwnKeysCheck).toBe(false);
  });

  it.each(["string", "symbol"] as const)(
    "rejects an unknown extra %s accessor without invoking it",
    (keyType) => {
      let getterCalls = 0;
      const key = keyType === "string" ? "secret" : Symbol("secret");
      const value = Object.defineProperty({ required: "safe" }, key, {
        get() {
          getterCalls += 1;
          throw new Error("unknown-accessor-secret");
        },
      });

      expect(readOwnDataProperties(value, ["required"])).toBeNull();
      expect(getterCalls).toBe(0);
    },
  );

  it("rejects an array index accessor without invoking it", () => {
    let getterCalls = 0;
    const value: unknown[] = [];
    Object.defineProperty(value, "0", {
      configurable: true,
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error("array-accessor-secret");
      },
    });

    expect(readBoundedDenseArray(value, 1)).toBeNull();
    expect(getterCalls).toBe(0);
  });

  it("accepts a dense array at its bound and rejects max plus one", () => {
    expect(readBoundedDenseArray(["a", "b"], 2)).toEqual(["a", "b"]);
    expect(readBoundedDenseArray(["a", "b", "c"], 2)).toBeNull();
  });

  it("rejects a huge sparse array before allocating from its length", () => {
    const allocation = vi.spyOn(Array, "from").mockImplementation(() => {
      throw new Error("attempted-huge-allocation");
    });
    let result: unknown[] | null;
    const hugeSparseArray: unknown[] = [];
    hugeSparseArray.length = 1_000_000_000;

    try {
      result = readBoundedDenseArray(hugeSparseArray, 32);
    } finally {
      allocation.mockRestore();
    }

    expect(result!).toBeNull();
    expect(allocation).not.toHaveBeenCalled();
  });
});
