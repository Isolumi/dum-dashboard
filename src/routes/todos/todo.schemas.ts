import { z } from "zod";

export const TODO_COLUMNS =
  "id,name,status,priority,due_date,due_date_has_time,sort_order,today_date,today_sort_order,created_at" as const;

export const TodoDueDateSchema = z.union([
  z.string().date(),
  z.string().datetime({ offset: true }),
]);
export const TodoSectionSchema = z.enum(["today", "high", "low"]);
export const TodoStatusFilterSchema = z.enum(["incomplete", "complete", "all"]);
export type TodoSection = z.infer<typeof TodoSectionSchema>;
export type TodoStatusFilter = z.infer<typeof TodoStatusFilterSchema>;

export type TodoListFilters = {
  query?: string;
  section?: TodoSection;
  status?: TodoStatusFilter;
  limit?: number;
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function inferDueDateHasTime(value: string | null | undefined): boolean {
  return value ? !DATE_ONLY_PATTERN.test(value) : false;
}

export const CreateTodoSchema = z.object({
  name: z.string().trim().min(1).max(200),
  priority: z.enum(["high", "low"] as const).default("low"),
  status: z.enum(["not_started", "started", "complete"] as const).default("not_started"),
  due_date: TodoDueDateSchema.nullable().optional(),
  due_date_has_time: z.boolean().optional(),
});

export const UpdateTodoSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  priority: z.enum(["high", "low"] as const).optional(),
  status: z.enum(["not_started", "started", "complete"] as const).optional(),
  due_date: TodoDueDateSchema.nullable().optional(),
  due_date_has_time: z.boolean().optional(),
  sort_order: z.number().int().nonnegative().optional(),
});

const TodoIdListSchema = z.array(z.string().uuid()).max(200);

export const ReorderTodosSchema = z
  .object({
    section: TodoSectionSchema,
    expected_ids: TodoIdListSchema.min(1),
    ordered_ids: TodoIdListSchema.min(1),
  })
  .strict()
  .superRefine((data, context) => {
    if (new Set(data.expected_ids).size !== data.expected_ids.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expected Todo ids must be unique",
        path: ["expected_ids"],
      });
    }
    if (new Set(data.ordered_ids).size !== data.ordered_ids.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ordered Todo ids must be unique",
        path: ["ordered_ids"],
      });
    }
    const expectedIds = new Set(data.expected_ids);
    if (
      data.expected_ids.length !== data.ordered_ids.length ||
      data.ordered_ids.some((id) => !expectedIds.has(id))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expected and ordered Todo ids must contain the same Todos",
        path: ["ordered_ids"],
      });
    }
  });

export const MoveTodoSchema = z
  .object({
    id: z.string().uuid(),
    target_section: TodoSectionSchema,
    source_ids: TodoIdListSchema,
    target_ids: TodoIdListSchema.min(1),
  })
  .strict()
  .superRefine((data, context) => {
    if (new Set(data.source_ids).size !== data.source_ids.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Source Todo ids must be unique",
        path: ["source_ids"],
      });
    }
    if (new Set(data.target_ids).size !== data.target_ids.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Target Todo ids must be unique",
        path: ["target_ids"],
      });
    }
    if (data.source_ids.includes(data.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Moved Todo cannot remain in the source order",
        path: ["source_ids"],
      });
    }
    if (!data.target_ids.includes(data.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Moved Todo must be in the target order",
        path: ["target_ids"],
      });
    }
    const targetIds = new Set(data.target_ids);
    if (data.source_ids.some((id) => targetIds.has(id))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Source and target Todo ids must not overlap",
        path: ["source_ids"],
      });
    }
  });

export const DeleteTodoSchema = z.object({
  id: z.string().uuid(),
});

export const GetTodoSchema = z.object({
  id: z.string().uuid(),
});

export const GetTodosInputSchema = z.object({}).strict();
export const GetTodoInputSchema = GetTodoSchema.strict();
export const CreateTodoInputSchema = CreateTodoSchema.strict();
export const UpdateTodoInputSchema = UpdateTodoSchema.strict();
export const DeleteTodoInputSchema = DeleteTodoSchema.strict();
export const ReorderTodosInputSchema = ReorderTodosSchema;
export const MoveTodoInputSchema = MoveTodoSchema;

export function normalizeCreateTodoFields(data: z.infer<typeof CreateTodoSchema>) {
  return {
    ...data,
    due_date_has_time:
      data.due_date == null
        ? false
        : (data.due_date_has_time ?? inferDueDateHasTime(data.due_date)),
  };
}

export function normalizeUpdateTodoFields(data: z.infer<typeof UpdateTodoSchema>) {
  const { id, ...fields } = data;
  return {
    id,
    ...(fields.due_date === undefined
      ? fields
      : {
          ...fields,
          due_date_has_time:
            fields.due_date === null
              ? false
              : (fields.due_date_has_time ?? inferDueDateHasTime(fields.due_date)),
        }),
  };
}
