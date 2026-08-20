import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import {
  createMoniesExpenseRequest,
  deleteMoniesExpenseRequest,
  listMoniesExpenses,
  listMoniesUsers,
  restoreMoniesExpenseRequest,
  updateMoniesExpenseRequest,
} from "#/lib/monies-api";
import { assertSameOrigin, getOwnerUser, noStore } from "#/lib/server-auth";
import type {
  CreateMoniesExpenseInput,
  MoniesExpense,
  MoniesExpensePage,
  MoniesUser,
  UpdateMoniesExpenseFields,
} from "#/routes/_layout/monies/-monies.types";

const MONEY_PATTERN = /^(?:0|[1-9]\d{0,9})\.\d{2}$/;
const UuidSchema = z.string().uuid();
const ItemSchema = z.string().min(1).max(200);
const PositiveMoneySchema = z
  .string()
  .regex(MONEY_PATTERN)
  .refine((value) => value !== "0.00", "must be greater than zero");
const PurchaseDateSchema = z
  .string()
  .datetime({ offset: true })
  .refine((value) => /[+-]\d{2}:\d{2}$/.test(value), "must include a time-zone offset");

function moneyToCents(value: string): bigint {
  const [whole, fraction] = value.split(".");
  if (whole === undefined || fraction === undefined) throw new Error("Invalid money value");
  return BigInt(whole) * 100n + BigInt(fraction);
}

function addOwedAmountConstraint(
  value: { amount: string; owedAmount: string },
  context: z.RefinementCtx,
): void {
  if (!MONEY_PATTERN.test(value.amount) || !MONEY_PATTERN.test(value.owedAmount)) return;

  if (moneyToCents(value.owedAmount) > moneyToCents(value.amount)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["owedAmount"],
      message: "cannot exceed amount",
    });
  }
}

export const ListMoniesExpensesInputSchema = z
  .object({
    page: z.number().int().min(1).max(10_000).default(1),
    pageSize: z.number().int().min(1).max(100).default(50),
  })
  .strict();

export const CreateMoniesExpenseInputSchema: z.ZodType<CreateMoniesExpenseInput> = z
  .object({
    item: ItemSchema,
    amount: PositiveMoneySchema,
    owedAmount: PositiveMoneySchema,
    payerId: UuidSchema,
    purchaseDate: PurchaseDateSchema,
    idempotencyKey: z.string().min(1).max(128),
  })
  .strict()
  .superRefine(addOwedAmountConstraint);

const UpdateMoniesExpenseFieldsSchema = z
  .object({
    item: ItemSchema.optional(),
    amount: PositiveMoneySchema.optional(),
    owedAmount: PositiveMoneySchema.optional(),
    payerId: UuidSchema.optional(),
    purchaseDate: PurchaseDateSchema.optional(),
  })
  .strict();

export const UpdateMoniesExpenseInputSchema = z
  .object({
    id: UuidSchema,
    item: ItemSchema.optional(),
    amount: PositiveMoneySchema.optional(),
    owedAmount: PositiveMoneySchema.optional(),
    payerId: UuidSchema.optional(),
    purchaseDate: PurchaseDateSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const fields: UpdateMoniesExpenseFields = {
      item: value.item,
      amount: value.amount,
      owedAmount: value.owedAmount,
      payerId: value.payerId,
      purchaseDate: value.purchaseDate,
    };
    const suppliedFields = Object.values(fields).filter((field) => field !== undefined);
    if (suppliedFields.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "at least one mutable field is required",
      });
    }

    const hasAmount = value.amount !== undefined;
    const hasOwedAmount = value.owedAmount !== undefined;
    if (hasAmount !== hasOwedAmount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [hasAmount ? "owedAmount" : "amount"],
        message: "amount and owedAmount must be supplied together",
      });
    } else if (hasAmount && hasOwedAmount) {
      addOwedAmountConstraint(value as { amount: string; owedAmount: string }, context);
    }
  });

export const MoniesExpenseIdInputSchema = z.object({ id: UuidSchema }).strict();

function assertMoniesReadRequest(): void {
  noStore();
  getOwnerUser();
}

function assertMoniesMutationRequest(): void {
  getOwnerUser();
  assertSameOrigin();
}

export const getMoniesUsers = createServerFn({ method: "GET" }).handler(
  async (): Promise<MoniesUser[]> => {
    assertMoniesReadRequest();
    return listMoniesUsers();
  },
);

export const getMoniesExpenses = createServerFn({ method: "GET" })
  .inputValidator(zodValidator(ListMoniesExpensesInputSchema))
  .handler(async ({ data }): Promise<MoniesExpensePage> => {
    assertMoniesReadRequest();
    return listMoniesExpenses({ ...data, deleted: false });
  });

export const getDeletedMoniesExpenses = createServerFn({ method: "GET" })
  .inputValidator(zodValidator(ListMoniesExpensesInputSchema))
  .handler(async ({ data }): Promise<MoniesExpensePage> => {
    assertMoniesReadRequest();
    return listMoniesExpenses({ ...data, deleted: true });
  });

export const createMoniesExpense = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(CreateMoniesExpenseInputSchema))
  .handler(async ({ data }): Promise<MoniesExpense> => {
    assertMoniesMutationRequest();
    return createMoniesExpenseRequest(data);
  });

export const updateMoniesExpense = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(UpdateMoniesExpenseInputSchema))
  .handler(async ({ data }): Promise<MoniesExpense> => {
    assertMoniesMutationRequest();
    const { id, ...fields } = data;
    return updateMoniesExpenseRequest(id, UpdateMoniesExpenseFieldsSchema.parse(fields));
  });

export const deleteMoniesExpense = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(MoniesExpenseIdInputSchema))
  .handler(async ({ data }): Promise<MoniesExpense> => {
    assertMoniesMutationRequest();
    return deleteMoniesExpenseRequest(data.id);
  });

export const restoreMoniesExpense = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(MoniesExpenseIdInputSchema))
  .handler(async ({ data }): Promise<MoniesExpense> => {
    assertMoniesMutationRequest();
    return restoreMoniesExpenseRequest(data.id);
  });
