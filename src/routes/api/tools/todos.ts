import { createFileRoute } from "@tanstack/react-router";

import { requireServerEnv } from "#/lib/runtime-env";
import * as todoDomain from "#/routes/todos/todo.domain";
import { createTodoToolHandlers } from "./todos/-handlers";

const handlers = createTodoToolHandlers({
  token: requireServerEnv("DUMQ_TOOL_TOKEN"),
  domain: todoDomain,
});

export const Route = createFileRoute("/api/tools/todos")({
  server: {
    handlers: {
      GET: ({ request }) => handlers.list(request),
      POST: ({ request }) => handlers.create(request),
    },
  },
});
