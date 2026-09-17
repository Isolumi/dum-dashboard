import { describe, expect, it } from "vitest";
import {
  CreateBuyListItemSchema,
  RenameBuyListItemSchema,
  DeleteBuyListItemSchema,
} from "./buy-list.schemas";

const id = "11111111-1111-4111-8111-111111111111";
describe("Buy list validation", () => {
  it("trims names and accepts the inclusive limits", () => {
    expect(CreateBuyListItemSchema.parse({ name: "  Milk  " })).toEqual({ name: "Milk" });
    for (const name of ["a", "a".repeat(300)])
      expect(CreateBuyListItemSchema.safeParse({ name }).success).toBe(true);
    expect(RenameBuyListItemSchema.parse({ id, name: " Bread " })).toEqual({ id, name: "Bread" });
  });
  it.each(["", "   ", "a".repeat(301)])("rejects invalid name %s", (name) => {
    expect(CreateBuyListItemSchema.safeParse({ name }).success).toBe(false);
    expect(RenameBuyListItemSchema.safeParse({ id, name }).success).toBe(false);
  });
  it("rejects malformed IDs and unknown fields", () => {
    expect(DeleteBuyListItemSchema.safeParse({ id: "temporary" }).success).toBe(false);
    expect(RenameBuyListItemSchema.safeParse({ id: "bad", name: "Milk" }).success).toBe(false);
    expect(CreateBuyListItemSchema.safeParse({ name: "Milk", price: 1 }).success).toBe(false);
    expect(DeleteBuyListItemSchema.safeParse({ id, name: "Milk" }).success).toBe(false);
  });
});
