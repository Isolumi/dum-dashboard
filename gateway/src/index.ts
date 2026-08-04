import { serve } from "@hono/node-server";
import { createGateway } from "./app";

const app = createGateway();
const requestedPort = Number(process.env.PORT ?? "8080");
const port = Number.isFinite(requestedPort) && requestedPort > 0 ? requestedPort : 8080;

serve({ fetch: app.fetch, port });
