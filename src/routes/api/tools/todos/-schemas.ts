import { z } from "zod";

import {
  TodoDueDateSchema,
  TodoSectionSchema,
  TodoStatusFilterSchema,
} from "#/routes/todos/todo.schemas";

const TodoNameSchema = z.string().trim().min(1).max(200);
const TodoStatusSchema = z.enum(["not_started", "started", "complete"] as const);

export const ListTodosQuerySchema = z.strictObject({
  query: z.string().trim().min(1).max(100).optional(),
  section: TodoSectionSchema.optional(),
  status: TodoStatusFilterSchema.default("incomplete"),
  limit: z.coerce.number().int().min(1).max(50).default(50),
});

export const CreateToolTodoSchema = z.strictObject({
  name: TodoNameSchema,
  status: TodoStatusSchema.default("not_started"),
  due_date: TodoDueDateSchema.nullable().optional(),
  due_date_has_time: z.boolean().optional(),
});

export const UpdateToolTodoSchema = z
  .strictObject({
    name: TodoNameSchema.optional(),
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
