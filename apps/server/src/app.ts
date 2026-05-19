import {
  buildPrompt,
  ChatCompletionRequestSchema,
  createChatCompletionResponse,
  createOpenAiError,
  formatSseDone,
  type RunnerClient,
  runnerEventToSse,
} from "@cursor-proxy/shared"
import { swaggerUI } from "@hono/swagger-ui"
import { Scalar } from "@scalar/hono-api-reference"
import { Hono } from "hono"
import { createLogger } from "./logger.js"
import { createOpenApiDocument } from "./openapi.js"
import { createRemoteRunnerClient } from "./remote-runner.js"

export type ServerBindings = {
  readonly CURSOR_RUNNER_URL?: string
  readonly CURSOR_RUNNER_TOKEN?: string
}

export type AppOptions = {
  readonly runner?: RunnerClient
  readonly now?: () => number
  readonly id?: () => string
}

const log = createLogger("server")

function resolveRunner(env: ServerBindings, explicit: RunnerClient | undefined): RunnerClient {
  if (explicit !== undefined) {
    return explicit
  }
  if (env.CURSOR_RUNNER_URL !== undefined && env.CURSOR_RUNNER_URL.length > 0) {
    const config = {
      url: env.CURSOR_RUNNER_URL,
    }
    return env.CURSOR_RUNNER_TOKEN === undefined
      ? createRemoteRunnerClient(config)
      : createRemoteRunnerClient({ ...config, token: env.CURSOR_RUNNER_TOKEN })
  }
  throw new Error("CURSOR_RUNNER_URL is required unless an in-process runner is configured")
}

function jsonHeaders(): HeadersInit {
  return { "Content-Type": "application/json" }
}

export function createApp(options: AppOptions = {}) {
  const app = new Hono<{ Bindings: ServerBindings }>()
  const openapi = createOpenApiDocument()

  app.get("/", (context) => context.redirect("/scalar"))
  app.get("/health", (context) =>
    context.json({
      ok: true,
      service: "cursor-proxy",
    }),
  )
  app.get("/openapi.json", (context) => context.json(openapi))
  app.get("/scalar", Scalar({ url: "/openapi.json", pageTitle: "Cursor Proxy API" }))
  app.get("/swagger", swaggerUI({ url: "/openapi.json", title: "Cursor Proxy Swagger" }))
  app.get("/v1/models", (context) =>
    context.json({
      object: "list",
      data: [
        {
          id: "cursor-acp/auto",
          object: "model",
          created: 0,
          owned_by: "cursor",
        },
      ],
    }),
  )

  app.post("/v1/chat/completions", async (context) => {
    const requestId = options.id?.() ?? crypto.randomUUID()
    const created = Math.floor((options.now?.() ?? Date.now()) / 1000)
    const json = await context.req.json().catch(() => undefined)
    const parsed = ChatCompletionRequestSchema.safeParse(json)
    if (!parsed.success) {
      log.warn("Rejected malformed chat completion request", { requestId })
      return context.json(createOpenAiError("Malformed chat completion request", 400), 400)
    }

    const body = parsed.data
    const runner = resolveRunner(context.env, options.runner)
    const prompt = buildPrompt(body)
    const runnerRequest = {
      model: body.model,
      prompt,
      stream: body.stream === true,
    }
    log.info("Chat completion request accepted", {
      requestId,
      model: body.model,
      stream: body.stream === true,
      messageCount: body.messages.length,
    })

    if (body.stream !== true) {
      const completion = await runner.complete(runnerRequest)
      return new Response(
        JSON.stringify(
          createChatCompletionResponse({
            id: requestId,
            created,
            model: body.model,
            content: completion.content,
            usage: completion.usage,
          }),
        ),
        { status: 200, headers: jsonHeaders() },
      )
    }

    const source = await runner.stream(runnerRequest)
    const reader = source.getReader()
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        for (;;) {
          const read = await reader.read()
          if (read.done) {
            break
          }
          controller.enqueue(
            encoder.encode(
              runnerEventToSse({
                event: read.value,
                id: requestId,
                created,
                model: body.model,
              }),
            ),
          )
        }
        controller.enqueue(encoder.encode(formatSseDone()))
        controller.close()
      },
    })

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    })
  })

  app.notFound((context) =>
    context.json(createOpenAiError(`Unsupported path: ${context.req.path}`, 404), 404),
  )

  return app
}
