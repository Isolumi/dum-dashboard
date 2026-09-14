import { createFileRoute } from "@tanstack/react-router";

import { requireServerEnv } from "#/lib/runtime-env";
import * as todoDomain from "#/routes/todos/todo.domain";
import { createTodoToolHandlers } from "./todos/-handlers";

const handlers = createTodoToolHandlers({
  token: requireServerEnv("DUMQ_TOOL_TOKEN"),
  domain: todoDomain,
});

export const Route = createFileRoute("/api/tools/todos/$id")({
  server: {
    handlers: {
      DELETE: ({ request, params }) => handlers.delete(request, params.id),
      GET: ({ request, params }) => handlers.get(request, params.id),
      PATCH: ({ request, params }) => handlers.update(request, params.id),
    },
  },
});
