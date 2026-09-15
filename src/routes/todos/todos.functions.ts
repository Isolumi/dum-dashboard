import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";

import type { Todo } from "#/lib/database.types";
import { assertSameOrigin, getOwnerUser, noStore } from "#/lib/server-auth";
import {
  createTodoRecord,
  deleteTodoRecord,
  getTodoRecord,
  listTodoRecords,
  moveTodoRecord,
  reorderTodoRecords,
  updateTodoRecord,
} from "./todo.domain";
import {
  CreateTodoInputSchema,
  DeleteTodoInputSchema,
  GetTodoInputSchema,
  MoveTodoInputSchema,
  ReorderTodosInputSchema,
  UpdateTodoInputSchema,
} from "./todo.schemas";

export * from "./todo.schemas";

export function assertTodoMutationRequest(): void {
  assertSameOrigin();
}

export const getTodos = createServerFn({ method: "POST" }).handler(async (): Promise<Todo[]> => {
  noStore();
  getOwnerUser();
  return await listTodoRecords({ limit: Number.POSITIVE_INFINITY, status: "all" });
});

export const getTodo = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(GetTodoInputSchema))
  .handler(async ({ data }): Promise<Todo> => {
    noStore();
    getOwnerUser();
    return await getTodoRecord(data.id);
  });

export const createTodo = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(CreateTodoInputSchema))
  .handler(async ({ data }): Promise<Todo> => {
    noStore();
    assertTodoMutationRequest();
    return await createTodoRecord(data);
  });

export const updateTodo = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(UpdateTodoInputSchema))
  .handler(async ({ data }): Promise<Todo> => {
    noStore();
    assertTodoMutationRequest();
    return await updateTodoRecord(data);
  });

export const deleteTodo = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(DeleteTodoInputSchema))
  .handler(async ({ data }): Promise<void> => {
    noStore();
    assertTodoMutationRequest();
    await deleteTodoRecord(data.id);
  });

export const reorderTodos = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(ReorderTodosInputSchema))
  .handler(async ({ data }): Promise<void> => {
    noStore();
    assertTodoMutationRequest();
    await reorderTodoRecords(data);
  });

export const moveTodo = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(MoveTodoInputSchema))
  .handler(async ({ data }): Promise<void> => {
    noStore();
    assertTodoMutationRequest();
    await moveTodoRecord(data);
  });
