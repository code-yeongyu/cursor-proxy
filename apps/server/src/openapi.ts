export function createOpenApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Cursor Proxy",
      version: "0.1.0",
      description: "OpenAI-compatible chat completions facade for Cursor CLI.",
    },
    servers: [{ url: "http://localhost:8787", description: "Local development" }],
    paths: {
      "/health": {
        get: {
          tags: ["System"],
          summary: "Health check",
          responses: {
            "200": {
              description: "Service is healthy",
            },
          },
        },
      },
      "/v1/models": {
        get: {
          tags: ["OpenAI"],
          summary: "List configured Cursor models",
          responses: {
            "200": {
              description: "Model list",
            },
          },
        },
      },
      "/v1/chat/completions": {
        post: {
          tags: ["OpenAI"],
          summary: "Create a chat completion",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["model", "messages"],
                  properties: {
                    model: { type: "string" },
                    messages: { type: "array" },
                    stream: { type: "boolean" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "OpenAI-compatible chat completion or SSE stream",
            },
            "400": {
              description: "Malformed OpenAI request",
            },
          },
        },
      },
    },
  } as const
}
