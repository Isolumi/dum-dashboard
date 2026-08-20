import { createServerOnlyFn } from "@tanstack/react-start";
import { z } from "zod";

import type {
  CreateMoniesExpenseInput,
  MoniesExpense,
  MoniesExpensePage,
  MoniesSummary,
  MoniesUser,
  UpdateMoniesExpenseFields,
} from "#/routes/_layout/monies/-monies.types";
import { requireServerEnv } from "./runtime-env";

const REQUEST_TIMEOUT_MS = 5_000;
const PRODUCTION_ORIGIN = "http://monies.monies.svc.cluster.local:3333";
const LOCAL_ORIGIN_PATTERN = /^http:\/\/(?:localhost|127\.0\.0\.1):\d{1,5}\/?$/;
const MONEY_PATTERN = /^(?:0|[1-9]\d{0,9})\.\d{2}$/;

const UuidSchema = z.string().uuid();
const PositiveMoneySchema = z
  .string()
  .regex(MONEY_PATTERN)
  .refine((value) => value !== "0.00", "must be greater than zero");
const NonNegativeMoneySchema = z.string().regex(MONEY_PATTERN);
const TimestampSchema = z.string().datetime({ offset: true });
const PurchaseDateSchema = TimestampSchema.refine(
  (value) => /[+-]\d{2}:\d{2}$/.test(value),
  "must include a time-zone offset",
);

const MoniesUserSchema: z.ZodType<MoniesUser> = z
  .object({
    id: UuidSchema,
    name: z.string(),
  })
  .strict();

const MoniesExpenseSchema: z.ZodType<MoniesExpense> = z
  .object({
    id: UuidSchema,
    item: z.string().min(1).max(200),
    amount: PositiveMoneySchema,
    owedAmount: PositiveMoneySchema.nullable(),
    payer: MoniesUserSchema,
    debtor: MoniesUserSchema.nullable(),
    purchaseDate: PurchaseDateSchema,
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    deletedAt: TimestampSchema.nullable(),
  })
  .strict();

const MoniesExpensePageSchema: z.ZodType<MoniesExpensePage> = z
  .object({
    items: z.array(MoniesExpenseSchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    total: z.number().int().nonnegative(),
  })
  .strict();

const MoniesUserListSchema = z.array(MoniesUserSchema);

const MoniesSummarySchema: z.ZodType<MoniesSummary> = z
  .object({
    amount: NonNegativeMoneySchema,
    debtor: MoniesUserSchema.nullable(),
    creditor: MoniesUserSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    const isSettled = value.amount === "0.00";
    if (isSettled && (value.debtor !== null || value.creditor !== null)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "settled summary must omit users" });
    }
    if (!isSettled && (value.debtor === null || value.creditor === null)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "owed summary must include users" });
    }
  });

export class MoniesApiError extends Error {
  constructor() {
    super("Monies service unavailable");
    this.name = "MoniesApiError";
    this.stack = undefined;
  }
}

function privateBaseUrl(): URL {
  const rawBaseUrl = requireServerEnv("MONIES_API_URL");
  const isAllowedText =
    process.env.NODE_ENV === "production"
      ? rawBaseUrl === PRODUCTION_ORIGIN
      : LOCAL_ORIGIN_PATTERN.test(rawBaseUrl);
  if (!isAllowedText) throw new MoniesApiError();

  try {
    return new URL(rawBaseUrl);
  } catch {
    throw new MoniesApiError();
  }
}

interface MoniesRequestOptions<T> {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  schema: z.ZodType<T>;
  body?: unknown;
}

async function requestMonies<T>({
  method,
  path,
  schema,
  body,
}: MoniesRequestOptions<T>): Promise<T> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const url = new URL(path, privateBaseUrl());
    const token = requireServerEnv("MONIES_API_TOKEN");
    const isRead = method === "GET";
    const headers = new Headers({
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    });
    if (isRead) headers.set("Cache-Control", "no-store");
    if (body !== undefined) headers.set("Content-Type", "application/json");

    timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const response = await fetch(url, {
      method,
      headers,
      ...(isRead ? { cache: "no-store" as const } : {}),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new MoniesApiError();
    }

    return schema.parse(await response.json());
  } catch (error) {
    if (error instanceof MoniesApiError) throw error;
    throw new MoniesApiError();
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export const listMoniesUsers = createServerOnlyFn(
  async (): Promise<MoniesUser[]> =>
    requestMonies({ method: "GET", path: "/api/users", schema: MoniesUserListSchema }),
);

export const getMoniesSummary = createServerOnlyFn(
  async (): Promise<MoniesSummary> =>
    requestMonies({ method: "GET", path: "/api/summary", schema: MoniesSummarySchema }),
);

export const listMoniesExpenses = createServerOnlyFn(
  async ({
    page,
    pageSize,
    deleted,
  }: {
    page: number;
    pageSize: number;
    deleted: boolean;
  }): Promise<MoniesExpensePage> => {
    const path = deleted ? "/api/expenses/deleted" : "/api/expenses";
    const url = new URL(path, PRODUCTION_ORIGIN);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(pageSize));
    return requestMonies({
      method: "GET",
      path: `${url.pathname}${url.search}`,
      schema: MoniesExpensePageSchema,
    });
  },
);

export const createMoniesExpenseRequest = createServerOnlyFn(
  async (input: CreateMoniesExpenseInput): Promise<MoniesExpense> =>
    requestMonies({
      method: "POST",
      path: "/api/expenses",
      schema: MoniesExpenseSchema,
      body: input,
    }),
);

export const updateMoniesExpenseRequest = createServerOnlyFn(
  async (id: string, input: UpdateMoniesExpenseFields): Promise<MoniesExpense> =>
    requestMonies({
      method: "PATCH",
      path: `/api/expenses/${encodeURIComponent(id)}`,
      schema: MoniesExpenseSchema,
      body: input,
    }),
);

export const deleteMoniesExpenseRequest = createServerOnlyFn(
  async (id: string): Promise<MoniesExpense> =>
    requestMonies({
      method: "DELETE",
      path: `/api/expenses/${encodeURIComponent(id)}`,
      schema: MoniesExpenseSchema,
    }),
);

export const restoreMoniesExpenseRequest = createServerOnlyFn(
  async (id: string): Promise<MoniesExpense> =>
    requestMonies({
      method: "POST",
      path: `/api/expenses/${encodeURIComponent(id)}/restore`,
      schema: MoniesExpenseSchema,
    }),
);
