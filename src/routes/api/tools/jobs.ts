import { createFileRoute } from "@tanstack/react-router";

import { requireServerEnv } from "#/lib/runtime-env";
import { saveJobRecord } from "#/routes/jobs/job.domain";
import { createJobToolHandlers } from "./jobs/-handlers";

const handlers = createJobToolHandlers({
  token: requireServerEnv("DUMQ_TOOL_TOKEN"),
  saveJobRecord,
});

export const Route = createFileRoute("/api/tools/jobs")({
  server: {
    handlers: {
      POST: ({ request }) => handlers.create(request),
    },
  },
});
