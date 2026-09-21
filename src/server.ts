import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

type NextHandler = (request: Request) => Response | Promise<Response>;

export function handleRequest(request: Request, next: NextHandler): Response | Promise<Response> {
  if (new URL(request.url).pathname === "/healthz") {
    return new Response("ok", {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  return next(request);
}

export default createServerEntry({
  fetch(request) {
    return handleRequest(request, (incomingRequest) => handler.fetch(incomingRequest));
  },
});
