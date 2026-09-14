import type { z } from "zod";

import type { Todo } from "#/lib/database.types";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import {
  CreateTodoSchema,
  MoveTodoSchema,
  ReorderTodosSchema,
  TODO_COLUMNS,
  type TodoListFilters,
  type TodoSection,
  UpdateTodoSchema,
  normalizeCreateTodoFields,
  normalizeUpdateTodoFields,
} from "./todo.schemas";

export type TodoDomainErrorCode = "not_found" | "conflict" | "database_unavailable";

export class TodoDomainError extends Error {
  constructor(public readonly code: TodoDomainErrorCode) {
    super(
      code === "not_found"
        ? "Todo not found"
        : code === "conflict"
          ? "Todo changed; retry the request"
          : "Todo service unavailable",
    );
    this.name = "TodoDomainError";
  }
}

type DatabaseError = {
  code?: string;
};

function throwDatabaseError(error: DatabaseError): never {
  if (error.code === "40001") throw new TodoDomainError("conflict");
  if (error.code === "P0002") throw new TodoDomainError("not_found");
  throw new TodoDomainError("database_unavailable");
}

function requireTodo(todo: Todo | null): Todo {
  if (!todo) throw new TodoDomainError("not_found");
  return todo;
}

export async function listTodoRecords(filters: TodoListFilters = {}): Promise<Todo[]> {
  const admin = getSupabaseAdmin();
  let query = admin.from("todos").select(TODO_COLUMNS);

  const status = filters.status ?? "incomplete";
  if (status === "incomplete") query = query.neq("status", "complete");
  if (status === "complete") query = query.eq("status", "complete");

  if (filters.section === "today") {
    query = query.not("today_date", "is", null);
  } else if (filters.section) {
    query = query.is("today_date", null).eq("priority", filters.section);
  }

  const nameQuery = filters.query?.trim().slice(0, 100);
  if (nameQuery) query = query.ilike("name", `%${nameQuery}%`);

  const orderedQuery = query.order("sort_order", { ascending: true });
  const result =
    filters.limit === Number.POSITIVE_INFINITY
      ? await orderedQuery
      : await orderedQuery.limit(Math.min(Math.max(Math.trunc(filters.limit ?? 50), 1), 50));
  const { data, error } = result;
  if (error) throwDatabaseError(error);
  return data ?? [];
}

export async function getTodoRecord(id: string): Promise<Todo> {
  const { data, error } = await getSupabaseAdmin()
    .from("todos")
    .select(TODO_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throwDatabaseError(error);
  return requireTodo(data);
}

export async function createTodoRecord(input: z.infer<typeof CreateTodoSchema>): Promise<Todo> {
  const admin = getSupabaseAdmin();
  const todoFields = normalizeCreateTodoFields(input);
  const { data: maxRow, error: maxError } = await admin
    .from("todos")
    .select("sort_order")
    .eq("priority", todoFields.priority)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxError) throwDatabaseError(maxError);

  const sort_order = maxRow ? maxRow.sort_order + 1 : 0;
  const { data, error } = await admin
    .from("todos")
    .insert({ ...todoFields, sort_order })
    .select(TODO_COLUMNS)
    .single();
  if (error) throwDatabaseError(error);
  return data;
}

export async function updateTodoRecord(input: z.infer<typeof UpdateTodoSchema>): Promise<Todo> {
  const { id, ...fields } = normalizeUpdateTodoFields(input);
  const { data, error } = await getSupabaseAdmin()
    .from("todos")
    .update(fields)
    .eq("id", id)
    .select(TODO_COLUMNS)
    .maybeSingle();
  if (error) throwDatabaseError(error);
  return requireTodo(data);
}

export async function deleteTodoRecord(id: string): Promise<Todo> {
  const { data, error } = await getSupabaseAdmin()
    .from("todos")
    .delete()
    .eq("id", id)
    .select(TODO_COLUMNS)
    .maybeSingle();
  if (error) throwDatabaseError(error);
  return requireTodo(data);
}

export async function reorderTodoRecords(input: z.infer<typeof ReorderTodosSchema>): Promise<void> {
  const { error } = await getSupabaseAdmin().rpc("reorder_todo_section_atomically", {
    p_section: input.section,
    p_expected_ids: input.expected_ids,
    p_ordered_ids: input.ordered_ids,
  });
  if (error) throwDatabaseError(error);
}

export async function moveTodoRecord(input: z.infer<typeof MoveTodoSchema>): Promise<void> {
  const { error } = await getSupabaseAdmin().rpc("move_todo_between_sections", {
    p_todo_id: input.id,
    p_target_section: input.target_section,
    p_source_ids: input.source_ids,
    p_target_ids: input.target_ids,
  });
  if (error) throwDatabaseError(error);
}

function todoSection(todo: Todo): TodoSection {
  return todo.today_date !== null ? "today" : todo.priority;
}

function compareTodoIds(left: Todo, right: Todo): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function compareSectionTodos(section: TodoSection, left: Todo, right: Todo): number {
  if (section !== "today") {
    return left.sort_order - right.sort_order || compareTodoIds(left, right);
  }

  if (left.today_sort_order === null) {
    return right.today_sort_order === null ? compareTodoIds(left, right) : 1;
  }
  if (right.today_sort_order === null) return -1;
  return left.today_sort_order - right.today_sort_order || compareTodoIds(left, right);
}

function todoIdsInSection(todos: Todo[], section: TodoSection, omittedId?: string): string[] {
  return todos
    .filter((todo) => todo.id !== omittedId && todoSection(todo) === section)
    .sort((left, right) => compareSectionTodos(section, left, right))
    .map((todo) => todo.id);
}

async function listAllTodoRecords(): Promise<Todo[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("todos")
    .select(TODO_COLUMNS)
    .order("sort_order", { ascending: true });
  if (error) throwDatabaseError(error);
  return data ?? [];
}

export async function moveTodoRecordToSectionEnd(id: string, target: TodoSection): Promise<Todo> {
  const todos = await listAllTodoRecords();
  const current = todos.find((todo) => todo.id === id);
  if (!current) throw new TodoDomainError("not_found");

  const source = todoSection(current);
  if (source === target) return current;

  const source_ids = todoIdsInSection(todos, source, id);
  const target_ids = [...todoIdsInSection(todos, target), id];

  await moveTodoRecord({ id, target_section: target, source_ids, target_ids });
  return await getTodoRecord(id);
}
