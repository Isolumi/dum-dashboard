import { z } from "zod";

import {
  TodoDueDateSchema,
  TodoSectionSchema,
  TodoStatusFilterSchema,
} from "#/routes/todos/todo.schemas";

const TodoInputNameSchema = z.string().trim().min(1).max(200);
const TodoSnapshotNameSchema = z
  .string()
  .min(1)
  .max(200)
  .refine((name) => name.trim().length > 0, { message: "Todo name cannot be blank" });
const TodoStatusSchema = z.enum(["not_started", "started", "complete"] as const);

export const ListTodosQuerySchema = z.strictObject({
  query: z.string().trim().min(1).max(100).optional(),
  section: TodoSectionSchema.optional(),
  status: TodoStatusFilterSchema.default("incomplete"),
  limit: z.coerce.number().int().min(1).max(50).default(50),
});

export const CreateToolTodoSchema = z.strictObject({
  name: TodoInputNameSchema,
  status: TodoStatusSchema.default("not_started"),
  due_date: TodoDueDateSchema.nullable().optional(),
  due_date_has_time: z.boolean().optional(),
});

export const UpdateToolTodoSchema = z
  .strictObject({
    name: TodoInputNameSchema.optional(),
    status: TodoStatusSchema.optional(),
    due_date: TodoDueDateSchema.nullable().optional(),
    due_date_has_time: z.boolean().optional(),
  })
  .refine((fields) => Object.values(fields).some((value) => value !== undefined), {
    message: "At least one Todo field is required",
  });

export const MoveToolTodoSchema = z.strictObject({
  section: TodoSectionSchema,
});

export const DeleteToolTodoSchema = z
  .strictObject({
    id: z.string().uuid(),
    name: TodoSnapshotNameSchema,
    section: TodoSectionSchema,
    status: TodoStatusSchema,
    due_date: TodoDueDateSchema.nullable(),
    due_date_has_time: z.boolean(),
    sort_order: z.number().int().nonnegative(),
    today_date: z.string().date().nullable(),
    today_sort_order: z.number().int().nonnegative().nullable(),
    created_at: z.string().datetime({ offset: true }),
  })
  .superRefine((snapshot, context) => {
    if (snapshot.section === "today" && snapshot.today_date === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Today Todo snapshot requires a Today date",
        path: ["today_date"],
      });
    }
    if (snapshot.section !== "today" && snapshot.today_date !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Priority Todo snapshot cannot have a Today date",
        path: ["today_date"],
      });
    }
  });
